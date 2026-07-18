import { useEffect, useState } from 'react'
import {
  Ban,
  Check,
  CirclePlus,
  Send,
  Trophy,
  X,
  type LucideIcon,
} from 'lucide-react'

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { ApiError } from '@/lib/api'
import {
  DRIVE_STUDENT_ACTION_LABELS,
  DRIVE_STUDENT_STATUS_LABELS,
  getDriveStudentTrack,
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
  // For outcome, the "to" status IS the meaningful label (Selected, etc.).
  return e.action === 'outcome' ? `${to}${actor}` : `→ ${to}${actor}`
}

/**
 * A right-side slide-over showing one student's full lifecycle track in a drive
 * — every status change / action, oldest first, with actor and reason.
 */
export function DriveStudentTrackSheet({
  driveId,
  studentId,
  open,
  onOpenChange,
}: {
  driveId: number
  studentId: number | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [track, setTrack] = useState<DriveStudentTrack | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || studentId === null) return
    let cancelled = false
    setLoading(true)
    setTrack(null)
    setError(null)
    getDriveStudentTrack(driveId, studentId)
      .then((t) => {
        if (!cancelled) setTrack(t)
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(
            e instanceof ApiError || e instanceof Error
              ? e.message
              : 'Could not load the track.',
          )
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, driveId, studentId])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>
            {track ? track.student.display_name : 'Student track'}
          </SheetTitle>
          <SheetDescription>
            {track
              ? `${track.student.roll_no} · every status change in this drive`
              : 'The full lifecycle history for this student.'}
          </SheetDescription>
        </SheetHeader>

        <div className="scrollbar-themed min-h-0 flex-1 overflow-y-auto px-1 pb-4">
          {loading ? (
            <div className="space-y-3 pt-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-10 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          ) : error ? (
            <p className="pt-4 text-sm text-destructive">{error}</p>
          ) : track && track.events.length > 0 ? (
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
          ) : (
            <p className="pt-4 text-sm text-muted-foreground">
              No history recorded yet.
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
