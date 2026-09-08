import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from '@tanstack/react-router'
import {
  CircleAlert,
  ClipboardCheck,
  MapPin,
  RefreshCw,
  User,
} from 'lucide-react'

import { PageHeader } from '@/components/portal-layout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ApiError } from '@/lib/api'
import {
  fetchStudentSubjectSessions,
  shortTime,
  type SubjectSessionRow,
  type SubjectSessionsResult,
} from '@/lib/student-academics'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'

type Filter = 'all' | 'absent'

const FILTER_OPTIONS: readonly { value: Filter; label: string }[] = [
  { value: 'all', label: 'All classes' },
  { value: 'absent', label: 'Only absent' },
]

export default function AttendanceSubject() {
  const { subjectId: rawId } = useParams({ strict: false }) as {
    subjectId?: string
  }
  const subjectId = Number(rawId)
  const signOut = useAuthStore((state) => state.signOut)
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
  const visibleSessions =
    filter === 'absent'
      ? sessions.filter((s) => s.attendance_status === 'absent')
      : sessions

  const subtitle = data?.subject
    ? `${data.subject.code} · ${sessions.length} session${sessions.length === 1 ? '' : 's'} · ${absentCount} absent`
    : undefined
  const title = data?.subject?.name ?? 'Subject attendance'

  return (
    <>
      <PageHeader
        title={title}
        subtitle={subtitle}
        icon={ClipboardCheck}
        accent="emerald"
        backTo="/attendance"
        backLabel="Back to attendance"
      />

      {error && !data ? <ErrorBanner message={error} onRetry={load} /> : null}

      {loading && !data ? (
        <LoadingState />
      ) : data ? (
        <section className="space-y-4">
          <FilterChips value={filter} onChange={setFilter} />

          <p className="text-xs text-muted-foreground">
            {filter === 'absent'
              ? `Showing ${visibleSessions.length} absent of ${sessions.length} total`
              : `Showing all ${sessions.length} class${sessions.length === 1 ? '' : 'es'} · ${absentCount} absent`}
          </p>

          {visibleSessions.length === 0 ? (
            <Card className="px-5 py-10 text-center text-sm italic text-muted-foreground">
              {filter === 'absent'
                ? 'No absences recorded — keep it going.'
                : 'No classes recorded for this subject yet.'}
            </Card>
          ) : (
            <Card className="divide-y overflow-hidden">
              <ul className="divide-y">
                {visibleSessions.map((s) => (
                  <SubjectSessionRow key={s.session_id} session={s} />
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
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

function SubjectSessionRow({ session }: { session: SubjectSessionRow }) {
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
          <StatusPill kind={status.kind}>{status.label}</StatusPill>
          {session.is_substitute ? (
            <Badge variant="secondary">Sub</Badge>
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
            Reason: {session.cancel_reason}
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
  | 'leave'
  | 'cancelled'
  | 'unmarked'
  | 'upcoming'

function derivedSessionStatus(s: SubjectSessionRow): {
  kind: StatusKind
  label: string
} {
  if (s.session_status === 'cancelled') {
    return { kind: 'cancelled', label: 'Cancelled' }
  }
  if (s.attendance_status === 'present')
    return { kind: 'present', label: 'Present' }
  if (s.attendance_status === 'absent')
    return { kind: 'absent', label: 'Absent' }
  if (s.attendance_status === 'late') return { kind: 'late', label: 'Late' }
  if (s.attendance_status === 'od') return { kind: 'od', label: 'OD' }
  if (s.attendance_status === 'exempt')
    return { kind: 'exempt', label: 'Exempt' }
  if (s.attendance_status === 'leave') return { kind: 'leave', label: 'Leave' }
  // Not marked yet, but an approved leave covers the date — show the leave
  // rather than "Upcoming"; the teacher's mark (if any) takes over above.
  if (s.on_leave) return { kind: 'leave', label: 'Leave' }
  if (isFutureDate(s.date)) return { kind: 'upcoming', label: 'Upcoming' }
  return { kind: 'unmarked', label: 'Not marked' }
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
    leave: 'bg-icon-violet/15 text-icon-violet',
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
  return (
    <Card className="flex items-start gap-3 border-destructive/30 bg-destructive/10 p-4">
      <CircleAlert className="mt-0.5 size-5 shrink-0 text-destructive" />
      <div className="flex-1 space-y-2">
        <p className="text-sm text-destructive">{message}</p>
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw />
          Retry
        </Button>
      </div>
    </Card>
  )
}
