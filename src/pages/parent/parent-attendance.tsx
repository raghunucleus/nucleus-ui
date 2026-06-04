import { useCallback, useEffect, useState } from 'react'
import {
  CalendarClock,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  ClipboardCheck,
  RefreshCw,
  TriangleAlert,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'

import { PageHeader } from '@/components/portal-layout'
import { StateView } from '@/components/state-view'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { ApiError } from '@/lib/api'
import {
  fetchChildAttendanceDashboard,
  type DashboardResult,
  type SubjectAttendanceRow,
} from '@/lib/parent-academics'
import { parentNavigate } from '@/lib/parent-nav'
import { cn } from '@/lib/utils'
import { useParentAuthStore } from '@/stores/parent-auth-store'

const ATTENDANCE_THRESHOLD = 75

type BadgeVariant = 'success' | 'warning' | 'destructive'
type Standing = 'good' | 'warning' | 'low'

const STANDING: Record<
  Standing,
  { badge: BadgeVariant; bar: string; text: string }
> = {
  good: { badge: 'success', bar: 'bg-success', text: 'text-success' },
  warning: { badge: 'warning', bar: 'bg-warning', text: 'text-warning' },
  low: { badge: 'destructive', bar: 'bg-destructive', text: 'text-destructive' },
}

const STANDING_LABEL_KEY: Record<Standing, string> = {
  good: 'attendance.standingGood',
  warning: 'attendance.standingLow',
  low: 'attendance.standingShortage',
}

function standingFor(pct: number): Standing {
  if (pct >= 85) return 'good'
  if (pct >= ATTENDANCE_THRESHOLD) return 'warning'
  return 'low'
}

function marginHint(t: TFunction, held: number, attended: number): string {
  if (held === 0) return t('attendance.marginNoHeld')
  const pct = (attended / held) * 100
  const ratio = ATTENDANCE_THRESHOLD / 100
  if (pct >= ATTENDANCE_THRESHOLD) {
    const canSkip = Math.floor(attended / ratio - held)
    return canSkip > 0
      ? t('attendance.canMiss', { count: canSkip })
      : t('attendance.noBuffer')
  }
  const need = Math.ceil((ratio * held - attended) / (1 - ratio))
  return t('attendance.need', { n: need, threshold: ATTENDANCE_THRESHOLD })
}

export default function ParentAttendance() {
  const { t } = useTranslation()
  const signOut = useParentAuthStore((s) => s.signOut)
  const programmeName = useParentAuthStore(
    (s) =>
      (s.students.find((x) => x.id === s.selectedStudentId) ?? s.students[0])
        ?.programme?.name ?? null,
  )
  const [dashboard, setDashboard] = useState<DashboardResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    document.title = 'Attendance — Nucleus'
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setDashboard(await fetchChildAttendanceDashboard())
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        signOut()
        return
      }
      setError(
        err instanceof Error ? err.message : 'Could not load attendance.',
      )
    } finally {
      setLoading(false)
    }
  }, [signOut])

  useEffect(() => {
    void load()
  }, [load])

  const subtitle = subtitleFor(t, programmeName, dashboard)

  return (
    <>
      <PageHeader
        title={t('attendance.title')}
        subtitle={subtitle}
        icon={ClipboardCheck}
        accent="emerald"
      />

      {error && !dashboard && !loading ? (
        <StateView
          icon={CalendarClock}
          title={error}
          description={t('attendance.notReadyDesc')}
          action={{ label: t('common.retry'), onClick: load }}
        />
      ) : (
        <>
          {error ? <ErrorBanner message={error} onRetry={load} /> : null}

          {loading && !dashboard ? (
            <LoadingState />
          ) : dashboard && dashboard.per_subject.length === 0 ? (
            <EmptyState />
          ) : dashboard ? (
            <ContentLoaded data={dashboard} />
          ) : null}
        </>
      )}
    </>
  )
}

function subtitleFor(
  t: TFunction,
  programmeName: string | null,
  dashboard: DashboardResult | null,
): string | undefined {
  const parts: string[] = []
  if (programmeName) parts.push(programmeName)
  if (dashboard?.semester_number) {
    parts.push(t('attendance.semester', { n: dashboard.semester_number }))
  }
  return parts.length > 0 ? parts.join(' · ') : undefined
}

function ContentLoaded({ data }: { data: DashboardResult }) {
  const { t } = useTranslation()
  const standing = standingFor(data.overall_pct)
  return (
    <>
      <OverallCard
        percent={data.overall_pct}
        held={data.overall_held}
        attended={data.overall_attended}
        standing={standing}
      />

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground">
            {t('attendance.subjectWise')}
          </h2>
          <p className="text-xs text-muted-foreground">
            {t('attendance.subjectsReq', {
              n: data.per_subject.length,
              threshold: ATTENDANCE_THRESHOLD,
            })}
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {data.per_subject.map((subject) => (
            <SubjectCard key={subject.subject_id} subject={subject} />
          ))}
        </div>
      </section>
    </>
  )
}

