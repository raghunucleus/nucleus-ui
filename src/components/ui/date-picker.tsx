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
  hideIcon,
  'aria-label': ariaLabel = 'Pick a date',
}: {
  value: string
  onChange: (iso: string) => void
  disabled?: boolean
  className?: string
  /** Drop the leading calendar glyph — useful when several pickers sit inside
   * a single labelled group and one shared icon already conveys the affordance. */
  hideIcon?: boolean
  'aria-label'?: string
}) {
  const [open, setOpen] = useState(false)
  // Month the grid is currently showing — seeded from the selected date.
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(parseIso(value)))
  const rootRef = useRef<HTMLDivElement>(null)
  const popoverId = useId()

  // Re-centre the grid on the selected month whenever it changes externally
  // (prev/next-day buttons, "Today") so reopening always lands on the right
  // month.
  useEffect(() => {
    setViewMonth(startOfMonth(parseIso(value)))
  }, [value])

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

  const selected = parseIso(value)
  const today = new Date()
  const cells = monthGrid(viewMonth)

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
        className="gap-2 font-normal"
      >
        {hideIcon ? null : (
          <CalendarDays className="size-4 text-muted-foreground" />
        )}
        <span className="tabular-nums">{formatTrigger(selected)}</span>
      </Button>

      {open ? (
        <div
          id={popoverId}
          role="dialog"
          aria-label="Choose date"
          className="absolute right-0 z-50 mt-2 w-72 origin-top rounded-md border bg-popover p-3 text-popover-foreground shadow-md"
        >
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
              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => {
                    onChange(iso)
                    setOpen(false)
                  }}
                  className={cn(
                    'flex h-8 items-center justify-center rounded-md text-sm tabular-nums transition-colors',
                    'hover:bg-accent hover:text-accent-foreground',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
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

          <div className="mt-2 flex justify-end border-t pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                onChange(toIso(new Date()))
                setOpen(false)
              }}
            >
              Today
            </Button>
          </div>
        </div>
      ) : null}
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
