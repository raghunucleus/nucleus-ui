/**
 * Month bucketing for the birthdays screens — shared by the student and the
 * employee page, which carry different row shapes but the same calendar.
 *
 * The server returns one row per person with the date of their NEXT birthday
 * (never the birth year), so a cohort spans a rolling 365 days. Rather than
 * scrolling that as one list, the screens browse it a month at a time: twelve
 * buckets starting at the current month, each with its own count.
 *
 * Everything here is pure and works on `YYYY-MM-DD` strings, so bucketing
 * never touches a timezone. `today` is passed in by the caller (once, from
 * `todayIso()`) instead of being read here, so the result is stable for a
 * given render.
 */

import { formatMonthTitle, shiftMonthKey } from './calendar-grid'

/** The fields month bucketing needs — both `BirthdayPerson` shapes satisfy it. */
export interface BirthdayLike {
  id: number
  display_name: string
  /** Days from today until the next occurrence; 0 = today. */
  days_until: number
  /** ISO date of the next occurrence. */
  date: string
}

/** One month of the rolling year, with the people whose birthday falls in it. */
export interface BirthdayMonthBucket<T extends BirthdayLike> {
  /** `YYYY-MM` — this year for months from now on, next year once it wraps. */
  key: string
  /** Chip label — "Sep". */
  short: string
  /** Header — "September 2026". */
  title: string
  /** Still to come, earliest first. Today's people are never here. */
  upcoming: T[]
  /** Current month only: already celebrated this year, so the next one is a year out. */
  passed: T[]
}

/**
 * Fixed three-letter labels rather than `Intl`, which renders September as
 * "Sept" — one chip wider than the other eleven, and out of step with the
 * mobile apps' own table.
 */
const MONTH_LABELS_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

const WEEKDAY_SHORT = new Intl.DateTimeFormat('en-IN', { weekday: 'short' })

/** `2026-09-14` → a local-time Date, with no timezone parsing surprises. */
function localDate(iso: string): Date | null {
  const y = Number(iso.slice(0, 4))
  const m = Number(iso.slice(5, 7))
  const d = Number(iso.slice(8, 10))
  if (!y || !m || !d) return null
  const date = new Date(y, m - 1, d)
  return Number.isNaN(date.getTime()) ? null : date
}

/** Day of month then name — the order within one month. */
function byDayThenName<T extends BirthdayLike>(a: T, b: T): number {
  return (
    a.date.slice(8, 10).localeCompare(b.date.slice(8, 10)) ||
    a.display_name.localeCompare(b.display_name)
  )
}

/**
 * Twelve buckets in rolling order from the current month. Everyone whose
 * birthday is not today lands in exactly one of them: the month whose number
 * matches their next occurrence. In the current month that splits two ways —
 * a date still in this year is upcoming, one that has rolled into next year
 * was celebrated earlier this month.
 */
export function birthdayMonths<T extends BirthdayLike>(
  people: readonly T[],
  today: string,
): BirthdayMonthBucket<T>[] {
  const current = today.slice(0, 7)
  const buckets: BirthdayMonthBucket<T>[] = Array.from({ length: 12 }, (_, i) => {
    const key = shiftMonthKey(current, i)
    return {
      key,
      short: monthShort(key),
      title: formatMonthTitle(key),
      upcoming: [],
      passed: [],
    }
  })

  const byMonthNumber = new Map(buckets.map((b) => [b.key.slice(5, 7), b]))
  for (const person of people) {
    // Today's people live in their own card, never in a month list.
    if (person.days_until <= 0) continue
    const bucket = byMonthNumber.get(person.date.slice(5, 7))
    if (!bucket) continue
    if (bucket === buckets[0] && person.date.slice(0, 7) !== current) {
      bucket.passed.push(person)
    } else {
      bucket.upcoming.push(person)
    }
  }

  for (const bucket of buckets) {
    bucket.upcoming.sort(byDayThenName)
    bucket.passed.sort(byDayThenName)
  }
  return buckets
}

/** `2026-09` → `Sep`. */
export function monthShort(key: string): string {
  return MONTH_LABELS_SHORT[Number(key.slice(5, 7)) - 1] ?? key
}

/**
 * The date a row should show. For an already-celebrated person the stored
 * date is next year's, so the weekday is taken from the month being browsed.
 */
export function rowDate(monthKey: string, iso: string): string {
  return `${monthKey}-${iso.slice(8, 10)}`
}

/** `2026-09-14` → `{ day: '14', weekday: 'Sat' }` for the leading date tile. */
export function dayParts(iso: string): { day: string; weekday: string } {
  const date = localDate(iso)
  return {
    day: iso.slice(8, 10),
    weekday: date ? WEEKDAY_SHORT.format(date) : '',
  }
}

/** "Sat, 12 Jun" — the full date, used where no month header gives context. */
export function fullDateLabel(iso: string): string {
  const { day, weekday } = dayParts(iso)
  if (!weekday) return ''
  return `${weekday}, ${day} ${monthShort(iso.slice(0, 7))}`
}

/** A nudge for the birthdays worth noticing; empty for anything further out. */
export function soonLabel(daysUntil: number): string {
  if (daysUntil === 1) return 'Tomorrow'
  if (daysUntil > 1 && daysUntil <= 7) return `In ${daysUntil} days`
  return ''
}

/** "4 birthdays" — the month header's subtitle. */
export function countLabel(count: number): string {
  if (count === 0) return 'No birthdays'
  return `${count} birthday${count === 1 ? '' : 's'}`
}

/**
 * Search a person by name or code. The whole cohort is already in memory, so
 * this replaces the server's `q` — results are instant and span the year.
 */
export function matchesQuery(query: string, ...values: (string | null)[]): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return values.some((value) => value != null && value.toLowerCase().includes(q))
}

/** The server's page cap (`MAX_LIMIT`). */
const FETCH_PAGE = 100
/** Refuse to spin forever if `total` ever disagrees with what comes back. */
const FETCH_MAX_PAGES = 20

/**
 * Every person in the caller's cohort, by walking the paged endpoint. A cohort
 * is one section or one department, so this is a handful of requests at most —
 * and once it is in memory, month switching and search cost nothing.
 */
export async function fetchWholeCohort<T extends { id: number }>(
  fetchPage: (params: { limit: number; offset: number }) => Promise<{
    total: number
    items: T[]
  }>,
): Promise<T[]> {
  const byId = new Map<number, T>()
  for (let page = 0; page < FETCH_MAX_PAGES; page += 1) {
    const { items, total } = await fetchPage({
      limit: FETCH_PAGE,
      offset: byId.size,
    })
    for (const item of items) byId.set(item.id, item)
    if (items.length < FETCH_PAGE || byId.size >= total) break
  }
  return [...byId.values()]
}
