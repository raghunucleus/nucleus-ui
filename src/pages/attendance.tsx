import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import {
  ChevronRight,
  CircleAlert,
  CircleCheck,
  ClipboardCheck,
  RefreshCw,
  TriangleAlert,
} from 'lucide-react'

import { PageHeader } from '@/components/portal-layout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { ApiError } from '@/lib/api'
import {
  fetchStudentAttendanceDashboard,
  type DashboardResult,
  type SubjectAttendanceRow,
} from '@/lib/student-academics'
import { studentMe, type StudentProfile } from '@/lib/student-auth'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'

const ATTENDANCE_THRESHOLD = 75

type BadgeVariant = 'success' | 'warning' | 'destructive'
type Standing = 'good' | 'warning' | 'low'

const STANDING: Record<
  Standing,
  { badge: BadgeVariant; bar: string; text: string; label: string }
> = {
  good: { badge: 'success', bar: 'bg-success', text: 'text-success', label: 'On track' },
  warning: { badge: 'warning', bar: 'bg-warning', text: 'text-warning', label: 'Low' },
  low: { badge: 'destructive', bar: 'bg-destructive', text: 'text-destructive', label: 'Shortage' },
}

function standingFor(pct: number): Standing {
  if (pct >= 85) return 'good'
  if (pct >= ATTENDANCE_THRESHOLD) return 'warning'
  return 'low'
}

function marginHint(held: number, attended: number): string {
  if (held === 0) return 'No classes held yet'
  const pct = (attended / held) * 100
  const ratio = ATTENDANCE_THRESHOLD / 100
  if (pct >= ATTENDANCE_THRESHOLD) {
    const canSkip = Math.floor(attended / ratio - held)
    return canSkip > 0
      ? `Can miss ${canSkip} more class${canSkip === 1 ? '' : 'es'}`
      : 'No buffer left — stay regular'
  }
  const need = Math.ceil((ratio * held - attended) / (1 - ratio))
  return `Attend ${need} in a row to reach ${ATTENDANCE_THRESHOLD}%`
}

export default function Attendance() {
  const signOut = useAuthStore((state) => state.signOut)
  const [profile, setProfile] = useState<StudentProfile | null>(null)
  const [dashboard, setDashboard] = useState<DashboardResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Track whether we've already fetched the profile so `load`'s identity
  // stays stable across renders — without this, setProfile → profile
  // changes → useCallback recreates load → useEffect re-fires → setProfile
  // again, looping the dashboard API forever.
  const profileLoadedRef = useRef(false)

  useEffect(() => {
    document.title = 'Attendance — Nucleus'
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const needsProfile = !profileLoadedRef.current
    try {
      const [data, profileData] = await Promise.all([
        fetchStudentAttendanceDashboard(),
        needsProfile ? studentMe() : Promise.resolve(null),
      ])
      setDashboard(data)
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
        err instanceof Error ? err.message : 'Could not load attendance.',
      )
    } finally {
      setLoading(false)
    }
  }, [signOut])

  useEffect(() => {
    void load()
  }, [load])

  const subtitle = subtitleFor(profile, dashboard)

  return (
    <>
      <PageHeader
        title="Attendance"
        subtitle={subtitle}
        icon={ClipboardCheck}
        accent="emerald"
      />

      {error ? <ErrorBanner message={error} onRetry={load} /> : null}

      {loading && !dashboard ? (
        <LoadingState />
      ) : dashboard && dashboard.per_subject.length === 0 ? (
        <EmptyState />
      ) : dashboard ? (
        <ContentLoaded data={dashboard} />
      ) : null}
    </>
  )
}

function subtitleFor(
  profile: StudentProfile | null,
  dashboard: DashboardResult | null,
): string | undefined {
  if (!profile) return undefined
  const parts: string[] = []
  if (profile.programme) parts.push(profile.programme.name)
  if (dashboard?.semester_number) {
    parts.push(`Semester ${dashboard.semester_number}`)
  }
  return parts.length > 0 ? parts.join(' · ') : undefined
}

function ContentLoaded({ data }: { data: DashboardResult }) {
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
            Subject-wise attendance
          </h2>
          <p className="text-xs text-muted-foreground">
            {data.per_subject.length} subjects · {ATTENDANCE_THRESHOLD}% required
            for exam eligibility
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
  const meta = STANDING[standing]
  const Icon =
    standing === 'good'
      ? CircleCheck
      : standing === 'warning'
        ? TriangleAlert
        : CircleAlert

  return (
    <Card className="p-5 sm:p-6">
      <div className="grid gap-6 sm:grid-cols-[auto_1fr] sm:items-center">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Overall attendance
          </p>
          <div className="flex items-end gap-1">
            <span className="text-5xl font-bold tracking-tight tabular-nums">
              {percent.toFixed(1)}
            </span>
            <span className="pb-1.5 text-xl font-semibold text-muted-foreground">
              %
            </span>
          </div>
          <Badge variant={meta.badge}>{meta.label}</Badge>
        </div>

        <div className="space-y-2.5">
          <Progress value={percent} indicatorClassName={meta.bar} />
          <div className="flex items-start gap-2 text-sm text-muted-foreground">
            <Icon className={cn('mt-0.5 size-4 shrink-0', meta.text)} />
            <p>
              {attended} of {held} classes attended
              {held === 0
                ? '.'
                : standing === 'low'
                  ? ' — currently below the minimum requirement.'
                  : standing === 'warning'
                    ? ' — keep it above 85% for a comfortable margin.'
                    : ' — comfortably above the requirement.'}
            </p>
          </div>
        </div>
      </div>
    </Card>
  )
}

function SubjectCard({ subject }: { subject: SubjectAttendanceRow }) {
  const standing = standingFor(subject.pct)
  const meta = STANDING[standing]

  return (
    <Card className="overflow-hidden">
      <Link
        to="/attendance/$subjectId"
        params={{ subjectId: String(subject.subject_id) }}
        aria-label={`Open class history for ${subject.subject_name}`}
        className="block w-full space-y-3 p-5 text-left transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold">{subject.subject_name}</h3>
            <p className="text-xs text-muted-foreground">
              {subject.subject_code}
            </p>
          </div>
          <span className={cn('text-xl font-bold tabular-nums', meta.text)}>
            {subject.pct.toFixed(1)}%
          </span>
        </div>

        <Progress value={subject.pct} indicatorClassName={meta.bar} />

        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="text-muted-foreground">
            {subject.attended} / {subject.held} classes
          </span>
          <span className={cn('font-medium', meta.text)}>
            {marginHint(subject.held, subject.attended)}
          </span>
        </div>

        <div className="flex items-center justify-between border-t pt-3 text-[11px] font-medium text-muted-foreground">
          <span>View class history</span>
          <ChevronRight className="size-3.5" />
        </div>
      </Link>
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
  return (
    <Card className="px-5 py-10 text-center text-sm text-muted-foreground">
      No subjects with attendance data yet. Check back once classes start.
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
