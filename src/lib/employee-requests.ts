import { apiFetch } from './api'
import { withEmployeeAuth } from './employee-auth'
import type {
  CatalogModule,
  ItemOutcome,
  RequestApprover,
  RequestEvent,
  RequestStatus,
  RequestStatusCounts,
  RequestType,
} from './student-requests'

/**
 * Employee side of the approval-requests framework: the Approvals inbox
 * (requests from students of batches the employee verifies) and the
 * employee's own My Requests.
 * Shared vocabulary (statuses, type labels, payload shapes) lives in
 * `student-requests.ts` — one source for both portals.
 */

export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  limit: number
}

/** Who raised a request — a student or an employee, in one shape. */
export interface RequestRequester {
  kind: 'student' | 'employee'
  id: number
  /** display_name / emp_display_name. */
  name: string
  /** student_id / emp_code. */
  code: string
  /** "B.Tech CSE · 2022" or "Assistant Professor · CSE". */
  subtitle: string | null
}

export interface ApprovalRow {
  id: number
  request_type: RequestType
  status: RequestStatus
  /** Type-specific — each payload renderer casts it to its own shape. */
  payload: Record<string, unknown>
  requester_note: string | null
  decision_note: string | null
  decided_at: string | null
  decided_by: { id: number; emp_display_name: string } | null
  created_at: string
  /** The routing action for employee-raised requests; null for student ones. */
  action_key: string | null
  requester: RequestRequester
  /** @deprecated Read `requester`. Present on student requests only. */
  student?: {
    id: number
    student_id: string
    display_name: string
    programme_name: string
    admission_year_display: string
  }
}

/** An approval row plus the full picture: the approver pool and the history. */
export interface ApprovalDetail extends ApprovalRow {
  approvers: RequestApprover[]
  timeline: RequestEvent[]
}

export interface EmployeeOwnRequest {
  id: number
  request_type: RequestType
  status: RequestStatus
  payload: Record<string, unknown>
  requester_note: string | null
  decision_note: string | null
  decided_at: string | null
  created_at: string
  action_key: string | null
}

/** One of the caller's own requests, with the approver pool and history. */
export interface EmployeeOwnRequestDetail extends EmployeeOwnRequest {
  approvers: RequestApprover[]
  timeline: RequestEvent[]
}

export interface ApprovalsQuery {
  status?: RequestStatus | 'all'
  type?: RequestType
  /** Inclusive local-date window on created_at (YYYY-MM-DD). */
  from?: string
  to?: string
  sort?: 'newest' | 'oldest'
  page?: number
  limit?: number
}

export type DecisionAction = 'approve' | 'reject'

function qs(params: object): string {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue
    sp.set(k, String(v))
  }
  const s = sp.toString()
  return s ? `?${s}` : ''
}

export function fetchApprovals(
  query: ApprovalsQuery = {},
): Promise<Paginated<ApprovalRow>> {
  return withEmployeeAuth((token) =>
    apiFetch(`/employee/requests/approvals${qs(query)}`, { token }),
  )
}

/** One request in full — state, the approver pool and the history. */
export function fetchApproval(id: number): Promise<ApprovalDetail> {
  return withEmployeeAuth((token) =>
    apiFetch(`/employee/requests/approvals/${id}`, { token }),
  )
}

/** The Modules tree — which request types exist and how they group. */
export function fetchApprovalCatalog(): Promise<CatalogModule[]> {
  return withEmployeeAuth((token) =>
    apiFetch('/employee/requests/catalog', { token }),
  )
}

/** Chip counts across every visible request — global, never type-scoped. */
export function fetchApprovalCounts(): Promise<RequestStatusCounts> {
  return withEmployeeAuth((token) =>
    apiFetch('/employee/requests/approvals/counts', { token }),
  )
}

/**
 * Return a pending request to the student for changes. Not a decision —
 * nothing is applied; it parks with them until they resubmit or cancel. The
 * note is required: it is the only thing telling them what to fix.
 */
export function sendBackApproval(
  id: number,
  note: string,
): Promise<ApprovalRow> {
  return withEmployeeAuth((token) =>
    apiFetch(`/employee/requests/approvals/${id}/send-back`, {
      method: 'POST',
      body: { note },
      token,
    }),
  )
}

/**
 * `overrides` carries type-specific edits the approver made while deciding
 * (e.g. reassigning who owns a company job role). Opaque to this client — the
 * type's payload renderer produces it and the server's handler validates it.
 */
export function decideApproval(
  id: number,
  action: DecisionAction,
  note?: string,
  overrides?: Record<string, unknown>,
): Promise<ApprovalRow> {
  return withEmployeeAuth((token) =>
    apiFetch(`/employee/requests/approvals/${id}/${action}`, {
      method: 'POST',
      body: { note: note || undefined, overrides },
      token,
    }),
  )
}

/**
 * Per-field (mixed) decision — approve some fields, reject others. Every
 * field of the request must get a verdict, and `overall` is the approver's
 * pick for the request status when the verdicts disagree (there is no
 * separate "partial" status).
 */
export function decideApprovalMixed(
  id: number,
  decisions: Record<string, ItemOutcome>,
  overall: ItemOutcome,
  note?: string,
  overrides?: Record<string, unknown>,
): Promise<ApprovalRow> {
  return withEmployeeAuth((token) =>
    apiFetch(`/employee/requests/approvals/${id}/decide`, {
      method: 'POST',
      body: { decisions, overall, note: note || undefined, overrides },
      token,
    }),
  )
}

// --- My requests ----------------------------------------------------------

export function fetchMyEmployeeRequests(): Promise<EmployeeOwnRequest[]> {
  return withEmployeeAuth((token) =>
    apiFetch('/employee/requests/mine', { token }),
  )
}

/** One of the caller's own requests in full — the pool, the history, the payload. */
export function fetchMyEmployeeRequest(
  id: number,
): Promise<EmployeeOwnRequestDetail> {
  return withEmployeeAuth((token) =>
    apiFetch(`/employee/requests/mine/${id}`, { token }),
  )
}

export function fetchMyEmployeeRequestCounts(): Promise<RequestStatusCounts> {
  return withEmployeeAuth((token) =>
    apiFetch('/employee/requests/mine/counts', { token }),
  )
}

/** Withdraw one of your own requests while it is still open. */
export function cancelMyEmployeeRequest(
  id: number,
): Promise<EmployeeOwnRequest> {
  return withEmployeeAuth((token) =>
    apiFetch(`/employee/requests/mine/${id}/cancel`, {
      method: 'POST',
      token,
    }),
  )
}
