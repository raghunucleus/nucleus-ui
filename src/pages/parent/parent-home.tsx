import { useCallback, useEffect, useState } from 'react'
import {
  Award,
  BookOpen,
  CalendarDays,
  ChevronRight,
  ClipboardCheck,
  GraduationCap,
  Layers,
  PalmtreeIcon,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { PageHeader } from '@/components/portal-layout'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { ApiError } from '@/lib/api'
import { type AcademicHoliday } from '@/lib/holidays'
import { type LinkedStudent } from '@/lib/parent-auth'
import {
  fetchChildAttendanceDashboard,
  fetchChildExamResults,
  fetchChildHolidaysPaged,
  type DashboardResult,
  type ExamResultsView,
  type SubjectAttendanceRow,
} from '@/lib/parent-academics'
import { parentNavigate } from '@/lib/parent-nav'
import { cn } from '@/lib/utils'
import { useParentAuthStore } from '@/stores/parent-auth-store'

const ATTENDANCE_THRESHOLD = 75
const GOOD_ATTENDANCE = 85

// Shared fixed height for the two data cards so the dashboard grid stays aligned
// no matter how many subjects/semesters there are — overflow scrolls internally.
const DASH_CARD = 'h-[26rem]'

function greetingKey(): string {
  const h = new Date().getHours()
  if (h < 12) return 'home.greetMorning'
  if (h < 17) return 'home.greetAfternoon'
  return 'home.greetEvening'
}

function initials(source: string): string {
  return (
    source
      .replace(/[^A-Za-z0-9 ]/g, '')
      .split(/\s+/)
      .filter(Boolean)
      .map((p) => p[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?'
  )
}

interface HomeData {
  attendance: DashboardResult | null
  exams: ExamResultsView | null
  holidays: AcademicHoliday[]
}

const EMPTY: HomeData = {
  attendance: null,
  exams: null,
  holidays: [],
}

export default function ParentHome() {
  const { t } = useTranslation()
  const signOut = useParentAuthStore((s) => s.signOut)
  const guardian = useParentAuthStore((s) => s.guardian)
  const child = useParentAuthStore(
    (s) => s.students.find((x) => x.id === s.selectedStudentId) ?? s.students[0],
  )

  const [data, setData] = useState<HomeData>(EMPTY)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    document.title = 'Home — Nucleus'
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    const [attendance, exams, holidays] = await Promise.allSettled([
      fetchChildAttendanceDashboard(),
      fetchChildExamResults(),
      fetchChildHolidaysPaged({ scope: 'upcoming', page: 1, page_size: 2 }),
    ])

    // A 401 anywhere means the session is gone — drop to login.
    for (const r of [attendance, exams, holidays]) {
      if (
        r.status === 'rejected' &&
        r.reason instanceof ApiError &&
        r.reason.status === 401
      ) {
        signOut()
        return
      }
    }

    setData({
      attendance: attendance.status === 'fulfilled' ? attendance.value : null,
      exams:
        exams.status === 'fulfilled' && exams.value.has_results
          ? exams.value
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

      {child ? <IdentityCard child={child} data={data} /> : null}

      <StatsRow loading={loading} data={data} />

      <HolidaysPreview loading={loading} holidays={data.holidays} />

      <div className="grid gap-4 lg:grid-cols-2">
        <AttendanceFocusCard loading={loading} attendance={data.attendance} />
        <AcademicCard loading={loading} exams={data.exams} />
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Identity — who the parent is looking at, at a glance.
// ---------------------------------------------------------------------------

function IdentityCard({
  child,
  data,
}: {
  child: LinkedStudent
  data: HomeData
}) {
  const { t } = useTranslation()
  const sem = data.attendance?.semester_number ?? null
  const meta = [
    child.programme?.name,
    sem != null ? t('home.identitySem', { n: sem }) : null,
    child.admission_year?.display_year
      ? t('home.batch', { year: child.admission_year.display_year })
      : null,
  ].filter(Boolean) as string[]

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-4 bg-gradient-to-br from-primary/8 to-secondary/8 p-5 sm:flex-row sm:items-center">
        <div className="brand-gradient grid size-14 shrink-0 place-items-center rounded-full text-lg font-semibold shadow-md shadow-primary/30">
          {initials(child.display_name)}
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <h2 className="truncate text-lg font-semibold">
            {child.display_name}
          </h2>
          <p className="text-sm text-muted-foreground">
            {child.student_id}
            {meta.length > 0 ? ` · ${meta.join(' · ')}` : ''}
          </p>
        </div>
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Stat tiles — the headline standing numbers.
// ---------------------------------------------------------------------------

function StatsRow({ loading, data }: { loading: boolean; data: HomeData }) {
  const { t } = useTranslation()
  const att = data.attendance
  const exams = data.exams
  const backlogs = exams?.backlog_count ?? 0

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <StatCard
        label={t('home.statAttendance')}
        value={att ? `${att.overall_pct.toFixed(1)}%` : t('home.notYet')}
        hint={
          att
            ? t('attendance.classes', {
                a: att.overall_attended,
                h: att.overall_held,
              })
            : undefined
        }
        icon={ClipboardCheck}
        tone={att ? attendanceTone(att.overall_pct) : 'emerald'}
        loading={loading}
        onClick={() => parentNavigate('/attendance')}
      />
      <StatCard
        label={t('home.statCgpa')}
        value={exams ? exams.cgpa.toFixed(2) : t('home.notYet')}
        hint={
          exams
            ? t('home.creditsHint', { credits: exams.total_credits })
            : undefined
        }
        icon={Award}
        tone="amber"
        loading={loading}
        onClick={() => parentNavigate('/exam-results')}
      />
      <StatCard
        label={t('home.statBacklogs')}
        value={
          exams ? (backlogs === 0 ? t('home.backlogsClear') : String(backlogs)) : '—'
        }
        hint={
          exams
            ? t('home.subjectsPassed', {
                passed: exams.passed_count,
                total: exams.subjects_count,
              })
            : undefined
        }
        icon={backlogs > 0 ? TriangleAlert : GraduationCap}
        tone={backlogs > 0 ? 'rose' : 'cyan'}
        loading={loading}
        onClick={() => parentNavigate('/exam-results')}
      />
    </div>
  )
}

type Tone = 'emerald' | 'amber' | 'blue' | 'rose' | 'cyan' | 'violet'

const TONE_CHIP: Record<Tone, string> = {
  emerald: 'bg-icon-emerald/12 text-icon-emerald',
  amber: 'bg-icon-amber/14 text-icon-amber',
  blue: 'bg-icon-blue/12 text-icon-blue',
  rose: 'bg-icon-rose/12 text-icon-rose',
  cyan: 'bg-icon-cyan/12 text-icon-cyan',
  violet: 'bg-icon-violet/12 text-icon-violet',
}

function attendanceTone(pct: number): Tone {
  if (pct >= GOOD_ATTENDANCE) return 'emerald'
  if (pct >= ATTENDANCE_THRESHOLD) return 'amber'
  return 'rose'
}

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone,
  loading,
  onClick,
}: {
  label: string
  value: string
  hint?: string
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
            <>
              <p className="text-2xl font-semibold tracking-tight tabular-nums">
                {value}
              </p>
              {hint ? (
                <p className="truncate text-xs text-muted-foreground">{hint}</p>
              ) : null}
            </>
          )}
        </div>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
      </button>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Attendance focus — overall plus the subjects that need attention.
// ---------------------------------------------------------------------------

function AttendanceFocusCard({
  loading,
  attendance,
}: {
  loading: boolean
  attendance: DashboardResult | null
}) {
  const { t } = useTranslation()

  if (loading) {
    return (
      <Card className={cn(DASH_CARD, 'space-y-4 p-5')}>
        <div className="h-4 w-32 shimmer rounded bg-muted/60" />
        <div className="h-10 w-24 shimmer rounded bg-muted/60" />
        <div className="h-2 w-full shimmer rounded bg-muted/60" />
      </Card>
    )
  }
  if (!attendance || attendance.per_subject.length === 0) return null

  const tone = attendanceTone(attendance.overall_pct)
  const barClass =
    tone === 'emerald'
      ? 'bg-success'
      : tone === 'amber'
        ? 'bg-warning'
        : 'bg-destructive'

  // Every subject, lowest attendance first so anything at risk sits on top.
  const subjects = [...attendance.per_subject].sort((a, b) => a.pct - b.pct)

  return (
    <Card className={cn(DASH_CARD, 'flex flex-col overflow-hidden')}>
      <button
        type="button"
        onClick={() => parentNavigate('/attendance')}
        className="flex w-full shrink-0 items-center justify-between gap-3 border-b px-5 py-3.5 text-left transition-colors hover:bg-accent/40"
      >
        <span className="flex items-center gap-2 text-sm font-semibold">
          <ClipboardCheck className="size-4 text-icon-emerald" />
          {t('home.attnFocus')}
        </span>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
      </button>

      <div className="shrink-0 space-y-2 border-b p-5">
        <div className="flex items-baseline justify-between">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t('home.attnOverall')}
          </p>
          <span
            className={cn(
              'text-2xl font-bold tabular-nums',
              tone === 'emerald'
                ? 'text-success'
                : tone === 'amber'
                  ? 'text-warning'
                  : 'text-destructive',
            )}
          >
            {attendance.overall_pct.toFixed(1)}%
          </span>
        </div>
        <Progress value={attendance.overall_pct} indicatorClassName={barClass} />
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-5">
        <p className="text-xs font-semibold text-muted-foreground">
          {t('home.attnAllSubjects')}
        </p>
        {subjects.map((s) => (
          <FocusRow key={s.subject_id} subject={s} />
        ))}
      </div>
    </Card>
  )
}

function focusMeta(pct: number): { bar: string; text: string } {
  if (pct >= GOOD_ATTENDANCE) return { bar: 'bg-success', text: 'text-success' }
  if (pct >= ATTENDANCE_THRESHOLD)
    return { bar: 'bg-warning', text: 'text-warning' }
  return { bar: 'bg-destructive', text: 'text-destructive' }
}

function FocusRow({ subject }: { subject: SubjectAttendanceRow }) {
  const { t } = useTranslation()
  const noClasses = subject.held === 0
  const meta = noClasses ? null : focusMeta(subject.pct)
  return (
    <button
      type="button"
      onClick={() => parentNavigate(`/attendance/${subject.subject_id}`)}
      className="flex w-full flex-col gap-1.5 text-left"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 flex-1 truncate text-sm font-medium">
          {subject.subject_name}
        </span>
        <span
          className={cn(
            'shrink-0 text-sm font-semibold tabular-nums',
            meta ? meta.text : 'text-muted-foreground',
          )}
        >
          {noClasses ? t('attendance.marginNoHeld') : `${subject.pct.toFixed(0)}%`}
        </span>
      </div>
      <Progress value={noClasses ? 0 : subject.pct} indicatorClassName={meta?.bar} />
    </button>
  )
}

// ---------------------------------------------------------------------------
// Academic performance — CGPA breakdown + per-semester SGPA trend.
// ---------------------------------------------------------------------------

function AcademicCard({
  loading,
  exams,
}: {
  loading: boolean
  exams: ExamResultsView | null
}) {
  const { t } = useTranslation()

  if (loading) {
    return (
      <Card className={cn(DASH_CARD, 'space-y-4 p-5')}>
        <div className="h-4 w-40 shimmer rounded bg-muted/60" />
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 shimmer rounded-lg bg-muted/60" />
          ))}
        </div>
      </Card>
    )
  }
  if (!exams) {
    return (
      <Card className={cn(DASH_CARD, 'flex flex-col overflow-hidden')}>
        <div className="flex shrink-0 items-center gap-2 border-b px-5 py-3.5 text-sm font-semibold">
          <GraduationCap className="size-4 text-icon-amber" />
          {t('home.academicTitle')}
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-1 px-5 text-center">
          <BookOpen className="size-8 text-muted-foreground/60" />
          <p className="text-sm text-muted-foreground">
            {t('home.academicPending')}
          </p>
        </div>
      </Card>
    )
  }

  return (
    <Card className={cn(DASH_CARD, 'flex flex-col overflow-hidden')}>
      <button
        type="button"
        onClick={() => parentNavigate('/exam-results')}
        className="flex w-full shrink-0 items-center justify-between gap-3 border-b px-5 py-3.5 text-left transition-colors hover:bg-accent/40"
      >
        <span className="flex items-center gap-2 text-sm font-semibold">
          <GraduationCap className="size-4 text-icon-amber" />
          {t('home.academicTitle')}
        </span>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
      </button>

      <div className="grid shrink-0 grid-cols-3 gap-3 border-b p-5">
        <MiniStat
          icon={Award}
          tone="amber"
          label={t('exam.cgpaLabel')}
          value={exams.cgpa.toFixed(2)}
        />
        <MiniStat
          icon={Layers}
          tone="violet"
          label={t('home.academicCredits')}
          value={String(exams.total_credits)}
        />
        <MiniStat
          icon={exams.backlog_count > 0 ? TriangleAlert : GraduationCap}
          tone={exams.backlog_count > 0 ? 'rose' : 'cyan'}
          label={t('home.academicBacklogs')}
          value={String(exams.backlog_count)}
        />
      </div>

      {exams.semesters.length > 0 ? (
        <div className="flex-1 space-y-3 overflow-y-auto p-5">
          <p className="text-xs font-semibold text-muted-foreground">
            {t('home.academicTrend')}
          </p>
          <div className="space-y-2.5">
            {[...exams.semesters]
              .sort((a, b) => a.semester - b.semester)
              .map((s) => (
                <div key={s.semester} className="flex items-center gap-3">
                  <span className="w-14 shrink-0 text-xs font-medium text-muted-foreground">
                    {t('home.semShort', { n: s.semester })}
                  </span>
                  <Progress
                    className="flex-1"
                    value={(s.sgpa / 10) * 100}
                    indicatorClassName={s.passed ? 'bg-success' : 'bg-warning'}
                  />
                  <span className="w-10 shrink-0 text-right text-sm font-semibold tabular-nums">
                    {s.sgpa.toFixed(2)}
                  </span>
                </div>
              ))}
          </div>
        </div>
      ) : (
        <div className="flex-1" />
      )}
    </Card>
  )
}

