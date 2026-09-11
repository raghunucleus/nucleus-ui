import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from '@tanstack/react-router'
import { ClipboardCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { SessionsView } from '@/components/attendance/sessions-view'
import { PageHeader } from '@/components/portal-layout'
import { ApiError } from '@/lib/api'
import {
  fetchChildSubjectSessions,
  type SubjectSessionsResult,
} from '@/lib/parent-academics'
import { useParentAuthStore } from '@/stores/parent-auth-store'
import { buildParentSessionsStrings } from './parent-sessions-strings'

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
    () => buildParentSessionsStrings(t, i18n.language),
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
      <SessionsView
        sessions={data?.sessions ?? null}
        loading={loading}
        error={error}
        onRetry={load}
        strings={strings}
      />
    </>
  )
}
