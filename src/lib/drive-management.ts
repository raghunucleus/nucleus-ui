import type { RichTextValue } from '@/components/ui/lazy-rich-text-editor'
import { apiFetch, apiUpload } from './api'
import { getEmployeeAccessToken, withEmployeeAuth } from './employee-auth'
import type {
  ExportFormat,
  FkOption,
  ParsedNql,
  SearchGroup,
  SearchMeta,
  StudentSearchApi,
  StudentSearchBody,
  StudentSearchResult,
} from './student-search'

/**
 * Data layer for placement drive management — the drive classifier lookups
 * behind the Drive Attributes screen, and the drives themselves.
 */

const ATTR_ROOT = '/employee/drive-management/attributes'
const DRIVES_ROOT = '/employee/drive-management/drives'

export const DRIVE_LOOKUP_KINDS = [
  { key: 'designations', label: 'Designations' },
  { key: 'job-locations', label: 'Job locations' },
  { key: 'offer-types', label: 'Offer types' },
  { key: 'placement-categories', label: 'Placement categories' },
] as const

export type DriveLookupKind = (typeof DRIVE_LOOKUP_KINDS)[number]['key']

export interface DriveLookupValue {
  id: number
  name: string
  is_active: boolean
  sort_order: number
  /** offer-types only — absent on the other kinds. */
  is_internship?: boolean
  is_full_time?: boolean
  /**
   * placement-categories only — absent on the other kinds. Strings, not
   * numbers: Postgres serialises `numeric` as a string ("5.00"). null is an
   * open-ended bound, so (null, "5.00") reads as "<5L".
   */
  min_lpa?: string | null
  max_lpa?: string | null
}

/** The flags the server only honours for `offer-types`. */
export interface DriveOfferFlags {
  is_internship?: boolean
  is_full_time?: boolean
}

/**
 * The salary bounds the server only honours for `placement-categories`. Sent as
 * numbers; null clears a bound to open-ended.
 */
export interface DriveSalaryRange {
  min_lpa?: number | null
  max_lpa?: number | null
}

export function listDriveAttributes(
  kind: DriveLookupKind,
): Promise<DriveLookupValue[]> {
  return withEmployeeAuth((token) => apiFetch(`${ATTR_ROOT}/${kind}`, { token }))
}

export function createDriveAttribute(
  kind: DriveLookupKind,
  body: { name: string; sort_order?: number } & DriveOfferFlags &
    DriveSalaryRange,
): Promise<DriveLookupValue> {
  return withEmployeeAuth((token) =>
    apiFetch(`${ATTR_ROOT}/${kind}`, { method: 'POST', body, token }),
  )
}

export function updateDriveAttribute(
  kind: DriveLookupKind,
  id: number,
  body: { name?: string; sort_order?: number } & DriveOfferFlags &
    DriveSalaryRange,
): Promise<DriveLookupValue> {
  return withEmployeeAuth((token) =>
    apiFetch(`${ATTR_ROOT}/${kind}/${id}`, { method: 'PATCH', body, token }),
  )
}

export function setDriveAttributeStatus(
  kind: DriveLookupKind,
  id: number,
  isActive: boolean,
): Promise<DriveLookupValue> {
  return withEmployeeAuth((token) =>
    apiFetch(`${ATTR_ROOT}/${kind}/${id}/status`, {
      method: 'PATCH',
      body: { is_active: isActive },
      token,
    }),
  )
}

// --- Drives ---------------------------------------------------------------

/** A `{ id, name }` chip as the server returns it for every lookup reference. */
export interface Chip {
  id: number
  name: string
}

/** Whether the drive hires for one designation or several. */
export type DriveProfileType = 'single' | 'multi'

/**
 * Where a switchable field's value is captured. `drive` = once for the whole
 * drive; `designation` = separately on each profile. The other side is blank —
 * the server rejects a value on the wrong side rather than picking a winner.
 */
export type DriveFieldScope = 'drive' | 'designation'

/** Whether a package is a single figure or a min–max band. */
export type DriveAmountMode = 'fixed' | 'range'

/** A drive's lifecycle state — moved through a guarded machine (see server). */
export type DriveStatus =
  | 'draft'
  | 'ready_to_publish'
  | 'published'
  | 'archived'

export const DRIVE_STATUSES: DriveStatus[] = [
  'draft',
  'ready_to_publish',
  'published',
  'archived',
]

export const DRIVE_STATUS_LABELS: Record<DriveStatus, string> = {
  draft: 'Draft',
  ready_to_publish: 'Ready to publish',
  published: 'Published',
  archived: 'Archived',
}

