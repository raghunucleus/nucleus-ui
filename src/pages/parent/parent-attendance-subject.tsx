import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from '@tanstack/react-router'
import { CircleAlert, ClipboardCheck, MapPin, RefreshCw, User } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { PageHeader } from '@/components/portal-layout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ApiError } from '@/lib/api'
import {
  fetchChildSubjectSessions,
  shortTime,
  type SubjectSessionRow,
  type SubjectSessionsResult,
} from '@/lib/parent-academics'
import { cn } from '@/lib/utils'
import { useParentAuthStore } from '@/stores/parent-auth-store'

type Filter = 'all' | 'absent'

const FILTER_OPTIONS: readonly { value: Filter; labelKey: string }[] = [
  { value: 'all', labelKey: 'subject.filterAll' },
  { value: 'absent', labelKey: 'subject.filterAbsent' },
]

export default function ParentAttendanceSubject() {
  const { t } = useTranslation()
  const { subjectId: rawId } = useParams({ strict: false }) as {
    subjectId?: string
  }
  const subjectId = Number(rawId)
  const signOut = useParentAuthStore((s) => s.signOut)
  const [data, setData] = useState<SubjectSessionsResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
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

  const sessions = data?.sessions ?? []
  const absentCount = sessions.filter(
    (s) => s.attendance_status === 'absent',
  ).length
  const visibleSessions =
    filter === 'absent'
      ? sessions.filter((s) => s.attendance_status === 'absent')
      : sessions

  const subtitle = data?.subject
    ? t('subject.subtitle', {
        code: data.subject.code,
        n: sessions.length,
        absent: absentCount,
      })
    : undefined
  const title = data?.subject?.name ?? t('subject.titleFallback')

  return (
    <>
      <PageHeader
        title={title}
        subtitle={subtitle}
        icon={ClipboardCheck}
        accent="emerald"
        backTo="/attendance"
        backLabel={t('subject.backToAttendance')}
      />

      {error && !data ? <ErrorBanner message={error} onRetry={load} /> : null}

      {loading && !data ? (
        <LoadingState />
      ) : data ? (
        <section className="space-y-4">
          <FilterChips value={filter} onChange={setFilter} />

          <p className="text-xs text-muted-foreground">
            {filter === 'absent'
              ? t('subject.showingAbsent', {
                  n: visibleSessions.length,
                  total: sessions.length,
                })
              : t('subject.showingAll', {
                  n: sessions.length,
                  absent: absentCount,
                })}
          </p>

          {visibleSessions.length === 0 ? (
            <Card className="px-5 py-10 text-center text-sm italic text-muted-foreground">
              {filter === 'absent'
                ? t('subject.noAbsences')
                : t('subject.noClassesYet')}
            </Card>
          ) : (
            <Card className="divide-y overflow-hidden">
              <ul className="divide-y">
                {visibleSessions.map((s) => (
                  <SubjectSessionRowItem key={s.session_id} session={s} />
                ))}
              </ul>
            </Card>
          )}
        </section>
      ) : null}
    </>
  )
}

function FilterChips({
  value,
  onChange,
}: {
  value: Filter
  onChange: (next: Filter) => void
}) {
  const { t } = useTranslation()
  return (
    <div
      role="tablist"
      aria-label="Filter sessions"
      className="inline-flex rounded-lg border bg-muted p-1"
    >
      {FILTER_OPTIONS.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              'rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors',
              selected
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t(option.labelKey)}
          </button>
        )
      })}
    </div>
  )
}

