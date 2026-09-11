import { ChevronLeft, ChevronRight } from 'lucide-react'
import * as React from 'react'
import { useMemo, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  STATUS_CELL_CLASS,
  STATUS_DOT_CLASS,
  STATUS_KINDS,
  SUMMARY_BUCKETS,
  SUMMARY_DOT_CLASS,
  dominantKind,
  formatDateShort,
  summarize,
  type AttendanceStatusKind,
} from '@/lib/attendance-status'
import {
  WEEKDAYS_MON_FIRST,
  formatMonthTitle,
  monthCells,
  monthKey,
  shiftMonthKey,
  todayIso,
} from '@/lib/calendar-grid'
import type { AttendanceCalendarStrings } from '@/lib/subject-sessions-strings'
import { cn } from '@/lib/utils'

export interface CalendarItem {
  id: number | string
  /** `YYYY-MM-DD`. */
  date: string
  kind: AttendanceStatusKind
  /** Translated status label — read out in the cell's accessible name. */
  label: string
  /** Orders sessions within a day (pips + detail). Usually `start_time`. */
  sortKey?: string
}

/** More pips than this collapse into a `+n`. */
const MAX_PIPS = 3

/**
 * A month of attendance, one cell per day.
 *
 * Each cell answers two questions in order: is a class scheduled on this day
 * (plain vs. coloured), and if so what happened (the status colour). A day
 * with several sessions takes the colour of its strongest status — an absence
 * is never hidden behind a present mark — and shows one pip per session.
 *
 * Everything is derived: the month and the selected day are clamped against
 * the data on every render rather than synced by effects, so a change of
 * `items` (the employee sheet's subject filter) can never leave the view on
 * an empty month or a vanished day.
 */
