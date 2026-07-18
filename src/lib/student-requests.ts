import { apiFetch } from './api'
import { withAuth } from './student-auth'

/**
 * Student side of the approval-requests framework: list/cancel are generic
 * (any request type), while creation is per-type (profile updates today).
 * Statuses and the per-type payload shapes mirror the server contract.
 */

export const REQUEST_STATUSES = [
  'pending',
  'sent_back',
  'approved',
  'rejected',
  'cancelled',
] as const
export type RequestStatus = (typeof REQUEST_STATUSES)[number]

/** Statuses in which the requester can still act — matches the server's set. */
export const OPEN_REQUEST_STATUSES: RequestStatus[] = ['pending', 'sent_back']

/** Per-item verdict inside a decided request (e.g. one profile field). */
export type ItemOutcome = 'approved' | 'rejected'

export type RequestType = 'profile_update'

export type BadgeVariant =
  | 'default'
  | 'secondary'
  | 'success'
  | 'warning'
  | 'destructive'
  | 'muted'

export function requestStatusVariant(status: string): BadgeVariant {
  switch (status) {
    case 'pending':
      return 'warning'
    case 'sent_back':
      // Not a failure — the requester has work to do. Reserve destructive red
      // for an actual rejection.
      return 'default'
    case 'approved':
      return 'success'
    case 'rejected':
      return 'destructive'
    case 'cancelled':
      return 'muted'
    default:
      return 'secondary'
  }
}

export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  pending: 'Pending',
  sent_back: 'Sent back',
  approved: 'Approved',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
}

// --- catalog: the Modules tree (module → request types) ---------------------

/**
 * One request type as a leaf in the Modules tree. `type` is a plain string so
 * the same tree (and `RequestModulesPanel`) can describe any module's types —
 * the requests framework's `profile_update`, the approvals inbox's leaves, etc.
 */
export interface CatalogType {
  type: string
  label: string
  order: number
}

/** A parent module and its request types, as declared by the server handlers. */
export interface CatalogModule {
  key: string
  label: string
  /** Lucide icon name — resolved by the client. */
  icon: string
  order: number
  types: CatalogType[]
}

/** Label for a request type, from the catalog; falls back to the raw key. */
export function typeLabel(
  catalog: CatalogModule[] | undefined,
  type: string,
): string {
  for (const m of catalog ?? []) {
    const t = m.types.find((x) => x.type === type)
    if (t) return t.label
  }
  return type
}

// --- full view: approvers + timeline ----------------------------------------

/**
 * Someone who can act on the request — a profile verifier of the student's
 * batch. The pool is flat: any one of them can decide, so this is "who it's
 * with", not a sequence of steps.
 */
export interface RequestApprover {
  id: number
  emp_display_name: string
  designation: string | null
  department: string | null
  is_decider: boolean
}

export type RequestEventKind =
  | 'raised'
  | 'resubmitted'
  | 'sent_back'
  | 'approved'
  | 'rejected'
  | 'cancelled'

export interface RequestEvent {
  event: RequestEventKind
  at: string
  note: string | null
  /** Name is null once the actor's row is gone; `kind` still says what it was. */
  actor: { kind: string; name: string | null } | null
  detail: { changes?: ProfileUpdateChange[] } | null
}

export const REQUEST_EVENT_LABELS: Record<RequestEventKind, string> = {
  raised: 'Raised',
  resubmitted: 'Resubmitted',
  sent_back: 'Sent back for changes',
  approved: 'Approved',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
}

/** Counts per status for the chip strip — global, never category-scoped. */
export type RequestStatusCounts = Partial<Record<RequestStatus, number>>

// --- profile_update payload (owned by the profile domain server-side) -------

/**
 * Canonical labels for every profile wire key, mirroring the server's field
 * registry — including the composite unit keys and the legacy 'email' key so
 * old V1 payloads still render with a friendly name.
 */
