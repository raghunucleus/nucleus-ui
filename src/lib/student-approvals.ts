import { apiFetch } from './api'
import { withAuth } from './student-auth'
import type { PlacementDriveRecord } from './student-placements'
import type { RequestStatus } from './student-requests'

/**
 * The student Approvals inbox — everything sent to the student for a decision
 * plus what they already decided, read from the server-owned `student_approvals`
 * table. The common core status (pending/approved/rejected/sent_back/cancelled)
 * is authoritative on the server; each item embeds its module's display payload
 * (today: a placement drive) so the existing cards render unchanged.
 */

export interface StudentApprovalItem {
  id: number
  module: string
  type: string
  status: RequestStatus
  /** When the item entered the inbox — drives the date filter and sort. */
  created_at: string
  decided_at: string | null
  reason: string | null
  /** Present for `module === 'placements'`; drives the invite/record card. */
  drive: PlacementDriveRecord | null
}

/** Per-status tally across every module — every status is seeded (incl. 0). */
export type ApprovalCounts = Partial<Record<RequestStatus, number>>

export function fetchStudentApprovals(
  status?: RequestStatus | 'all',
  module?: string,
): Promise<StudentApprovalItem[]> {
  const params = new URLSearchParams()
  if (status && status !== 'all') params.set('status', status)
  if (module && module !== 'all') params.set('module', module)
  const qs = params.toString()
  return withAuth((token) =>
    apiFetch(`/student/approvals${qs ? `?${qs}` : ''}`, { token }),
  )
}

export function fetchStudentApprovalCounts(): Promise<ApprovalCounts> {
  return withAuth((token) => apiFetch('/student/approvals/counts', { token }))
}