function OverallCard({
  percent,
  held,
  attended,
  standing,
}: {
  percent: number
  held: number
  attended: number
  standing: Standing
}) {
  const { t } = useTranslation()
  const meta = STANDING[standing]
  const Icon =
    standing === 'good'
      ? CircleCheck
      : standing === 'warning'
        ? TriangleAlert
        : CircleAlert

  const summaryKey =
    held === 0
      ? 'attendance.summaryNone'
      : standing === 'low'
        ? 'attendance.summaryLow'
        : standing === 'warning'
          ? 'attendance.summaryWarn'
          : 'attendance.summaryGood'

  return (
    <Card className="p-5 sm:p-6">
      <div className="grid gap-6 sm:grid-cols-[auto_1fr] sm:items-center">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t('attendance.overall')}
          </p>
          <div className="flex items-end gap-1">
            <span className="text-5xl font-bold tracking-tight tabular-nums">
              {percent.toFixed(1)}
            </span>
            <span className="pb-1.5 text-xl font-semibold text-muted-foreground">
              %
            </span>
          </div>
          <Badge variant={meta.badge}>{t(STANDING_LABEL_KEY[standing])}</Badge>
        </div>

        <div className="space-y-2.5">
          <Progress value={percent} indicatorClassName={meta.bar} />
          <div className="flex items-start gap-2 text-sm text-muted-foreground">
            <Icon className={cn('mt-0.5 size-4 shrink-0', meta.text)} />
            <p>{t(summaryKey, { a: attended, h: held })}</p>
          </div>
        </div>
      </div>
    </Card>
  )
}

function SubjectCard({ subject }: { subject: SubjectAttendanceRow }) {
  const { t } = useTranslation()
  const standing = standingFor(subject.pct)
  const meta = STANDING[standing]

  return (
    <Card className="overflow-hidden">
      <a
        href={`/attendance/${subject.subject_id}`}
        onClick={(e) => {
          e.preventDefault()
          parentNavigate(`/attendance/${subject.subject_id}`)
        }}
        aria-label={`Open class history for ${subject.subject_name}`}
        className="flex h-full w-full flex-col gap-3 p-5 text-left transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold">{subject.subject_name}</h3>
            <p className="text-xs text-muted-foreground">{subject.subject_code}</p>
          </div>
          <span className={cn('text-xl font-bold tabular-nums', meta.text)}>
            {subject.pct.toFixed(1)}%
          </span>
        </div>

        <Progress value={subject.pct} indicatorClassName={meta.bar} />

        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="text-muted-foreground">
            {t('attendance.classes', { a: subject.attended, h: subject.held })}
          </span>
          <span className={cn('font-medium', meta.text)}>
            {marginHint(t, subject.held, subject.attended)}
          </span>
        </div>

        <div className="mt-auto flex items-center justify-between border-t pt-3 text-[11px] font-medium text-muted-foreground">
          <span>{t('attendance.viewHistory')}</span>
          <ChevronRight className="size-3.5" />
        </div>
      </a>
    </Card>
  )
}

function LoadingState() {
  return (
    <>
      <Card className="p-5 sm:p-6">
        <div className="space-y-3">
          <div className="h-4 w-32 shimmer rounded bg-muted/60" />
          <div className="h-12 w-24 shimmer rounded bg-muted/60" />
          <div className="h-2 w-full shimmer rounded bg-muted/60" />
        </div>
      </Card>
      <div className="grid gap-4 sm:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i} className="space-y-3 p-5">
            <div className="h-5 w-2/3 shimmer rounded bg-muted/60" />
            <div className="h-2 w-full shimmer rounded bg-muted/60" />
            <div className="h-3 w-1/2 shimmer rounded bg-muted/60" />
          </Card>
        ))}
      </div>
    </>
  )
}

function EmptyState() {
  const { t } = useTranslation()
  return (
    <StateView
      icon={ClipboardCheck}
      title={t('attendance.noDataTitle')}
      description={t('attendance.noDataDesc')}
    />
  )
}

function ErrorBanner({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}) {
  const { t } = useTranslation()
  return (
    <Card className="flex items-start gap-3 border-destructive/30 bg-destructive/10 p-4">
      <CircleAlert className="mt-0.5 size-5 shrink-0 text-destructive" />
      <div className="flex-1 space-y-2">
        <p className="text-sm text-destructive">{message}</p>
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw />
          {t('common.retry')}
        </Button>
      </div>
    </Card>
  )
}
