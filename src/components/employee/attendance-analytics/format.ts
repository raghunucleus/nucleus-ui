import type { DateRangePreset } from '@/components/ui/date-range-picker'
import { ApiError } from '@/lib/api'
import { STATUS_PILL_CLASS } from '@/lib/attendance-status'

/**
 * Constants and formatters shared by every Attendance Analytics tab.
 *
 * Split from `ui.tsx` because a file that exports both components and plain
 * values breaks Fast Refresh — the same reason `chart-chrome.ts` sits beside
 * `drive-analytics.tsx`.
 *
 * Band colours are the one thing that MUST agree across tabs: a student shown
 * amber on the roster and red on the day grid reads as a bug. The band keys
 * themselves come from the server (`thresholds.bands`) so web and any future
 * mobile screen can't drift; only the colour mapping lives here.
 */

/** Server band key → chart/badge colour token. Never hex — repo rule. */
export const BAND_COLOR: Record<string, string> = {
  critical: 'var(--color-icon-rose)',
  low: 'var(--color-icon-orange)',
  condonation: 'var(--color-icon-amber)',
  ok: 'var(--color-icon-cyan)',
  good: 'var(--color-icon-emerald)',
}

/** Tailwind classes for the same bands, for table cells and chips. */
export const BAND_CLASS: Record<string, string> = {
  critical: 'bg-icon-rose/15 text-icon-rose',
  low: 'bg-icon-orange/15 text-icon-orange',
  condonation: 'bg-icon-amber/15 text-icon-amber',
  ok: 'bg-icon-cyan/15 text-icon-cyan',
  good: 'bg-icon-emerald/15 text-icon-emerald',
}

/**
 * Attendance status → colour, shared by the day grid and session drills.
 *
 * An alias of the portal-wide map so an incharge and the student they are
 * looking at see the same colours for the same fact.
 */
export const STATUS_CLASS: Record<string, string> = STATUS_PILL_CLASS

/** Indexed by ISO weekday (1 = Mon), matching `class_sessions.day_of_week`. */
export const WEEKDAYS = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/**
 * The one bounded scroll box every analytics result table uses.
 *
 * A bare `62vh` was fine when the page had no pinned chrome. Now that the
 * header, tabs and scope row are sticky, `chrome + 62vh + toolbar + strip`
 * overflows a 720p laptop — you get a page scrollbar AND a table scrollbar, and
 * the table's own sticky header never reaches its sticky position. Taking the
 * smaller of the two caps keeps it to one scrollbar; `min-h-64` stops the box
 * collapsing to nothing on a short viewport. `svh` (not `vh`) so a mobile
 * browser's retracting toolbar doesn't resize it mid-scroll.
 */
export const RESULT_SCROLL =
  'max-h-[min(62vh,calc(100svh-19rem))] min-h-64 overflow-auto scrollbar-themed'

export const nf = (n: number) => n.toLocaleString('en-IN')

/** One decimal, matching the server's `pct()`. */
export const fmtPct = (n: number) => `${n.toFixed(1)}%`

export function errMsg(e: unknown, fallback: string): string {
  return e instanceof ApiError || e instanceof Error ? e.message : fallback
}

/** `2026-09-07` → `07 Sep`. */
export function shortDay(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    timeZone: 'UTC',
  })
}

