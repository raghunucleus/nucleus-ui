import { Link, useNavigate } from '@tanstack/react-router'
import {
  ArrowUpRight,
  Award,
  Cake,
  ClipboardCheck,
  LayoutGrid,
  MessageCircle,
  PartyPopper,
  type LucideIcon,
} from 'lucide-react'
import { useCallback, useEffect, useState, type ReactNode } from 'react'

import { ModuleTile } from '@/components/module-tile'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { ApiError } from '@/lib/api'
import { cn } from '@/lib/utils'
import { attendanceStanding } from '@/lib/academics-mock'
import {
  fetchStudentAttendanceDashboard,
  fetchStudentExamResults,
  fetchStudentHolidays,
  type DashboardResult,
  type ExamResultsView,
} from '@/lib/student-academics'
import {
  holidayRangeLabel,
  toIsoDate,
  type AcademicHoliday,
  type AcademicHolidayType,
} from '@/lib/holidays'
import { fetchChatUnreadCount } from '@/lib/student-chat'
import { useChatConnection, useChatEvent } from '@/lib/chat-socket'
import { useAuthStore } from '@/stores/auth-store'
import {
  avatarColorFor,
  studentBirthdays,
  type BirthdayPerson,
} from '@/lib/student-birthdays'
import {
  MODULES,
  MODULE_GRADIENT,
  MODULE_SOFT,
  type ModuleColor,
  type ModuleRoute,
} from '@/lib/modules'
import { useAppDrawerStore } from '@/stores/app-drawer-store'

// --- shared chrome ----------------------------------------------------------

const TILE_BASE = 'rounded-xl border bg-card text-card-foreground shadow-sm'

/** A friendly countdown label, e.g. "Today", "Tomorrow", "in 5 days". */
function relativeLabel(offsetDays: number): string {
  if (offsetDays <= 0) return 'Today'
  if (offsetDays === 1) return 'Tomorrow'
  return `in ${offsetDays} days`
}

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((word) => word[0] ?? '')
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

/** Initials avatar in the person's accent tint. */
function Avatar({
  name,
  color,
  photoUrl,
}: {
  name: string
  color: ModuleColor
  photoUrl?: string | null
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null)

  // Failure is per-URL: a refetch may deliver a fresh signed URL — retry it
  // instead of staying on initials forever.
  if (photoUrl && failedUrl !== photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={name}
        onError={() => setFailedUrl(photoUrl)}
        className="size-9 shrink-0 rounded-full border bg-muted object-cover"
      />
    )
  }

  return (
    <div
      className={cn(
        'grid size-9 shrink-0 place-items-center rounded-full text-xs font-semibold',
        MODULE_SOFT[color],
      )}
    >
      {initials(name)}
    </div>
  )
}

/** Stacked day / month chip in a soft accent tint. */
function DateChip({ date, color }: { date: Date; color: ModuleColor }) {
  return (
    <div
      className={cn(
        'grid size-12 shrink-0 place-items-center rounded-lg leading-none',
        MODULE_SOFT[color],
      )}
    >
      <span className="text-base font-bold tabular-nums">
        {date.toLocaleDateString('en-IN', { day: '2-digit' })}
      </span>
      <span className="mt-0.5 text-[10px] font-medium uppercase tracking-wide">
        {date.toLocaleDateString('en-IN', { month: 'short' })}
      </span>
    </div>
  )
}

/** A clickable stat tile — icon, title and a glanceable metric. */
function StatTile({
  to,
  icon: Icon,
  color,
  title,
  className,
  pulseIcon,
  children,
}: {
  to: ModuleRoute
  icon: LucideIcon
  color: ModuleColor
  title: string
  className?: string
  /** Gently breathe the icon disc — signals a placeholder ("not yet") state. */
  pulseIcon?: boolean
  children: ReactNode
}) {
  return (
    <Link
      to={to}
      className={cn(
        TILE_BASE,
        'group block p-5 transition-all hover:-translate-y-0.5 hover:shadow-md',
        className,
      )}
    >
      <div className="flex items-center gap-2.5">
        <div
          className={cn(
            'grid size-9 place-items-center rounded-lg bg-gradient-to-br text-icon-on shadow-sm',
            MODULE_GRADIENT[color],
            pulseIcon && 'animate-pulse motion-reduce:animate-none',
          )}
        >
          <Icon className="size-5" />
        </div>
        <h3 className="text-sm font-semibold">{title}</h3>
        <ArrowUpRight className="ml-auto size-4 text-muted-foreground transition-colors group-hover:text-primary" />
      </div>
      {children}
    </Link>
  )
}

