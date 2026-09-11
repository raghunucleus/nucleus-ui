import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from '@tanstack/react-router'
import { ClipboardCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'

import { SubjectSessionsView } from '@/components/attendance/subject-sessions-view'
import { PageHeader } from '@/components/portal-layout'
import { ApiError } from '@/lib/api'
import {
  STATUS_LABEL_KEY,
  formatDateShort,
  type AttendanceStatusKind,
} from '@/lib/attendance-status'
import { formatMonthTitle } from '@/lib/calendar-grid'
import {
  fetchChildSubjectSessions,
  type SubjectSessionsResult,
} from '@/lib/parent-academics'
import type { SubjectSessionsStrings } from '@/lib/subject-sessions-strings'
import { useParentAuthStore } from '@/stores/parent-auth-store'

export default function ParentAttendanceSubject() {
  const { t, i18n } = useTranslation()
  const { subjectId: rawId } = useParams({ strict: false }) as {
    subjectId?: string
  }
  const subjectId = Number(rawId)
  const signOut = useParentAuthStore((s) => s.signOut)
  const [data, setData] = useState<SubjectSessionsResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const requestedRef = useRef(false)

  useEffect(() => {
    document.title = 'Attendance — Nucleus'
  }, [])

  const load = useCallback(async () => {
    if (!Number.isFinite(subjectId)) {
      setError(t('subject.missing'))
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      setData(await fetchChildSubjectSessions(subjectId))
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        signOut()
        return
      }
      setError(err instanceof Error ? err.message : t('subject.errLoad'))
    } finally {
      setLoading(false)
    }
  }, [signOut, subjectId, t])

  useEffect(() => {
    if (requestedRef.current) return
    requestedRef.current = true
    void load()
  }, [load])

  const strings = useMemo(
    () => buildParentStrings(t, i18n.language),
    [t, i18n.language],
  )

  const sessions = data?.sessions ?? []
  const absentCount = sessions.filter(
    (s) => s.attendance_status === 'absent',
  ).length
  const subtitle = data?.subject
    ? t('subject.subtitle', {
        code: data.subject.code,
        n: sessions.length,
        absent: absentCount,
      })
    : undefined

  return (
    <>
      <PageHeader
        title={data?.subject?.name ?? t('subject.titleFallback')}
        subtitle={subtitle}
        icon={ClipboardCheck}
        accent="emerald"
        backTo="/attendance"
        backLabel={t('subject.backToAttendance')}
      />
      <SubjectSessionsView
        data={data}
        loading={loading}
        error={error}
        onRetry={load}
        strings={strings}
      />
    </>
  )
}

/**
 * The shared view is i18n-free (the student chunk must not carry
 * react-i18next), so the parent page resolves every string here.
 */
function buildParentStrings(t: TFunction, lang: string): SubjectSessionsStrings {
  const statusLabel = (kind: AttendanceStatusKind) => t(STATUS_LABEL_KEY[kind])
  const locale = lang === 'hi' ? 'hi-IN' : lang === 'te' ? 'te-IN' : 'en-IN'
  return {
    viewLabel: t('subject.viewLabel'),
    viewCalendar: t('subject.viewCalendar'),
    viewList: t('subject.viewList'),
    filterLabel: t('subject.filterLabel'),
    filterAll: t('subject.filterAll'),
    filterAbsent: t('subject.filterAbsent'),
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
      legend: t('subject.legend'),
      noClassesThisMonth: t('subject.noClassesThisMonth'),
      today: t('subject.today'),
      dayCount: (n) => t('subject.dayCount', { count: n }),
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
