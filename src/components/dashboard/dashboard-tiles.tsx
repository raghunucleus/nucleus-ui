import { Link, useNavigate } from '@tanstack/react-router'
import {
  ArrowUpRight,
  Award,
  Cake,
  CalendarClock,
  ClipboardCheck,
  CreditCard,
  LayoutGrid,
  MapPin,
  PartyPopper,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { useCallback, useEffect, useState, type ReactNode } from 'react'

import { ModuleTile } from '@/components/module-tile'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { ApiError } from '@/lib/api'
import { cn } from '@/lib/utils'
import {
  FEE_DUES,
  attendanceStanding,
  cgpa,
  feeTotals,
  formatDate,
  formatINR,
} from '@/lib/academics-mock'
import {
  fetchStudentAttendanceDashboard,
  type DashboardResult,
} from '@/lib/student-academics'
import { useAuthStore } from '@/stores/auth-store'
import {
  CAMPUS_EVENTS,
  CLASSMATES,
  CLASS_CONTEXT,
  HOLIDAYS,
  dateFromOffset,
  relativeLabel,
  type CampusEvent,
  type Classmate,
  type Presence,
} from '@/lib/campus-mock'
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

const TILE_BASE = 'rounded-2xl border bg-card text-card-foreground shadow-sm'

const PRESENCE_DOT: Record<Presence, string> = {
  'in-class': 'bg-icon-amber',
  library: 'bg-icon-violet',
  online: 'bg-icon-emerald',
  away: 'bg-muted-foreground',
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
function Avatar({ name, color }: { name: string; color: ModuleColor }) {
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
  children,
}: {
  to: ModuleRoute
  icon: LucideIcon
  color: ModuleColor
  title: string
  className?: string
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
    : !data || data.overall_held === 0
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
    >
      <p className="mt-4 text-3xl font-bold tabular-nums">
        {loading ? (
          <span className="inline-block h-9 w-16 animate-pulse rounded bg-muted/70 align-middle" />
        ) : (
          <>
            {percent.toFixed(1)}
            <span className="text-lg font-semibold text-muted-foreground">
              %
            </span>
          </>
        )}
      </p>
      <Progress value={percent} indicatorClassName={bar} className="mt-3" />
      <p className="mt-2 text-xs text-muted-foreground">{note}</p>
    </StatTile>
  )
}

export function CgpaTile({ className }: { className?: string }) {
  const value = cgpa()

  return (
    <StatTile
      to="/exam-marks"
      icon={Award}
      color="amber"
      title="Exam marks"
      className={className}
    >
      <p className="mt-4 text-3xl font-bold tabular-nums">
        {value ? value.toFixed(2) : '—'}
        <span className="text-lg font-semibold text-muted-foreground">
          {' '}
          / 10
        </span>
      </p>
      <Progress
        value={value ? value * 10 : 0}
        indicatorClassName="bg-icon-amber"
        className="mt-3"
      />
      <p className="mt-2 text-xs text-muted-foreground">
        Cumulative GPA across 5 semesters
      </p>
    </StatTile>
  )
}

export function FeesTile({ className }: { className?: string }) {
  const { total, paid, pending } = feeTotals()
  const paidPct = total > 0 ? Math.round((paid / total) * 100) : 0
  const due = FEE_DUES[0]

  return (
    <StatTile
      to="/fees"
      icon={CreditCard}
      color="rose"
      title="Fees"
      className={className}
    >
      <div className="mt-4 flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
        <div>
          <p className="text-3xl font-bold tabular-nums">
            {formatINR(pending)}
          </p>
          <p className="text-xs text-muted-foreground">
            {pending > 0 ? 'pending dues' : 'all dues cleared'}
          </p>
        </div>
        {pending > 0 && due ? (
          <span className="rounded-full bg-warning/10 px-2.5 py-1 text-xs font-medium text-warning">
            Due {formatDate(due.dueDate)}
          </span>
        ) : null}
      </div>
      <Progress
        value={paidPct}
        indicatorClassName="bg-success"
        className="mt-3"
      />
      <p className="mt-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{formatINR(paid)}</span>{' '}
        paid of {formatINR(total)} · {paidPct}% complete
      </p>
    </StatTile>
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

export function ClassmatesTile({ className }: { className?: string }) {
  return (
    <PanelTile
      icon={Users}
      title="Your class"
      meta={`${CLASS_CONTEXT.section} · Sem ${CLASS_CONTEXT.semester}`}
      className={className}
    >
      <ul className="divide-y">
        {CLASSMATES.map((classmate) => (
          <PersonRow key={classmate.name} person={classmate} />
        ))}
      </ul>
    </PanelTile>
  )
}

function PersonRow({ person }: { person: Classmate }) {
  return (
    <li className="flex items-center gap-3 px-5 py-3">
      <div className="relative shrink-0">
        <Avatar name={person.name} color={person.avatarColor} />
        <span
          className={cn(
            'absolute -right-0.5 -bottom-0.5 size-3 rounded-full ring-2 ring-card',
            PRESENCE_DOT[person.presence],
          )}
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{person.name}</p>
        <p className="truncate text-xs text-muted-foreground">{person.note}</p>
      </div>
    </li>
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
    <PanelTile icon={Cake} title="Birthdays" className={className}>
      <div className="space-y-4 p-5">
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
              onClick={() => void load()}
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
                      onClick={() =>
                        void navigate({
                          to: '/connect',
                          search: {
                            to: person.id,
                            name: person.display_name,
                            wish: true,
                          },
                        })
                      }
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
    </PanelTile>
  )
}

export function HolidaysTile({ className }: { className?: string }) {
  return (
    <PanelTile
      icon={PartyPopper}
      title="Upcoming holidays"
      className={className}
    >
      <ul className="divide-y">
        {HOLIDAYS.map((holiday) => {
          const date = dateFromOffset(holiday.offsetDays)
          return (
            <li
              key={holiday.name}
              className="flex items-center gap-3 px-5 py-3"
            >
              <DateChip date={date} color={holiday.color} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{holiday.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {date.toLocaleDateString('en-IN', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                  })}
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                {relativeLabel(holiday.offsetDays)}
              </span>
            </li>
          )
        })}
      </ul>
    </PanelTile>
  )
}

export function EventsTile({ className }: { className?: string }) {
  const todayCount = CAMPUS_EVENTS.filter(
    (event) => event.offsetDays <= 0,
  ).length

  return (
    <PanelTile
      icon={CalendarClock}
      title="Campus events"
      meta={todayCount > 0 ? `${todayCount} today` : undefined}
      className={className}
    >
      <ul className="divide-y">
        {CAMPUS_EVENTS.map((event) => (
          <EventRow key={event.title} event={event} />
        ))}
      </ul>
    </PanelTile>
  )
}

function EventRow({ event }: { event: CampusEvent }) {
  const isToday = event.offsetDays <= 0
  const date = dateFromOffset(event.offsetDays)

  return (
    <li
      className={cn(
        'flex items-center gap-3 px-5 py-3',
        isToday && 'bg-primary/5',
      )}
    >
      <DateChip date={date} color={event.color} />
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-sm font-medium leading-snug">
          {event.title}
        </p>
        <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
          <MapPin className="size-3 shrink-0" />
          {event.location}
        </p>
      </div>
      <span
        className={cn(
          'shrink-0 rounded-full px-2 py-0.5 text-xs font-medium',
          isToday
            ? 'bg-primary/10 text-primary'
            : 'bg-muted text-muted-foreground',
        )}
      >
        {relativeLabel(event.offsetDays)}
      </span>
    </li>
  )
}
