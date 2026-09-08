import { CalendarDays, Clock, FileText, Paperclip } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import {
  formatLeaveRange,
  shortTime,
  type LeaveAttachment,
  type LeaveImpact,
} from '@/lib/student-requests'

/**
 * Shared rendering for the two leave request types (apply / cancel) and the
 * student's own Leaves screen — one look for "which leave, when, why, proof",
 * wherever it appears.
 */

export function LeaveFacts({
  leaveType,
  from,
  to,
  fromTime,
  toTime,
  days,
}: {
  leaveType: string
  from: string
  to: string
  /** Part-day window; both null/absent on a full-day leave. */
  fromTime?: string | null
  toTime?: string | null
  days: number
}) {
  const partial = Boolean(fromTime && toTime)
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="default">{leaveType}</Badge>
      <span className="inline-flex items-center gap-1.5 text-sm font-medium">
        <CalendarDays className="size-4 text-muted-foreground" />
        {formatLeaveRange(from, to)}
      </span>
      {partial ? (
        <span className="inline-flex items-center gap-1.5 rounded-md bg-muted/60 px-1.5 py-0.5 text-xs font-medium tabular-nums">
          <Clock className="size-3.5 text-muted-foreground" />
          {shortTime(fromTime!)}–{shortTime(toTime!)}
        </span>
      ) : null}
      <span className="text-xs text-muted-foreground">
        {partial ? 'Part of the day' : `${days} day${days === 1 ? '' : 's'}`}
      </span>
    </div>
  )
}

export function LeaveReason({
  label = 'Reason',
  reason,
}: {
  label?: string
  reason: string | null
}) {
  return (
    <div className="rounded-md bg-muted/30 px-3 py-2 text-sm">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 whitespace-pre-wrap break-words">
        {reason?.trim() ? reason : <span className="text-muted-foreground">—</span>}
      </p>
    </div>
  )
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

/** Proof files. Links only render when the presigned `url` is present (detail views). */
export function LeaveAttachments({
  attachments,
}: {
  attachments: LeaveAttachment[]
}) {
  if (attachments.length === 0) return null
  return (
    <div className="space-y-1.5">
      <p className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        <Paperclip className="size-3.5" />
        Proof ({attachments.length})
      </p>
      <ul className="space-y-1">
        {attachments.map((a) => {
          const inner = (
            <>
              <FileText className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate" title={a.name}>
                {a.name}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {formatBytes(a.size)}
              </span>
            </>
          )
          return (
            <li key={a.key}>
              {a.url ? (
                <a
                  href={a.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted/40"
                >
                  {inner}
                </a>
              ) : (
                <div className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm text-muted-foreground">
                  {inner}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/**
 * What the decision touches. `mode` picks the wording: approving an application
 * flips absent → leave; approving a cancellation flips leave → absent.
 */
export function LeaveImpactPanel({
  impact,
  mode,
}: {
  impact: LeaveImpact | undefined
  mode: 'apply' | 'cancel'
}) {
  if (!impact) return null
  const flipped = mode === 'apply' ? impact.absent_sessions : impact.leave_sessions
  const flipLabel =
    mode === 'apply'
      ? 'Marked absent → will become leave'
      : 'Marked leave → will revert to absent'
  return (
    <div className="rounded-md border bg-muted/20 p-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Attendance impact
      </p>
      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-3">
        <ImpactStat label={flipLabel} value={flipped} emphasis />
        <ImpactStat label="Attended (untouched)" value={impact.attended_sessions} />
        <ImpactStat label="Upcoming sessions" value={impact.upcoming_sessions} />
        {impact.cancelled_sessions > 0 ? (
          <ImpactStat
            label="Cancelled (not counted)"
            value={impact.cancelled_sessions}
          />
        ) : null}
      </dl>
    </div>
  )
}

function ImpactStat({
  label,
  value,
  emphasis,
}: {
  label: string
  value: number
  emphasis?: boolean
}) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={emphasis ? 'text-lg font-semibold tabular-nums' : 'font-medium tabular-nums'}>
        {value}
      </dd>
    </div>
  )
}