/** A non-clickable container tile — a bordered header over a body. */
function PanelTile({
  icon: Icon,
  title,
  meta,
  className,
  children,
}: {
  icon: LucideIcon
  title: string
  meta?: string
  className?: string
  children: ReactNode
}) {
  return (
    <section className={cn(TILE_BASE, className)}>
      <header className="flex items-center gap-2 border-b px-5 py-3.5">
        <Icon className="size-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">{title}</h3>
        {meta ? (
          <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            {meta}
          </span>
        ) : null}
      </header>
      {children}
    </section>
  )
}

// --- stat tiles -------------------------------------------------------------

export function AttendanceTile({ className }: { className?: string }) {
  const signOut = useAuthStore((state) => state.signOut)
  const [data, setData] = useState<DashboardResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchStudentAttendanceDashboard()
      .then((result) => {
        if (!cancelled) setData(result)
      })
      .catch((err) => {
        if (cancelled) return
        if (err instanceof ApiError && err.status === 401) {
          signOut()
          return
        }
        setFailed(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [signOut])

  // A real percentage only once classes have actually been held — before then
  // "0.0%" reads like the student has zero attendance (with an alarming red
  // bar), when really nothing has been recorded yet. Show "Not yet" instead.
  const hasData = !!data && data.overall_held > 0
  const percent = data?.overall_pct ?? 0
  const standing = attendanceStanding(percent)
  const bar =
    standing === 'good'
      ? 'bg-success'
      : standing === 'warning'
        ? 'bg-warning'
        : 'bg-destructive'
  const note = failed
    ? "Couldn't load attendance"
    : !hasData
      ? 'No classes held yet'
      : standing === 'good'
        ? 'Comfortably above the 75% minimum'
        : standing === 'warning'
          ? 'Getting close to the 75% line'
          : 'Below the 75% requirement'

  return (
    <StatTile
      to="/attendance"
      icon={ClipboardCheck}
      color="emerald"
      title="Attendance"
      className={className}
      pulseIcon={!loading && !failed && !hasData}
    >
      <p className="mt-4 text-2xl font-semibold tabular-nums">
        {loading ? (
          <span className="inline-block h-8 w-16 animate-pulse rounded bg-muted/70 align-middle" />
        ) : failed ? (
          <span className="text-xl font-semibold text-muted-foreground">
            —
          </span>
        ) : !hasData ? (
          <span className="text-xl font-semibold text-muted-foreground">
            Not yet
          </span>
        ) : (
          <>
            {percent.toFixed(1)}
            <span className="text-base font-semibold text-muted-foreground">
              %
            </span>
          </>
        )}
      </p>
      <Progress
        value={hasData ? percent : 0}
        indicatorClassName={hasData ? bar : 'bg-muted-foreground/30'}
        className="mt-3"
      />
      <p className="mt-2 text-xs text-muted-foreground">{note}</p>
    </StatTile>
  )
}

export function CgpaTile({ className }: { className?: string }) {
  const signOut = useAuthStore((state) => state.signOut)
  const [data, setData] = useState<ExamResultsView | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchStudentExamResults()
      .then((result) => {
        if (!cancelled) setData(result)
      })
      .catch((err) => {
        if (cancelled) return
        if (err instanceof ApiError && err.status === 401) {
          signOut()
          return
        }
        setFailed(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [signOut])

  const value = data?.has_results ? data.cgpa : null
  const hasResults = value !== null
  const semestersCount = data?.semesters_count ?? 0
  const note = failed
    ? "Couldn't load results"
    : !hasResults
      ? 'No results published yet'
      : `Cumulative GPA across ${semestersCount} semester${semestersCount === 1 ? '' : 's'}`

  return (
    <StatTile
      to="/exam-marks"
      icon={Award}
      color="amber"
      title="Exam results"
      className={className}
      pulseIcon={!loading && !failed && !hasResults}
    >
      <p className="mt-4 text-2xl font-semibold tabular-nums">
        {loading ? (
          <span className="inline-block h-8 w-16 animate-pulse rounded bg-muted/70 align-middle" />
        ) : failed ? (
          <span className="text-xl font-semibold text-muted-foreground">
            —
          </span>
        ) : !hasResults ? (
          <span className="text-xl font-semibold text-muted-foreground">
            Not yet
          </span>
        ) : (
          <>
            {value.toFixed(2)}
            <span className="text-base font-semibold text-muted-foreground">
              {' '}
              / 10
            </span>
          </>
        )}
      </p>
      <Progress
        value={hasResults ? value * 10 : 0}
        indicatorClassName={hasResults ? 'bg-icon-amber' : 'bg-muted-foreground/30'}
        className="mt-3"
      />
      <p className="mt-2 text-xs text-muted-foreground">{note}</p>
    </StatTile>
  )
}

/**
 * Dashboard nudge for unread chat messages — a one-tap shortcut into Connect.
 * Renders nothing when the inbox is clear; the count is live, seeded from the
 * server then refreshed on socket message/read events (the same `chat-unread`
 * signal the Connect badge uses).
 */
export function MessagesAlert({ className }: { className?: string }) {
  const signOut = useAuthStore((state) => state.signOut)
  const navigate = useNavigate()
  const [unread, setUnread] = useState(0)

  // Keep the socket alive on the dashboard too, so the count updates live.
  useChatConnection()

  const load = useCallback(() => {
    fetchChatUnreadCount()
      .then((r) => setUnread(r.total))
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) signOut()
        // Other errors just leave the nudge hidden — not worth surfacing here.
      })
  }, [signOut])

  useEffect(() => {
    load()
  }, [load])

  useChatEvent('message:new', () => load())
  useChatEvent('message:read', () => load())

  if (unread <= 0) return null

  return (
    <button
      type="button"
      onClick={() => void navigate({ to: '/connect' })}
      className={cn(
        TILE_BASE,
        'group flex w-full items-center gap-3 p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-md',
        className,
      )}
    >
      <div
        className={cn(
          'relative grid size-10 shrink-0 place-items-center rounded-lg bg-gradient-to-br text-icon-on shadow-sm',
          MODULE_GRADIENT.cyan,
        )}
      >
        <MessageCircle className="size-5" />
        <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full border-2 border-card bg-primary px-1 text-[10px] font-semibold text-primary-foreground tabular-nums">
          {unread > 99 ? '99+' : unread}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">
          {unread} unread message{unread > 1 ? 's' : ''}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          Tap to open Connect and catch up.
        </p>
      </div>
      <ArrowUpRight className="size-4 text-muted-foreground transition-colors group-hover:text-primary" />
    </button>
  )
}

// --- container tiles --------------------------------------------------------

/** Module tiles shown on the dashboard before the "View more" tile. */
const DASHBOARD_MODULE_LIMIT = 7

export function ModulesTile({ className }: { className?: string }) {
  const shown = MODULES.slice(0, DASHBOARD_MODULE_LIMIT)
  const hidden = MODULES.length - shown.length

  return (
    <PanelTile icon={LayoutGrid} title="Modules" className={className}>
      <div className="flex flex-wrap justify-center gap-x-3 gap-y-5 p-5">
        {shown.map((module) => (
          <ModuleTile key={module.title} module={module} />
        ))}
        <ViewMoreTile hidden={hidden} />
      </div>
    </PanelTile>
  )
}

/** The 8th tile — opens the full app drawer. */
function ViewMoreTile({ hidden }: { hidden: number }) {
  const setDrawerOpen = useAppDrawerStore((state) => state.setOpen)

  return (
    <button
      type="button"
      onClick={() => setDrawerOpen(true)}
      title="Open the app drawer"
      className="group flex w-24 shrink-0 cursor-pointer flex-col items-center gap-2 rounded-2xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:w-28"
    >
      <div className="grid aspect-square w-full place-items-center rounded-2xl border-2 border-dashed border-border bg-muted/40 text-muted-foreground transition-all duration-200 ease-out group-hover:-translate-y-1 group-hover:border-primary/40 group-hover:bg-primary/5 group-hover:text-primary">
        <LayoutGrid className="size-7 sm:size-8" />
      </div>
      <p className="truncate text-xs font-medium sm:text-sm">
        {hidden > 0 ? `+${hidden} more` : 'View more'}
      </p>
    </button>
  )
}

/** "12 Jun" — the day/month of an upcoming birthday (no year). */
function birthdayDateLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
}

