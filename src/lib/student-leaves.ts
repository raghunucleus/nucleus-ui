import { apiFetch, apiUpload } from './api'
import { withAuth } from './student-auth'
import type { BadgeVariant, LeaveAttachment } from './student-requests'

/**
 * Student side of the Leaves module. A leave is a domain row (`student_leaves`)
 * whose approval runs through the requests framework: applying raises a
 * `leave_apply` request, asking to cancel raises a `leave_cancel` one, both
 * decided by the student's attendance-group in-charges. This API is the
 * leave-shaped surface over that; the generic request views (timeline,
 * approvers) are reached through `fetchMyRequest(apply_request.id)`.
 */

export const LEAVE_STATUSES = [
  'pending',
  'approved',
  'rejected',
  'withdrawn',
  'cancel_requested',
  'cancelled',
] as const
export type LeaveStatus = (typeof LEAVE_STATUSES)[number]

export const LEAVE_STATUS_LABELS: Record<LeaveStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
  cancel_requested: 'Cancellation pending',
  cancelled: 'Cancelled',
}

export function leaveStatusVariant(status: LeaveStatus): BadgeVariant {
  switch (status) {
    case 'pending':
      return 'warning'
    case 'approved':
      return 'success'
    case 'cancel_requested':
      // Still in effect — not a failure, but flagged as changing.
      return 'default'
    case 'rejected':
      return 'destructive'
    case 'withdrawn':
    case 'cancelled':
      return 'muted'
    default:
      return 'secondary'
  }
}

/** Statuses in which the leave is in effect for attendance. */
export const EFFECTIVE_LEAVE_STATUSES: LeaveStatus[] = [
  'approved',
  'cancel_requested',
]

export interface LeaveRequestRef {
  id: number
  /** The framework's status: pending / sent_back / approved / rejected / cancelled. */
  status: string
  decision_note: string | null
  decided_at: string | null
}

export interface StudentLeave {
  id: number
  status: LeaveStatus
  leave_type: { id: number; name: string }
  from_date: string
  to_date: string
  /** Partial-day window ('HH:MM:SS'), or both null for a full day. */
  from_time: string | null
  to_time: string | null
  days: number
  reason: string | null
  /** `url` is present only on the detail view (presigned per fetch). */
  attachments: LeaveAttachment[]
  apply_request: LeaveRequestRef | null
  cancel_request: LeaveRequestRef | null
  decided_at: string | null
  cancelled_at: string | null
  created_at: string
  updated_at: string
  can_withdraw: boolean
  can_request_cancel: boolean
  can_revise: boolean
}

export interface LeaveContext {
  leave_types: { id: number; name: string }[]
  /** The batch's current semester — warn when the dates fall outside it. */
  semester: {
    id: number
    name: string | null
    planned_start_date: string | null
    planned_end_date: string | null
  } | null
  group: { id: number; name: string } | null
  incharges: { id: number; emp_display_name: string }[]
  can_apply: boolean
  blocker: string | null
}

export type LeaveStatusCounts = Partial<Record<LeaveStatus, number>>

export interface LeaveAttachmentInput {
  key: string
  name: string
  mime: string
  size: number
}

export interface LeaveInput {
  leave_type_id: number
  from_date: string
  to_date: string
  /**
   * Part-day window as 'HH:MM'. Send both or neither, and only on a
   * single-date leave — the server rejects anything else with a 400.
   */
  from_time?: string
  to_time?: string
  reason?: string
  attachments: LeaveAttachmentInput[]
}

export const LEAVE_MAX_ATTACHMENTS = 3
export const LEAVE_ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024
export const LEAVE_ATTACHMENT_MIMES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
] as const

// --- API calls ---------------------------------------------------------------

export function fetchLeaveContext(): Promise<LeaveContext> {
  return withAuth((token) =>
    apiFetch<LeaveContext>('/student/leaves/context', { token }),
  )
}

export function fetchMyLeaves(status?: LeaveStatus): Promise<StudentLeave[]> {
  const qs = status ? `?status=${encodeURIComponent(status)}` : ''
  return withAuth((token) =>
    apiFetch<StudentLeave[]>(`/student/leaves${qs}`, { token }),
  )
}

export function fetchLeaveCounts(): Promise<LeaveStatusCounts> {
  return withAuth((token) =>
    apiFetch<LeaveStatusCounts>('/student/leaves/counts', { token }),
  )
}

export function fetchLeave(id: number): Promise<StudentLeave> {
  return withAuth((token) =>
    apiFetch<StudentLeave>(`/student/leaves/${id}`, { token }),
  )
}

/** Stage a proof file (PDF/JPEG/PNG ≤ 5 MB); the result goes into `attachments`. */
export function stageLeaveFile(file: File): Promise<LeaveAttachmentInput> {
  return withAuth((token) => {
    const form = new FormData()
    form.append('file', file, file.name)
    return apiUpload<LeaveAttachmentInput>('/student/leaves/files', form, token)
  })
}

export function applyLeave(input: LeaveInput): Promise<StudentLeave> {
  return withAuth((token) =>
    apiFetch<StudentLeave>('/student/leaves', {
      method: 'POST',
      body: input,
      token,
    }),
  )
}

/** Revise a sent-back application (replaces it wholesale). */
export function resubmitLeave(
  id: number,
  input: LeaveInput,
): Promise<StudentLeave> {
  return withAuth((token) =>
    apiFetch<StudentLeave>(`/student/leaves/${id}`, {
      method: 'PUT',
      body: input,
      token,
    }),
  )
}

/** Withdraw the pending application or the pending cancellation request. */
export function withdrawLeave(id: number): Promise<StudentLeave> {
  return withAuth((token) =>
    apiFetch<StudentLeave>(`/student/leaves/${id}/withdraw`, {
      method: 'POST',
      token,
    }),
  )
}

/** Ask the in-charges to cancel an approved leave. */
export function requestLeaveCancel(
  id: number,
  reason?: string,
): Promise<StudentLeave> {
  return withAuth((token) =>
    apiFetch<StudentLeave>(`/student/leaves/${id}/cancel-request`, {
      method: 'POST',
      body: reason ? { reason } : {},
      token,
    }),
  )
}
