import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  MapPin,
  RefreshCw,
  User,
} from 'lucide-react'

import { NoClassesIllustration } from '@/components/no-classes-illustration'
import { PageHeader } from '@/components/portal-layout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ApiError } from '@/lib/api'
import {
  addDays,
  fetchStudentWeek,
  formatWeekRange,
  shortTime,
  startOfWeek,
  toIsoDate,
  type WeekCell,
  type WeekResult,
} from '@/lib/student-academics'
import { studentMe, type StudentProfile } from '@/lib/student-auth'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'

// 1=Mon … 7=Sun — matches the server's ISO weekday.
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
  const jsDow = new Date().getDay() // 0=Sun…6=Sat
  return jsDow === 0 ? 7 : jsDow
}

const ALL_DAYS = [1, 2, 3, 4, 5, 6, 7] as const

export default function Timetable() {
  const signOut = useAuthStore((state) => state.signOut)
  const [profile, setProfile] = useState<StudentProfile | null>(null)
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()))
  const [selectedDay, setSelectedDay] = useState<number>(() => isoToday())
  // Per-day cache keyed by `${weekStart_iso}:${day_of_week}` — survives
  // day-switches inside the same week without refetching, and cleared
  // implicitly by changing the key when the user navigates weeks.
  const [cellsCache, setCellsCache] = useState<Map<string, WeekCell[]>>(
    () => new Map(),
  )
  // Bell schedule (break rows) is the same across the whole week, so we
  // hold one copy per loaded week and refresh it on each fetch.
  const [breaks, setBreaks] = useState<WeekResult['breaks']>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Tracks which (week, day) keys we've already attempted to fetch so the
  // load effect doesn't refire after the cache populates (per the
  // useEffect setState loop pattern saved in memory).
  const attemptedRef = useRef<Set<string>>(new Set())
  const profileLoadedRef = useRef(false)

  useEffect(() => {
    document.title = 'Timetable — Nucleus'
  }, [])

  const weekStartIso = toIsoDate(weekStart)
  const cacheKey = `${weekStartIso}:${selectedDay}`

  const load = useCallback(
    async (start: Date, dow: number) => {
      const startStr = toIsoDate(start)
      const endStr = toIsoDate(addDays(start, 6))
      setLoading(true)
      setError(null)
      const needsProfile = !profileLoadedRef.current
      try {
        const [weekData, profileData] = await Promise.all([
          fetchStudentWeek(startStr, endStr, dow),
          needsProfile ? studentMe() : Promise.resolve(null),
        ])
        // Cancelled sessions aren't classes — strip them at the boundary
        // so every consumer downstream sees only "real" rows.
        const visibleCells = weekData.cells.filter(
          (c) => c.status !== 'cancelled',
        )
        setCellsCache((prev) => {
          const next = new Map(prev)
          next.set(`${startStr}:${dow}`, visibleCells)
          return next
        })
        setBreaks(weekData.breaks)
        if (needsProfile && profileData) {
          setProfile(profileData)
          profileLoadedRef.current = true
        }
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          signOut()
          return
        }
        setError(
          err instanceof Error
            ? err.message
            : 'Could not load your timetable.',
        )
      } finally {
        setLoading(false)
      }
    },
    [signOut],
  )

  // Whenever the user picks a different week, drop the cache + attempt
  // tracker so the next day-click hits the network with fresh data.
  useEffect(() => {
    setCellsCache(new Map())
    attemptedRef.current = new Set()
  }, [weekStartIso])

  // Lazy-load whichever (week, day) is currently selected, unless we
  // already have it cached or already tried (and may have failed). Cells
  // cache is intentionally NOT in deps — the attemptedRef sentinel
  // prevents the loop when a successful fetch repopulates the cache.
  useEffect(() => {
    if (attemptedRef.current.has(cacheKey)) return
    attemptedRef.current.add(cacheKey)
    void load(weekStart, selectedDay)
  }, [cacheKey, load, weekStart, selectedDay])

  const subtitle = useMemo(() => {
    if (!profile) return 'Loading…'
    const parts: string[] = []
    if (profile.programme) parts.push(profile.programme.name)
    // Always derive the displayed range from weekStart — the *currently
    // selected* week, not the last successful fetch. Otherwise the subtitle
    // lags one click behind navigation because the response's `week_start`
    // only updates after the next fetch resolves.
    const start = toIsoDate(weekStart)
    const end = toIsoDate(addDays(weekStart, 6))
    parts.push(formatWeekRange(start, end))
    return parts.join(' · ')
  }, [profile, weekStart])

  const cachedCells = cellsCache.get(cacheKey)
  const todaysCells = cachedCells ?? []
  const dayLoading = loading && cachedCells === undefined
  const todayIso = isoToday()

  return (
    <>
      <PageHeader
        title="Timetable"
        subtitle={subtitle}
        icon={CalendarDays}
        accent="blue"
      />

      <WeekNav
        weekStart={weekStart}
        onPrev={() => setWeekStart(addDays(weekStart, -7))}
        onNext={() => setWeekStart(addDays(weekStart, 7))}
        onToday={() => setWeekStart(startOfWeek(new Date()))}
        loading={loading}
      />

      {/* Fixed Mon–Sun strip. Day data is fetched lazily when the chip is
       *  clicked (and cached per week), so a student who only checks
       *  today doesn't pay for the other six days. */}
      <div className="flex flex-wrap gap-2">
        {ALL_DAYS.map((day) => {
          const selected = day === selectedDay
          const isToday = day === todayIso
          const labels = DAY_LABELS[day]
          return (
            <button
              key={day}
              type="button"
              aria-pressed={selected}
              onClick={() => setSelectedDay(day)}
              className={cn(
                'relative rounded-lg border px-4 py-2 text-sm font-medium transition-colors',
                selected
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'bg-card hover:bg-accent hover:text-accent-foreground',
                isToday && !selected && 'border-primary/40',
              )}
            >
              <span className="sm:hidden">{labels.short}</span>
              <span className="hidden sm:inline">{labels.long}</span>
            </button>
          )
        })}
      </div>

      {error ? (
        <ErrorBanner
          message={error}
          onRetry={() => {
            // Allow retrying this (week, day) on demand.
            attemptedRef.current.delete(cacheKey)
            void load(weekStart, selectedDay)
          }}
        />
      ) : null}

      <Card className="overflow-hidden">
        <div className="flex items-center gap-2 border-b bg-muted/40 px-5 py-3">
          <CalendarDays className="size-4 text-muted-foreground" />
          <p className="text-sm font-medium">
            {DAY_LABELS[selectedDay]?.long ?? 'Day'}
            <span className="text-muted-foreground">
              {' '}· {teachingCount(todaysCells)} classes
            </span>
          </p>
        </div>

        <DayBody loading={dayLoading} cells={todaysCells} breaks={breaks} />
      </Card>
    </>
  )
}

