import { useEffect } from 'react'
import {
  CircleAlert,
  CircleCheck,
  ClipboardCheck,
  TriangleAlert,
} from 'lucide-react'

import { PageHeader } from '@/components/portal-layout'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import {
  ACADEMIC_CONTEXT,
  ATTENDANCE,
  ATTENDANCE_THRESHOLD,
  attendancePercent,
  attendanceStanding,
  attendanceTotals,
  type AttendanceStanding,
  type SubjectAttendance,
} from '@/lib/academics-mock'

type BadgeVariant = 'success' | 'warning' | 'destructive'

const STANDING: Record<
  AttendanceStanding,
  { badge: BadgeVariant; bar: string; text: string; label: string }
> = {
  good: {
    badge: 'success',
    bar: 'bg-success',
    text: 'text-success',
    label: 'On track',
  },
  warning: {
    badge: 'warning',
    bar: 'bg-warning',
    text: 'text-warning',
    label: 'Low',
  },
  low: {
    badge: 'destructive',
    bar: 'bg-destructive',
    text: 'text-destructive',
    label: 'Shortage',
  },
}

/** A short, actionable hint about each subject's attendance margin. */
function marginHint(held: number, attended: number): string {
  const pct = held === 0 ? 0 : (attended / held) * 100
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
  useEffect(() => {
    document.title = 'Attendance — Nucleus'
  }, [])

  const totals = attendanceTotals()
  const standing = attendanceStanding(totals.percent)

  return (
    <>
      <PageHeader
        title="Attendance"
        subtitle={`${ACADEMIC_CONTEXT.programme} · Semester ${ACADEMIC_CONTEXT.currentSemester}`}
        icon={ClipboardCheck}
        accent="emerald"
      />

      <OverallCard
        percent={totals.percent}
        held={totals.held}
        attended={totals.attended}
        standing={standing}
      />

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground">
            Subject-wise attendance
          </h2>
          <p className="text-xs text-muted-foreground">
            {ATTENDANCE.length} subjects · {ATTENDANCE_THRESHOLD}% required for
            exam eligibility
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {ATTENDANCE.map((subject) => (
            <SubjectCard key={subject.code} subject={subject} />
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
  standing: AttendanceStanding
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
              {percent}
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
              {standing === 'low'
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

function SubjectCard({ subject }: { subject: SubjectAttendance }) {
  const percent = attendancePercent(subject)
  const standing = attendanceStanding(percent)
  const meta = STANDING[standing]

  return (
    <Card className="space-y-3 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold">{subject.subject}</h3>
          <p className="text-xs text-muted-foreground">
            {subject.code} · {subject.faculty}
          </p>
        </div>
        <span className={cn('text-xl font-bold tabular-nums', meta.text)}>
          {percent}%
        </span>
      </div>

      <Progress value={percent} indicatorClassName={meta.bar} />

      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="text-muted-foreground">
          {subject.attended} / {subject.held} classes
        </span>
        <span className={cn('font-medium', meta.text)}>
          {marginHint(subject.held, subject.attended)}
        </span>
      </div>
    </Card>
  )
}
