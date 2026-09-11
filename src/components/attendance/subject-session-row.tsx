import { MapPin, User } from 'lucide-react'

import { StatusPill } from '@/components/attendance/status-pill'
import { Badge } from '@/components/ui/badge'
import {
  deriveSessionStatus,
  formatDateShort,
  type AttendanceStatusKind,
} from '@/lib/attendance-status'
import {
  shortTime,
  type AllSessionRow,
  type SubjectSessionRow,
} from '@/lib/student-academics'
import { cn } from '@/lib/utils'

export interface SubjectSessionRowStrings {
  reason: string
  sub: string
  statusLabel: (kind: AttendanceStatusKind) => string
  /** Defaults to `formatDateShort`. */
  dateLabel?: (iso: string) => string
}

export type SessionRowData = SubjectSessionRow | AllSessionRow

function hasSubject(s: SessionRowData): s is AllSessionRow {
  return 'subject_name' in s
}

/**
 * One class, as a list item. Shared by the student and parent portals (which
 * were verbatim forks of each other) and by the calendar's day-detail panel,
 * where `hideDate` drops the date column because the panel heading already
 * carries it. `showSubject` names the subject — the all-subjects view.
 */
export function SubjectSessionListRow({
  session,
  strings,
  hideDate = false,
  showSubject = false,
}: {
  session: SessionRowData
  strings: SubjectSessionRowStrings
  hideDate?: boolean
  showSubject?: boolean
}) {
  const kind = deriveSessionStatus(session)
  const time = session.start_time
    ? `${shortTime(session.start_time)}${session.end_time ? `–${shortTime(session.end_time)}` : ''}`
    : ''
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <div
        className={cn(
          'shrink-0 text-xs tabular-nums',
          hideDate ? 'w-20' : 'w-24',
        )}
      >
        {hideDate ? (
          <p className="font-mono text-xs text-muted-foreground">{time}</p>
        ) : (
          <>
            <p className="font-medium">
              {(strings.dateLabel ?? formatDateShort)(session.date)}
            </p>
            <p className="font-mono text-[10px] text-muted-foreground">
              {time}
            </p>
          </>
        )}
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        {showSubject && hasSubject(session) ? (
          <p className="text-sm font-medium leading-tight">
            {session.subject_name}
            <span className="ml-1.5 font-mono text-[11px] font-normal text-muted-foreground">
              {session.subject_code}
            </span>
          </p>
        ) : null}
        <div className="flex items-center gap-1.5">
          <StatusPill kind={kind}>{strings.statusLabel(kind)}</StatusPill>
          {session.is_substitute ? (
            <Badge variant="secondary">{strings.sub}</Badge>
          ) : null}
        </div>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
          {session.teacher_display_name ? (
            <span className="inline-flex items-center gap-1">
              <User className="size-3" />
              {session.teacher_display_name}
            </span>
          ) : null}
          {session.room ? (
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3" />
              {session.room}
            </span>
          ) : null}
          {session.period_label ? <span>{session.period_label}</span> : null}
        </p>
        {session.session_status === 'cancelled' && session.cancel_reason ? (
          <p className="text-[10px] italic text-muted-foreground">
            {strings.reason} {session.cancel_reason}
          </p>
        ) : null}
      </div>
    </li>
  )
}
