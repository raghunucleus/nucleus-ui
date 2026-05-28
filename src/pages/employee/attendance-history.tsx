import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CalendarRange,
  CircleAlert,
  ClipboardList,
  DoorOpen,
  GraduationCap,
  History,
  RefreshCw,
  UserCheck,
  Users,
} from 'lucide-react'

import {
  NoAccessEmptyState,
  NoScopeEmptyState,
} from '@/components/employee/empty-states'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useScreenAccess } from '@/hooks/use-screen-access'
import {
  addDays,
  fetchTeacherHistory,
  formatHumanDate,
  shortTime,
  toIsoDate,
  type TeacherSessionListItem,
} from '@/lib/teacher-attendance'

/** Default window: last 14 days, ending today. */
function defaultRange(): { from: string; to: string } {
  const to = toIsoDate(new Date())
  const from = toIsoDate(addDays(new Date(), -13))
  return { from, to }
}

export default function EmployeeAttendanceHistoryPage() {
  const access = useScreenAccess('attendance.entry.history')

  const initial = defaultRange()
  const [from, setFrom] = useState(initial.from)
  const [to, setTo] = useState(initial.to)
  const [rows, setRows] = useState<TeacherSessionListItem[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (a: string, b: string) => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchTeacherHistory(a, b)
      setRows(data)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not load history.',
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load(from, to)
  }, [from, to, load])

  // Group by date so the list reads top-down by day.
  const grouped = useMemo(() => {
    if (!rows) return []
    const map = new Map<string, TeacherSessionListItem[]>()
    for (const r of rows) {
      const list = map.get(r.session_date) ?? []
      list.push(r)
      map.set(r.session_date, list)
    }
    return [...map.entries()].sort(([a], [b]) => (a < b ? 1 : -1))
  }, [rows])

  if (!access) return <NoAccessEmptyState />
  if (!access.actions.includes('view')) {
    return <NoScopeEmptyState attributeLabel="view permission" />
  }

  return (
    <section className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <History className="size-6 text-icon-emerald" />
            Attendance history
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your marked classes — review only. Use{' '}
            <span className="font-medium text-foreground">Mark attendance</span>{' '}
            to amend.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-md border bg-card px-2 py-1">
            <CalendarRange className="size-4 text-muted-foreground" />
            <Input
              type="date"
              value={from}
              max={to}
              onChange={(e) => setFrom(e.target.value || initial.from)}
              className="h-8 border-0 bg-transparent p-0 text-sm focus-visible:ring-0"
            />
            <span className="text-xs text-muted-foreground">→</span>
            <Input
              type="date"
              value={to}
              min={from}
              onChange={(e) => setTo(e.target.value || initial.to)}
              className="h-8 border-0 bg-transparent p-0 text-sm focus-visible:ring-0"
            />
          </div>
        </div>
      </header>

      {error ? <ErrorBanner message={error} onRetry={() => load(from, to)} /> : null}

      {loading && !rows ? (
        <Skeleton />
      ) : grouped.length === 0 ? (
        <Card className="px-6 py-12 text-center text-sm text-muted-foreground">
          No classes marked in this window.
        </Card>
      ) : (
        <div className="space-y-6">
          {grouped.map(([date, list]) => (
            <DayGroup key={date} date={date} sessions={list} />
          ))}
        </div>
      )}
    </section>
  )
}

function DayGroup({
  date,
  sessions,
}: {
  date: string
  sessions: TeacherSessionListItem[]
}) {
  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 border-b pb-1 text-sm font-semibold">
        <ClipboardList className="size-4 text-muted-foreground" />
        {formatHumanDate(date)}
        <span className="text-xs font-normal text-muted-foreground">
          · {sessions.length} session{sessions.length === 1 ? '' : 's'}
        </span>
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {sessions.map((s) => (
          <HistoryCard key={s.id} session={s} />
        ))}
      </div>
    </section>
  )
}

function HistoryCard({ session }: { session: TeacherSessionListItem }) {
  const marked = session.status === 'completed'
  const cancelled = session.status === 'cancelled'
  const cohortLine = formatCohort(session)

  return (
    <Card className="space-y-3 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={marked ? 'success' : cancelled ? 'destructive' : 'default'}>
          {cancelled ? 'Cancelled' : marked ? 'Marked' : 'Unmarked'}
        </Badge>
        {session.is_substitute ? <Badge variant="warning">Substitute</Badge> : null}
        {session.is_elective ? <Badge variant="secondary">Elective</Badge> : null}
      </div>

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold">{session.subject.name}</p>
          <p className="truncate text-xs font-medium text-muted-foreground tabular-nums">
            {session.subject.code}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-semibold tabular-nums">
            {shortTime(session.period.start_time)}
          </p>
          <p className="text-xs text-muted-foreground tabular-nums">
            {shortTime(session.period.end_time)}
          </p>
        </div>
      </div>

      {cohortLine ? (
        <div className="rounded-md border bg-muted/30 px-3 py-2">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <GraduationCap className="size-3.5 text-icon-blue" />
            <span className="truncate">{cohortLine}</span>
          </p>
          {session.attendance_group ? (
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Users className="size-3.5" />
              <span className="truncate">{session.attendance_group.name}</span>
              {session.admission_year ? (
                <span className="ml-auto shrink-0 rounded-full bg-card px-2 py-0.5 text-[10px] font-medium tabular-nums">
                  Batch {session.admission_year.display_year}
                </span>
              ) : null}
            </p>
          ) : session.admission_year ? (
            <p className="mt-0.5 text-xs text-muted-foreground">
              Batch {session.admission_year.display_year}
              {session.is_elective ? ' · cross-group elective' : ''}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        {session.room ? (
          <span className="inline-flex items-center gap-1">
            <DoorOpen className="size-3.5" />
            {session.room}
          </span>
        ) : null}
        {session.attended_count !== null && session.roster_size !== null ? (
          <span className="inline-flex items-center gap-1">
            <UserCheck className="size-3.5" />
            {session.attended_count} / {session.roster_size} present
          </span>
        ) : null}
      </div>
    </Card>
  )
}

/**
 * "B.Tech CSE · Semester 6" line — kept in lock-step with the day-list
 * page's helper so both screens read the same.
 */
function formatCohort(session: TeacherSessionListItem): string {
  const programme =
    session.programme?.display_name ?? session.programme?.name ?? null
  const semester = session.semester
    ? `Semester ${session.semester.sem_number}`
    : null
  if (programme && semester) return `${programme} · ${semester}`
  return programme ?? semester ?? ''
}

function Skeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-32 animate-pulse rounded-xl bg-muted/60" />
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
