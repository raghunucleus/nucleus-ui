import { useCallback, useEffect, useState } from 'react'
import {
  Award,
  CalendarDays,
  ChevronRight,
  ClipboardCheck,
  Coffee,
  PalmtreeIcon,
  type LucideIcon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { PageHeader } from '@/components/portal-layout'
import { Card } from '@/components/ui/card'
import { ApiError } from '@/lib/api'
import { type AcademicHoliday } from '@/lib/holidays'
import {
  addDays,
  fetchChildAttendanceDashboard,
  fetchChildExamResults,
  fetchChildHolidaysPaged,
  fetchChildWeek,
  startOfWeek,
  toIsoDate,
} from '@/lib/parent-academics'
import { parentNavigate } from '@/lib/parent-nav'
import { cn } from '@/lib/utils'
import { useParentAuthStore } from '@/stores/parent-auth-store'

function greetingKey(): string {
  const h = new Date().getHours()
  if (h < 12) return 'home.greetMorning'
  if (h < 17) return 'home.greetAfternoon'
  return 'home.greetEvening'
}

function isoTodayDow(): number {
  const jsDow = new Date().getDay()
  return jsDow === 0 ? 7 : jsDow
}

interface Stats {
  attendancePct: number | null
  cgpa: number | null
  classesToday: { completed: number; total: number } | null
  holidays: AcademicHoliday[]
}

export default function ParentHome() {
  const { t } = useTranslation()
  const signOut = useParentAuthStore((s) => s.signOut)
  const guardian = useParentAuthStore((s) => s.guardian)
  const child = useParentAuthStore(
    (s) => s.students.find((x) => x.id === s.selectedStudentId) ?? s.students[0],
  )

  const [stats, setStats] = useState<Stats>({
    attendancePct: null,
    cgpa: null,
    classesToday: null,
    holidays: [],
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    document.title = 'Home — Nucleus'
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    const start = startOfWeek(new Date())
    const weekStart = toIsoDate(start)
    const weekEnd = toIsoDate(addDays(start, 6))
    const [attendance, exams, week, holidays] = await Promise.allSettled([
      fetchChildAttendanceDashboard(),
      fetchChildExamResults(),
      fetchChildWeek(weekStart, weekEnd, isoTodayDow()),
      fetchChildHolidaysPaged({ scope: 'upcoming', page: 1, page_size: 3 }),
    ])

    // A 401 anywhere means the session is gone — drop to login.
    for (const r of [attendance, exams, week, holidays]) {
      if (
        r.status === 'rejected' &&
        r.reason instanceof ApiError &&
        r.reason.status === 401
      ) {
        signOut()
        return
      }
    }

    const todayCells =
      week.status === 'fulfilled'
        ? week.value.cells.filter((c) => c.status !== 'cancelled')
        : null

    setStats({
      attendancePct:
        attendance.status === 'fulfilled' ? attendance.value.overall_pct : null,
      cgpa:
        exams.status === 'fulfilled' && exams.value.has_results
          ? exams.value.cgpa
          : null,
      classesToday: todayCells
        ? {
            completed: todayCells.filter((c) => c.status === 'completed').length,
            total: todayCells.length,
          }
        : null,
      holidays: holidays.status === 'fulfilled' ? holidays.value.items : [],
    })
    setLoading(false)
  }, [signOut])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <>
      <PageHeader
        title={`${t(greetingKey())}${guardian ? `, ${guardian.display_name.split(' ')[0]}` : ''}`}
        subtitle={
          child
            ? t('home.subtitle', { name: child.display_name.split(' ')[0] })
            : undefined
        }
        icon={CalendarDays}
        accent="blue"
        backTo="/"
        backLabel={t('brand.parentPortal')}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label={t('home.statAttendance')}
          value={
            stats.attendancePct != null
              ? `${stats.attendancePct.toFixed(1)}%`
              : t('home.notYet')
          }
          icon={ClipboardCheck}
          tone="emerald"
          loading={loading}
          onClick={() => parentNavigate('/attendance')}
        />
        <StatCard
          label={t('home.statCgpa')}
          value={stats.cgpa != null ? stats.cgpa.toFixed(2) : t('home.notYet')}
          icon={Award}
          tone="amber"
          loading={loading}
          onClick={() => parentNavigate('/exam-results')}
        />
        <StatCard
          label={t('home.statClassesToday')}
          value={
            stats.classesToday
              ? stats.classesToday.total === 0
                ? t('home.freeDay')
                : `${stats.classesToday.completed}/${stats.classesToday.total}`
              : '—'
          }
          icon={stats.classesToday?.total === 0 ? Coffee : CalendarDays}
          tone="blue"
          loading={loading}
          onClick={() => parentNavigate('/timetable')}
        />
      </div>

      <HolidaysPreview loading={loading} holidays={stats.holidays} />
    </>
  )
}

type Tone = 'emerald' | 'amber' | 'blue' | 'rose'

const TONE_CHIP: Record<Tone, string> = {
  emerald: 'bg-icon-emerald/12 text-icon-emerald',
  amber: 'bg-icon-amber/14 text-icon-amber',
  blue: 'bg-icon-blue/12 text-icon-blue',
  rose: 'bg-icon-rose/12 text-icon-rose',
}

function StatCard({
  label,
  value,
  icon: Icon,
  tone,
  loading,
  onClick,
}: {
  label: string
  value: string
  icon: LucideIcon
  tone: Tone
  loading: boolean
  onClick: () => void
}) {
  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center gap-4 p-5 text-left transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <span
          className={cn(
            'grid size-11 shrink-0 place-items-center rounded-xl',
            TONE_CHIP[tone],
          )}
        >
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          {loading ? (
            <div className="mt-1 h-7 w-16 shimmer rounded bg-muted/60" />
          ) : (
            <p className="text-2xl font-bold tracking-tight tabular-nums">
              {value}
            </p>
          )}
        </div>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
      </button>
    </Card>
  )
}

function HolidaysPreview({
  loading,
  holidays,
}: {
  loading: boolean
  holidays: AcademicHoliday[]
}) {
  const { t } = useTranslation()
  if (loading || holidays.length === 0) return null
  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={() => parentNavigate('/academic-holidays')}
        className="flex w-full items-center justify-between gap-3 border-b px-5 py-3.5 text-left transition-colors hover:bg-accent/40"
      >
        <span className="flex items-center gap-2 text-sm font-semibold">
          <PalmtreeIcon className="size-4 text-icon-rose" />
          {t('home.upcomingHolidays')}
        </span>
        <ChevronRight className="size-4 text-muted-foreground" />
      </button>
      <ul className="divide-y">
        {holidays.map((h) => (
          <li key={h.id} className="flex items-center justify-between gap-3 px-5 py-3">
            <span className="min-w-0 flex-1 truncate text-sm font-medium">
              {h.name}
            </span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {holidayDate(h.date)}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  )
}

function holidayDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
}
