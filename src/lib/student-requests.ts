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

/** One request type as a leaf in the Modules tree. */
export interface CatalogType {
  type: RequestType
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

export const PROFILE_UPDATE_FIELDS = [
  'mobile_number',
  'email',
  'blood_group',
  'abc_id',
] as const
export type ProfileUpdateField = (typeof PROFILE_UPDATE_FIELDS)[number]

export const PROFILE_FIELD_LABELS: Record<ProfileUpdateField, string> = {
  mobile_number: 'Mobile number',
  email: 'Email',
  blood_group: 'Blood group',
  abc_id: 'ABC ID',
}

export interface ProfileUpdateChange {
  field: ProfileUpdateField
  from: string | null
  to: string
  /** Per-field verdict, present once the request is decided. */
  outcome?: ItemOutcome
}

export interface StudentRequest {
  id: number
  request_type: RequestType
  status: RequestStatus
  payload: { changes?: ProfileUpdateChange[] }
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

export interface ProfileUpdateContext {
  current: {
    mobile_number: string
    email: string
    blood_group: string | null
    abc_id: string | null
  }
  blood_groups: string[]
  /**
   * Fields locked by an OPEN request — pending, or sent back for changes.
   * Warn + disable these; never block the rest.
   */
  pending_fields: ProfileUpdateField[]
}

export interface ProfileUpdateInput {
  changes: Partial<Record<ProfileUpdateField, string>>
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