export const PROFILE_FIELD_LABELS: Record<string, string> = {
  full_name: 'Full name (as per Aadhaar)',
  first_name: 'First name',
  middle_name: 'Middle name',
  last_name: 'Last name',
  gender: 'Gender',
  date_of_birth: 'Date of birth',
  mobile_number: 'Mobile number',
  college_email: 'College email',
  personal_email: 'Personal email',
  blood_group: 'Blood group',
  abc_id: 'ABC ID',
  admission_year: 'Admission year',
  pass_out_year: 'Pass-out year',
  tenth_percentage: '10th mark (%)',
  twelfth_percentage: '12th mark (%)',
  diploma_percentage: 'Diploma mark (%)',
  ug_cgpa: 'UG CGPA',
  current_backlogs: 'Current backlogs',
  backlog_history: 'Backlog history',
  resume: 'Resume',
  industry_certifications: 'Industry certifications',
  parent_name: 'Parent name',
  parent_mobile: 'Parent mobile number',
  parent_email: 'Parent email',
  guardian_name: 'Guardian name',
  guardian_mobile: 'Guardian mobile number',
  guardian_email: 'Guardian email',
  home_address: 'Home address',
  home_district: 'Home district',
  home_pincode: 'Home pincode',
  home_state: 'Home state',
  home_country: 'Home country',
  aadhaar_number: 'Aadhaar number',
  pan_number: 'PAN number',
  entrance_exam_rank: 'Entrance exam rank',
  entrance_exam: 'Entrance exam',
  entrance_exam_year: 'Entrance exam year',
  year_of_gap: 'Years of gap',
  reason_of_gap: 'Reason of gap',
  tenth_board: '10th board',
  tenth_institution: '10th institution',
  tenth_year_of_pass: '10th year of pass',
  tenth_state: '10th state',
  twelfth_board: '12th board of study',
  twelfth_institution: '12th institution',
  twelfth_year_of_pass: '12th year of pass',
  twelfth_state: '12th state',
  diploma_board: 'Diploma board',
  diploma_institution: 'Diploma institution',
  diploma_year_of_pass: 'Diploma year of pass',
  diploma_specialization: 'Diploma specialization',
  diploma_state: 'Diploma state',
  allowed_by_dept_for_placements: 'Allowed by department for placements',
  interested_in_placements_self: 'Interested in placements',
  gap: 'Education gap',
  // Legacy key from the original 4-field request flow (college email is
  // read-only now, but old requests still carry it).
  email: 'Email',
}

/**
 * One requested change (payload V2). `from`/`to` are raw values — FK ids,
 * booleans, unit objects — so ALWAYS render via `display` when present and
 * fall back to `String(...)` for legacy V1 payloads (see changeFromText /
 * changeToText). Item keys are simple field keys plus the atomic units
 * 'entrance_exam' / 'gap' and the dynamic 'certification:<id>'.
 */
export interface ProfileUpdateChange {
  field: string
  from: unknown
  to: unknown
  /** Human-readable rendering of from/to, present on V2 payloads. */
  display?: { from: string; to: string }
  /** Per-field verdict, present once the request is decided. */
  outcome?: ItemOutcome
}

const CERTIFICATION_KEY_PREFIX = 'certification:'

/** Label for a change item, handling the composite/dynamic keys. */
export function labelForChange(change: ProfileUpdateChange): string {
  if (change.field.startsWith(CERTIFICATION_KEY_PREFIX)) {
    const to = change.to as { name?: unknown } | null
    const name = to && typeof to.name === 'string' ? to.name : null
    return name ? `Certification: ${name}` : 'Certification'
  }
  return PROFILE_FIELD_LABELS[change.field] ?? change.field
}

/** RENDER RULE: prefer `display.from`; fall back for legacy V1 payloads. */
export function changeFromText(change: ProfileUpdateChange): string {
  if (change.display) return change.display.from
  return String(change.from ?? '—')
}

/** RENDER RULE: prefer `display.to`; fall back for legacy V1 payloads. */
export function changeToText(change: ProfileUpdateChange): string {
  if (change.display) return change.display.to
  return String(change.to)
}

/**
 * Presigned certificate URL of a 'certification:<id>' change — present ONLY
 * in detail views (the server enriches the payload per view, never stores it).
 */
export function changeCertificateUrl(
  change: ProfileUpdateChange,
): string | null {
  if (!change.field.startsWith(CERTIFICATION_KEY_PREFIX)) return null
  const to = change.to as { certificate_file_url?: unknown } | null
  return to && typeof to.certificate_file_url === 'string'
    ? to.certificate_file_url
    : null
}

export interface StudentRequest {
  id: number
  request_type: RequestType
  status: RequestStatus
  payload: { v?: 2; changes?: ProfileUpdateChange[] }
  requester_note: string | null
  decision_note: string | null
  decided_at: string | null
  created_at: string
}

/** A request plus the full picture: who can act on it, and what has happened. */
export interface StudentRequestDetail extends StudentRequest {
  approvers: RequestApprover[]
  timeline: RequestEvent[]
}

/** The entrance-exam trio + "not applicable" flag, always one atomic unit. */
export interface EntranceExamValue {
  na: boolean
  entrance_exam_id: number | null
  exam_name: string | null
  entrance_exam_rank: number | null
  entrance_exam_year: number | null
}

