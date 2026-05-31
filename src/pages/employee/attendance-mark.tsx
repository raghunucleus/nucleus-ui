import {
  ChevronLeft,
  ChevronRight,
  ChevronRight as ChevronRightSmall,
  ClipboardCheck,
  ClipboardList,
  DoorOpen,
  GraduationCap,
  RefreshCw,
  UserCheck,
  Users,
  XCircle,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import {
  NoAccessEmptyState,
  NoScopeEmptyState,
} from '@/components/employee/empty-states'
import { NoClassesIllustration } from '@/components/no-classes-illustration'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { DatePicker } from '@/components/ui/date-picker'
import { useScreenAccess } from '@/hooks/use-screen-access'
import { ApiError } from '@/lib/api'
import {
  addDays,
  fetchTeacherDay,
  formatHumanDate,
  shortTime,
  toIsoDate,
  type TeacherSessionListItem,
} from '@/lib/teacher-attendance'
import { cn } from '@/lib/utils'

/**
 * Day list for the marking screen. Each card links to the dedicated
 * full-screen marking route at `/attendance/mark/$sessionId` — the slide-over
 * sheet doesn't give the roster enough room (names/IDs get truncated), so
 * marking owns the whole viewport instead.
 */
export default function EmployeeAttendanceMarkPage() {
  const access = useScreenAccess('attendance.entry.daily')

  const [date, setDate] = useState<string>(() => toIsoDate(new Date()))
  const [sessions, setSessions] = useState<TeacherSessionListItem[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (forDate: string) => {
    setLoading(true)
    setError(null)
    try {
      const rows = await fetchTeacherDay(forDate)
      setSessions(rows)
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Could not load your sessions.',
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load(date)
  }, [date, load])

  if (!access) return <NoAccessEmptyState />
  if (!access.actions.includes('view')) {
    return <NoScopeEmptyState attributeLabel="view permission" />
  }

  return (
    <section className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <ClipboardCheck className="size-6 text-icon-emerald" />
            Mark attendance
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your classes on {formatHumanDate(date)}. Tap a session to mark
            students.
          </p>
        </div>
        <DateBar
          date={date}
          onPrev={() =>
            setDate(toIsoDate(addDays(new Date(`${date}T00:00:00`), -1)))
          }
          onNext={() =>
            setDate(toIsoDate(addDays(new Date(`${date}T00:00:00`), 1)))
          }
          onToday={() => setDate(toIsoDate(new Date()))}
          onChange={setDate}
          loading={loading}
        />
      </header>

      {error ? (
        <ErrorBanner message={error} onRetry={() => load(date)} />
      ) : null}

      {loading && !sessions ? (
        <SessionsSkeleton />
      ) : sessions && sessions.length === 0 ? (
        <EmptyDay date={date} />
      ) : sessions ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {sessions.map((s) => (
            <SessionCard key={s.id} session={s} />
          ))}
        </div>
      ) : null}
    </section>
  )
}

// ---------------------------------------------------------------------------
// Date bar
// ---------------------------------------------------------------------------

function DateBar({
  date,
  onPrev,
  onNext,
  onToday,
  onChange,
  loading,
}: {
  date: string
  onPrev: () => void
  onNext: () => void
  onToday: () => void
  onChange: (next: string) => void
  loading: boolean
}) {
  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="icon"
        aria-label="Previous day"
        onClick={onPrev}
        disabled={loading}
      >
        <ChevronLeft />
      </Button>
      <DatePicker
        value={date}
        onChange={(next) => onChange(next || toIsoDate(new Date()))}
        disabled={loading}
        aria-label="Pick a date to mark attendance"
      />
      <Button variant="outline" size="sm" onClick={onToday}>
        Today
      </Button>
      <Button
        variant="outline"
        size="icon"
        aria-label="Next day"
        onClick={onNext}
        disabled={loading}
      >
        <ChevronRight />
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Session card
// ---------------------------------------------------------------------------

/**
 * "B.Tech CSE · Semester 6" style line. Falls back gracefully when only one
 * side is known so a half-joined row still tells the teacher something.
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

function SessionCard({ session }: { session: TeacherSessionListItem }) {
  const cancelled = session.status === 'cancelled'
  const marked = session.status === 'completed'
  const cohortLine = formatCohort(session)

  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant={
                marked ? 'success' : cancelled ? 'destructive' : 'default'
              }
            >
              {cancelled
                ? 'Cancelled'
                : marked
                  ? 'Marked'
                  : session.status === 'rescheduled'
                    ? 'Rescheduled'
                    : 'Pending'}
            </Badge>
            {session.is_substitute ? (
              <Badge variant="warning">Substitute</Badge>
            ) : null}
            {session.is_elective ? (
              <Badge variant="secondary">Elective</Badge>
            ) : null}
            {session.span > 1 ? (
              <Badge variant="secondary">{session.span} periods</Badge>
            ) : null}
          </div>
          <h3 className="truncate text-base font-semibold">
            {session.subject.name}
          </h3>
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

      {/* Cohort context line — the bit that disambiguates "Database Systems"
          taught to three different batches in different rooms. Always
          rendered so the teacher can confirm they're walking into the right
          room before opening the marking screen. */}
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
        <span>{session.period.label}</span>
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

      <div className="flex items-center justify-between pt-1">
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-primary">
          <ClipboardList className="size-4" />
          {marked ? 'View / amend' : 'Mark attendance'}
        </span>
        <ChevronRightSmall className="size-4 text-muted-foreground" />
      </div>
    </>
  )

  // Cancelled sessions aren't markable — render as a disabled-looking card.
  if (cancelled) {
    return (
      <Card className="flex flex-col gap-3 p-5 opacity-60">{body}</Card>
    )
  }

  const href = `/attendance/mark/${session.id}`
  return (
    <a
      href={href}
      onClick={(e) => {
        e.preventDefault()
        // Imperative push mirrors the employee-portal sidebar pattern — the
        // dual-router setup doesn't expose typed `<Link>` for employee paths.
        window.history.pushState({}, '', href)
        window.dispatchEvent(new PopStateEvent('popstate'))
      }}
      className={cn(
        'block rounded-xl',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
      )}
    >
      <Card className="flex flex-col gap-3 p-5 transition-all hover:-translate-y-0.5 hover:shadow-md">
        {body}
      </Card>
    </a>
  )
}

// ---------------------------------------------------------------------------
// Empty / loading / error states
// ---------------------------------------------------------------------------

function SessionsSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="shimmer h-40 rounded-xl bg-muted/60" />
      ))}
    </div>
  )
}

function EmptyDay({ date }: { date: string }) {
  return (
    <Card>
      <NoClassesIllustration
        title="No classes scheduled"
        description={`${formatHumanDate(date)} — no sessions assigned to you. Enjoy the breather.`}
      />
    </Card>
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
      <XCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
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
