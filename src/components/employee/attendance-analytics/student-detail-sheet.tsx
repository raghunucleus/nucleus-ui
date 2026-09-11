import { CalendarDays, Download, List } from 'lucide-react'
import { useMemo, useState } from 'react'

import {
  AttendanceCalendar,
  type CalendarItem,
} from '@/components/attendance/attendance-calendar'
import { FilterChips } from '@/components/placement-filter-chips'
import { Button } from '@/components/ui/button'
import { Segmented } from '@/components/ui/segmented'
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
  type StudentSession,
} from '@/lib/attendance-analytics'
import { STATUS_LABEL, markToStatusKind } from '@/lib/attendance-status'
import { downloadCsv } from '@/lib/csv'
import { ATTENDANCE_CALENDAR_STRINGS_EN } from '@/lib/subject-sessions-strings'
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

type View = 'calendar' | 'list'
type SubjectFilter = 'all' | `${number}`

type SessionItem = CalendarItem & { session: StudentSession }

const CALENDAR_STRINGS = {
  ...ATTENDANCE_CALENDAR_STRINGS_EN,
  dayTitle: longDay,
}

const CHIP_TONE = 'border-primary bg-primary/10 text-primary'

/**
 * One student's full record: their per-subject figures and every class they
 * were marked on — the day-level detail an incharge needs when a parent
 * calls. The session section opens on the same month calendar the student
 * sees on their own portal, so the two never disagree about a day.
 */
