import type { TFunction } from 'i18next'

import {
  STATUS_LABEL_KEY,
  formatDateShort,
  type AttendanceStatusKind,
} from '@/lib/attendance-status'
import { formatMonthTitle } from '@/lib/calendar-grid'
import type { SubjectSessionsStrings } from '@/lib/subject-sessions-strings'

/**
 * The shared sessions view is i18n-free (the student chunk must not carry
 * react-i18next), so the parent pages resolve every string here. Parent-only
 * module: nothing under `components/attendance` may import it.
 */
export function buildParentSessionsStrings(
  t: TFunction,
  lang: string,
): SubjectSessionsStrings {
  const statusLabel = (kind: AttendanceStatusKind) => t(STATUS_LABEL_KEY[kind])
  const locale = lang === 'hi' ? 'hi-IN' : lang === 'te' ? 'te-IN' : 'en-IN'
  return {
    viewLabel: t('subject.viewLabel'),
    viewCalendar: t('subject.viewCalendar'),
    viewList: t('subject.viewList'),
    filterLabel: t('subject.filterLabel'),
    filterAll: t('subject.filterAll'),
    filterAbsent: t('subject.filterAbsent'),
    filterAllSubjects: t('subject.filterAllSubjects'),
    showingAbsent: (n, total) => t('subject.showingAbsent', { n, total }),
    showingAll: (n, absent) => t('subject.showingAll', { n, absent }),
    noAbsences: t('subject.noAbsences'),
    noClassesYet: t('subject.noClassesYet'),
    reason: t('subject.reason'),
    sub: t('subject.sub'),
    retry: t('common.retry'),
    statusLabel,
    calendar: {
      prevMonth: t('subject.prevMonth'),
      nextMonth: t('subject.nextMonth'),
      prevDay: t('subject.prevDay'),
      nextDay: t('subject.nextDay'),
      close: t('subject.close'),
      legend: t('subject.legend'),
      noClassesThisMonth: t('subject.noClassesThisMonth'),
      tapDayHint: t('subject.tapDayHint'),
      today: t('subject.today'),
      dayCount: (n) => t('subject.dayCount', { count: n }),
      daySummary: (n, absent) =>
        absent > 0
          ? `${t('subject.dayCount', { count: n })} · ${t('subject.dayAbsent', { count: absent })}`
          : t('subject.dayCount', { count: n }),
      statusLabel,
      summary: {
        present: t('subject.statusPresent'),
        absent: t('subject.statusAbsent'),
        late: t('subject.statusLate'),
        leave: t('subject.statusLeave'),
        other: t('subject.summaryOther'),
      },
      weekdays: ['1', '2', '3', '4', '5', '6', '7'].map((d) =>
        t(`timetable.dayShort.${d}`),
      ),
      monthTitle: (key) => formatMonthTitle(key, locale),
      dayTitle: (iso) => formatDateShort(iso, locale),
    },
  }
}