function MiniStat({
  icon: Icon,
  tone,
  label,
  value,
}: {
  icon: LucideIcon
  tone: Tone
  label: string
  value: string
}) {
  return (
    <div className="space-y-1 rounded-lg border bg-card/50 p-3">
      <span
        className={cn(
          'grid size-7 place-items-center rounded-md',
          TONE_CHIP[tone],
        )}
      >
        <Icon className="size-4" />
      </span>
      <p className="text-lg font-bold tabular-nums leading-tight">{value}</p>
      <p className="truncate text-[11px] text-muted-foreground">{label}</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Upcoming holidays.
// ---------------------------------------------------------------------------

function HolidaysPreview({
  loading,
  holidays,
}: {
  loading: boolean
  holidays: AcademicHoliday[]
}) {
  const { t } = useTranslation()
  if (loading || holidays.length === 0) return null
  const shown = holidays.slice(0, 2)
  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={() => parentNavigate('/academic-holidays')}
        className="flex w-full items-center gap-4 p-4 text-left transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <PalmtreeIcon className="size-3.5 text-icon-rose" />
            {t('home.upcomingHolidays')}
          </p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {shown.map((h) => (
              <HolidayChip key={h.id} holiday={h} />
            ))}
          </div>
        </div>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
      </button>
    </Card>
  )
}

/** One holiday laid out horizontally — a compact date badge (weekday on top,
 *  day + month below) next to the name, so the date stays the visual focus
 *  while the two holidays sit side by side to save vertical space. */
function HolidayChip({ holiday }: { holiday: AcademicHoliday }) {
  const { weekday, dayMonth } = holidayParts(holiday.date)
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex flex-col items-center rounded-md border border-icon-rose/20 bg-icon-rose/8 px-2 py-1 text-center leading-none">
        {weekday ? (
          <span className="text-[10px] font-semibold uppercase tracking-wide text-icon-rose">
            {weekday}
          </span>
        ) : null}
        <span className="mt-0.5 text-sm font-bold tabular-nums">{dayMonth}</span>
      </span>
      <span className="text-sm font-medium">{holiday.name}</span>
    </div>
  )
}

/** Short weekday + "DD Mon" for the date badge. */
function holidayParts(iso: string): { weekday: string; dayMonth: string } {
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return { weekday: '', dayMonth: iso }
  return {
    weekday: d.toLocaleDateString('en-IN', { weekday: 'short' }),
    dayMonth: d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
  }
}
