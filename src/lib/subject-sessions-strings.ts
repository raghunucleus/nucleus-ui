import {
  STATUS_LABEL,
  type AttendanceStatusKind,
  type SummaryBucket,
} from '@/lib/attendance-status'

/**
 * Copy for the shared subject-sessions view and the attendance calendar.
 *
 * Student and employee pass the English constant; the parent portal builds
 * the same shape from `t()` inside its page so `react-i18next` never enters
 * the shared components (the student chunk must not carry it).
 */

export interface AttendanceCalendarStrings {
  prevMonth: string
  nextMonth: string
  legend: string
  noClassesThisMonth: string
  /** Visually-hidden marker on today's cell. */
  today: string
  /** "3 classes" — aria-labels and the day-detail heading. */
  dayCount: (n: number) => string
  statusLabel: (kind: AttendanceStatusKind) => string
  summary: Record<SummaryBucket, string>
  /** Monday-first, two-letter. Defaults to `WEEKDAYS_MON_FIRST`. */
  weekdays?: readonly string[]
  /** Defaults to `formatMonthTitle(key, 'en-IN')`. */
  monthTitle?: (key: string) => string
  /** Heading of the day-detail panel. Defaults to `formatDateShort`. */
  dayTitle?: (iso: string) => string
}

export interface SubjectSessionsStrings {
  viewLabel: string
  viewCalendar: string
  viewList: string
  filterLabel: string
  filterAll: string
  filterAbsent: string
  showingAbsent: (n: number, total: number) => string
  showingAll: (n: number, absent: number) => string
  noAbsences: string
  noClassesYet: string
  reason: string
  sub: string
  retry: string
  statusLabel: (kind: AttendanceStatusKind) => string
  calendar: AttendanceCalendarStrings
}

const statusLabelEn = (kind: AttendanceStatusKind) => STATUS_LABEL[kind]

export const ATTENDANCE_CALENDAR_STRINGS_EN: AttendanceCalendarStrings = {
  prevMonth: 'Previous month',
  nextMonth: 'Next month',
  legend: 'Legend',
  noClassesThisMonth: 'No classes this month.',
  today: 'Today',
  dayCount: (n) => `${n} class${n === 1 ? '' : 'es'}`,
  statusLabel: statusLabelEn,
  summary: {
    present: 'Present',
    absent: 'Absent',
    late: 'Late',
    leave: 'Leave',
    other: 'Other',
  },
}

export const SUBJECT_SESSIONS_STRINGS_EN: SubjectSessionsStrings = {
  viewLabel: 'View',
  viewCalendar: 'Calendar',
  viewList: 'List',
  filterLabel: 'Filter sessions',
  filterAll: 'All classes',
  filterAbsent: 'Only absent',
  showingAbsent: (n, total) => `Showing ${n} absent of ${total} total`,
  showingAll: (n, absent) =>
    `Showing all ${n} class${n === 1 ? '' : 'es'} · ${absent} absent`,
  noAbsences: 'No absences recorded — keep it going.',
  noClassesYet: 'No classes recorded for this subject yet.',
  reason: 'Reason:',
  sub: 'Sub',
  retry: 'Retry',
  statusLabel: statusLabelEn,
  calendar: ATTENDANCE_CALENDAR_STRINGS_EN,
}