export function AttendanceCalendar<T extends CalendarItem>({
  items,
  strings,
  renderDay,
  bounds,
  layout = 'auto',
  className,
}: {
  items: readonly T[]
  strings: AttendanceCalendarStrings
  /** The selected day's sessions — the caller's own row renderer. */
  renderDay: (date: string, items: readonly T[]) => React.ReactNode
  /** Hard month bounds (`YYYY-MM-DD`). Default: data ∪ today. */
  bounds?: { from?: string; to?: string }
  /** `auto` → two columns from `lg`; `stacked` → always one column. */
  layout?: 'auto' | 'stacked'
  className?: string
}) {
  const today = todayIso()
  const gridRef = useRef<HTMLDivElement>(null)

  const byDate = useMemo(() => {
    const map = new Map<string, T[]>()
    for (const it of items) {
      const list = map.get(it.date) ?? []
      list.push(it)
      map.set(it.date, list)
    }
    for (const list of map.values()) {
      list.sort((a, b) => (a.sortKey ?? '').localeCompare(b.sortKey ?? ''))
    }
    return map
  }, [items])

  const dates = useMemo(() => [...byDate.keys()].sort(), [byDate])

  const boundFrom = bounds?.from
  const boundTo = bounds?.to
  const [minMonth, maxMonth] = useMemo(() => {
    const first = dates[0]
    const last = dates[dates.length - 1]
    const lo = boundFrom
      ? monthKey(boundFrom)
      : first
        ? monthKey(first)
        : monthKey(today)
    let hi = boundTo
      ? monthKey(boundTo)
      : last
        ? monthKey(last)
        : monthKey(today)
    // Without an explicit ceiling, always let the reader reach the current
    // month — that is where "what is scheduled next" lives.
    if (!boundTo && monthKey(today) > hi) hi = monthKey(today)
    if (hi < lo) hi = lo
    return [lo, hi]
  }, [dates, boundFrom, boundTo, today])

  const initialMonth = useMemo(() => {
    const cur = monthKey(today)
    if (cur >= minMonth && cur <= maxMonth) return cur
    return maxMonth
  }, [today, minMonth, maxMonth])

  const [chosenMonth, setChosenMonth] = useState<string | null>(null)
  const month = clampKey(chosenMonth ?? initialMonth, minMonth, maxMonth)

  const cells = useMemo(() => monthCells(month), [month])
  const monthDates = useMemo(
    () => dates.filter((d) => monthKey(d) === month),
    [dates, month],
  )

  const [chosenDay, setChosenDay] = useState<string | null>(null)
  const selected: string | null =
    chosenDay && monthKey(chosenDay) === month && byDate.has(chosenDay)
      ? chosenDay
      : byDate.has(today) && monthKey(today) === month
        ? today
        : (monthDates[monthDates.length - 1] ?? null)

  const monthKinds = useMemo(
    () => monthDates.flatMap((d) => (byDate.get(d) ?? []).map((i) => i.kind)),
    [monthDates, byDate],
  )
  const summary = useMemo(() => summarize(monthKinds), [monthKinds])

  const legendKinds = useMemo(() => {
    const seen = new Set<AttendanceStatusKind>(['present', 'absent'])
    for (const it of items) seen.add(it.kind)
    return STATUS_KINDS.filter((k) => seen.has(k))
  }, [items])

  const canPrev = month > minMonth
  const canNext = month < maxMonth
  const weekdays = strings.weekdays ?? WEEKDAYS_MON_FIRST
  const monthTitle = strings.monthTitle ?? ((k: string) => formatMonthTitle(k))
  const dayTitle = strings.dayTitle ?? formatDateShort

  const go = (delta: number) => {
    const next = clampKey(shiftMonthKey(month, delta), minMonth, maxMonth)
    setChosenMonth(next)
  }

  /** Roving focus across the month's item-days only. */
  const onGridKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement
    const from = target.dataset.date
    if (!from) return
    const inMonth = monthDates
    const idx = inMonth.indexOf(from)
    if (idx < 0) return
    let to: string | null
    switch (e.key) {
      case 'ArrowRight':
        to = inMonth[idx + 1] ?? null
        break
      case 'ArrowLeft':
        to = inMonth[idx - 1] ?? null
        break
      case 'ArrowDown':
        to = nearestOnOrAfter(inMonth, addDaysIso(from, 7))
        break
      case 'ArrowUp':
        to = nearestOnOrBefore(inMonth, addDaysIso(from, -7))
        break
      case 'Home':
        to = inMonth[0] ?? null
        break
      case 'End':
        to = inMonth[inMonth.length - 1] ?? null
        break
      case 'PageUp':
        if (canPrev) go(-1)
        e.preventDefault()
        return
      case 'PageDown':
        if (canNext) go(1)
        e.preventDefault()
        return
      default:
        return
    }
    e.preventDefault()
    if (!to || to === from) return
    setChosenDay(to)
    const el = gridRef.current?.querySelector<HTMLButtonElement>(
      `[data-date="${to}"]`,
    )
    el?.focus()
  }

  const tabStop = selected ?? monthDates[0] ?? null

  return (
    <div
      className={cn(
        'grid gap-4',
        layout === 'auto' &&
          'lg:grid-cols-[minmax(0,30rem)_minmax(0,1fr)] lg:items-start',
        className,
      )}
    >
      <div className="rounded-xl border bg-card p-3 sm:p-4">
        {/* Month nav */}
        <div className="flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-8"
            onClick={() => go(-1)}
            disabled={!canPrev}
            aria-label={strings.prevMonth}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <h3 className="text-sm font-semibold" aria-live="polite">
            {monthTitle(month)}
          </h3>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-8"
            onClick={() => go(1)}
            disabled={!canNext}
            aria-label={strings.nextMonth}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>

        {/* Month summary */}
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {SUMMARY_BUCKETS.map((b) => {
            if (summary[b] === 0 && b !== 'present' && b !== 'absent') {
              return null
            }
            return (
              <span
                key={b}
                className="inline-flex items-center gap-1.5 tabular-nums"
              >
                <i
                  aria-hidden
                  className={cn('size-2 rounded-full', SUMMARY_DOT_CLASS[b])}
                />
                {strings.summary[b]}{' '}
                <span className="font-medium text-foreground">
                  {summary[b]}
                </span>
              </span>
            )
          })}
        </div>

        {/* Weekday header */}
        <div
          className="mt-3 grid grid-cols-7 gap-1 text-center text-xs font-medium uppercase text-muted-foreground"
          aria-hidden
        >
          {weekdays.map((d, i) => (
            <div key={i} className="py-1">
              {d}
            </div>
          ))}
        </div>

        {/* Grid */}
        <div
          ref={gridRef}
          role="grid"
          aria-label={monthTitle(month)}
          onKeyDown={onGridKeyDown}
          className="grid grid-cols-7 gap-1"
        >
          {cells.map((iso, i) => {
            if (!iso) {
              return <div key={`pad-${i}`} aria-hidden className="aspect-square" />
            }
            const day = Number(iso.slice(8, 10))
            const list = byDate.get(iso)
            const isToday = iso === today
            if (!list || list.length === 0) {
              return (
                <div
                  key={iso}
                  role="gridcell"
                  className={cn(
                    'flex aspect-square items-center justify-center rounded-lg text-sm tabular-nums text-muted-foreground/70',
                    isToday && 'ring-1 ring-inset ring-primary/60',
                  )}
                >
                  {day}
                </div>
              )
            }
            const kinds = list.map((it) => it.kind)
            const dominant = dominantKind(kinds)
            const isSelected = iso === selected
            const label = `${dayTitle(iso)}, ${strings.dayCount(list.length)}: ${list
              .map((it) => it.label)
              .join(', ')}${isToday ? ` (${strings.today})` : ''}`
            return (
              <div key={iso} role="gridcell" className="aspect-square">
                <button
                  type="button"
                  data-date={iso}
                  tabIndex={iso === tabStop ? 0 : -1}
                  aria-pressed={isSelected}
                  aria-label={label}
                  onClick={() => setChosenDay(iso)}
                  className={cn(
                    'flex size-full flex-col items-center justify-center rounded-lg text-sm font-medium tabular-nums outline-none motion-safe:transition-colors',
                    'focus-visible:ring-[3px] focus-visible:ring-ring/50',
                    STATUS_CELL_CLASS[dominant],
                    isToday && !isSelected && 'ring-1 ring-inset ring-primary/60',
                    isSelected && 'font-semibold ring-2 ring-inset ring-ring',
                    !isSelected && 'hover:ring-1 hover:ring-inset hover:ring-ring/40',
                  )}
                >
                  <span className="leading-none">{day}</span>
                  {list.length > 1 ? (
                    <span
                      aria-hidden
                      className="mt-1 flex items-center gap-0.5 leading-none"
                    >
                      {list.slice(0, MAX_PIPS).map((it) => (
                        <i
                          key={it.id}
                          className={cn(
                            'size-1.5 rounded-full',
                            STATUS_DOT_CLASS[it.kind],
                          )}
                        />
                      ))}
                      {list.length > MAX_PIPS ? (
                        <span className="text-[10px] leading-none">
                          +{list.length - MAX_PIPS}
                        </span>
                      ) : null}
                    </span>
                  ) : null}
                </button>
              </div>
            )
          })}
        </div>

        {/* Legend */}
        <div
          className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t pt-3 text-xs text-muted-foreground"
          aria-label={strings.legend}
        >
          {legendKinds.map((k) => (
            <span key={k} className="inline-flex items-center gap-1.5">
              <i
                aria-hidden
                className={cn('size-2 rounded-full', STATUS_DOT_CLASS[k])}
              />
              {strings.statusLabel(k)}
            </span>
          ))}
        </div>
      </div>

      {/* Day detail */}
      <section
        aria-live="polite"
        className={cn(
          'min-w-0 space-y-2',
          layout === 'auto' && 'lg:sticky lg:top-4',
        )}
      >
        {selected ? (
          <>
            <div className="flex items-baseline justify-between gap-2 px-1">
              <h3 className="text-sm font-semibold">{dayTitle(selected)}</h3>
              <span className="text-xs text-muted-foreground tabular-nums">
                {strings.dayCount(byDate.get(selected)?.length ?? 0)}
              </span>
            </div>
            {renderDay(selected, byDate.get(selected) ?? [])}
          </>
        ) : (
          <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
            {strings.noClassesThisMonth}
          </p>
        )}
      </section>
    </div>
  )
}

function clampKey(key: string, lo: string, hi: string): string {
  if (key < lo) return lo
  if (key > hi) return hi
  return key
}

function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`)
  d.setDate(d.getDate() + days)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

/** First entry ≥ `target` in a sorted list, else the last one. */
function nearestOnOrAfter(sorted: readonly string[], target: string) {
  return sorted.find((d) => d >= target) ?? sorted[sorted.length - 1] ?? null
}

/** Last entry ≤ `target` in a sorted list, else the first one. */
function nearestOnOrBefore(sorted: readonly string[], target: string) {
  for (let i = sorted.length - 1; i >= 0; i -= 1) {
    if (sorted[i] <= target) return sorted[i]
  }
  return sorted[0] ?? null
}
