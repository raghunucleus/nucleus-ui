import { Download } from 'lucide-react'
import { useMemo } from 'react'

import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  fetchAnalyticsStudent,
  type AnalyticsRange,
  type StudentDetailResult,
  type StudentRow,
} from '@/lib/attendance-analytics'
import { downloadCsv } from '@/lib/csv'
import { cn } from '@/lib/utils'
import {
  STATUS_CLASS,
  clockTime,
  fmtPct,
  longDay,
  nf,
  projectionAt,
  shortDay,
} from './format'
import {
  DetailSkeleton,
  EmptyNote,
  PctBadge,
} from './ui'
import { rangeKey, useAnalyticsQuery } from './use-analytics-query'

/**
 * One student's full record: their per-subject figures and every class they
 * were marked on, newest first — the day-level detail an incharge needs when a
 * parent calls.
 */
export function StudentDetailSheet({
  range,
  student,
  threshold,
  sessionsRemaining,
  onClose,
}: {
  range: AnalyticsRange
  student: StudentRow | null
  /** The cutoff the opening list was drawn at, so the sheet agrees with it. */
  threshold: number
  /** `StudentDetailResult` carries no `sessions_remaining`; it comes from the
   *  roster payload the caller already holds. */
  sessionsRemaining: number
  onClose: () => void
}) {
  const studentId = student?.student_id ?? null

  // Keyed on the student so reopening a different row refetches, and the
  // closed sheet holds no request at all.
  const { data, loading, error } = useAnalyticsQuery<StudentDetailResult | null>(
    rangeKey(range, studentId),
    () =>
      studentId === null
        ? Promise.resolve(null)
        : fetchAnalyticsStudent(range, studentId),
    'Could not load this student.',
  )

  /** Classes grouped by date so the list reads as a diary rather than a dump. */
  const byDate = useMemo(() => {
    const map = new Map<string, StudentDetailResult['sessions']>()
    for (const s of data?.sessions ?? []) {
      const list = map.get(s.session_date) ?? []
      list.push(s)
      map.set(s.session_date, list)
    }
    return [...map.entries()]
  }, [data])

  const exportCsv = () => {
    if (!data) return
    downloadCsv(
      `attendance-${data.student.roll_no}`,
      ['Date', 'Period', 'Time', 'Subject', 'Teacher', 'Status'],
      data.sessions.map((s) => [
        s.session_date,
        s.period_label,
        clockTime(s.start_time),
        `${s.subject_code} — ${s.subject_name}`,
        s.teacher_display_name ?? '',
        s.status,
      ]),
    )
  }

  return (
    <Sheet open={student !== null} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>{student?.display_name ?? ''}</SheetTitle>
          <SheetDescription>
            {student?.roll_no}
            {student && student.held > 0
              ? ` · ${nf(student.attended)} of ${nf(student.held)} classes attended`
              : ''}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-4 pb-6">
          {loading && studentId !== null && <DetailSkeleton />}
          {error && <EmptyNote>{error}</EmptyNote>}

          {data && (
            <>
              {(() => {
                const proj = projectionAt(
                  data.student.attended,
                  data.student.held,
                  sessionsRemaining,
                  threshold,
                )
                return (
              <div className="grid grid-cols-3 gap-3">
                <Stat
                  label="Overall"
                  value={
                    data.student.held > 0 ? fmtPct(data.student.pct) : '—'
                  }
                />
                <Stat
                  label={`To reach ${threshold}%`}
                  value={
                    data.student.held === 0
                      ? '—'
                      : proj.sessions_needed === null
                        ? `Max ${fmtPct(proj.max_achievable_pct)}`
                        : proj.sessions_needed === 0
                          ? 'Clear'
                          : `${nf(proj.sessions_needed)} classes`
                  }
                  tone={proj.sessions_needed === null ? 'bad' : undefined}
                />
                <Stat
                  label="Absent streak"
                  value={
                    data.student.current_absent_streak > 0
                      ? `${nf(data.student.current_absent_streak)} days`
                      : 'None'
                  }
                  tone={
                    data.student.current_absent_streak >= 3 ? 'bad' : undefined
                  }
                />
              </div>
                )
              })()}

              {data.student.joined_group_estimate && (
                <p className="text-xs text-muted-foreground">
                  First class with this group:{' '}
                  {longDay(data.student.joined_group_estimate)}
                </p>
              )}

              <section className="space-y-2">
                <h3 className="text-sm font-semibold">Subject-wise</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Subject</TableHead>
                      <TableHead className="text-right">Attended</TableHead>
                      <TableHead className="text-right">Held</TableHead>
                      <TableHead className="text-right">Attendance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.student.per_subject.map((s) => (
                      <TableRow key={s.subject_id}>
                        <TableCell>
                          <span className="block text-sm">{s.subject_name}</span>
                          <span className="font-mono text-xs text-muted-foreground">
                            {s.subject_code}
                          </span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {nf(s.attended)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {nf(s.held)}
                        </TableCell>
                        <TableCell className="text-right">
                          <PctBadge pct={s.pct} band={s.band} held={s.held} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </section>

              <section className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">
                    Every class, day by day
                  </h3>
                  <Button size="sm" variant="outline" onClick={exportCsv}>
                    <Download className="size-4" />
                    CSV
                  </Button>
                </div>
                {byDate.length === 0 ? (
                  <EmptyNote>No classes marked in this period.</EmptyNote>
                ) : (
                  <div className="space-y-3">
                    {byDate.map(([date, list]) => {
                      const present = list.filter(
                        (s) => s.status === 'present' || s.status === 'late',
                      ).length
                      return (
                        <div key={date} className="rounded-lg border">
                          <div className="flex items-center justify-between border-b px-3 py-1.5">
                            <span className="text-xs font-medium">
                              {shortDay(date)}
                            </span>
                            <span className="text-xs text-muted-foreground tabular-nums">
                              {present}/{list.length} present
                            </span>
                          </div>
                          <ul className="divide-y">
                            {list.map((s) => (
                              <li
                                key={s.session_id}
                                className="flex items-center gap-2 px-3 py-1.5 text-xs"
                              >
                                <span className="w-14 shrink-0 text-muted-foreground">
                                  {clockTime(s.start_time)}
                                </span>
                                <span className="min-w-0 flex-1 truncate">
                                  {s.subject_name}
                                  {s.is_elective && (
                                    <span className="ml-1 text-muted-foreground">
                                      (elective)
                                    </span>
                                  )}
                                </span>
                                <span className="hidden shrink-0 text-muted-foreground sm:inline">
                                  {s.teacher_display_name}
                                  {s.is_substitute ? ' (sub)' : ''}
                                </span>
                                <span
                                  className={cn(
                                    'shrink-0 rounded px-1.5 py-0.5 font-medium capitalize',
                                    STATUS_CLASS[s.status] ??
                                      'bg-muted text-muted-foreground',
                                  )}
                                >
                                  {s.status}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )
                    })}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'bad'
}) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          'mt-1 text-lg font-semibold tabular-nums',
          tone === 'bad' && 'text-icon-rose',
        )}
      >
        {value}
      </p>
    </div>
  )
}