/**
 * Allowed lifecycle transitions, mirroring `DRIVE_STATUS_TRANSITIONS` on the
 * server. Used to restrict the status dropdown to legal next states; the server
 * is the source of truth and also enforces the preconditions (complete
 * eligibility to reach `ready_to_publish`, all students final to `archived`).
 */
export const DRIVE_STATUS_TRANSITIONS: Record<DriveStatus, DriveStatus[]> = {
  draft: ['ready_to_publish'],
  ready_to_publish: ['draft', 'published'],
  published: ['archived'],
  archived: [],
}

/** The current status plus the statuses it may legally move to. */
export function driveStatusOptions(current: DriveStatus): DriveStatus[] {
  return [current, ...DRIVE_STATUS_TRANSITIONS[current]]
}

type BadgeVariant = 'default' | 'secondary' | 'success' | 'warning' | 'muted'

/** Status → badge colour. Mirrors `requestStatusVariant` in student-requests. */
export function driveStatusVariant(status: DriveStatus): BadgeVariant {
  switch (status) {
    case 'draft':
      return 'muted'
    case 'ready_to_publish':
      return 'warning'
    case 'published':
      return 'success'
    case 'archived':
      return 'secondary'
    default:
      return 'muted'
  }
}

/** Entry-type codes, matching `students.entry_type` (fixed enum — not fetched). */
export const ENTRY_TYPE_OPTIONS: { value: number; name: string }[] = [
  { value: 1, name: 'Regular' },
  { value: 2, name: 'Lateral' },
]

/** Gender values, matching `students.gender` (fixed enum — not fetched). */
export const GENDER_OPTIONS: { value: string; name: string }[] = [
  { value: 'male', name: 'Male' },
  { value: 'female', name: 'Female' },
  { value: 'other', name: 'Other' },
]

/** A drive's eligibility. Empty arrays / null thresholds = no restriction. */
export interface DriveEligibility {
  programme_ids: number[]
  entry_types: number[]
  genders: string[]
  passout_years: number[]
  allow_backlog_history: boolean
  max_current_backlogs: number | null
  /** Xth minimum, a percentage. */
  min_tenth_percentage: number | null
  /** 12th-or-Diploma minimum, a percentage. */
  min_twelfth_or_diploma_percentage: number | null
  /** Btech minimum, a 10-point CGPA. */
  min_btech_cgpa: number | null
}

/** Options for the eligibility form's programme + passout-year pickers. */
export interface DriveEligibilityOptions {
  programmes: Chip[]
  passout_years: number[]
}

/**
 * A drive's eligibility with ids/codes resolved to human labels — the read-only
 * shape rendered on the employee Overview and the student drive view. Empty
 * arrays / null thresholds mean "no restriction on that axis";
 * `has_restrictions` is false only when the drive is open to everyone.
 */
export interface EligibilitySummary {
  programmes: string[]
  entry_types: string[]
  genders: string[]
  passout_years: number[]
  allow_backlog_history: boolean
  max_current_backlogs: number | null
  min_tenth_percentage: number | null
  min_twelfth_or_diploma_percentage: number | null
  min_btech_cgpa: number | null
  has_restrictions: boolean
}

/**
 * The switchable fields, shared by the drive and by each profile. Exactly one
 * side carries them, per the drive's `*_scope`.
 *
 * Money reads back as a string (Postgres serialises `numeric` as "6.00") but is
 * written as a number — hence the split between {@link DriveScopedRead} and
 * {@link DriveScopedWrite}.
 */
interface DriveScopedCommon {
  has_bond: boolean | null
  bond_years: number | null
  bond_desc: RichTextValue | null
  stipend_mode: DriveAmountMode | null
  ctc_mode: DriveAmountMode | null
}

export interface DriveScopedRead extends DriveScopedCommon {
  offer_type: Chip | null
  placement_categories: Chip[]
  job_locations: Chip[]
  stipend_min: string | null
  stipend_max: string | null
  ctc_min: string | null
  ctc_max: string | null
}

export interface DriveScopedWrite extends Partial<DriveScopedCommon> {
  offer_type_id?: number | null
  placement_category_ids?: number[]
  job_location_ids?: number[]
  stipend_min?: number | null
  stipend_max?: number | null
  ctc_min?: number | null
  ctc_max?: number | null
}

export interface DriveAttachment {
  id: number
  file_name: string
  content_type: string | null
  size_bytes: number | null
  /** Presigned + cached; the underlying object key never leaves the server. */
  file_url: string
  created_at: string
}

