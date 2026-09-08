import type { ApprovalRow } from '@/lib/employee-requests'
import {
  leaveRequestSummary,
  type LeaveCancelPayload,
} from '@/lib/student-requests'
import { LeaveFacts, LeaveImpactPanel, LeaveReason } from './leave-bits'
import type { PayloadRenderer, PayloadRendererProps } from './types'

const payloadOf = (row: ApprovalRow | null): LeaveCancelPayload | null =>
  (row?.payload as unknown as LeaveCancelPayload) ?? null

function Body({ row, detail }: PayloadRendererProps) {
  const p = payloadOf(detail ?? row)
  if (!p) return null
  return (
    <div className="space-y-3 p-3">
      <p className="text-sm text-muted-foreground">
        The student wants to cancel this approved leave. Until you approve, the
        leave stays in effect.
      </p>
      <LeaveFacts
        leaveType={p.leave_type?.name ?? 'Leave'}
        from={p.from_date}
        to={p.to_date}
        fromTime={p.from_time}
        toTime={p.to_time}
        days={p.days}
      />
      <LeaveReason label="Reason for cancelling" reason={p.reason} />
      <LeaveImpactPanel impact={p.impact} mode="cancel" />
    </div>
  )
}

export const leaveCancelRenderer: PayloadRenderer = {
  perItem: false,
  title: 'Leave cancellation',
  summary: (row) => {
    const p = payloadOf(row)
    return p ? `Cancel · ${leaveRequestSummary(p)}` : 'Leave cancellation'
  },
  Body,
}
