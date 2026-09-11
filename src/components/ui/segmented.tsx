import * as React from 'react'

import { cn } from '@/lib/utils'

export interface SegmentedOption<T extends string> {
  value: T
  label: React.ReactNode
  icon?: React.ComponentType<{ className?: string }>
  /** Accessible name — required when `label` is icon-only. */
  ariaLabel?: string
  /** Native hover tooltip on the option. */
  title?: string
  disabled?: boolean
}

/**
 * A one-of-N switch rendered as a joined button group.
 *
 * The pattern was hand-rolled in three places with three different active
 * treatments (a primary fill, an accent fill, and a chip row). This generalises
 * the CR View density toggle, because that one already had the right
 * accessibility contract: a real `<button>` per option so each stays a tab
 * stop, `aria-pressed` for state, and `role="group"` with a name on the shell.
 *
 * Deliberately NOT `role="radiogroup"` — that promises roving tabindex and
 * arrow-key navigation, which this does not implement.
 */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  size = 'default',
  className,
  'aria-label': ariaLabel,
}: {
  value: T
  onChange: (next: T) => void
  options: ReadonlyArray<SegmentedOption<T>>
  /** `sm` → 32px shell, `default` → 36px, matching Button's `sm`/`default`. */
  size?: 'sm' | 'default'
  className?: string
  /** Required: the group has no visible label. */
  'aria-label': string
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        'inline-flex shrink-0 items-center rounded-md border border-input bg-background p-0.5 shadow-xs',
        size === 'sm' ? 'h-8' : 'h-9',
        className,
      )}
    >
      {options.map((o) => {
        const on = o.value === value
        const Icon = o.icon
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            aria-label={o.ariaLabel}
            title={o.title}
            disabled={o.disabled}
            onClick={() => onChange(o.value)}
            className={cn(
              'flex h-full items-center gap-1.5 whitespace-nowrap rounded px-2.5 text-sm transition-colors',
              'outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-inset',
              'disabled:pointer-events-none disabled:opacity-50',
              on
                ? 'bg-accent font-medium text-accent-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {Icon ? <Icon className="size-4" /> : null}
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