/** One designation within a drive. */
export interface DriveProfileRead extends DriveScopedRead {
  id: number
  designation: Chip
  jd: RichTextValue | null
  sort_order: number
  attachments: DriveAttachment[]
}

export interface DriveProfileWrite extends DriveScopedWrite {
  /** Present when editing an existing profile; omit to add a new one. */
  id?: number
  designation_id: number
  jd?: RichTextValue | null
  sort_order?: number
}

/** A drive as the list endpoint returns it — enough for a table row or a card. */
export interface DriveListItem {
  id: number
  drive_name: string
  profile_type: DriveProfileType
  status: DriveStatus
  company: { id: number; name: string; logo_url: string | null }
  company_categories: Chip[]
  offer_type: Chip | null
  placement_categories: Chip[]
  job_locations: Chip[]
  designations: Chip[]
  designation_count: number
  registration_end_date: string | null
  drive_date: string | null
  updated_at: string
}

/** One entry in a drive's status audit trail, oldest first. */
export interface DriveStatusChange {
  id: number
  from_status: DriveStatus | null
  to_status: DriveStatus
  actor_name: string | null
  created_at: string
}

export interface DriveDetail extends DriveScopedRead {
  id: number
  drive_name: string
  profile_type: DriveProfileType
  status: DriveStatus
  status_history: DriveStatusChange[]
  company: { id: number; name: string; website: string | null; logo_url: string | null }
  company_categories: Chip[]
  offer_type_scope: DriveFieldScope
  job_location_scope: DriveFieldScope
  placement_category_scope: DriveFieldScope
  bond_scope: DriveFieldScope
  spoc_email: string | null
  spoc_contact: string | null
  registration_end_date: string | null
  drive_date: string | null
  profiles: DriveProfileRead[]
  created_at: string
  updated_at: string
}

/** A company website as a browser-openable href (adds a scheme when missing). */
export function companyWebsiteHref(website: string): string {
  return /^https?:\/\//i.test(website) ? website : `https://${website}`
}

/** The same website trimmed to a compact display label (no scheme, no trailing slash). */
export function companyWebsiteLabel(website: string): string {
  return website.replace(/^https?:\/\//i, '').replace(/\/$/, '')
}

export interface DriveWrite extends DriveScopedWrite {
  company_id: number
  drive_name: string
  profile_type: DriveProfileType
  status?: DriveStatus
  offer_type_scope: DriveFieldScope
  job_location_scope: DriveFieldScope
  placement_category_scope: DriveFieldScope
  bond_scope: DriveFieldScope
  company_category_ids?: number[]
  spoc_email?: string | null
  spoc_contact?: string | null
  registration_end_date?: string | null
  drive_date?: string | null
  /** The COMPLETE desired set — an omitted profile is deleted server-side. */
  profiles: DriveProfileWrite[]
}

export const DRIVE_SORT_FIELDS = [
  'drive_name',
  'company_name',
  'drive_date',
  'registration_end_date',
  'created_at',
] as const
export type DriveSortField = (typeof DRIVE_SORT_FIELDS)[number]

export interface DriveListQuery {
  search?: string
  company_id?: number
  statuses?: DriveStatus[]
  company_ids?: number[]
  offer_type_ids?: number[]
  placement_category_ids?: number[]
  company_category_ids?: number[]
  sort_by?: DriveSortField
  sort_dir?: 'asc' | 'desc'
  page?: number
  limit?: number
}

export interface DriveListResponse {
  items: DriveListItem[]
  total: number
  page: number
  limit: number
}

// ---------------------------------------------------------------------------
// Analytics — the drive detail page's read-only "Analytics" tab.
// Mirrors the server's `DriveAnalytics` shape (drive-analytics.service.ts).
// ---------------------------------------------------------------------------

export interface DriveAnalyticsTotals {
  total: number
  imported: number
  invited: number
  accepted: number
  denied: number
  not_attended: number
  selected: number
  not_selected: number
  revoked: number
}

export interface DriveFunnelStage {
  key: 'imported' | 'invited' | 'accepted' | 'selected'
  label: string
  count: number
}

export interface DriveAnalyticsRates {
  invite_rate: number | null
  response_rate: number | null
  acceptance_rate: number | null
  no_show_rate: number | null
  selection_rate: number | null
  offer_yield: number | null
}

export interface DriveStatusSlice {
  status: number
  label: string
  count: number
}

export interface DriveBreakdownRow {
  label: string
  imported: number
  accepted: number
  selected: number
}

export interface DriveCgpaBandRow {
  label: string
  imported: number
  selected: number
  avg_cgpa: number | null
}

export interface DriveReasonRow {
  reason: string
  count: number
}

export interface DriveAnalytics {
  totals: DriveAnalyticsTotals
  funnel: DriveFunnelStage[]
  rates: DriveAnalyticsRates
  status_distribution: DriveStatusSlice[]
  breakdowns: {
    programme: DriveBreakdownRow[]
    gender: DriveBreakdownRow[]
    entry_type: DriveBreakdownRow[]
    passout_year: DriveBreakdownRow[]
    cgpa_band: DriveCgpaBandRow[]
  }
  cgpa: { avg_pool: number | null; avg_selected: number | null }
  response_time: {
    avg_hours: number | null
    buckets: { label: string; count: number }[]
  }
  reasons: { denied: DriveReasonRow[]; revoked: DriveReasonRow[] }
  attention: {
    not_invited: number
    awaiting_response: number
    stale_invites: number
    awaiting_outcome: number
  }
}

/** The drive's funnel, conversion rates and demographic breakdowns. */
export function getDriveAnalytics(id: number): Promise<DriveAnalytics> {
  return withEmployeeAuth((token) =>
    apiFetch(`${DRIVES_ROOT}/${id}/analytics`, { token }),
  )
}

export function listDrives(query: DriveListQuery): Promise<DriveListResponse> {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(query)) {
    if (Array.isArray(v)) {
      if (v.length) qs.set(k, v.join(','))
    } else if (v !== undefined && v !== null && v !== '') {
      qs.set(k, String(v))
    }
  }
  const suffix = qs.toString() ? `?${qs}` : ''
  return withEmployeeAuth((token) => apiFetch(`${DRIVES_ROOT}${suffix}`, { token }))
}

