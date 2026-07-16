import { ArrowRight, Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  PROFILE_FIELD_LABELS,
  type ProfileUpdateChange,
} from '@/lib/student-requests'

/**
 * The requested `from → to` diff, with each field's outcome once decided.
 * Shared by both portals so a student sees exactly which fields were rejected
 * in a mixed decision — not just the request's overall status.
 */
export function RequestChanges({
  changes,
  className,
}: {
  changes: ProfileUpdateChange[]
  className?: string
}) {
  if (changes.length === 0) {
    return (
      <p className={cn('text-sm text-muted-foreground', className)}>
        No changes recorded on this request.
      </p>
    )
  }

  return (
    <ul className={cn('space-y-2', className)}>
      {changes.map((c) => (
        <li
          key={c.field}
          className="rounded-lg border bg-card px-3 py-2 text-sm"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              {PROFILE_FIELD_LABELS[c.field] ?? c.field}
            </span>
            {c.outcome && (
              <span
                className={cn(
                  'inline-flex items-center gap-1 text-xs font-medium',
                  c.outcome === 'approved' ? 'text-success' : 'text-destructive',
                )}
              >
                {c.outcome === 'approved' ? (
                  <Check className="size-3" />
                ) : (
                  <X className="size-3" />
                )}
                {c.outcome === 'approved' ? 'Approved' : 'Rejected'}
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground line-through">
              {c.from || '—'}
            </span>
            <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="font-medium break-all">{c.to}</span>
          </div>
        </li>
      ))}
    </ul>
  )
}
