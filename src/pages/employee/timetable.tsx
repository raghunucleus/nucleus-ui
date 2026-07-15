import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  ClipboardCheck,
  DoorOpen,
  GraduationCap,
  RefreshCw,
  Users,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  NoAccessEmptyState,
  NoScopeEmptyState,
} from '@/components/employee/empty-states'
import { NoClassesIllustration } from '@/components/no-classes-illustration'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useScreenAccess } from '@/hooks/use-screen-access'
import { ApiError } from '@/lib/api'
import {
  addDays,
  fetchTeacherTimetableWeek,
  formatWeekRange,
  shortTime,
  startOfWeek,
  toIsoDate,
  type TeacherSessionListItem,
} from '@/lib/teacher-attendance'
import { cn } from '@/lib/utils'

const DAY_LABELS: Record<number, { short: string; long: string }> = {
  1: { short: 'Mon', long: 'Monday' },
  2: { short: 'Tue', long: 'Tuesday' },
  3: { short: 'Wed', long: 'Wednesday' },
  4: { short: 'Thu', long: 'Thursday' },
  5: { short: 'Fri', long: 'Friday' },
  6: { short: 'Sat', long: 'Saturday' },
  7: { short: 'Sun', long: 'Sunday' },
}

/** Today's ISO weekday (1=Mon…7=Sun). */
function isoToday(): number {
  const jsDow = new Date().getDay()
  return jsDow === 0 ? 7 : jsDow
}

/**
 * Imperative employee-portal navigation — the dual-router setup makes the
 * typed `<Link>` reject employee-only paths. Mirrors the helper in
 * `employee-portal-layout.tsx`.
 */
