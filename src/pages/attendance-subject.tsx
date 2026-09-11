import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from '@tanstack/react-router'
import { ClipboardCheck } from 'lucide-react'

import { SessionsView } from '@/components/attendance/sessions-view'
import { PageHeader } from '@/components/portal-layout'
import { ApiError } from '@/lib/api'
import {
  fetchStudentSubjectSessions,
  type SubjectSessionsResult,
} from '@/lib/student-academics'
import { SUBJECT_SESSIONS_STRINGS_EN } from '@/lib/subject-sessions-strings'
import { useAuthStore } from '@/stores/auth-store'

export default function AttendanceSubject() {
  const { subjectId: rawId } = useParams({ strict: false }) as {
    subjectId?: string
  }
  const subjectId = Number(rawId)
  const signOut = useAuthStore((state) => state.signOut)
  const [data, setData] = useState<SubjectSessionsResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const requestedRef = useRef(false)

  useEffect(() => {
    document.title = 'Attendance — Nucleus'
  }, [])

  const load = useCallback(async () => {
    if (!Number.isFinite(subjectId)) {
      setError('Missing subject.')
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetchStudentSubjectSessions(subjectId)
      setData(res)
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        signOut()
        return
      }
      setError(
        err instanceof Error
          ? err.message
          : "Couldn't load this subject's sessions.",
      )
    } finally {
      setLoading(false)
    }
  }, [signOut, subjectId])

  useEffect(() => {
    if (requestedRef.current) return
    requestedRef.current = true
    void load()
  }, [load])

  const sessions = data?.sessions ?? []
  const absentCount = sessions.filter(
    (s) => s.attendance_status === 'absent',
  ).length
  const subtitle = data?.subject
    ? `${data.subject.code} · ${sessions.length} session${sessions.length === 1 ? '' : 's'} · ${absentCount} absent`
    : undefined

  return (
    <>
      <PageHeader
        title={data?.subject?.name ?? 'Subject attendance'}
        subtitle={subtitle}
        icon={ClipboardCheck}
        accent="emerald"
        backTo="/attendance"
        backLabel="Back to attendance"
      />
      <SessionsView
        sessions={data?.sessions ?? null}
        loading={loading}
        error={error}
        onRetry={load}
        strings={SUBJECT_SESSIONS_STRINGS_EN}
      />
    </>
  )
}