/**
 * Classmate birthdays from the student's own attendance group. Live data —
 * today's celebrants get a highlighted block, the next few are listed under
 * "Coming up". The tile trims the upcoming list; the Birthdays page shows all.
 */
export function BirthdaysTile({ className }: { className?: string }) {
  const signOut = useAuthStore((state) => state.signOut)
  const navigate = useNavigate()
  const [people, setPeople] = useState<BirthdayPerson[] | null>(null)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    setError(false)
    try {
      // The tile only shows today + a few upcoming — one small page is plenty.
      const page = await studentBirthdays({ limit: 8 })
      setPeople(page.items)
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        signOut()
        return
      }
      setError(true)
    }
  }, [signOut])

  useEffect(() => {
    void load()
  }, [load])

  const today = (people ?? []).filter((p) => p.days_until <= 0)
  const upcoming = (people ?? []).filter((p) => p.days_until > 0).slice(0, 5)

  return (
    <Link
      to="/birthdays"
      className={cn(
        TILE_BASE,
        'group flex flex-col transition-all hover:-translate-y-0.5 hover:shadow-md',
        className,
      )}
    >
      <header className="flex items-center gap-2 border-b px-5 py-3.5">
        <Cake className="size-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Birthdays</h3>
        <ArrowUpRight className="ml-auto size-4 text-muted-foreground transition-colors group-hover:text-primary" />
      </header>
      <div className="scrollbar-themed min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
        {people === null && !error ? (
          <div className="space-y-3">
            <div className="h-12 animate-pulse rounded-xl bg-muted" />
            <div className="h-10 animate-pulse rounded-lg bg-muted" />
          </div>
        ) : error ? (
          <p className="text-xs text-muted-foreground">
            Couldn&rsquo;t load birthdays.{' '}
            <button
              type="button"
              onClick={(e) => {
                // The whole card is a link — keep Retry from navigating.
                e.preventDefault()
                e.stopPropagation()
                void load()
              }}
              className="font-medium text-primary hover:underline"
            >
              Retry
            </button>
          </p>
        ) : today.length === 0 && upcoming.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No birthdays in your class over the next few weeks.
          </p>
        ) : (
          <>
            {today.length > 0 ? (
              <div className="rounded-xl border border-icon-rose/20 bg-gradient-to-br from-icon-rose/10 to-icon-amber/10 p-4">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-icon-rose">
                  <PartyPopper className="size-3.5" />
                  Today
                </p>
                {today.map((person) => (
                  <div key={person.id} className="mt-2.5 flex items-center gap-3">
                    <Avatar
                      name={person.display_name}
                      color={avatarColorFor(person.display_name)}
                      photoUrl={person.photo_url}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {person.display_name}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        It&rsquo;s their birthday 🎂
                      </p>
                    </div>
                    <Button
                      size="sm"
                      className="shrink-0"
                      onClick={(e) => {
                        // The whole card is a link — Wish goes to Connect, not
                        // the Birthdays page.
                        e.preventDefault()
                        e.stopPropagation()
                        void navigate({
                          to: '/connect',
                          search: {
                            to: person.id,
                            name: person.display_name,
                            wish: true,
                          },
                        })
                      }}
                    >
                      <PartyPopper />
                      Wish
                    </Button>
                  </div>
                ))}
              </div>
            ) : null}

            {upcoming.length > 0 ? (
              <div className="space-y-3">
                {today.length > 0 ? (
                  <p className="text-xs font-medium text-muted-foreground">
                    Coming up
                  </p>
                ) : null}
                {upcoming.map((person) => (
                  <div key={person.id} className="flex items-center gap-3">
                    <Avatar
                      name={person.display_name}
                      color={avatarColorFor(person.display_name)}
                      photoUrl={person.photo_url}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {person.display_name}
                      </p>
                      {person.section ? (
                        <p className="truncate text-xs text-muted-foreground">
                          {person.section}
                        </p>
                      ) : null}
                    </div>
                    <span className="shrink-0 text-xs font-medium text-muted-foreground">
                      {person.days_until === 1
                        ? 'Tomorrow'
                        : birthdayDateLabel(person.date)}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </>
        )}
      </div>
    </Link>
  )
}

/** Holiday badge accent per type — drives the dashboard date chip tint. */
const HOLIDAY_COLOR: Record<AcademicHolidayType, ModuleColor> = {
  public: 'emerald',
  institutional: 'blue',
  unplanned: 'rose',
  half_day: 'amber',
}

/** Whole days from today (local midnight) to an ISO calendar date. */
function offsetDaysFromIso(iso: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return 0
  return Math.round((d.getTime() - today.getTime()) / (24 * 60 * 60 * 1000))
}

/**
 * Upcoming holidays as a stat-row tile — the next few current/upcoming
 * holidays at a glance; the whole tile links to the Holidays page.
 */
export function HolidaysTile({ className }: { className?: string }) {
  const signOut = useAuthStore((state) => state.signOut)
  const [holidays, setHolidays] = useState<AcademicHoliday[] | null>(null)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    setError(false)
    try {
      // Only current + upcoming holidays — the endpoint folds in ongoing
      // multi-day breaks via COALESCE(end_date, date) >= from.
      const list = await fetchStudentHolidays({ from: toIsoDate(new Date()) })
      setHolidays(list)
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        signOut()
        return
      }
      setError(true)
    }
  }, [signOut])

  useEffect(() => {
    void load()
  }, [load])

  const today = toIsoDate(new Date())
  // The tile fits the stat row, so only the next few — the page has the rest.
  const upcoming = (holidays ?? []).slice(0, 3)

  return (
    <StatTile
      to="/academic-holidays"
      icon={PartyPopper}
      color="blue"
      title="Upcoming holidays"
      className={className}
      pulseIcon={holidays !== null && !error && upcoming.length === 0}
    >
      {holidays === null && !error ? (
        <div className="mt-4 space-y-2">
          <div className="h-12 animate-pulse rounded-xl bg-muted" />
          <div className="h-12 animate-pulse rounded-xl bg-muted" />
        </div>
      ) : error ? (
        <p className="mt-4 text-xs text-muted-foreground">
          Couldn&rsquo;t load holidays — open to retry.
        </p>
      ) : upcoming.length === 0 ? (
        <p className="mt-4 text-xs text-muted-foreground">
          No holidays coming up.
        </p>
      ) : (
        <ul className="mt-4 space-y-2.5">
          {upcoming.map((holiday) => {
            const date = new Date(`${holiday.date}T00:00:00`)
            const ongoing =
              holiday.date <= today && (holiday.end_date ?? holiday.date) >= today
            return (
              <li key={holiday.id} className="flex items-center gap-3">
                <DateChip date={date} color={HOLIDAY_COLOR[holiday.type]} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{holiday.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {holidayRangeLabel(holiday)}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  {ongoing ? 'Today' : relativeLabel(offsetDaysFromIso(holiday.date))}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </StatTile>
  )
}
