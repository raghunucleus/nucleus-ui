import {
  Ban,
  Check,
  CirclePlus,
  Pencil,
  Send,
  Trophy,
  X,
  type LucideIcon,
} from 'lucide-react'

import {
  DRIVE_STUDENT_ACTION_LABELS,
  DRIVE_STUDENT_STATUS_LABELS,
  type DriveStudentEvent,
  type DriveStudentTrack,
} from '@/lib/drive-management'
import { cn } from '@/lib/utils'

const ACTION_STYLE: Record<string, { icon: LucideIcon; tone: string }> = {
  imported: { icon: CirclePlus, tone: 'bg-muted text-muted-foreground' },
  invited: { icon: Send, tone: 'bg-warning/10 text-warning' },
  accepted: { icon: Check, tone: 'bg-success/10 text-success' },
  denied: { icon: X, tone: 'bg-destructive/10 text-destructive' },
  outcome: { icon: Trophy, tone: 'bg-primary/10 text-primary' },
  revoked: { icon: Ban, tone: 'bg-muted text-muted-foreground' },
  selection_updated: { icon: Pencil, tone: 'bg-primary/10 text-primary' },
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

/** Line under the action label: what it became, plus who did it. */
function subline(e: DriveStudentEvent): string {
  const to = DRIVE_STUDENT_STATUS_LABELS[e.to_status] ?? String(e.to_status)
  const actor = e.actor_name ? ` · ${e.actor_name}` : ''
  // For outcome (and a selection edit, which stays Selected), the "to" status
  // IS the meaningful label — an arrow would just say "→ Selected" noise.
  return e.action === 'outcome' || e.action === 'selection_updated'
    ? `${to}${actor}`
    : `→ ${to}${actor}`
}

/**
 * One student's full lifecycle track in a drive — every status change /
 * action, oldest first, with actor and reason. Rendered inside the Students
 * tab's detail sheet ("This Drive" tab).
 */
export function DriveStudentTrackTimeline({
  track,
}: {
  track: DriveStudentTrack
}) {
  if (track.events.length === 0) {
    return (
      <p className="pt-4 text-sm text-muted-foreground">
        No history recorded yet.
      </p>
    )
  }
  return (
    <ol className="space-y-0 pt-2">
      {track.events.map((e, i) => {
        const style = ACTION_STYLE[e.action] ?? {
          icon: CirclePlus,
          tone: 'bg-muted text-muted-foreground',
        }
        const Icon = style.icon
        const isLast = i === track.events.length - 1
        return (
          <li key={e.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  'flex size-7 shrink-0 items-center justify-center rounded-full',
                  style.tone,
                )}
              >
                <Icon className="size-3.5" />
              </span>
              {!isLast && <span className="w-px flex-1 bg-border" />}
            </div>
            <div className={cn('min-w-0 flex-1', !isLast && 'pb-4')}>
              <p className="text-sm font-medium">
                {DRIVE_STUDENT_ACTION_LABELS[e.action] ?? e.action}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatWhen(e.created_at)} · {subline(e)}
              </p>
              {e.reason && (
                <p className="mt-1 break-words rounded-md bg-muted/50 px-2 py-1.5 text-xs">
                  {e.reason}
                </p>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