export function getDrive(id: number): Promise<DriveDetail> {
  return withEmployeeAuth((token) => apiFetch(`${DRIVES_ROOT}/${id}`, { token }))
}

/**
 * Companies the drive form can pick from. Served by the drives screen, not the
 * corporate-relations one, so the form works with only a drives grant.
 */
export function listDriveCompanyOptions(): Promise<Chip[]> {
  return withEmployeeAuth((token) =>
    apiFetch(`${DRIVES_ROOT}/company-options`, { token }),
  )
}

/**
 * The full company-category master list — the drive form's category options.
 * Served by the drives screen (not corporate-relations) so the form works with
 * only a drives grant; the company's own tags merely pre-fill the selection.
 */
export function listDriveCompanyCategoryOptions(): Promise<Chip[]> {
  return withEmployeeAuth((token) =>
    apiFetch(`${DRIVES_ROOT}/company-category-options`, { token }),
  )
}

/** Active offer types — the drive list's offer-type filter options. */
export function listDriveOfferTypeOptions(): Promise<Chip[]> {
  return withEmployeeAuth((token) =>
    apiFetch(`${DRIVES_ROOT}/offer-type-options`, { token }),
  )
}

/** Active placement categories — the drive list's placement-category filter options. */
export function listDrivePlacementCategoryOptions(): Promise<Chip[]> {
  return withEmployeeAuth((token) =>
    apiFetch(`${DRIVES_ROOT}/placement-category-options`, { token }),
  )
}

/** A company's logo + its own categories, to seed a new drive's form. */
export function getDriveCompanyDefaults(
  companyId: number,
): Promise<{ id: number; name: string; logo_url: string | null; categories: Chip[] }> {
  return withEmployeeAuth((token) =>
    apiFetch(`${DRIVES_ROOT}/company-defaults/${companyId}`, { token }),
  )
}

export function createDrive(body: DriveWrite): Promise<{ id: number }> {
  return withEmployeeAuth((token) =>
    apiFetch(DRIVES_ROOT, { method: 'POST', body, token }),
  )
}

export function updateDrive(
  id: number,
  body: Partial<DriveWrite>,
): Promise<{ id: number }> {
  return withEmployeeAuth((token) =>
    apiFetch(`${DRIVES_ROOT}/${id}`, { method: 'PATCH', body, token }),
  )
}

export function deleteDrive(id: number): Promise<void> {
  return withEmployeeAuth((token) =>
    apiFetch(`${DRIVES_ROOT}/${id}`, { method: 'DELETE', token }),
  )
}

