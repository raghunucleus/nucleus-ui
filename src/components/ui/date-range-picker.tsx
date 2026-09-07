import { CalendarRange, X } from 'lucide-react'
import { useId, useState } from 'react'

import { Button } from '@/components/ui/button'
import { CalendarPanel } from '@/components/ui/date-picker'
import { useDismissOnOutside } from '@/hooks/use-dismiss-on-outside'
import { cn } from '@/lib/utils'

export interface DateRangePreset {
  key: string
  label: string
  /** Omit BOTH to mean "clear the range" — the empty state. */
  from?: string
  to?: string
}

/**
 * A from–to range as one trigger plus a popover.
 *
 * Two loose `DatePicker`s cannot express a range: the second one has no label
 * of its own, so it ends up with a placeholder like "to" that reads as a broken
 * field, and "no range set" needs a third control to clear it. Here the trigger
 * carries the whole state — an empty-state word, or the formatted span — and
 * clearing is an ✕ on that same trigger.
 *
 * Deliberately dumb and fully controlled: `onChange` always reports BOTH ends,
 * and this component never clamps or reorders them. Callers that must satisfy a
 * both-or-neither rule (the analytics API 400s on half a range) get that for
 * free from the single atomic callback, and keep their own clamping in one
 * place rather than splitting it across two interacting handlers.
 */
export function DateRangePicker({
  from,
  to,
  onChange,
  presets,
  emptyLabel = 'Any date',
  min,
  align = 'end',
  className,
  triggerClassName,
  'aria-label': ariaLabel = 'Date range',
}: {
  /** 'YYYY-MM-DD', or '' for unset. */
  from: string
  to: string
  /** Always called with both ends. `{ from: '', to: '' }` clears. */
  onChange: (next: { from: string; to: string }) => void
  presets?: readonly DateRangePreset[]
  /** Trigger label while both ends are empty. */
  emptyLabel?: string
  /** Earliest pickable day. */
  min?: string
  align?: 'start' | 'end'
  className?: string
  triggerClassName?: string
  'aria-label'?: string
}) {
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const rootRef = useDismissOnOutside<HTMLDivElement>(open, () =>
    setOpen(false),
  )

  const active = Boolean(from || to)

  const clear = () => {
    onChange({ from: '', to: '' })
    setOpen(false)
  }

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <div className="flex items-center">
        <Button
          type="button"
          variant={active ? 'secondary' : 'outline'}
          size="sm"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={open ? panelId : undefined}
          aria-label={ariaLabel}
          onClick={() => setOpen((v) => !v)}
          className={cn(
            'h-9 gap-2 font-normal',
            active && 'rounded-r-none',
            triggerClassName,
          )}
        >
          <CalendarRange className="size-4 text-muted-foreground" />
          {active ? (
            <span className="tabular-nums">{formatRange(from, to)}</span>
          ) : (
            <span className="text-muted-foreground">{emptyLabel}</span>
          )}
        </Button>
        {active && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            aria-label={`Clear ${ariaLabel.toLowerCase()}`}
            title={`Clear ${ariaLabel.toLowerCase()}`}
            onClick={clear}
            className="h-9 rounded-l-none border-l border-border px-2"
          >
            <X className="size-4" />
          </Button>
        )}
      </div>

      {open ? (
        <div
          id={panelId}
          role="dialog"
          aria-label="Choose a date range"
          className={cn(
            'absolute z-50 mt-2 w-max max-w-[calc(100vw-2rem)] rounded-md border bg-popover text-popover-foreground shadow-md',
            align === 'end' ? 'right-0' : 'left-0',
          )}
        >
          <div className="flex flex-col sm:flex-row">
            {presets && presets.length > 0 && (
              <div className="flex shrink-0 gap-1 overflow-x-auto border-b p-2 sm:flex-col sm:overflow-x-visible sm:border-b-0 sm:border-r">
                {presets.map((p) => {
                  const on =
                    (p.from ?? '') === from && (p.to ?? '') === to
                  return (
                    <Button
                      key={p.key}
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-pressed={on}
                      onClick={() => {
                        onChange({ from: p.from ?? '', to: p.to ?? '' })
                        setOpen(false)
                      }}
                      className={cn(
                        'justify-start whitespace-nowrap font-normal sm:w-full',
                        on && 'bg-accent font-medium text-accent-foreground',
                      )}
                    >
                      {p.label}
                    </Button>
                  )
                })}
              </div>
            )}

            {/* Stacked below `sm` on purpose — two 18rem calendars side by side
                overflow a tablet in portrait. */}
            <div className="grid grid-cols-1 sm:grid-cols-2">
              <div>
                <p className="px-3 pt-3 text-xs font-medium text-muted-foreground">
                  From
                </p>
                <CalendarPanel
                  value={from || null}
                  min={min}
                  onPick={(iso) => onChange({ from: iso, to })}
                />
              </div>
              <div className="border-t sm:border-l sm:border-t-0">
                <p className="px-3 pt-3 text-xs font-medium text-muted-foreground">
                  To
                </p>
                <CalendarPanel
                  value={to || null}
                  min={from || min}
                  onPick={(iso) => onChange({ from, to: iso })}
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

/**
 * `2 – 14 Mar 2026`, dropping whatever the two ends share. A range label that
 * repeats "Mar 2026" twice is just noise in a toolbar.
 */
function formatRange(from: string, to: string): string {
  if (from && !to) return `${fmtFull(from)} →`
  if (!from && to) return `→ ${fmtFull(to)}`
  if (from === to) return fmtFull(from)

  const a = parse(from)
  const b = parse(to)
  if (!a || !b) return `${from} – ${to}`

  if (a.getFullYear() === b.getFullYear()) {
    if (a.getMonth() === b.getMonth()) {
      // 2 – 14 Mar 2026
      return `${a.getDate()} – ${fmtFull(to)}`
    }
    // 2 Mar – 14 Apr 2026
    return `${fmt(a, { day: 'numeric', month: 'short' })} – ${fmtFull(to)}`
  }
  return `${fmtFull(from)} – ${fmtFull(to)}`
}

function parse(iso: string): Date | null {
  const d = new Date(`${iso}T00:00:00`)
  return Number.isNaN(d.getTime()) ? null : d
}

function fmt(d: Date, opts: Intl.DateTimeFormatOptions): string {
  return d.toLocaleDateString('en-IN', opts)
}

function fmtFull(iso: string): string {
  const d = parse(iso)
  if (!d) return iso
  return fmt(d, { day: 'numeric', month: 'short', year: 'numeric' })
}