export function StudentDetailSheet({
  range,
  student,
  threshold,
  sessionsRemaining,
  onClose,
  load,
  loadKey,
}: {
  /** The incharge endpoint's pin. Omit (with `load`) on other surfaces. */
  range?: AnalyticsRange
  /** Alternative loader — the Insights screen answers from its own endpoint. */
  load?: (studentId: number) => Promise<StudentDetailResult>
  /** Cache key for `load`; must change whenever `load` would answer differently. */
  loadKey?: string
  student: StudentRow | null
  /** The cutoff the opening list was drawn at, so the sheet agrees with it. */
  threshold: number
  /** `StudentDetailResult` carries no `sessions_remaining`; it comes from the
   *  roster payload the caller already holds. */
  sessionsRemaining: number
  onClose: () => void
}) {
  const studentId = student?.student_id ?? null
  const [view, setView] = useState<View>('calendar')
  const [subject, setSubject] = useState<SubjectFilter>('all')

  // Keyed on the student so reopening a different row refetches, and the
  // closed sheet holds no request at all.
  const { data, loading, error } = useAnalyticsQuery<StudentDetailResult | null>(
    range ? rangeKey(range, studentId) : `${loadKey ?? ''}|${studentId ?? ''}`,
    () => {
      if (studentId === null) return Promise.resolve(null)
      if (load) return load(studentId)
      if (range) return fetchAnalyticsStudent(range, studentId)
      return Promise.resolve(null)
    },
    'Could not load this student.',
  )

  const sessions = useMemo(() => data?.sessions ?? [], [data])

  const countBySubject = useMemo(() => {
    const m = new Map<number, number>()
    for (const s of sessions) m.set(s.subject_id, (m.get(s.subject_id) ?? 0) + 1)
    return m
  }, [sessions])

  const filtered = useMemo(
    () =>
      subject === 'all'
        ? sessions
        : sessions.filter((s) => String(s.subject_id) === subject),
    [sessions, subject],
  )

  const items = useMemo<SessionItem[]>(
    () =>
      filtered.map((s) => {
        const kind = markToStatusKind(s.status)
        return {
          id: s.session_id,
          date: s.session_date,
          kind,
          label: STATUS_LABEL[kind],
          sortKey: s.start_time,
          session: s,
        }
      }),
    [filtered],
  )

  /** Classes grouped by date so the list reads as a diary rather than a dump. */
  const byDate = useMemo(() => {
    const map = new Map<string, StudentSession[]>()
    for (const s of filtered) {
      const list = map.get(s.session_date) ?? []
      list.push(s)
      map.set(s.session_date, list)
    }
    return [...map.entries()]
  }, [filtered])

  const chipItems = useMemo(() => {
    if (!data) return []
    return [
      {
        value: 'all' as SubjectFilter,
        label: 'All',
        count: sessions.length,
        tone: CHIP_TONE,
      },
      ...data.student.per_subject.map((s) => ({
        value: `${s.subject_id}` as SubjectFilter,
        label: s.subject_code,
        count: countBySubject.get(s.subject_id) ?? 0,
        tone: CHIP_TONE,
      })),
    ]
  }, [data, sessions.length, countBySubject])

  const exportCsv = () => {
    if (!data) return
    downloadCsv(
      `attendance-${data.student.roll_no}`,
      ['Date', 'Period', 'Time', 'Subject', 'Teacher', 'Status'],
      filtered.map((s) => [
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

              <section className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold">
                    Every class, day by day
                  </h3>
                  <div className="ml-auto flex items-center gap-1.5">
                    <Segmented<View>
                      size="sm"
                      aria-label="View"
                      value={view}
                      onChange={setView}
                      options={[
                        {
                          value: 'calendar',
                          icon: CalendarDays,
                          label: null,
                          ariaLabel: 'Calendar',
                          title: 'Calendar',
                        },
                        {
                          value: 'list',
                          icon: List,
                          label: null,
                          ariaLabel: 'List',
                          title: 'List',
                        },
                      ]}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={exportCsv}
                      title={
                        subject === 'all'
                          ? 'Download every class as CSV'
                          : 'Download the selected subject as CSV'
                      }
                    >
                      <Download className="size-4" />
                      CSV
                    </Button>
                  </div>
                </div>

                {chipItems.length > 2 ? (
                  <FilterChips<SubjectFilter>
                    value={subject}
                    items={chipItems}
                    onChange={setSubject}
                  />
                ) : null}

                {view === 'calendar' ? (
                  <AttendanceCalendar<SessionItem>
                    items={items}
                    strings={CALENDAR_STRINGS}
                    layout="stacked"
                    bounds={
                      range?.from && range?.to
                        ? { from: range.from, to: range.to }
                        : undefined
                    }
                    renderDay={(_date, list) => (
                      <div className="rounded-lg border">
                        <StudentSessionRows
                          list={list.map((it) => it.session)}
                          hideSubject={subject !== 'all'}
                        />
                      </div>
                    )}
                  />
                ) : byDate.length === 0 ? (
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
                          <StudentSessionRows
                            list={list}
                            hideSubject={subject !== 'all'}
                          />
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

/** The rows for one day — shared by the diary list and the calendar's day panel. */
function StudentSessionRows({
  list,
  hideSubject,
}: {
  list: readonly StudentSession[]
  hideSubject: boolean
}) {
  return (
    <ul className="divide-y">
      {list.map((s) => {
        const kind = markToStatusKind(s.status)
        return (
          <li
            key={s.session_id}
            className="flex items-center gap-2 px-3 py-1.5 text-xs"
          >
            <span className="w-14 shrink-0 text-muted-foreground">
              {clockTime(s.start_time)}
            </span>
            <span className="min-w-0 flex-1 truncate">
              {hideSubject ? s.period_label : s.subject_name}
              {s.is_elective && !hideSubject && (
                <span className="ml-1 text-muted-foreground">(elective)</span>
              )}
            </span>
            <span className="hidden shrink-0 text-muted-foreground sm:inline">
              {s.teacher_display_name}
              {s.is_substitute ? ' (sub)' : ''}
            </span>
            <span
              className={cn(
                'shrink-0 rounded px-1.5 py-0.5 font-medium',
                STATUS_CLASS[kind] ?? 'bg-muted text-muted-foreground',
              )}
            >
              {STATUS_LABEL[kind]}
            </span>
          </li>
        )
      })}
    </ul>
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
