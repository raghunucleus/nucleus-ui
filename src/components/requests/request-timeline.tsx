import {
  Check,
  CirclePlus,
  RotateCcw,
  Undo2,
  X,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  REQUEST_EVENT_LABELS,
  type RequestEvent,
  type RequestEventKind,
} from '@/lib/student-requests'

const EVENT_STYLE: Record<
  RequestEventKind,
  { icon: LucideIcon; tone: string }
> = {
  raised: { icon: CirclePlus, tone: 'bg-primary/10 text-primary' },
  resubmitted: { icon: RotateCcw, tone: 'bg-primary/10 text-primary' },
  // Sent back is work-to-do, not a failure — no destructive red.
  sent_back: { icon: Undo2, tone: 'bg-warning/10 text-warning' },
  approved: { icon: Check, tone: 'bg-success/10 text-success' },
  rejected: { icon: X, tone: 'bg-destructive/10 text-destructive' },
  cancelled: { icon: X, tone: 'bg-muted text-muted-foreground' },
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

/**
 * A request's history, oldest first. Empty for requests raised before the
 * events table shipped — their history was never recorded, and inventing one
 * from created_at/decided_at would be a guess.
 */
export function RequestTimeline({
  timeline,
  className,
}: {
  timeline: RequestEvent[]
  className?: string
}) {
  if (timeline.length === 0) {
    return (
      <p className={cn('text-sm text-muted-foreground', className)}>
        No history recorded for this request.
      </p>
    )
  }

  return (
    <ol className={cn('space-y-0', className)}>
      {timeline.map((e, i) => {
        const style = EVENT_STYLE[e.event] ?? {
          icon: CirclePlus,
          tone: 'bg-muted text-muted-foreground',
        }
        const Icon = style.icon
        const isLast = i === timeline.length - 1
        return (
          <li key={`${e.event}-${e.at}-${i}`} className="flex gap-3">
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
                {REQUEST_EVENT_LABELS[e.event] ?? e.event}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatWhen(e.at)}
                {e.actor?.name ? ` · ${e.actor.name}` : ''}
              </p>
              {e.note && (
                <p className="mt-1 rounded-md bg-muted/50 px-2 py-1.5 text-xs break-words">
                  {e.note}
                </p>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
