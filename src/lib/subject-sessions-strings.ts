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
  /** Day-sheet chevrons (phone widths). */
  prevDay: string
  nextDay: string
  close: string
  legend: string
  noClassesThisMonth: string
  /** Under the grid on phones, where the inline panel used to be. */
  tapDayHint: string
  /** Visually-hidden marker on today's cell; a badge in the day sheet. */
  today: string
  /** "3 classes" — aria-labels and the day-detail heading. */
  dayCount: (n: number) => string
  /** "3 classes · 1 absent" — the day sheet's subtitle. */
  daySummary: (n: number, absent: number) => string
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
  /** The "every subject" chip on the all-subjects view. */
  filterAllSubjects: string
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
  prevDay: 'Previous day',
  nextDay: 'Next day',
  close: 'Close',
  legend: 'Legend',
  noClassesThisMonth: 'No classes this month.',
  tapDayHint: 'Tap a day to see its classes.',
  today: 'Today',
  dayCount: (n) => `${n} class${n === 1 ? '' : 'es'}`,
  daySummary: (n, absent) =>
    `${n} class${n === 1 ? '' : 'es'}${absent > 0 ? ` · ${absent} absent` : ''}`,
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
  filterAllSubjects: 'All subjects',
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

/** The all-subjects page: same copy, semester-wide empty state. */
export const ALL_SESSIONS_STRINGS_EN: SubjectSessionsStrings = {
  ...SUBJECT_SESSIONS_STRINGS_EN,
  noClassesYet: 'No classes recorded this semester yet.',
}