function WeekNav({
  weekStart,
  onPrev,
  onNext,
  onToday,
  loading,
}: {
  weekStart: Date
  onPrev: () => void
  onNext: () => void
  onToday: () => void
  loading: boolean
}) {
  const start = toIsoDate(weekStart)
  const end = toIsoDate(addDays(weekStart, 6))
  return (
    <div className="flex items-center justify-between gap-2">
      <p className="flex items-center gap-2 text-sm font-medium tabular-nums text-muted-foreground">
        <span>{formatWeekRange(start, end)}</span>
        {/* A small shimmer dot replaces the old "loading…" text — same hint,
            quieter, and matches the skeleton's animation vocabulary. */}
        {loading ? (
          <span
            aria-label="Loading"
            className="shimmer size-2 rounded-full bg-muted-foreground/40"
          />
        ) : null}
      </p>
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

function DayBody({
  loading,
  cells,
  breaks,
}: {
  loading: boolean
  cells: WeekCell[]
  breaks: { position: number; label: string; start_time: string; end_time: string }[]
}) {
  if (loading) {
    return (
      <div className="space-y-3 p-5">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="shimmer h-16 rounded-md bg-muted/60"
          />
        ))}
      </div>
    )
  }

  if (cells.length === 0) {
    return <NoClassesIllustration />
  }

  const rows = mergeBreaksIntoCells(cells, breaks)

  return (
    <div>
      {rows.map((row, index) =>
        row.kind === 'break' ? (
          <BreakRow key={`break-${index}`} row={row} />
        ) : (
          <ClassRow
            key={`${row.cell.session_id}`}
            cell={row.cell}
            last={index === rows.length - 1}
          />
        ),
      )}
    </div>
  )
}

