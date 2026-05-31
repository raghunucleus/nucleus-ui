// Shared holiday types + presentation helpers used by both the student and
// employee academic-calendar pages. Pure data/formatting — no auth or fetch
// here; each surface adds its own scoped fetcher (see student-academics.ts /
// employee-academics.ts).

export type AcademicHolidayScope = 'institution' | 'programme' | 'group'
export type AcademicHolidayType =
  | 'public'
  | 'institutional'
  | 'unplanned'
  | 'half_day'

export interface AcademicHoliday {
  id: number
  date: string
  end_date: string | null
  name: string
  type: AcademicHolidayType
  scope: AcademicHolidayScope
  reason: string | null
}

/** Local-time ISO date (YYYY-MM-DD) for the given Date. */
export function toIsoDate(date: Date): string {
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

/** Inclusive `[from, to]` window covering a whole calendar year. */
export function yearWindow(year: number): { from: string; to: string } {
  return { from: `${year}-01-01`, to: `${year}-12-31` }
}

/** Inclusive `[from, to]` window covering a single calendar month (1-based). */
export function monthWindow(
  year: number,
  month: number,
): { from: string; to: string } {
  const mm = String(month).padStart(2, '0')
  // Day 0 of the next month is the last day of this one — handles 28/29/30/31.
  const lastDay = new Date(year, month, 0).getDate()
  return {
    from: `${year}-${mm}-01`,
    to: `${year}-${mm}-${String(lastDay).padStart(2, '0')}`,
  }
}

export const MONTH_LABELS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const

export const HOLIDAY_TYPE_LABEL: Record<AcademicHolidayType, string> = {
  public: 'Public holiday',
  institutional: 'Institutional',
  unplanned: 'Unplanned',
  half_day: 'Half-day',
}

/** Accent hue per type — pairs with the `--icon-*` design tokens. */
export const HOLIDAY_TYPE_COLOR: Record<AcademicHolidayType, string> = {
  public: 'bg-icon-emerald/10 text-icon-emerald',
  institutional: 'bg-icon-blue/10 text-icon-blue',
  unplanned: 'bg-icon-rose/10 text-icon-rose',
  half_day: 'bg-icon-amber/10 text-icon-amber',
}

/** "Mon, 12 Aug" — weekday + day + month for a single calendar date. */
export function holidayDateLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  })
}

/** Single day, or a "start – end" range for multi-day breaks. */
export function holidayRangeLabel(h: AcademicHoliday): string {
  if (!h.end_date || h.end_date === h.date) return holidayDateLabel(h.date)
  return `${holidayDateLabel(h.date)} – ${holidayDateLabel(h.end_date)}`
}

/** Number of days a holiday spans (1 for a single day). */
export function holidayDayCount(h: AcademicHoliday): number {
  if (!h.end_date || h.end_date === h.date) return 1
  const start = new Date(`${h.date}T00:00:00`).getTime()
  const end = new Date(`${h.end_date}T00:00:00`).getTime()
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return 1
  return Math.round((end - start) / (24 * 60 * 60 * 1000)) + 1
}

/** True once the holiday (and its whole range) is in the past, relative to
 *  the local calendar day. Past entries are dimmed but still listed. */
export function holidayIsPast(h: AcademicHoliday, today: string): boolean {
  return (h.end_date ?? h.date) < today
}

export interface HolidayMonthGroup {
  /** Stable key, e.g. "2026-08". */
  key: string
  /** "August 2026". */
  label: string
  holidays: AcademicHoliday[]
}

/**
 * Group holidays into month buckets keyed by their start date. Group order
 * follows `order` ('asc' = oldest month first, the default; 'desc' = newest
 * first, for the past view). Within a bucket the input order is preserved, so
 * callers that pass a DESC-sorted list get newest-first rows too.
 */
export function groupHolidaysByMonth(
  holidays: AcademicHoliday[],
  order: 'asc' | 'desc' = 'asc',
): HolidayMonthGroup[] {
  const buckets = new Map<string, HolidayMonthGroup>()
  for (const h of holidays) {
    const key = h.date.slice(0, 7) // YYYY-MM
    let group = buckets.get(key)
    if (!group) {
      const d = new Date(`${h.date}T00:00:00`)
      const label = Number.isNaN(d.getTime())
        ? key
        : d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
      group = { key, label, holidays: [] }
      buckets.set(key, group)
    }
    group.holidays.push(h)
  }
  return Array.from(buckets.values()).sort((a, b) =>
    order === 'desc' ? b.key.localeCompare(a.key) : a.key.localeCompare(b.key),
  )
}