function navigateTo(route: string) {
  window.history.pushState({}, '', route)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

/**
 * Teacher's weekly schedule. Mirrors the student timetable's day-tab shape
 * (Mon/Tue/Wed/...) but each card carries the cohort context a teacher
 * actually needs to walk into the right room: subject + group + programme +
 * batch. Click-through opens the marking screen for that session.
 */
export default function EmployeeTimetablePage() {
  const access = useScreenAccess('timetable.teacher.view')

  const [weekStart, setWeekStart] = useState<Date>(() =>
    startOfWeek(new Date()),
  )
  const [sessions, setSessions] = useState<TeacherSessionListItem[] | null>(
    null,
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedDay, setSelectedDay] = useState<number>(() => isoToday())

  const load = useCallback(async (start: Date) => {
    setLoading(true)
    setError(null)
    // Drop any cached sessions before fetching — otherwise the day list keeps
    // rendering the previous week's classes while the new fetch is in flight,
    // and the user thinks "Next week" did nothing.
    setSessions(null)
    const startStr = toIsoDate(start)
    const endStr = toIsoDate(addDays(start, 6))
    try {
      const rows = await fetchTeacherTimetableWeek(startStr, endStr)
      setSessions(rows)
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Could not load your timetable.',
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load(weekStart)
  }, [load, weekStart])

  const sessionsByDay = useMemo(() => {
    const map = new Map<number, TeacherSessionListItem[]>()
    if (sessions) {
      for (const s of sessions) {
        const list = map.get(s.day_of_week) ?? []
        list.push(s)
        map.set(s.day_of_week, list)
      }
    }
    return map
  }, [sessions])

  // Working-day pills are derived from the data — show the days the teacher
  // has at least one session in this week, plus today (so an empty Friday
  // still gets a pill if it's today). Falls back to Mon–Sat when empty.
  const workingDays = useMemo(() => {
    if (!sessions || sessions.length === 0) return [1, 2, 3, 4, 5, 6]
    const days = new Set<number>(sessions.map((s) => s.day_of_week))
    days.add(isoToday())
    return [...days].sort((a, b) => a - b)
  }, [sessions])

  // Snap selectedDay if it falls off the working-days list (e.g. user jumps
  // to a week where they don't have a Saturday class).
  useEffect(() => {
    if (workingDays.includes(selectedDay)) return
    if (workingDays.length > 0) setSelectedDay(workingDays[0])
  }, [selectedDay, workingDays])

  if (!access) return <NoAccessEmptyState />
  if (!access.actions.includes('view')) {
    return <NoScopeEmptyState attributeLabel="view permission" />
  }

  const todaysSessions = sessionsByDay.get(selectedDay) ?? []
  const weekStartStr = toIsoDate(weekStart)
  const weekEndStr = toIsoDate(addDays(weekStart, 6))

  return (
    <section className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
            <CalendarDays className="size-6 text-icon-blue" />
            My timetable
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your classes this week. Tap a card to mark attendance.
          </p>
        </div>
      </header>

      <WeekNav
        weekStart={weekStart}
        loading={loading}
        onPrev={() => setWeekStart(addDays(weekStart, -7))}
        onNext={() => setWeekStart(addDays(weekStart, 7))}
        onToday={() => setWeekStart(startOfWeek(new Date()))}
      />

      <div className="flex flex-wrap gap-2">
        {workingDays.map((day) => {
          const labels = DAY_LABELS[day]
          if (!labels) return null
          const selected = day === selectedDay
          const count = sessionsByDay.get(day)?.length ?? 0
          return (
            <button
              key={day}
              type="button"
              aria-pressed={selected}
              onClick={() => setSelectedDay(day)}
              className={cn(
                'flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors',
                selected
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'bg-card hover:bg-accent hover:text-accent-foreground',
              )}
            >
              <span className="sm:hidden">{labels.short}</span>
              <span className="hidden sm:inline">{labels.long}</span>
              {count > 0 ? (
                <span
                  className={cn(
                    'rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums',
                    selected
                      ? 'bg-primary-foreground/20 text-primary-foreground'
                      : 'bg-muted text-muted-foreground',
                  )}
                >
                  {count}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>

      {error ? (
        <ErrorBanner message={error} onRetry={() => load(weekStart)} />
      ) : null}

      <Card className="overflow-hidden">
        <div className="flex items-center gap-2 border-b bg-muted/40 px-5 py-3">
          <CalendarDays className="size-4 text-muted-foreground" />
          <p className="text-sm font-medium">
            {DAY_LABELS[selectedDay]?.long ?? 'Day'}
            <span className="text-muted-foreground">
              {' '}· {todaysSessions.length}{' '}
              class{todaysSessions.length === 1 ? '' : 'es'}
            </span>
          </p>
          <span className="ml-auto hidden text-xs text-muted-foreground sm:inline">
            Week {formatWeekRange(weekStartStr, weekEndStr)}
          </span>
        </div>

        {loading && !sessions ? (
          <div className="space-y-3 p-5">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="shimmer h-20 rounded-md bg-muted/60" />
            ))}
          </div>
        ) : todaysSessions.length === 0 ? (
          <NoClassesIllustration
            title="No classes scheduled"
            description="Nothing on your plate for this day — a good time to plan ahead or take a breather."
          />
        ) : (
          <ul className="divide-y">
            {todaysSessions.map((session) => (
              <SessionRow key={session.id} session={session} />
            ))}
          </ul>
        )}
      </Card>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Week navigation
// ---------------------------------------------------------------------------

function WeekNav({
  weekStart,
  loading,
  onPrev,
  onNext,
  onToday,
}: {
  weekStart: Date
  loading: boolean
  onPrev: () => void
  onNext: () => void
  onToday: () => void
}) {
  const start = toIsoDate(weekStart)
  const end = toIsoDate(addDays(weekStart, 6))
  return (
    <div className="flex items-center justify-between gap-2">
      <p className="flex items-center gap-2 text-sm font-medium tabular-nums text-muted-foreground">
        <span>{formatWeekRange(start, end)}</span>
        {loading ? (
          <span
            aria-label="Loading"
            className="shimmer size-2 rounded-full bg-muted-foreground/40"
          />
        ) : null}
      </p>
      {/* Buttons stay enabled during fetches — a fresh click cancels the
          previous frame in effect (the new load() invalidates the data and
          refetches). Disabling them on `loading` made rapid navigation feel
          broken because every click sets loading=true and locks the buttons
          out of the very next click. */}
      <div className="flex gap-1">
        <Button
          variant="outline"
          size="icon"
          aria-label="Previous week"
          onClick={onPrev}
        >
          <ChevronLeft />
        </Button>
        <Button variant="outline" size="sm" onClick={onToday}>
          This week
        </Button>
        <Button
          variant="outline"
          size="icon"
          aria-label="Next week"
          onClick={onNext}
        >
          <ChevronRight />
        </Button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Session row — compact card for one class in the day list
// ---------------------------------------------------------------------------

function SessionRow({ session }: { session: TeacherSessionListItem }) {
  const cancelled = session.status === 'cancelled'
  const marked = session.status === 'completed'
  const cohortLine = formatCohort(session)

  // Cancelled rows shouldn't link anywhere — there's nothing to mark.
  const inner = (
    <>
      <div className="w-16 shrink-0">
        <p className="text-sm font-semibold tabular-nums">
          {shortTime(session.period.start_time)}
        </p>
        <p className="text-xs text-muted-foreground tabular-nums">
          {shortTime(session.period.end_time)}
        </p>
      </div>

      <div className="min-w-0 flex-1 space-y-1.5 border-l pl-4">
        <div className="flex items-start justify-between gap-3">
          <p
            className={cn(
              'font-semibold',
              cancelled && 'line-through opacity-70',
            )}
          >
            {session.subject.name}
          </p>
          <div className="flex flex-wrap justify-end gap-1.5">
            <Badge
              variant={
                marked
                  ? 'success'
                  : cancelled
                    ? 'destructive'
                    : session.status === 'rescheduled'
                      ? 'warning'
                      : 'default'
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
        </div>

        <p className="text-xs font-medium text-muted-foreground tabular-nums">
          {session.subject.code}
        </p>

        {cohortLine ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <span className="inline-flex items-center gap-1 font-medium text-foreground">
              <GraduationCap className="size-3.5 text-icon-blue" />
              {cohortLine}
            </span>
            {session.attendance_group ? (
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <Users className="size-3.5" />
                {session.attendance_group.name}
              </span>
            ) : null}
            {session.admission_year ? (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium tabular-nums">
                Batch {session.admission_year.display_year}
              </span>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {session.period.label ? <span>{session.period.label}</span> : null}
          {session.room ? (
            <span className="inline-flex items-center gap-1">
              <DoorOpen className="size-3.5" />
              {session.room}
            </span>
          ) : null}
          {!cancelled ? (
            <span className="ml-auto inline-flex items-center gap-1 font-medium text-primary">
              <ClipboardCheck className="size-3.5" />
              {marked ? 'View / amend' : 'Mark attendance'}
            </span>
          ) : null}
        </div>
      </div>
    </>
  )

  if (cancelled) {
    return (
      <li className="flex gap-4 px-5 py-4 opacity-70">{inner}</li>
    )
  }

  const href = `/attendance/mark/${session.id}`
  return (
    <li>
      <a
        href={href}
        onClick={(e) => {
          e.preventDefault()
          navigateTo(href)
        }}
        className="flex gap-4 px-5 py-4 transition-colors hover:bg-accent/40 focus-visible:bg-accent/40 focus-visible:outline-none"
      >
        {inner}
      </a>
    </li>
  )
}

/**
 * "B.Tech CSE · Semester 6" — same line the attendance cards use, kept in
 * sync so a teacher sees the cohort framed identically across both screens.
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

// ---------------------------------------------------------------------------
// Error banner
// ---------------------------------------------------------------------------

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