type Row =
  | { kind: 'class'; cell: WeekCell; startMins: number }
  | {
      kind: 'break'
      label: string
      start_time: string
      end_time: string
      startMins: number
    }

/**
 * Interleave the day's class cells with the bell schedule's break rows,
 * ordering everything by start time. A break only renders if it sits between
 * two classes the student actually has — i.e. it falls strictly between the
 * earliest and latest class for the day. This avoids dangling break rows
 * before/after the student's first/last class.
 */
function mergeBreaksIntoCells(
  cells: WeekCell[],
  breaks: { position: number; label: string; start_time: string; end_time: string }[],
): Row[] {
  const classRows: Row[] = cells.map((cell) => ({
    kind: 'class' as const,
    cell,
    startMins: toMinutes(cell.start_time),
  }))
  if (classRows.length === 0) return []

  const earliest = Math.min(...classRows.map((r) => r.startMins))
  const latest = Math.max(...classRows.map((r) => r.startMins))

  const breakRows: Row[] = breaks
    .map((b) => ({
      kind: 'break' as const,
      label: b.label,
      start_time: b.start_time,
      end_time: b.end_time,
      startMins: toMinutes(b.start_time),
    }))
    .filter((b) => b.startMins > earliest && b.startMins < latest)

  return [...classRows, ...breakRows].sort((a, b) => a.startMins - b.startMins)
}

function toMinutes(time: string): number {
  const [h, m] = time.split(':')
  return Number(h) * 60 + Number(m)
}

function teachingCount(cells: WeekCell[]): number {
  // Cancelled sessions don't count as a "class to attend".
  return cells.filter((c) => c.status !== 'cancelled').length
}

function ClassRow({ cell, last }: { cell: WeekCell; last: boolean }) {
  const badge = badgeFor(cell)

  return (
    <div className={cn('flex gap-4 px-5 py-4', !last && 'border-b')}>
      <div className="w-16 shrink-0">
        <p className="text-sm font-semibold tabular-nums">
          {shortTime(cell.start_time)}
        </p>
        <p className="text-xs text-muted-foreground tabular-nums">
          {shortTime(cell.end_time)}
        </p>
      </div>

      <div className="min-w-0 flex-1 space-y-1.5 border-l pl-4">
        <div className="flex items-start justify-between gap-3">
          <p
            className={cn(
              'font-semibold',
              cell.status === 'cancelled' && 'line-through opacity-70',
            )}
          >
            {cell.subject_name}
          </p>
          <Badge variant={badge.variant}>{badge.label}</Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          {cell.subject_code}
          {cell.is_elective ? ' · Elective' : ''}
          {cell.span > 1 ? ` · ${cell.span} periods` : ''}
        </p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {cell.teacher_display_name ? (
            <span className="inline-flex items-center gap-1.5">
              <User className="size-3.5" />
              {cell.teacher_display_name}
            </span>
          ) : null}
          {cell.room ? (
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="size-3.5" />
              {cell.room}
            </span>
          ) : null}
          {cell.period_label ? <span>{cell.period_label}</span> : null}
        </div>
      </div>
    </div>
  )
}

function BreakRow({
  row,
}: {
  row: { label: string; start_time: string; end_time: string }
}) {
  return (
    <div className="flex items-center gap-3 border-b px-5 py-2">
      <span className="h-px flex-1 bg-border" />
      <span className="text-xs text-muted-foreground">
        {row.label} · {shortTime(row.start_time)}–{shortTime(row.end_time)}
      </span>
      <span className="h-px flex-1 bg-border" />
    </div>
  )
}

function badgeFor(cell: WeekCell): {
  label: string
  variant: 'default' | 'secondary' | 'warning' | 'destructive' | 'success'
} {
  if (cell.status === 'cancelled') return { label: 'Cancelled', variant: 'destructive' }
  if (cell.status === 'rescheduled') return { label: 'Rescheduled', variant: 'warning' }
  if (cell.is_elective) return { label: 'Elective', variant: 'secondary' }
  if (cell.span > 1) return { label: 'Lab', variant: 'secondary' }
  return { label: 'Lecture', variant: 'default' }
}