/** `2026-09-07` → `07 Sep 2026`. */
export function longDay(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

/** `09:40:00` → `9:40 am`. */
export function clockTime(t: string | null): string {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  if (Number.isNaN(h)) return t
  const suffix = h >= 12 ? 'pm' : 'am'
  const hour = h % 12 === 0 ? 12 : h % 12
  return `${hour}:${String(m ?? 0).padStart(2, '0')} ${suffix}`
}

/**
 * Band for a percentage, mirroring the server's `ATTENDANCE_BANDS` cut-points.
 * Only for payloads that carry a percentage without its band (the day grid);
 * everywhere else, render the band the server sent.
 */
export function bandOf(pct: number): string {
  if (pct < 50) return 'critical'
  if (pct < 65) return 'low'
  if (pct < 75) return 'condonation'
  if (pct < 85) return 'ok'
  return 'good'
}

// ---------------------------------------------------------------------------
// Thresholds
//
// The server hardcodes 75% (`DEFAULT_THRESHOLD`) and ships `below_threshold` /
// `sessions_needed` already computed against it. The Defaulters tab lets the
// incharge move that cutoff, so the same two answers have to be recomputed
// here — from the raw `attended`/`held` the server used, which ride on every
// `StudentRow`.
//
// At 75 these reproduce the server's values exactly; that equivalence is what
// lets one code path serve both the Students tab (fixed 75) and Defaulters.
// ---------------------------------------------------------------------------

/** The official exam-eligibility cutoff, and the Defaulters tab's default. */
export const DEFAULT_THRESHOLD = 75

/** Highest selectable cutoff. 100 would divide by zero in `projectionAt`. */
export const MAX_THRESHOLD = 99

/** Mirrors the server's `pct()`: one decimal, 0 when nothing was held. */
export function pctOf(attended: number, held: number): number {
  if (held <= 0) return 0
  return Math.round((attended / held) * 1000) / 10
}

/**
 * Mirrors the server's `thresholds()`.
 *
 * Compares the RAW ratio, never the rounded percentage: `pct()` rounds 74.96
 * to `75.0`, so `pct < 75` would drop a real defaulter off a detention list.
 * A student with nothing held is never a defaulter.
 */
export function isBelow(
  attended: number,
  held: number,
  threshold: number,
): boolean {
  if (held <= 0) return false
  return (attended / held) * 100 < threshold
}

/**
 * Mirrors the server's `projection()` at an arbitrary cutoff: how many more
 * consecutive classes clear the threshold, and the best percentage still
 * reachable if the student attends everything left.
 *
 * `sessions_needed` is null when even a perfect run falls short.
 */
export function projectionAt(
  attended: number,
  held: number,
  remaining: number,
  threshold: number,
): { sessions_needed: number | null; max_achievable_pct: number } {
  const t = Math.min(threshold, MAX_THRESHOLD) / 100
  const max_achievable_pct = pctOf(attended + remaining, held + remaining)
  if (held > 0 && attended / held >= t) {
    return { sessions_needed: 0, max_achievable_pct }
  }
  // attend `n` more of the remaining: (attended + n) / (held + n) >= t
  const n = Math.ceil((t * held - attended) / (1 - t))
  return {
    sessions_needed: n > remaining ? null : Math.max(n, 0),
    max_achievable_pct,
  }
}

// ---------------------------------------------------------------------------
// Sorting
//
// One sort state per tab, driven by BOTH the toolbar dropdown and the table
// headers — two controls over one value, so they can never disagree.
// ---------------------------------------------------------------------------

export type SortDir = 'asc' | 'desc'

export interface SortState<K extends string> {
  by: K
  dir: SortDir
}

/**
 * What a click on a header (or a menu row) should produce: the same field flips
 * direction, a new field starts at whatever direction reads naturally for it —
 * ascending for names, descending for "how many classes has this teacher not
 * marked".
 */
export function nextSort<K extends string>(
  current: SortState<K>,
  by: K,
  dir: SortDir = 'asc',
): SortState<K> {
  return current.by === by
    ? { by, dir: current.dir === 'asc' ? 'desc' : 'asc' }
    : { by, dir }
}

/**
 * Numeric compare that keeps "no data" at the BOTTOM in both directions.
 *
 * Every one of these columns renders `—` when the value is missing — a student
 * with nothing held, a subject they are not enrolled in, a class nobody marked.
 * Flipping to descending must not lift that wall of dashes to the top, so the
 * null branch is decided before `dir` is applied.
 */
export function cmpNum(
  a: number | null,
  b: number | null,
  dir: SortDir,
): number {
  if (a === null || Number.isNaN(a)) return b === null ? 0 : 1
  if (b === null || Number.isNaN(b)) return -1
  return dir === 'asc' ? a - b : b - a
}

/** The same rule for text. An empty string counts as missing. */
export function cmpText(
  a: string | null,
  b: string | null,
  dir: SortDir,
): number {
  if (!a) return !b ? 0 : 1
  if (!b) return -1
  const c = a.localeCompare(b)
  return dir === 'asc' ? c : -c
}

// ---------------------------------------------------------------------------
// Scope date presets
// ---------------------------------------------------------------------------

/** Local-time `YYYY-MM-DD`, matching `toIsoDate` in lib/teacher-attendance. */
function toIso(d: Date): string {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function shift(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`)
  d.setDate(d.getDate() + days)
  return toIso(d)
}

/**
 * The ranges an incharge actually asks for, clamped to the semester.
 *
 * The first entry clears the range, which is the meaningful default: with no
 * dates the server answers from the same rollup the student dashboard reads, so
 * the percentages are the official ones. Every other preset switches to a live
 * session scan — hence the basis chip.
 *
 * Clamping matters beyond tidiness: `/daily/:date` 403s on a date outside the
 * active window, and a preset reaching past the semester (or into the future,
 * where there is no attendance) would produce an empty view that reads as a
 * data fault. A preset whose clamped window collapses is dropped rather than
 * shown as an empty span.
 */
export function rangePresets(
  today: string,
  semester?: {
    planned_start_date: string | null
    planned_end_date: string | null
  } | null,
): DateRangePreset[] {
  // ISO dates compare lexicographically, so these are plain date comparisons.
  const floor = semester?.planned_start_date ?? null
  const ceil = semester?.planned_end_date
    ? semester.planned_end_date < today
      ? semester.planned_end_date
      : today
    : today

  const now = new Date(`${today}T00:00:00`)
  // Monday-first, matching CalendarPanel's week.
  const dow = now.getDay()
  const weekStart = shift(today, -(dow === 0 ? 6 : dow - 1))
  const monthStart = toIso(new Date(now.getFullYear(), now.getMonth(), 1))

  const spans: Array<{ key: string; label: string; from: string }> = [
    { key: 'week', label: 'This week', from: weekStart },
    { key: 'month', label: 'This month', from: monthStart },
    { key: 'last30', label: 'Last 30 days', from: shift(today, -29) },
  ]

  const presets: DateRangePreset[] = [
    { key: 'all', label: 'Whole semester' },
  ]
  for (const s of spans) {
    const from = floor && s.from < floor ? floor : s.from
    if (from > ceil) continue
    presets.push({ key: s.key, label: s.label, from, to: ceil })
  }
  return presets
}

// ---------------------------------------------------------------------------
// Remembered picker state
//
// Private-mode browsers throw on both read and write; a forgotten picker is
// never worth failing the page over.
// ---------------------------------------------------------------------------

export function readStored(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export function writeStored(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Ignored — see above.
  }
}
