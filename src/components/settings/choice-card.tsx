import { Check } from 'lucide-react'
import type { ReactNode } from 'react'

import type { ThemeSwatches } from '@/config/themes'
import { cn } from '@/lib/utils'

/**
 * One option in a radio-card group (Display mode, colour theme).
 *
 * A native radio inside a `<label>`: radios sharing a `name` give the group a
 * single tab stop, arrow-key roving and `aria-checked` for free, and
 * `has-checked:` paints the selected state with no JS. Wrap a set in
 * `<div role="radiogroup" aria-label="…">`.
 *
 * Portal-agnostic — used by the student Settings tabs and the employee Profile
 * page — so nothing in here may import a portal store or i18n.
 */
export function ChoiceCard({
  name,
  value,
  checked,
  onSelect,
  title,
  description,
  preview,
  className,
}: {
  name: string
  value: string
  checked: boolean
  onSelect: (value: string) => void
  title: ReactNode
  description?: ReactNode
  /** Decorative block above the text — a `ThemePreview`, an icon. */
  preview?: ReactNode
  className?: string
}) {
  return (
    <label
      className={cn(
        'group relative flex cursor-pointer flex-col gap-3 rounded-xl border bg-card p-4 transition-colors',
        'hover:bg-muted/40',
        'has-checked:border-primary has-checked:ring-1 has-checked:ring-primary/40',
        // Focus uses an outline so it never fights the selected ring.
        'has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring/60',
        className,
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={() => onSelect(value)}
        className="sr-only"
      />
      {preview}
      <span className="min-w-0 pr-6">
        <span className="block text-sm font-semibold">{title}</span>
        {description ? (
          <span className="block text-xs text-muted-foreground">
            {description}
          </span>
        ) : null}
      </span>
      <Check
        aria-hidden
        className="absolute top-3 right-3 size-4 text-primary opacity-0 transition-opacity group-has-checked:opacity-100"
      />
    </label>
  )
}

/**
 * A miniature "window" painted from a preset's swatch literals, so it can show
 * a theme that is NOT currently applied. This is the one sanctioned use of hex
 * values outside index.css — see the note at the top of config/themes.ts.
 */
export function ThemePreview({
  swatches,
  className,
}: {
  swatches: ThemeSwatches
  className?: string
}) {
  const [g0, g1, g2] = swatches.gradient
  return (
    <div
      aria-hidden
      className={cn(
        'overflow-hidden rounded-lg ring-1 ring-foreground/15 ring-inset',
        className,
      )}
      style={{ backgroundColor: swatches.background }}
    >
      <div
        className="h-1.5"
        style={{ background: `linear-gradient(90deg, ${g0}, ${g1}, ${g2})` }}
      />
      <div className="flex items-center gap-2 p-3">
        <div
          className="flex-1 space-y-1.5 rounded-md p-2"
          style={{ backgroundColor: swatches.card }}
        >
          <div
            className="h-1.5 w-3/5 rounded-full"
            style={{ backgroundColor: swatches.foreground, opacity: 0.7 }}
          />
          <div
            className="h-1.5 w-2/5 rounded-full"
            style={{ backgroundColor: swatches.foreground, opacity: 0.3 }}
          />
        </div>
        <div
          className="grid h-8 w-10 shrink-0 place-items-center rounded-md text-xs font-semibold"
          style={{
            backgroundColor: swatches.primary,
            color: swatches.primaryForeground,
          }}
        >
          Aa
        </div>
      </div>
    </div>
  )
}