/** Set a drive's lifecycle status (free transition). */
export function updateDriveStatus(
  id: number,
  status: DriveStatus,
): Promise<{ id: number }> {
  return withEmployeeAuth((token) =>
    apiFetch(`${DRIVES_ROOT}/${id}/status`, {
      method: 'PATCH',
      body: { status },
      token,
    }),
  )
}

/** Programmes + passout years for the eligibility form's pickers. */
export function listDriveEligibilityOptions(): Promise<DriveEligibilityOptions> {
  return withEmployeeAuth((token) =>
    apiFetch(`${DRIVES_ROOT}/eligibility-options`, { token }),
  )
}

/** A drive's eligibility (all-empty defaults if none saved yet). */
export function getDriveEligibility(id: number): Promise<DriveEligibility> {
  return withEmployeeAuth((token) =>
    apiFetch(`${DRIVES_ROOT}/${id}/eligibility`, { token }),
  )
}

/** A drive's eligibility, ids resolved to labels — for the read-only Overview. */
export function getDriveEligibilitySummary(
  id: number,
): Promise<EligibilitySummary> {
  return withEmployeeAuth((token) =>
    apiFetch(`${DRIVES_ROOT}/${id}/eligibility/summary`, { token }),
  )
}

/** Replace a drive's eligibility. */
export function saveDriveEligibility(
  id: number,
  body: DriveEligibility,
): Promise<{ id: number }> {
  return withEmployeeAuth((token) =>
    apiFetch(`${DRIVES_ROOT}/${id}/eligibility`, {
      method: 'PUT',
      body,
      token,
    }),
  )
}

// --- Filter tab (student search under a drive) -----------------------------

/**
 * The Filter tab's {@link StudentSearchApi}, bound to one drive's endpoints.
 * All JSON — exports are async jobs, so no blob handling is needed anywhere.
 */
export function driveStudentsSearchApi(driveId: number): StudentSearchApi {
  const root = `${DRIVES_ROOT}/${driveId}/students`
  return {
    meta: () =>
      withEmployeeAuth((token) =>
        apiFetch<SearchMeta>(`${root}/search/meta`, { token }),
      ),
    search: (body: StudentSearchBody) =>
      withEmployeeAuth((token) =>
        apiFetch<StudentSearchResult>(`${root}/search`, {
          method: 'POST',
          body,
          token,
        }),
      ),
    options: (lookup: string, q?: string) => {
      const qs = new URLSearchParams({ lookup })
      if (q) qs.set('q', q)
      return withEmployeeAuth((token) =>
        apiFetch<FkOption[]>(`${root}/search/options?${qs}`, { token }),
      )
    },
    parseNql: (nql: string) =>
      withEmployeeAuth((token) =>
        apiFetch<ParsedNql>(`${root}/search/parse-nql`, {
          method: 'POST',
          body: { nql },
          token,
        }),
      ),
    createExport: (body: StudentSearchBody, format: ExportFormat) =>
      withEmployeeAuth((token) =>
        apiFetch<{ job_id: number }>(`${root}/export`, {
          method: 'POST',
          body: { ...body, format },
          token,
        }),
      ),
  }
}

// --- Eligibility check (standalone student search, no drive) ---------------

const ELIGIBILITY_CHECK_ROOT =
  '/employee/drive-management/eligibility-check/students'

/**
 * The Eligibility check screen's {@link StudentSearchApi} — the same engine as
 * the drive Filter tab, bound to the standalone institution-wide endpoints.
 */
export function eligibilityCheckSearchApi(): StudentSearchApi {
  const root = ELIGIBILITY_CHECK_ROOT
  return {
    meta: () =>
      withEmployeeAuth((token) =>
        apiFetch<SearchMeta>(`${root}/search/meta`, { token }),
      ),
    search: (body: StudentSearchBody) =>
      withEmployeeAuth((token) =>
        apiFetch<StudentSearchResult>(`${root}/search`, {
          method: 'POST',
          body,
          token,
        }),
      ),
    options: (lookup: string, q?: string) => {
      const qs = new URLSearchParams({ lookup })
      if (q) qs.set('q', q)
      return withEmployeeAuth((token) =>
        apiFetch<FkOption[]>(`${root}/search/options?${qs}`, { token }),
      )
    },
    parseNql: (nql: string) =>
      withEmployeeAuth((token) =>
        apiFetch<ParsedNql>(`${root}/search/parse-nql`, {
          method: 'POST',
          body: { nql },
          token,
        }),
      ),
    createExport: (body: StudentSearchBody, format: ExportFormat) =>
      withEmployeeAuth((token) =>
        apiFetch<{ job_id: number }>(`${root}/export`, {
          method: 'POST',
          body: { ...body, format },
          token,
        }),
      ),
  }
}

