import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * Lightweight calendar date-picker — a trigger button that opens a month-grid
 * popover. Built with no extra deps (the app ships no popover/calendar lib) so
 * we get a real visual calendar instead of the browser's native `<input
 * type="date">` entry field. Week starts on Monday to match the rest of the
 * attendance/timetable UI.
 *
 * `value` / `onChange` speak local-time ISO dates (`YYYY-MM-DD`).
 */
export function DatePicker({
  value,
  onChange,
  disabled,
  className,
  triggerClassName,
  hideIcon,
  clearable,
  placeholder = 'Pick a date',
  min,
  'aria-label': ariaLabel = 'Pick a date',
}: {
  /** 'YYYY-MM-DD' — the empty string means "nothing picked" (see `clearable`). */
  value: string
  onChange: (iso: string) => void
  disabled?: boolean
  /** Styles the positioning wrapper — NOT the trigger. A width here sets the
   *  popover's anchor box; use `triggerClassName` to size the button itself. */
  className?: string
  /** Extra classes for the trigger button, e.g. `h-9 w-full` to make it fill
   *  and line up with `h-9` neighbours in a toolbar row. */
  triggerClassName?: string
  /** Drop the leading calendar glyph — useful when several pickers sit inside
   * a single labelled group and one shared icon already conveys the affordance. */
  hideIcon?: boolean
  /** Optional-date mode: an empty `value` shows `placeholder`, and the popover
   * offers a Clear action that reports `onChange('')`. */
  clearable?: boolean
  placeholder?: string
  /** Earliest pickable 'YYYY-MM-DD' — days before it render disabled. */
  min?: string
  'aria-label'?: string
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const popoverId = useId()

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const selected = value ? parseIso(value) : null

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? popoverId : undefined}
        aria-label={ariaLabel}
        onClick={() => setOpen((v) => !v)}
        className={cn('gap-2 font-normal', triggerClassName)}
      >
        {hideIcon ? null : (
          <CalendarDays className="size-4 text-muted-foreground" />
        )}
        {selected ? (
          <span className="tabular-nums">{formatTrigger(selected)}</span>
        ) : (
          <span className="text-muted-foreground">{placeholder}</span>
        )}
      </Button>

      {open ? (
        <div
          id={popoverId}
          role="dialog"
          aria-label="Choose date"
          className="absolute right-0 z-50 mt-2 origin-top rounded-md border bg-popover text-popover-foreground shadow-md"
        >
          <CalendarPanel
            value={value}
            min={min}
            onPick={(iso) => {
              onChange(iso)
              setOpen(false)
            }}
            onClear={
              clearable && value
                ? () => {
                    onChange('')
                    setOpen(false)
                  }
                : undefined
            }
          />
        </div>
      ) : null}
    </div>
  )
}

/**
 * The calendar itself — month switcher, Monday-first day grid, and the
 * Today/Clear footer. Exported on its own so surfaces with their own popover
 * machinery (the CR View table's portalled cell popovers) can embed the exact
 * same calendar instead of falling back to the native `<input type="date">`
 * popup, which the browser dismisses on focus/layout churn.
 */
export function CalendarPanel({
  value,
  onPick,
  onClear,
  min,
}: {
  /** Selected 'YYYY-MM-DD' — '' or `null` for no selection. */
  value: string | null
  onPick: (iso: string) => void
  /** When provided, a Clear action sits opposite Today in the footer. */
  onClear?: () => void
  /** Earliest pickable 'YYYY-MM-DD' — days before it render disabled. */
  min?: string
}) {
  // Month the grid is currently showing — seeded from the selected date.
  const [viewMonth, setViewMonth] = useState(() =>
    startOfMonth(value ? parseIso(value) : new Date()),
  )

  // Re-centre the grid on the selected month whenever it changes externally
  // so a stale month never lingers while the panel stays mounted.
  useEffect(() => {
    if (value) setViewMonth(startOfMonth(parseIso(value)))
  }, [value])

  const today = new Date()
  const cells = monthGrid(viewMonth)

  return (
    <div className="w-72 p-3">
      {/* Month switcher */}
      <div className="mb-2 flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7"
          aria-label="Previous month"
          onClick={() => setViewMonth(addMonths(viewMonth, -1))}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <span className="text-sm font-semibold tabular-nums">
          {formatMonth(viewMonth)}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7"
          aria-label="Next month"
          onClick={() => setViewMonth(addMonths(viewMonth, 1))}
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>

      {/* Weekday header — Monday first */}
      <div className="grid grid-cols-7 gap-0.5 text-center text-[11px] font-medium text-muted-foreground">
        {WEEKDAYS.map((d) => (
          <span key={d} className="py-1">
            {d}
          </span>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((cell) => {
          const iso = toIso(cell)
          const isSelected = iso === value
          const isToday = sameDay(cell, today)
          const isOutside = cell.getMonth() !== viewMonth.getMonth()
          // ISO dates compare lexicographically, so a plain < is a date test.
          const isDisabled = min !== undefined && iso < min
          return (
            <button
              key={iso}
              type="button"
              disabled={isDisabled}
              onClick={() => onPick(iso)}
              className={cn(
                'flex h-8 items-center justify-center rounded-md text-sm tabular-nums transition-colors',
                'hover:bg-accent hover:text-accent-foreground',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
                'disabled:pointer-events-none disabled:text-muted-foreground/30',
                isOutside && !isSelected && 'text-muted-foreground/50',
                isToday &&
                  !isSelected &&
                  'font-semibold text-primary ring-1 ring-inset ring-primary/40',
                isSelected &&
                  'bg-primary font-semibold text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground',
              )}
              aria-pressed={isSelected}
              aria-label={formatTrigger(cell)}
            >
              {cell.getDate()}
            </button>
          )
        })}
      </div>

      <div
        className={cn(
          'mt-2 flex border-t pt-2',
          onClear ? 'justify-between' : 'justify-end',
        )}
      >
        {onClear ? (
          <Button type="button" variant="ghost" size="sm" onClick={onClear}>
            Clear
          </Button>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={min !== undefined && toIso(new Date()) < min}
          onClick={() => onPick(toIso(new Date()))}
        >
          Today
        </Button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Date helpers — local time, kept self-contained so this stays a generic UI
// primitive with no app-layer imports.
// ---------------------------------------------------------------------------

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

function parseIso(iso: string): Date {
  const d = new Date(`${iso}T00:00:00`)
  return Number.isNaN(d.getTime()) ? new Date() : d
}

function toIso(date: Date): string {
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1)
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

/** 42-cell (6×7) grid covering `month`, padded into adjacent months, Monday-first. */
function monthGrid(month: Date): Date[] {
  const first = startOfMonth(month)
  const dow = first.getDay() // 0 = Sunday
  const offset = dow === 0 ? 6 : dow - 1 // days back to the preceding Monday
  const gridStart = new Date(
    first.getFullYear(),
    first.getMonth(),
    1 - offset,
  )
  return Array.from(
    { length: 42 },
    (_, i) =>
      new Date(
        gridStart.getFullYear(),
        gridStart.getMonth(),
        gridStart.getDate() + i,
      ),
  )
}

function formatMonth(date: Date): string {
  return date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
}

function formatTrigger(date: Date): string {
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}
