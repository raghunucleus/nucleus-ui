import { Fragment, useEffect, useState, type ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { Clock, MapPin, Sparkles } from 'lucide-react'

import { cn } from '@/lib/utils'
import { TIMETABLE, WEEKDAYS, type ClassSlot } from '@/lib/academics-mock'

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

interface DayState {
  teaching: ClassSlot[]
  current: ClassSlot | null
  currentIndex: number
  next: ClassSlot | null
  doneCount: number
  isSunday: boolean
}

/** Works out where the student is in their teaching day, right now. */
function computeDay(now: Date): DayState {
  const day = now.getDay()
  if (day === 0) {
    return {
      teaching: [],
      current: null,
      currentIndex: -1,
      next: null,
      doneCount: 0,
      isSunday: true,
    }
  }
  const teaching = TIMETABLE[WEEKDAYS[day - 1]].filter(
    (slot) => slot.kind !== 'break',
  )
  const mins = now.getHours() * 60 + now.getMinutes()
  let current: ClassSlot | null = null
  let currentIndex = -1
  let next: ClassSlot | null = null
  let doneCount = 0
  teaching.forEach((slot, index) => {
    if (mins >= toMinutes(slot.end)) doneCount += 1
    if (mins >= toMinutes(slot.start) && mins < toMinutes(slot.end)) {
      current = slot
      currentIndex = index
    }
    if (next === null && mins < toMinutes(slot.start)) next = slot
  })
  return { teaching, current, currentIndex, next, doneCount, isSunday: false }
}

/**
 * The dashboard hero — a live snapshot of the student's day. It refreshes
 * every minute so "happening now" stays accurate while the tab is open.
 */
export function TodayHero({ name }: { name: string }) {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  const { teaching, current, currentIndex, next, doneCount, isSunday } =
    computeDay(now)
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
    <section className="relative overflow-hidden rounded-2xl border bg-card p-5 text-card-foreground shadow-sm sm:p-6">
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
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Welcome back,{' '}
            <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              {firstName}
            </span>
          </h1>
        </div>

        {isSunday ? (
          <HeroNote>
            It&rsquo;s Sunday — no classes today. Enjoy the break. 🌤️
          </HeroNote>
        ) : current ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <ClassPanel tone="now" label="Happening now" slot={current} />
            {next ? (
              <ClassPanel tone="next" label="Up next" slot={next} />
            ) : (
              <DoneNote count={teaching.length} />
            )}
          </div>
        ) : next ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <ClassPanel
              tone="next"
              label={doneCount === 0 ? 'First class' : 'Up next'}
              slot={next}
            />
            <HeroNote>
              {doneCount === 0
                ? 'Your teaching day is about to begin — here is what is coming up.'
                : `${doneCount} of ${teaching.length} classes done. One more break, then back to it.`}
            </HeroNote>
          </div>
        ) : (
          <DoneNote count={teaching.length} />
        )}

        {!isSunday && teaching.length > 0 ? (
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
  slot,
}: {
  tone: 'now' | 'next'
  label: string
  slot: ClassSlot
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
      <p className="mt-2 truncate font-semibold leading-tight">{slot.title}</p>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
        <span className="tabular-nums">
          {slot.start} – {slot.end}
        </span>
        {slot.room ? (
          <>
            <span aria-hidden>·</span>
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3" />
              {slot.room}
            </span>
          </>
        ) : null}
      </div>
    </Link>
  )
}

function HeroNote({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border bg-background p-4 text-sm text-muted-foreground">
      {children}
    </div>
  )
}

function DoneNote({ count }: { count: number }) {
  return (
    <div className="rounded-xl border bg-background p-4">
      <p className="text-sm font-medium">That&rsquo;s a wrap for today 🎉</p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        All {count} classes done. Rest up — see you tomorrow.
      </p>
    </div>
  )
}

function DayTimeline({
  teaching,
  doneCount,
  currentIndex,
}: {
  teaching: ClassSlot[]
  doneCount: number
  currentIndex: number
}) {
  const total = teaching.length
  const progressLabel =
    currentIndex >= 0
      ? `In class ${currentIndex + 1} of ${total} today`
      : `${doneCount} of ${total} classes done today`

  return (
    <div className="space-y-2">
      <div className="flex items-center">
        {teaching.map((slot, index) => {
          const state =
            index === currentIndex
              ? 'current'
              : index < doneCount
                ? 'done'
                : 'upcoming'
          return (
            <Fragment key={`${slot.code ?? slot.title}-${slot.start}`}>
              {index > 0 ? (
                <div
                  className={cn(
                    'h-0.5 flex-1 rounded-full',
                    index <= doneCount ? 'bg-primary' : 'bg-border',
                  )}
                />
              ) : null}
              <div
                title={`${slot.start} · ${slot.title}`}
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