/** The drive's eligibility translated to pre-fill filter conditions. */
export function getDriveStudentsFilterPrefill(
  driveId: number,
): Promise<{ filters: SearchGroup | null }> {
  return withEmployeeAuth((token) =>
    apiFetch(`${DRIVES_ROOT}/${driveId}/students/filter-prefill`, { token }),
  )
}

// --- Students tab (the drive's persisted shortlist + lifecycle) ------------

/**
 * The drive-student lifecycle codes — a frozen mirror of the server's
 * drive-student-status.ts. Numeric with gaps of 10 on purpose (user-confirmed)
 * so states can be inserted later without renumbering.
 */
export const DRIVE_STUDENT_STATUS = {
  IMPORTED: 10,
  INVITED: 20,
  ACCEPTED: 30,
  DENIED: 40,
  NOT_ATTENDED: 50,
  SELECTED: 60,
  NOT_SELECTED: 70,
  REVOKED: 80,
} as const

export type DriveStudentStatus =
  (typeof DRIVE_STUDENT_STATUS)[keyof typeof DRIVE_STUDENT_STATUS]

/** Statuses an employee may revoke from (Invited/Accepted). */
export const REVOCABLE_STATUSES: number[] = [
  DRIVE_STUDENT_STATUS.INVITED,
  DRIVE_STUDENT_STATUS.ACCEPTED,
]

export const DRIVE_STUDENT_STATUS_LABELS: Record<number, string> = {
  10: 'Imported',
  20: 'Invited',
  30: 'Accepted',
  40: 'Denied',
  50: 'Not Attended',
  60: 'Selected',
  70: 'Not Selected',
  80: 'Revoked',
}

export type DriveStudentBadgeVariant =
  | 'secondary'
  | 'warning'
  | 'success'
  | 'destructive'
  | 'muted'
  | 'default'

export const DRIVE_STUDENT_STATUS_BADGE: Record<
  number,
  DriveStudentBadgeVariant
> = {
  10: 'muted',
  20: 'warning',
  30: 'default',
  40: 'destructive',
  50: 'secondary',
  60: 'success',
  70: 'destructive',
  80: 'muted',
}

/** The outcomes an employee can set on an Accepted row. */
export const DRIVE_OUTCOME_OPTIONS: { value: 50 | 60 | 70; label: string }[] = [
  { value: 60, label: 'Selected' },
  { value: 70, label: 'Not Selected' },
  { value: 50, label: 'Not Attended' },
]

/** Human labels for the audit-log action verbs (the track view). */
export const DRIVE_STUDENT_ACTION_LABELS: Record<string, string> = {
  imported: 'Imported',
  invited: 'Invited',
  reminded: 'Reminded',
  accepted: 'Accepted',
  denied: 'Denied',
  outcome: 'Outcome recorded',
  revoked: 'Revoked',
  selection_updated: 'Selection updated',
}

/** One entry in a student's drive track (audit trail). */
export interface DriveStudentEvent {
  id: number
  action: string
  from_status: number | null
  to_status: number
  reason: string | null
  actor_type: string
  actor_name: string | null
  created_at: string
}

export interface DriveStudentTrack {
  student: { id: number; roll_no: string; display_name: string }
  current_status: number
  events: DriveStudentEvent[]
}

export interface DriveRevokeSummary {
  revoked: number
  skipped: number
  requested: number
}

export interface DriveRemindSummary {
  reminded: number
  skipped: number
  requested: number
}

/** Result of an import call — new rows vs. those already in the drive. */
export interface DriveStudentImportSummary {
  imported: number
  already_existed: number
  requested: number
}

/** Result of an invite call — rows moved 10 → 20 vs. skipped. */
export interface DriveInviteSummary {
  invited: number
  skipped: number
  requested: number
}

/** Result of an outcome call — rows moved 30 → outcome vs. skipped. */
export interface DriveOutcomeSummary {
  updated: number
  skipped: number
  requested: number
}

/** One imported student, as the Students tab lists them. */
export interface DriveStudentRow {
  /** Student PK — the id used to remove/invite/mark. */
  id: number
  roll_no: string
  display_name: string
  programme: string | null
  imported_at: string
  imported_by: string | null
  status: number
  invited_at: string | null
  responded_at: string | null
  rejection_reason: string | null
  outcome_marked_at: string | null
  /** Selection details — set only on Selected (60) rows marked after
   *  designation/amount capture shipped; null on legacy selections. `ctc` /
   *  `stipend` are the fixed value or range max; `_min` only for a range. */
  selected_drive_profile_id: number | null
  selected_designation: string | null
  ctc: string | null
  ctc_min: string | null
  stipend: string | null
  stipend_min: string | null
}