/** The education-gap pair, also one atomic unit. */
export interface GapValue {
  year_of_gap: number | null
  reason_of_gap: string | null
}

export interface ProfileUpdateContext {
  entry_type: number
  /** Wire key → raw current value (FK fields carry the id). */
  current: Record<string, unknown>
  /** Wire key → resolved display text for FK fields (id would be opaque). */
  display: Record<string, string | null>
  entrance_exam: EntranceExamValue
  gap: GapValue
  blood_groups: string[]
  genders: string[]
  /**
   * Item keys locked by an OPEN request — pending, or sent back for changes.
   * Warn + disable these; never block the rest.
   */
  pending_fields: string[]
  /** Certifications the student already holds — can't be re-requested. */
  held_certification_ids: number[]
  /**
   * Every mandatory requestable key for this student's entry type. Units come
   * as their unit keys ('entrance_exam', 'gap') — member fields never alone.
   */
  mandatory_fields: string[]
  /**
   * The BLOCKING subset of mandatory keys: still empty on the profile and not
   * claimed by another open request. The server rejects create/resubmit unless
   * every one of these is present in the submitted changes. Empty once the
   * profile is complete — partial requests are allowed from then on.
   */
  required_now: string[]
  /** The year the student actually joined (batch year, +1 for lateral). */
  join_year: number
  /**
   * Auto-computed education gap: join_year minus the year of pass of 12th
   * (regular) / diploma (lateral). Null when that year of pass is unknown.
   */
  suggested_gap: { years: number; basis: 'twelfth' | 'diploma' } | null
}

export interface EntranceExamGroupInput {
  na: boolean
  entrance_exam_id?: number | null
  entrance_exam_rank?: number | null
  entrance_exam_year?: number | null
}

export interface GapGroupInput {
  year_of_gap: number
  reason_of_gap?: string
}

export interface CertificationAddInput {
  industry_certification_id: number
  /** From POST /student/profile/certifications/files — required per entry. */
  certificate_file_key: string
}

/**
 * Create/resubmit body. `changes` carries only the touched simple keys (raw
 * values; FK fields send the id number) plus the atomic units and the
 * certifications add-list. NO `email` key — college email is read-only.
 */
export interface ProfileUpdateInput {
  changes: Record<string, unknown> & {
    entrance_exam?: EntranceExamGroupInput
    gap?: GapGroupInput
    certifications_add?: CertificationAddInput[]
  }
  note?: string
}

// --- API calls ---------------------------------------------------------------

export function fetchMyRequests(): Promise<StudentRequest[]> {
  return withAuth((token) =>
    apiFetch<StudentRequest[]>('/student/requests', { token }),
  )
}

/** The Modules tree — which request types exist and how they group. */
export function fetchRequestCatalog(): Promise<CatalogModule[]> {
  return withAuth((token) =>
    apiFetch<CatalogModule[]>('/student/requests/catalog', { token }),
  )
}

/** Chip counts across ALL types — the Modules panel filters the list, not these. */
export function fetchMyRequestCounts(): Promise<RequestStatusCounts> {
  return withAuth((token) =>
    apiFetch<RequestStatusCounts>('/student/requests/counts', { token }),
  )
}

/** One request in full — state, approvers and history. */
export function fetchMyRequest(id: number): Promise<StudentRequestDetail> {
  return withAuth((token) =>
    apiFetch<StudentRequestDetail>(`/student/requests/${id}`, { token }),
  )
}

/**
 * Revise a request that was sent back and put it back in the queue. Replaces
 * the requested changes wholesale — send the full desired set, not a delta.
 */
export function resubmitProfileUpdateRequest(
  id: number,
  input: ProfileUpdateInput,
): Promise<StudentRequest> {
  return withAuth((token) =>
    apiFetch<StudentRequest>(`/student/requests/profile-update/${id}`, {
      method: 'PUT',
      body: input,
      token,
    }),
  )
}

export function fetchProfileUpdateContext(): Promise<ProfileUpdateContext> {
  return withAuth((token) =>
    apiFetch<ProfileUpdateContext>('/student/requests/profile-update/context', {
      token,
    }),
  )
}

export function submitProfileUpdateRequest(
  input: ProfileUpdateInput,
): Promise<StudentRequest> {
  return withAuth((token) =>
    apiFetch<StudentRequest>('/student/requests/profile-update', {
      method: 'POST',
      body: input,
      token,
    }),
  )
}

export function cancelRequest(id: number): Promise<StudentRequest> {
  return withAuth((token) =>
    apiFetch<StudentRequest>(`/student/requests/${id}/cancel`, {
      method: 'POST',
      token,
    }),
  )
}
