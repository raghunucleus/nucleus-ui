import { Archive, CircleDot, PencilLine, Send, type LucideIcon } from 'lucide-react'

import { formatPlacementDateTime } from '@/components/placement-invite'
import {
  DRIVE_STATUS_LABELS,
  type DriveStatus,
  type DriveStatusChange,
} from '@/lib/drive-management'
import { cn } from '@/lib/utils'

/** Icon + tone for the bubble, keyed by the resulting (to) status. */
const STATUS_STYLE: Record<DriveStatus, { icon: LucideIcon; tone: string }> = {
  draft: { icon: PencilLine, tone: 'bg-muted text-muted-foreground' },
  ready_to_publish: { icon: CircleDot, tone: 'bg-warning/10 text-warning' },
  published: { icon: Send, tone: 'bg-success/10 text-success' },
  archived: { icon: Archive, tone: 'bg-muted text-muted-foreground' },
}

/**
 * A drive's status transitions, oldest first. Empty for drives that predate the
 * audit trail — their past changes were never recorded, so we say so rather than
 * inventing a history.
 */
export function DriveStatusHistory({
  history,
}: {
  history: DriveStatusChange[]
}) {
  if (history.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No status changes recorded yet.
      </p>
    )
  }

  return (
    <ol className="space-y-0">
      {history.map((e, i) => {
        const style = STATUS_STYLE[e.to_status] ?? {
          icon: CircleDot,
          tone: 'bg-muted text-muted-foreground',
        }
        const Icon = style.icon
        const isLast = i === history.length - 1
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
                {e.from_status
                  ? `${DRIVE_STATUS_LABELS[e.from_status]} → ${DRIVE_STATUS_LABELS[e.to_status]}`
                  : `Set to ${DRIVE_STATUS_LABELS[e.to_status]}`}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatPlacementDateTime(e.created_at)}
                {` · ${e.actor_name ?? 'System'}`}
              </p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
