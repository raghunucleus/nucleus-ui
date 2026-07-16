import { cn } from '@/lib/utils'
import {
  REQUEST_STATUS_LABELS,
  REQUEST_STATUSES,
  type RequestStatus,
  type RequestStatusCounts,
} from '@/lib/student-requests'

export type StatusFilter = RequestStatus | 'all'

/**
 * Per-status tone for the ACTIVE chip. Deliberately parallel to
 * `requestStatusVariant` (which drives the Badge on a row) rather than reusing
 * it: a Badge is a filled pill, a chip is an outlined button, so they need
 * different class shapes even though the colour semantics are identical.
 */
const ACTIVE_TONE: Record<StatusFilter, string> = {
  all: 'border-primary bg-primary/10 text-primary',
  pending: 'border-warning bg-warning/10 text-warning',
  // Sent back is work-to-do, not a failure — never destructive red.
  sent_back: 'border-primary bg-primary/10 text-primary',
  approved: 'border-success bg-success/10 text-success',
  rejected: 'border-destructive bg-destructive/10 text-destructive',
  cancelled: 'border-muted-foreground/40 bg-muted text-muted-foreground',
}

function Chip({
  label,
  count,
  active,
  tone,
  onClick,
}: {
  label: string
  count?: number
  active: boolean
  tone: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30',
        active
          ? tone
          : 'border-border bg-card text-muted-foreground hover:bg-muted/40',
      )}
    >
      {label}
      {count !== undefined && (
        <span
          className={cn(
            'inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] leading-none font-semibold',
            active ? 'bg-current/15' : 'bg-muted text-muted-foreground',
          )}
        >
          {count}
        </span>
      )}
    </button>
  )
}

/**
 * The status filter strip. Counts are GLOBAL — they cover every request the
 * viewer can see, and do not recount when the Modules panel narrows the list
 * below, so the chips stay a stable picture of the whole queue.
 */
export function StatusChips({
  value,
  counts,
  onChange,
  className,
}: {
  value: StatusFilter
  counts?: RequestStatusCounts
  onChange: (next: StatusFilter) => void
  className?: string
}) {
  const total = counts
    ? Object.values(counts).reduce((a, b) => a + (b ?? 0), 0)
    : undefined

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {REQUEST_STATUSES.map((s) => (
        <Chip
          key={s}
          label={REQUEST_STATUS_LABELS[s]}
          count={counts?.[s]}
          active={value === s}
          tone={ACTIVE_TONE[s]}
          onClick={() => onChange(s)}
        />
      ))}
      <Chip
        label="All"
        count={total}
        active={value === 'all'}
        tone={ACTIVE_TONE.all}
        onClick={() => onChange('all')}
      />
    </div>
  )
}
