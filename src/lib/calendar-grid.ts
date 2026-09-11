/**
 * Month-grid arithmetic on ISO strings.
 *
 * Every key is a plain `YYYY-MM` / `YYYY-MM-DD` string so bucketing and
 * comparison never touch `Date` (and therefore never touch a timezone). A
 * `Date` is only built at the edges — to count the days in a month, and to
 * format a title for display.
 *
 * `date-picker.tsx` has its own private grid helper; it is a single-select
 * picker and its helpers are not exported, so this module stands alone.
 */

export const WEEKDAYS_MON_FIRST = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

export function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** `2026-09-03` → `2026-09`. */
export function monthKey(iso: string): string {
  return iso.slice(0, 7)
}

export function shiftMonthKey(key: string, delta: number): string {
  const y = Number(key.slice(0, 4))
  const m = Number(key.slice(5, 7))
  const idx = y * 12 + (m - 1) + delta
  const ny = Math.floor(idx / 12)
  const nm = (idx % 12) + 1
  return `${ny}-${pad2(nm)}`
}

/**
 * The 7-column grid for a month, Monday-first. Slots before the 1st and after
 * the last day are `null`; every real day is its ISO string so callers key
 * straight into their data.
 */
export function monthCells(key: string): (string | null)[] {
  const y = Number(key.slice(0, 4))
  const m = Number(key.slice(5, 7))
  const first = new Date(y, m - 1, 1)
  // getDay(): 0=Sun..6=Sat → Monday-first index 0=Mon..6=Sun.
  const lead = (first.getDay() + 6) % 7
  const daysInMonth = new Date(y, m, 0).getDate()
  const cells: (string | null)[] = []
  for (let i = 0; i < lead; i += 1) cells.push(null)
  for (let d = 1; d <= daysInMonth; d += 1) {
    cells.push(`${y}-${pad2(m)}-${pad2(d)}`)
  }
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

/** Local-time `YYYY-MM-DD` for today. */
export function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

/** `2026-09` → `September 2026` in the given locale. */
export function formatMonthTitle(key: string, locale = 'en-IN'): string {
  const y = Number(key.slice(0, 4))
  const m = Number(key.slice(5, 7))
  return new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric',
  }).format(new Date(y, m - 1, 1))
}
