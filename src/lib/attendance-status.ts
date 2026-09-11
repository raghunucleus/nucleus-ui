import type { SubjectSessionRow } from '@/lib/student-academics'

/**
 * The one attendance status model every role's UI reads from.
 *
 * Student, parent and employee screens each used to carry their own copy of
 * the status → colour / label mapping, and the employee copy had drifted onto
 * a different palette. A student shown "Leave" in violet on their own portal
 * and "leave" in blue on the incharge's sheet reads as two different facts.
 *
 * Nothing here may import i18n: the student chunk must stay free of
 * `react-i18next`, so the parent portal resolves `STATUS_LABEL_KEY` itself.
 */

export type AttendanceStatusKind =
  | 'present'
  | 'absent'
  | 'late'
  | 'od'
  | 'exempt'
  | 'leave'
  | 'cancelled'
  | 'unmarked'
  | 'upcoming'

/** Canonical order for legends and summaries. */
export const STATUS_KINDS: readonly AttendanceStatusKind[] = [
  'present',
  'late',
  'absent',
  'leave',
  'od',
  'exempt',
  'unmarked',
  'upcoming',
  'cancelled',
]

/** English labels — student and employee portals. */
export const STATUS_LABEL: Record<AttendanceStatusKind, string> = {
  present: 'Present',
  absent: 'Absent',
  late: 'Late',
  od: 'OD',
  exempt: 'Exempt',
  leave: 'Leave',
  cancelled: 'Cancelled',
  unmarked: 'Not marked',
  upcoming: 'Upcoming',
}

/** Parent-portal i18n keys for the same labels; the page resolves them. */
export const STATUS_LABEL_KEY: Record<AttendanceStatusKind, string> = {
  present: 'subject.statusPresent',
  absent: 'subject.statusAbsent',
  late: 'subject.statusLate',
  od: 'subject.statusOd',
  exempt: 'subject.statusExempt',
  leave: 'subject.statusLeave',
  cancelled: 'subject.statusCancelled',
  unmarked: 'subject.statusUnmarked',
  upcoming: 'subject.statusUpcoming',
}

/** Pill / badge classes. Tokens only — never hex (repo rule). */
export const STATUS_PILL_CLASS: Record<AttendanceStatusKind, string> = {
  present: 'bg-success/15 text-success',
  absent: 'bg-destructive/15 text-destructive',
  late: 'bg-warning/15 text-warning',
  od: 'bg-primary/15 text-primary',
  exempt: 'bg-primary/10 text-primary',
  leave: 'bg-icon-violet/15 text-icon-violet',
  cancelled: 'bg-muted text-muted-foreground line-through',
  unmarked: 'bg-muted text-muted-foreground',
  upcoming: 'bg-muted text-muted-foreground',
}

/**
 * Calendar day-cell fill. `upcoming` is deliberately NOT tinted: a dashed
 * outline says "a class is scheduled here" without pretending anything has
 * happened yet.
 */
export const STATUS_CELL_CLASS: Record<AttendanceStatusKind, string> = {
  present: 'bg-success/15 text-success',
  absent: 'bg-destructive/15 text-destructive',
  late: 'bg-warning/15 text-warning',
  od: 'bg-primary/15 text-primary',
  exempt: 'bg-primary/10 text-primary',
  leave: 'bg-icon-violet/15 text-icon-violet',
  cancelled: 'bg-muted/60 text-muted-foreground',
  unmarked: 'bg-muted/60 text-muted-foreground',
  upcoming: 'border border-dashed border-border text-muted-foreground',
}

/** Legend dots and the per-session pips inside a multi-session cell. */
export const STATUS_DOT_CLASS: Record<AttendanceStatusKind, string> = {
  present: 'bg-success',
  absent: 'bg-destructive',
  late: 'bg-warning',
  od: 'bg-primary',
  exempt: 'bg-primary/70',
  leave: 'bg-icon-violet',
  cancelled: 'bg-muted-foreground/40',
  unmarked: 'bg-muted-foreground/40',
  upcoming: 'border border-dashed border-muted-foreground/60',
}

/**
 * Which status colours a day that holds several sessions — lower wins. An
 * absence must never be hidden behind a present mark on the same day.
 */
export const STATUS_PRIORITY: Record<AttendanceStatusKind, number> = {
  absent: 0,
  late: 1,
  leave: 2,
  od: 3,
  exempt: 4,
  present: 5,
  unmarked: 6,
  upcoming: 7,
  cancelled: 8,
}

export function dominantKind(
  kinds: readonly AttendanceStatusKind[],
): AttendanceStatusKind {
  let best: AttendanceStatusKind = 'cancelled'
  for (const k of kinds) {
    if (STATUS_PRIORITY[k] < STATUS_PRIORITY[best]) best = k
  }
  return best
}

/** `iso` is `YYYY-MM-DD`; compared at local midnight. */
export function isFutureDate(iso: string): boolean {
  const today = new Date()
  const d = new Date(`${iso}T00:00:00`)
  today.setHours(0, 0, 0, 0)
  return d.getTime() > today.getTime()
}

/**
 * Student / parent rows: the stored mark wins; an approved leave covering an
 * unmarked day shows as Leave rather than Upcoming; the rest is by date.
 */
export function deriveSessionStatus(s: SubjectSessionRow): AttendanceStatusKind {
  if (s.session_status === 'cancelled') return 'cancelled'
  switch (s.attendance_status) {
    case 'present':
    case 'absent':
    case 'late':
    case 'od':
    case 'exempt':
    case 'leave':
      return s.attendance_status
    default:
      break
  }
  if (s.on_leave) return 'leave'
  if (isFutureDate(s.date)) return 'upcoming'
  return 'unmarked'
}

/** Employee analytics rows carry the raw mark string. */
export function markToStatusKind(status: string): AttendanceStatusKind {
  switch (status) {
    case 'present':
    case 'absent':
    case 'late':
    case 'od':
    case 'exempt':
    case 'leave':
      return status
    default:
      return 'unmarked'
  }
}

/** Month summary buckets. Cancelled / unmarked / upcoming are not counted. */
export type SummaryBucket = 'present' | 'absent' | 'late' | 'leave' | 'other'

export const SUMMARY_BUCKETS: readonly SummaryBucket[] = [
  'present',
  'absent',
  'late',
  'leave',
  'other',
]

export const SUMMARY_DOT_CLASS: Record<SummaryBucket, string> = {
  present: STATUS_DOT_CLASS.present,
  absent: STATUS_DOT_CLASS.absent,
  late: STATUS_DOT_CLASS.late,
  leave: STATUS_DOT_CLASS.leave,
  other: STATUS_DOT_CLASS.od,
}

export function summaryBucket(kind: AttendanceStatusKind): SummaryBucket | null {
  switch (kind) {
    case 'present':
    case 'absent':
    case 'late':
    case 'leave':
      return kind
    case 'od':
    case 'exempt':
      return 'other'
    default:
      return null
  }
}

export function summarize(
  kinds: readonly AttendanceStatusKind[],
): Record<SummaryBucket, number> {
  const out: Record<SummaryBucket, number> = {
    present: 0,
    absent: 0,
    late: 0,
    leave: 0,
    other: 0,
  }
  for (const k of kinds) {
    const b = summaryBucket(k)
    if (b) out[b] += 1
  }
  return out
}

/** `2026-09-03` → `Wed 03 Sep`. */
export function formatDateShort(iso: string, locale = 'en-IN'): string {
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  }).format(d)
}
