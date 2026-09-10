import { Fragment, useEffect, useState, type ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { Clock, Coffee, MapPin, Sparkles } from 'lucide-react'

import { cn } from '@/lib/utils'
import {
  addDays,
  fetchStudentWeek,
  shortTime,
  startOfWeek,
  toIsoDate,
  type WeekCell,
  type WeekResult,
} from '@/lib/student-academics'
import { ApiError } from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/** ISO weekday (1=Mon … 7=Sun), matching the timetable API's `day_of_week`. */
function isoToday(now: Date): number {
  const dow = now.getDay()
  return dow === 0 ? 7 : dow
}

interface DayState {
  teaching: WeekCell[]
  current: WeekCell | null
  currentIndex: number
  next: WeekCell | null
  doneCount: number
}

/**
 * Works out where the student is in their teaching day, right now. `doneCount`
 * comes from the server's `status === 'completed'` flag (set when the teacher
 * marks attendance) — not from wall-clock time.
 */
function computeDay(now: Date, week: WeekResult | null): DayState {
  if (!week) {
    return {
      teaching: [],
      current: null,
      currentIndex: -1,
      next: null,
      doneCount: 0,
    }
  }
  const today = isoToday(now)
  const teaching = week.cells
    .filter((c) => c.day_of_week === today && c.status !== 'cancelled')
    .sort((a, b) => toMinutes(a.start_time) - toMinutes(b.start_time))
  const mins = now.getHours() * 60 + now.getMinutes()
  let current: WeekCell | null = null
  let currentIndex = -1
  let next: WeekCell | null = null
  let doneCount = 0
  teaching.forEach((cell, index) => {
    if (cell.status === 'completed') doneCount += 1
    if (mins >= toMinutes(cell.start_time) && mins < toMinutes(cell.end_time)) {
      current = cell
      currentIndex = index
    }
    if (next === null && mins < toMinutes(cell.start_time)) next = cell
  })
  return { teaching, current, currentIndex, next, doneCount }
}

/**
 * The dashboard hero — a live snapshot of the student's day. It refreshes
 * every minute so "happening now" stays accurate while the tab is open.
 */
export function TodayHero({ name }: { name: string }) {
  const signOut = useAuthStore((state) => state.signOut)
  const [now, setNow] = useState(() => new Date())
  const [week, setWeek] = useState<WeekResult | null>(null)
  const [weekLoading, setWeekLoading] = useState(true)
  const [weekError, setWeekError] = useState<string | null>(null)

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    let cancelled = false
    setWeekLoading(true)
    setWeekError(null)
    const start = startOfWeek(new Date())
    fetchStudentWeek(toIsoDate(start), toIsoDate(addDays(start, 6)))
      .then((result) => {
        if (!cancelled) setWeek(result)
      })
      .catch((err) => {
        if (cancelled) return
        if (err instanceof ApiError && err.status === 401) {
          signOut()
          return
        }
        setWeekError(
          err instanceof Error ? err.message : "Couldn't load today's classes.",
        )
      })
      .finally(() => {
        if (!cancelled) setWeekLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [signOut])

  const { teaching, current, currentIndex, next, doneCount } = computeDay(
    now,
    week,
  )
  const hour = now.getHours()
  const greeting =
    hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const firstName = name.trim().split(/\s+/)[0]
  const dateLabel = now.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  return (
    <section className="relative overflow-hidden rounded-xl border bg-card p-5 text-card-foreground shadow-sm sm:p-6">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-16 size-56 rounded-full bg-primary/10 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-28 -left-12 size-56 rounded-full bg-secondary/10 blur-3xl"
      />

      <div className="relative space-y-5">
        <div className="space-y-1">
          <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-primary">
            <Sparkles className="size-3.5" />
            {greeting} · {dateLabel}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            Welcome back,{' '}
            <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              {firstName}
            </span>
          </h1>
        </div>

        {weekLoading ? (
          <HeroNote>Loading today&rsquo;s classes…</HeroNote>
        ) : weekError ? (
          <HeroNote>{weekError}</HeroNote>
        ) : teaching.length === 0 ? (
          <RestDayNote />
        ) : current ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <ClassPanel
              tone="now"
              label="Happening now"
              title={current.subject_name}
              start={shortTime(current.start_time)}
              end={shortTime(current.end_time)}
              room={current.room}
            />
            {next ? (
              <ClassPanel
                tone="next"
                label="Up next"
                title={next.subject_name}
                start={shortTime(next.start_time)}
                end={shortTime(next.end_time)}
                room={next.room}
              />
            ) : (
              <DoneNote done={doneCount} total={teaching.length} />
            )}
          </div>
        ) : next ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <ClassPanel
              tone="next"
              label={doneCount === 0 ? 'First class' : 'Up next'}
              title={next.subject_name}
              start={shortTime(next.start_time)}
              end={shortTime(next.end_time)}
              room={next.room}
            />
            <HeroNote>
              {doneCount === 0
                ? 'Your teaching day is about to begin — here is what is coming up.'
                : `${doneCount} of ${teaching.length} classes done. One more break, then back to it.`}
            </HeroNote>
          </div>
        ) : (
          <DoneNote done={doneCount} total={teaching.length} />
        )}

        {!weekLoading && !weekError && teaching.length > 0 ? (
          <DayTimeline
            teaching={teaching}
            doneCount={doneCount}
            currentIndex={currentIndex}
          />
        ) : null}
      </div>
    </section>
  )
}

