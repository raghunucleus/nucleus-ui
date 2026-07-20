import { apiFetch } from './api'
import { withEmployeeAuth } from './employee-auth'
import type { DriveStudentProfile } from './drive-management'
import type { NotifyChannels } from './notify-channels'
import type {
  ExportFormat,
  FkOption,
  ParsedNql,
  SearchMeta,
  StudentSearchApi,
  StudentSearchBody,
  StudentSearchResult,
} from './student-search'

/**
 * Data layer for Placement Coordinator > Students — the coordinator's own
 * cohort, scoped server-side to the programme × batch pairs they are a profile
 * verifier for. `programme_admission_year_id` is a selector, not a grant: the
 * server re-checks it against the verifier rows on every call and 404s on a
 * miss, so an id from anywhere else simply doesn't resolve.
 */

const ROOT = '/employee/placement-coordinator/students'

/** One (programme × admission year) batch this employee verifies. */
export interface CoordinatorBatch {
  programme_admission_year_id: number
  programme_id: number
  programme_name: string
  admission_year_id: number
  admission_year: number
  admission_year_display: string
  /** "B.Tech CSE / 2022-26" — ready for the dropdown. */
  label: string
}

/** Mandatory-field completion for one student. */
export interface ProfileCompletion {
  required: number
  filled: number
  pct: number
}

/** The full profile plus the bits the drive surface strips. */
export interface CoordinatorStudentProfile extends DriveStudentProfile {
  completion: ProfileCompletion & { missing: string[] }
  placement: {
    allowed_by_dept_for_placements: boolean | null
    interested_in_placements_self: boolean | null
  }
}

/**
 * The extra fields the coordinator's search endpoint attaches to every result
 * row, beyond the registry columns. Underscore-prefixed server-side so they
 * cannot collide with an attribute key; read by the results table's row action.
 */
export interface CoordinatorSearchRowExtras {
  _allowed: boolean | null
  _interested: boolean | null
  _completion: ProfileCompletion
}

export function listCoordinatorBatches(): Promise<CoordinatorBatch[]> {
  return withEmployeeAuth((token) => apiFetch(`${ROOT}/batches`, { token }))
}

/** The toolbar's bucket switch. 'all' sends no predicate. */
export type AllowedBucket = 'all' | 'allowed' | 'not_allowed'

/**
 * The registry-driven student search bound to one verified batch and one
 * allowed-bucket.
 *
 * Must be memoised by the caller on exactly those two values: a new object per
 * render would re-fetch forever. Note that a new adapter does NOT re-boot
 * `StudentSearchPanel` (its boot is guarded internally), so changing the
 * bucket keeps the user's filters — only the next request's URL changes.
 */
export function coordinatorStudentsSearchApi(
  payId: number,
  bucket: AllowedBucket = 'all',
): StudentSearchApi {
  const batchQs = () => {
    const qs = new URLSearchParams({
      programme_admission_year_id: String(payId),
    })
    if (bucket !== 'all') qs.set('allowed', String(bucket === 'allowed'))
    return qs.toString()
  }
  return {
    meta: () =>
      withEmployeeAuth((token) =>
        apiFetch<SearchMeta>(`${ROOT}/search/meta`, { token }),
      ),
    search: (body: StudentSearchBody) =>
      withEmployeeAuth((token) =>
        apiFetch<StudentSearchResult>(`${ROOT}/search?${batchQs()}`, {
          method: 'POST',
          body,
          token,
        }),
      ),
    options: (lookup: string, q?: string) => {
      const qs = new URLSearchParams({ lookup })
      if (q) qs.set('q', q)
      return withEmployeeAuth((token) =>
        apiFetch<FkOption[]>(`${ROOT}/search/options?${qs}`, { token }),
      )
    },
    parseNql: (nql: string) =>
      withEmployeeAuth((token) =>
        apiFetch<ParsedNql>(`${ROOT}/search/parse-nql`, {
          method: 'POST',
          body: { nql },
          token,
        }),
      ),
    createExport: (body: StudentSearchBody, format: ExportFormat) =>
      withEmployeeAuth((token) =>
        apiFetch<{ job_id: number }>(`${ROOT}/export?${batchQs()}`, {
          method: 'POST',
          body: { ...body, format },
          token,
        }),
      ),
  }
}

// --- Analytics -------------------------------------------------------------

export interface CoordinatorCompanyRow {
  company_id: number
  company_name: string
  students_placed: number
  offers: number
  max_ctc: number | null
  avg_ctc: number | null
}

export interface CoordinatorOfferTypeRow {
  label: string
  is_full_time: boolean
  is_internship: boolean
  offers: number
  students: number
}

/**
 * Placement OUTCOMES for the batch — drawn from drives the students were
 * actually selected in, not from the two readiness flags (which default to
 * true for everyone and so carry no signal).
 */
export interface CoordinatorStudentsAnalytics {
  batch: CoordinatorBatch
  totals: {
    total: number
    /** Distinct students with at least one offer — not a count of offers. */
    placed: number
    placement_pct: number
    total_offers: number
    highest_ctc: number | null
    avg_ctc: number | null
  }
  companies: CoordinatorCompanyRow[]
  offer_types: CoordinatorOfferTypeRow[]
  top_performers: Array<{
    student_id: number
    roll_no: string
    display_name: string
    offers: number
    best_ctc: number | null
  }>
}

export function getCoordinatorStudentsAnalytics(
  payId: number,
): Promise<CoordinatorStudentsAnalytics> {
  return withEmployeeAuth((token) =>
    apiFetch(
      `${ROOT}/analytics?programme_admission_year_id=${payId}`,
      { token },
    ),
  )
}

// --- Per-student -----------------------------------------------------------

export function getCoordinatorStudentProfile(
  payId: number,
  studentId: number,
): Promise<CoordinatorStudentProfile> {
  return withEmployeeAuth((token) =>
    apiFetch(
      `${ROOT}/${studentId}/profile?programme_admission_year_id=${payId}`,
      { token },
    ),
  )
}

/** Requires the screen's `edit` action. */
export function setCoordinatorStudentAllowed(
  payId: number,
  studentId: number,
  allowed: boolean | null,
): Promise<{
  id: number
  roll_no: string
  display_name: string
  allowed_by_dept_for_placements: boolean | null
  interested_in_placements_self: boolean | null
  completion: ProfileCompletion
}> {
  return withEmployeeAuth((token) =>
    apiFetch(
      `${ROOT}/${studentId}/allowed?programme_admission_year_id=${payId}`,
      { token, method: 'PATCH', body: { allowed } },
    ),
  )
}

/**
 * Ask a student to update specific profile fields. `field_keys` are
 * profile-field registry keys (the same keys `completion.missing` returns) and
 * may be empty when the coordinator just wants to send a message.
 *
 * Requires the screen's `edit` action.
 */
export function notifyCoordinatorStudent(
  payId: number,
  studentId: number,
  input: { field_keys: string[]; message: string; channels: NotifyChannels },
): Promise<{ sent: true; fields: string[] }> {
  return withEmployeeAuth((token) =>
    apiFetch(
      `${ROOT}/${studentId}/notify?programme_admission_year_id=${payId}`,
      { token, method: 'POST', body: input },
    ),
  )
}
