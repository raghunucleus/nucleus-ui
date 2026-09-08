import type { ApprovalRow } from '@/lib/employee-requests'
import {
  leaveRequestSummary,
  type LeaveApplyPayload,
} from '@/lib/student-requests'
import {
  LeaveAttachments,
  LeaveFacts,
  LeaveImpactPanel,
  LeaveReason,
} from './leave-bits'
import type { PayloadRenderer, PayloadRendererProps } from './types'

const payloadOf = (row: ApprovalRow | null): LeaveApplyPayload | null =>
  (row?.payload as unknown as LeaveApplyPayload) ?? null

function Body({ row, detail }: PayloadRendererProps) {
  // Prefer the detail payload: attachment URLs and the impact live only there.
  const p = payloadOf(detail ?? row)
  if (!p) return null
  return (
    <div className="space-y-3 p-3">
      <LeaveFacts
        leaveType={p.leave_type?.name ?? 'Leave'}
        from={p.from_date}
        to={p.to_date}
        fromTime={p.from_time}
        toTime={p.to_time}
        days={p.days}
      />
      <LeaveReason reason={p.reason} />
      <LeaveAttachments attachments={p.attachments ?? []} />
      <LeaveImpactPanel impact={p.impact} mode="apply" />
    </div>
  )
}

/**
 * A leave is approved or rejected whole — there is nothing to approve
 * partially and nothing for the approver to edit.
 */
export const leaveApplyRenderer: PayloadRenderer = {
  perItem: false,
  title: 'Leave application',
  summary: (row) => {
    const p = payloadOf(row)
    return p ? leaveRequestSummary(p) : 'Leave application'
  },
  Body,
}