function SubjectSessionRowItem({ session }: { session: SubjectSessionRow }) {
  const { t } = useTranslation()
  const status = derivedSessionStatus(session)
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <div className="w-24 shrink-0 text-xs tabular-nums">
        <p className="font-medium">{formatDateShort(session.date)}</p>
        <p className="font-mono text-[10px] text-muted-foreground">
          {shortTime(session.start_time ?? '')}
          {session.end_time ? `–${shortTime(session.end_time)}` : ''}
        </p>
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-1.5">
          <StatusPill kind={status}>{t(STATUS_LABEL_KEY[status])}</StatusPill>
          {session.is_substitute ? (
            <Badge variant="secondary">{t('subject.sub')}</Badge>
          ) : null}
        </div>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
          {session.teacher_display_name ? (
            <span className="inline-flex items-center gap-1">
              <User className="size-3" />
              {session.teacher_display_name}
            </span>
          ) : null}
          {session.room ? (
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3" />
              {session.room}
            </span>
          ) : null}
          {session.period_label ? <span>{session.period_label}</span> : null}
        </p>
        {session.session_status === 'cancelled' && session.cancel_reason ? (
          <p className="text-[10px] italic text-muted-foreground">
            {t('subject.reason')} {session.cancel_reason}
          </p>
        ) : null}
      </div>
    </li>
  )
}

type StatusKind =
  | 'present'
  | 'absent'
  | 'late'
  | 'od'
  | 'exempt'
  | 'cancelled'
  | 'unmarked'
  | 'upcoming'

const STATUS_LABEL_KEY: Record<StatusKind, string> = {
  present: 'subject.statusPresent',
  absent: 'subject.statusAbsent',
  late: 'subject.statusLate',
  od: 'subject.statusOd',
  exempt: 'subject.statusExempt',
  cancelled: 'subject.statusCancelled',
  unmarked: 'subject.statusUnmarked',
  upcoming: 'subject.statusUpcoming',
}

function derivedSessionStatus(s: SubjectSessionRow): StatusKind {
  if (s.session_status === 'cancelled') return 'cancelled'
  if (s.attendance_status === 'present') return 'present'
  if (s.attendance_status === 'absent') return 'absent'
  if (s.attendance_status === 'late') return 'late'
  if (s.attendance_status === 'od') return 'od'
  if (s.attendance_status === 'exempt') return 'exempt'
  if (isFutureDate(s.date)) return 'upcoming'
  return 'unmarked'
}

function StatusPill({
  kind,
  children,
}: {
  kind: StatusKind
  children: React.ReactNode
}) {
  const cls: Record<StatusKind, string> = {
    present: 'bg-success/15 text-success',
    absent: 'bg-destructive/15 text-destructive',
    late: 'bg-warning/15 text-warning',
    od: 'bg-primary/15 text-primary',
    exempt: 'bg-primary/10 text-primary',
    cancelled: 'bg-muted text-muted-foreground line-through',
    unmarked: 'bg-muted text-muted-foreground',
    upcoming: 'bg-muted text-muted-foreground',
  }
  return (
    <span
      className={cn(
        'rounded-full px-2 py-0.5 text-[10px] font-semibold',
        cls[kind],
      )}
    >
      {children}
    </span>
  )
}

function formatDateShort(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  return new Intl.DateTimeFormat('en-IN', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  }).format(d)
}

function isFutureDate(iso: string): boolean {
  const today = new Date()
  const d = new Date(`${iso}T00:00:00`)
  today.setHours(0, 0, 0, 0)
  return d.getTime() > today.getTime()
}

function LoadingState() {
  return (
    <div className="space-y-3">
      <div className="h-9 w-56 shimmer rounded-lg bg-muted/60" />
      {[0, 1, 2, 3, 4].map((i) => (
        <Card key={i} className="space-y-2 p-4">
          <div className="h-3 w-20 shimmer rounded bg-muted/60" />
          <div className="h-4 w-2/3 shimmer rounded bg-muted/60" />
        </Card>
      ))}
    </div>
  )
}

function ErrorBanner({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}) {
  const { t } = useTranslation()
  return (
    <Card className="flex items-start gap-3 border-destructive/30 bg-destructive/10 p-4">
      <CircleAlert className="mt-0.5 size-5 shrink-0 text-destructive" />
      <div className="flex-1 space-y-2">
        <p className="text-sm text-destructive">{message}</p>
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw />
          {t('common.retry')}
        </Button>
      </div>
    </Card>
  )
}
