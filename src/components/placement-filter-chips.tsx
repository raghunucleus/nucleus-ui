import { cn } from '@/lib/utils'

export interface FilterChipItem<T extends string> {
  value: T
  label: string
  count: number
  /** Active-state classes, e.g. 'border-warning bg-warning/10 text-warning'. */
  tone: string
}

/**
 * A generic filter chip strip — the placements twin of the requests
 * `StatusChips` (that one is keyed to request statuses, so it isn't reusable
 * directly). Same visual language: outlined rounded-full pills with a count
 * bubble, `aria-pressed` marking the active one.
 */
export function FilterChips<T extends string>({
  value,
  items,
  onChange,
  className,
}: {
  value: T
  items: FilterChipItem<T>[]
  onChange: (next: T) => void
  className?: string
}) {
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {items.map((item) => {
        const active = value === item.value
        return (
          <button
            key={item.value}
            type="button"
            onClick={() => onChange(item.value)}
            aria-pressed={active}
            className={cn(
              'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30',
              active
                ? item.tone
                : 'border-border bg-card text-muted-foreground hover:bg-muted/40',
            )}
          >
            {item.label}
            <span
              className={cn(
                'inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] leading-none font-semibold',
                active ? 'bg-current/15' : 'bg-muted text-muted-foreground',
              )}
            >
              {item.count}
            </span>
          </button>
        )
      })}
    </div>
  )
}