/** The designation + package recorded when marking Selected (one set per batch). */
export interface DriveSelectionWrite {
  drive_profile_id: number
  /** CTC in LPA — fixed value or range max. */
  ctc?: number | null
  ctc_min?: number | null
  /** Stipend in ₹/month — fixed value or range max. */
  stipend?: number | null
  stipend_min?: number | null
}

export interface DriveStudentsPage {
  rows: DriveStudentRow[]
  total: number
  page: number
  pageSize: number
  pageCount: number
}

/** Import explicit student ids (record-level or small batch). */
export function importDriveStudents(
  driveId: number,
  studentIds: number[],
): Promise<DriveStudentImportSummary> {
  return withEmployeeAuth((token) =>
    apiFetch(`${DRIVES_ROOT}/${driveId}/students/import`, {
      method: 'POST',
      body: { student_ids: studentIds },
      token,
    }),
  )
}

/** Import every student matching the current Filter query. */
export function importAllDriveStudents(
  driveId: number,
  body: StudentSearchBody,
): Promise<DriveStudentImportSummary> {
  return withEmployeeAuth((token) =>
    apiFetch(`${DRIVES_ROOT}/${driveId}/students/import-all`, {
      method: 'POST',
      body,
      token,
    }),
  )
}

/** The drive's imported students (paginated, optionally by status). */
export function listDriveStudents(
  driveId: number,
  opts: {
    page?: number
    pageSize?: number
    search?: string
    status?: number
  } = {},
): Promise<DriveStudentsPage> {
  const qs = new URLSearchParams()
  if (opts.page) qs.set('page', String(opts.page))
  if (opts.pageSize) qs.set('pageSize', String(opts.pageSize))
  if (opts.search?.trim()) qs.set('search', opts.search.trim())
  if (opts.status !== undefined) qs.set('status', String(opts.status))
  const suffix = qs.toString() ? `?${qs}` : ''
  return withEmployeeAuth((token) =>
    apiFetch(`${DRIVES_ROOT}/${driveId}/students${suffix}`, { token }),
  )
}

/** Invite explicit students (10 → 20 + notification). Drive must be published. */
export function inviteDriveStudents(
  driveId: number,
  studentIds: number[],
): Promise<DriveInviteSummary> {
  return withEmployeeAuth((token) =>
    apiFetch(`${DRIVES_ROOT}/${driveId}/students/invite`, {
      method: 'POST',
      body: { student_ids: studentIds },
      token,
    }),
  )
}

/** Invite every still-Imported student in the drive. */
export function inviteAllDriveStudents(
  driveId: number,
): Promise<DriveInviteSummary> {
  return withEmployeeAuth((token) =>
    apiFetch(`${DRIVES_ROOT}/${driveId}/students/invite-all`, {
      method: 'POST',
      token,
    }),
  )
}

/** Nudge Invited students who haven't responded (re-sends the notification). */
export function remindDriveStudents(
  driveId: number,
  studentIds: number[],
): Promise<DriveRemindSummary> {
  return withEmployeeAuth((token) =>
    apiFetch(`${DRIVES_ROOT}/${driveId}/students/remind`, {
      method: 'POST',
      body: { student_ids: studentIds },
      token,
    }),
  )
}

/** Record the drive-day outcome for Accepted students. Selected (60) also
 *  carries the designation + package, applied to every student in the batch. */
export function markDriveStudentOutcome(
  driveId: number,
  studentIds: number[],
  status: 50 | 60 | 70,
  selection?: DriveSelectionWrite,
): Promise<DriveOutcomeSummary> {
  return withEmployeeAuth((token) =>
    apiFetch(`${DRIVES_ROOT}/${driveId}/students/outcome`, {
      method: 'POST',
      body: {
        student_ids: studentIds,
        status,
        ...(status === 60 && selection ? selection : {}),
      },
      token,
    }),
  )
}

/** Edit the designation/package recorded on a Selected (60) student. */
export function updateDriveStudentSelection(
  driveId: number,
  studentId: number,
  selection: DriveSelectionWrite,
): Promise<{ updated: number }> {
  return withEmployeeAuth((token) =>
    apiFetch(`${DRIVES_ROOT}/${driveId}/students/${studentId}/selection`, {
      method: 'PATCH',
      body: selection,
      token,
    }),
  )
}

