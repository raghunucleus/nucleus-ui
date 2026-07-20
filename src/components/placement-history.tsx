import {
  Ban,
  BellRing,
  Check,
  Flag,
  Mail,
  Pencil,
  X,
  type LucideIcon,
} from 'lucide-react'

import { Card } from '@/components/ui/card'
import {
  PLACEMENT_STATUS_LABELS,
  type PlacementHistoryEvent,
} from '@/lib/student-placements'
import { cn } from '@/lib/utils'

const ICONS: Record<PlacementHistoryEvent['action'], LucideIcon> = {
  invited: Mail,
  reminded: BellRing,
  accepted: Check,
  denied: X,
  outcome: Flag,
  revoked: Ban,
  selection_updated: Pencil,
}

function title(e: PlacementHistoryEvent): string {
  switch (e.action) {
    case 'invited':
      return 'Invited to this drive'
    case 'reminded':
      return 'Reminder sent'
    case 'accepted':
      return 'You accepted the invitation'
    case 'denied':
      return 'You denied the invitation'
    case 'outcome':
      return `Marked ${PLACEMENT_STATUS_LABELS[e.to_status] ?? e.to_status}`
    case 'revoked':
      return 'Invitation revoked'
    case 'selection_updated':
      return 'Offer details updated'
    // The audit log can grow new actions before this client knows them.
    default:
      return 'Updated by the placement cell'
  }
}

function when(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/**
 * The student's own action trail on a drive, oldest first. The actor is only
 * ever "You" or "Placement Cell" — the server never sends employee identities
 * here.
 */
export function PlacementHistoryTimeline({
  history,
}: {
  history: PlacementHistoryEvent[]
}) {
  if (history.length === 0) return null

  return (
    <Card className="p-4">
      <h2 className="mb-3 text-sm font-semibold">History</h2>
      <ol className="space-y-0">
        {history.map((e, i) => {
          // Fall back for audit actions this client doesn't know yet — an
          // unmapped action must never crash the whole detail view.
          const Icon = ICONS[e.action] ?? Flag
          const last = i === history.length - 1
          return (
            <li key={i} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span
                  className={cn(
                    'flex size-7 shrink-0 items-center justify-center rounded-full border',
                    e.by === 'you'
                      ? 'border-primary/40 bg-primary/10 text-primary'
                      : 'border-border bg-muted text-muted-foreground',
                  )}
                >
                  <Icon className="size-3.5" />
                </span>
                {!last && <span className="w-px flex-1 bg-border" />}
              </div>
              <div className={cn('min-w-0 flex-1', !last && 'pb-4')}>
                <p className="text-sm font-medium">{title(e)}</p>
                <p className="text-xs text-muted-foreground">
                  {e.by === 'you' ? 'You' : 'Placement Cell'} · {when(e.at)}
                </p>
                {e.reason && (e.action === 'denied' || e.action === 'revoked') ? (
                  <p className="mt-1.5 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                    {e.reason}
                  </p>
                ) : null}
              </div>
            </li>
          )
        })}
      </ol>
    </Card>
  )
}
