import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ClipboardCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { SessionsView } from '@/components/attendance/sessions-view'
import { PageHeader } from '@/components/portal-layout'
import { ApiError } from '@/lib/api'
import {
  fetchChildAllSessions,
  type AllSessionsResult,
} from '@/lib/parent-academics'
import { useParentAuthStore } from '@/stores/parent-auth-store'
import { buildParentSessionsStrings } from './parent-sessions-strings'

/** Every subject's classes on one calendar — the "Overall attendance" drill-down. */
export default function ParentAttendanceAll() {
  const { t, i18n } = useTranslation()
  const signOut = useParentAuthStore((s) => s.signOut)
  const [data, setData] = useState<AllSessionsResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const requestedRef = useRef(false)

  useEffect(() => {
    document.title = 'Attendance — Nucleus'
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await fetchChildAllSessions())
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        signOut()
        return
      }
      setError(err instanceof Error ? err.message : t('subject.allErrLoad'))
    } finally {
      setLoading(false)
    }
  }, [signOut, t])

  useEffect(() => {
    if (requestedRef.current) return
    requestedRef.current = true
    void load()
  }, [load])

  const strings = useMemo(
    () => ({
      ...buildParentSessionsStrings(t, i18n.language),
      noClassesYet: t('subject.allNoClassesYet'),
    }),
    [t, i18n.language],
  )

  return (
    <>
      <PageHeader
        title={t('subject.allTitle')}
        icon={ClipboardCheck}
        accent="emerald"
        backTo="/attendance"
        backLabel={t('subject.backToAttendance')}
      />
      <SessionsView
        sessions={data?.sessions ?? null}
        subjects={data?.subjects}
        loading={loading}
        error={error}
        onRetry={load}
        strings={strings}
      />
    </>
  )
}
