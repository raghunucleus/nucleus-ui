import type { RichTextValue } from '@/components/ui/lazy-rich-text-editor'
import { apiFetch, apiUpload } from './api'
import { getEmployeeAccessToken, withEmployeeAuth } from './employee-auth'
import type {
  ExportFormat,
  FkOption,
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

/** A drive's lifecycle state — freely set from the detail screen. */
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

export interface DriveDetail extends DriveScopedRead {
  id: number
  drive_name: string
  profile_type: DriveProfileType
  status: DriveStatus
  company: { id: number; name: string; logo_url: string | null }
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

export function listDrives(query: DriveListQuery): Promise<DriveListResponse> {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v))
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