/** Revoke Invited/Accepted students (20/30 → 80) with a required reason. */
export function revokeDriveStudents(
  driveId: number,
  studentIds: number[],
  reason: string,
  notify: boolean,
): Promise<DriveRevokeSummary> {
  return withEmployeeAuth((token) =>
    apiFetch(`${DRIVES_ROOT}/${driveId}/students/revoke`, {
      method: 'POST',
      body: { student_ids: studentIds, reason, notify },
      token,
    }),
  )
}

/** One student's full audit trail in the drive (the track view). */
export function getDriveStudentTrack(
  driveId: number,
  studentId: number,
): Promise<DriveStudentTrack> {
  return withEmployeeAuth((token) =>
    apiFetch(`${DRIVES_ROOT}/${driveId}/students/${studentId}/track`, { token }),
  )
}

// --- Student detail sheet (profile + cross-drive activity) -----------------

/** One field of the employee-visible profile (registry-driven). */
export interface EmployeeProfileField {
  key: string
  label: string
  kind: string
  value: unknown
  /** Human-readable rendering (FK names, Yes/No); null when unset. */
  display: string | null
}

export interface EmployeeProfileGroup {
  key: string
  label: string
  order: number
  fields: EmployeeProfileField[]
}

/** The full profile behind a Students-tab row (government IDs excluded). */
export interface DriveStudentProfile {
  student: {
    id: number
    roll_no: string
    display_name: string
    programme: string | null
    entry_type: number
    entry_type_label: string
    admission_year: number
    admission_year_display: string
    pass_out_year: number | null
  }
  groups: EmployeeProfileGroup[]
  certifications: Array<{
    id: number
    name: string
    certificate_file_url: string | null
    created_at: string
  }>
  resume: {
    url: string | null
    external_url: string | null
    uploaded_at: string | null
  }
}

/** One row of the student's lifecycle in ANOTHER drive. */
export interface DriveStudentActivityRow {
  drive_id: number
  drive_name: string
  drive_status: DriveStatus
  drive_date: string | null
  company: { name: string; logo_url: string | null }
  offer_type: string | null
  /** The student's status in that drive (DRIVE_STUDENT_STATUS codes). */
  status: number
  imported_at: string
  invited_at: string | null
  responded_at: string | null
  outcome_marked_at: string | null
  revoked_at: string | null
  rejection_reason: string | null
  selected_designation: string | null
  ctc: string | null
  ctc_min: string | null
  stipend: string | null
  stipend_min: string | null
}

/** A drive student's full profile (membership in the drive is the access gate). */
export function getDriveStudentProfile(
  driveId: number,
  studentId: number,
): Promise<DriveStudentProfile> {
  return withEmployeeAuth((token) =>
    apiFetch(`${DRIVES_ROOT}/${driveId}/students/${studentId}/profile`, {
      token,
    }),
  )
}

/** The student's lifecycle in every OTHER drive, latest activity first. */
export function getDriveStudentActivity(
  driveId: number,
  studentId: number,
): Promise<{ items: DriveStudentActivityRow[] }> {
  return withEmployeeAuth((token) =>
    apiFetch(`${DRIVES_ROOT}/${driveId}/students/${studentId}/drive-activity`, {
      token,
    }),
  )
}

/** Hard-delete a student from the drive (Imported rows only, server-enforced). */
export function removeDriveStudent(
  driveId: number,
  studentId: number,
): Promise<void> {
  return withEmployeeAuth((token) =>
    apiFetch(`${DRIVES_ROOT}/${driveId}/students/${studentId}`, {
      method: 'DELETE',
      token,
    }),
  )
}

/**
 * Attach a JD file to a designation. Needs a saved profile id, so the form holds
 * picked files in state and calls this once the drive round-trips.
 */
export async function uploadDriveAttachment(
  profileId: number,
  file: File,
): Promise<DriveAttachment> {
  const token = getEmployeeAccessToken()
  if (!token) throw new Error('Not signed in.')
  const form = new FormData()
  form.append('file', file)
  return apiUpload(`${DRIVES_ROOT}/profiles/${profileId}/attachments`, form, token)
}

export function deleteDriveAttachment(attachmentId: number): Promise<void> {
  return withEmployeeAuth((token) =>
    apiFetch(`${DRIVES_ROOT}/attachments/${attachmentId}`, {
      method: 'DELETE',
      token,
    }),
  )
}
