import { useCallback, useEffect, useRef, useState } from 'react'
import { ClipboardCheck } from 'lucide-react'

import { SessionsView } from '@/components/attendance/sessions-view'
import { PageHeader } from '@/components/portal-layout'
import { ApiError } from '@/lib/api'
import {
  fetchStudentAllSessions,
  type AllSessionsResult,
} from '@/lib/student-academics'
import { ALL_SESSIONS_STRINGS_EN } from '@/lib/subject-sessions-strings'
import { useAuthStore } from '@/stores/auth-store'

/** Every subject's classes on one calendar — the "Overall attendance" drill-down. */
export default function AttendanceAll() {
  const signOut = useAuthStore((state) => state.signOut)
  const [data, setData] = useState<AllSessionsResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const requestedRef = useRef(false)

  useEffect(() => {
    document.title = 'All classes — Nucleus'
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await fetchStudentAllSessions())
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        signOut()
        return
      }
      setError(
        err instanceof Error ? err.message : "Couldn't load the classes.",
      )
    } finally {
      setLoading(false)
    }
  }, [signOut])

  useEffect(() => {
    if (requestedRef.current) return
    requestedRef.current = true
    void load()
  }, [load])

  const sessions = data?.sessions ?? []
  const absentCount = sessions.filter(
    (s) => s.attendance_status === 'absent',
  ).length
  const subtitle = data
    ? [
        data.semester.semester_number
          ? `Semester ${data.semester.semester_number}`
          : null,
        `${sessions.length} session${sessions.length === 1 ? '' : 's'}`,
        `${absentCount} absent`,
      ]
        .filter(Boolean)
        .join(' · ')
    : undefined

  return (
    <>
      <PageHeader
        title="All classes"
        subtitle={subtitle}
        icon={ClipboardCheck}
        accent="emerald"
        backTo="/attendance"
        backLabel="Back to attendance"
      />
      <SessionsView
        sessions={data?.sessions ?? null}
        subjects={data?.subjects}
        loading={loading}
        error={error}
        onRetry={load}
        strings={ALL_SESSIONS_STRINGS_EN}
      />
    </>
  )
}