function LiveDot() {
  return (
    <span className="relative flex size-2">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-icon-emerald opacity-75" />
      <span className="relative inline-flex size-2 rounded-full bg-icon-emerald" />
    </span>
  )
}

function ClassPanel({
  tone,
  label,
  title,
  start,
  end,
  room,
}: {
  tone: 'now' | 'next'
  label: string
  title: string
  start: string
  end: string
  room: string | null
}) {
  return (
    <Link
      to="/timetable"
      className={cn(
        'block rounded-xl border p-4 transition-colors',
        tone === 'now'
          ? 'border-primary/30 bg-primary/5 hover:bg-primary/10'
          : 'bg-background hover:bg-muted/60',
      )}
    >
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide">
        {tone === 'now' ? (
          <>
            <LiveDot />
            <span className="text-icon-emerald">{label}</span>
          </>
        ) : (
          <>
            <Clock className="size-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">{label}</span>
          </>
        )}
      </div>
      <p className="mt-2 truncate font-semibold leading-tight">{title}</p>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
        <span className="tabular-nums">
          {start} – {end}
        </span>
        {room ? (
          <>
            <span aria-hidden>·</span>
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3" />
              {room}
            </span>
          </>
        ) : null}
      </div>
    </Link>
  )
}

/**
 * The "nothing scheduled today" state — a warm rest-day panel with a gently
 * breathing coffee cup, rather than a plain grey note. Stands in for the
 * meaningless "0/0 classes" that an empty teaching day would otherwise read as.
 */
function RestDayNote() {
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-gradient-to-br from-icon-amber/10 to-primary/5 p-4">
      <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-icon-amber to-icon-rose text-icon-on shadow-sm">
        <Coffee className="size-5 animate-pulse motion-reduce:animate-none" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold">No classes today</p>
        <p className="text-xs text-muted-foreground">
          Enjoy the break — rest up and recharge. ☕
        </p>
      </div>
    </div>
  )
}

function HeroNote({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border bg-background p-4 text-sm text-muted-foreground">
      {children}
    </div>
  )
}

function DoneNote({ done, total }: { done: number; total: number }) {
  return (
    <div className="rounded-xl border bg-background p-4">
      <p className="text-sm font-medium">That&rsquo;s a wrap for today 🎉</p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {done} of {total} classes done. Rest up — see you tomorrow.
      </p>
    </div>
  )
}

function DayTimeline({
  teaching,
  doneCount,
  currentIndex,
}: {
  teaching: WeekCell[]
  doneCount: number
  currentIndex: number
}) {
  const total = teaching.length
  const progressLabel =
    currentIndex >= 0
      ? `In class ${currentIndex + 1} of ${total} · ${doneCount} done so far`
      : `${doneCount} of ${total} classes done today`

  return (
    <div className="space-y-2">
      <div className="flex items-center">
        {teaching.map((cell, index) => {
          const state =
            index === currentIndex
              ? 'current'
              : cell.status === 'completed'
                ? 'done'
                : 'upcoming'
          return (
            <Fragment key={cell.session_id}>
              {index > 0 ? (
                <div
                  className={cn(
                    'h-0.5 flex-1 rounded-full',
                    index <= doneCount ? 'bg-primary' : 'bg-border',
                  )}
                />
              ) : null}
              <div
                title={`${shortTime(cell.start_time)} · ${cell.subject_name}`}
                className={cn(
                  'shrink-0 rounded-full transition-all',
                  state === 'current'
                    ? 'size-3.5 bg-primary ring-4 ring-primary/20'
                    : state === 'done'
                      ? 'size-3 bg-primary'
                      : 'size-3 border-2 border-border bg-card',
                )}
              />
            </Fragment>
          )
        })}
      </div>
      <p className="text-xs font-medium text-muted-foreground">
        {progressLabel}
      </p>
    </div>
  )
}
