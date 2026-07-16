import { Check } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { RequestApprover } from '@/lib/student-requests'

/** Initials for the avatar bubble — first + last word of the display name. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  const first = parts[0][0]
  const last = parts.length > 1 ? parts[parts.length - 1][0] : ''
  return (first + last).toUpperCase()
}

/**
 * Who can act on this request — the profile verifiers of the student's batch.
 * The pool is flat: any ONE of them can decide, there is no order or quorum,
 * so this is deliberately a list and not a stepper. `decided` marks whoever
 * actually acted.
 */
export function ApproversList({
  approvers,
  isDecided,
  className,
}: {
  approvers: RequestApprover[]
  /** Whether the request has left `pending` — changes the empty-state wording. */
  isDecided?: boolean
  className?: string
}) {
  if (approvers.length === 0) {
    return (
      <p className={cn('text-sm text-muted-foreground', className)}>
        No approvers are set up for this batch.
      </p>
    )
  }

  return (
    <div className={cn('space-y-3', className)}>
      {!isDecided && (
        <p className="text-xs text-muted-foreground">
          Any one of these can act on it.
        </p>
      )}
      <ul className="space-y-2">
        {approvers.map((a) => (
          <li key={a.id} className="flex items-center gap-3">
            <span
              className={cn(
                'flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                a.is_decider
                  ? 'bg-success/10 text-success'
                  : 'bg-muted text-muted-foreground',
              )}
            >
              {initials(a.emp_display_name)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {a.emp_display_name}
              </p>
              {(a.designation || a.department) && (
                <p className="truncate text-xs text-muted-foreground">
                  {[a.designation, a.department].filter(Boolean).join(' · ')}
                </p>
              )}
            </div>
            {a.is_decider && (
              <Badge variant="success" className="shrink-0">
                <Check className="size-3" />
                Acted
              </Badge>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
