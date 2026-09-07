import { useMemo, useState } from 'react'

import { SectionCard } from '@/components/drive-management/drive-analytics'
import { Combobox } from '@/components/ui/combobox'
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  fetchAnalyticsSessions,
  fetchAnalyticsTeachers,
  type AnalyticsRange,
  type SessionLogRow,
  type SessionState,
  type TeacherRow,
} from '@/lib/attendance-analytics'
import { downloadCsv } from '@/lib/csv'
import { cn } from '@/lib/utils'
import {
  RESULT_SCROLL,
  WEEKDAYS,
  clockTime,
  cmpNum,
  cmpText,
  fmtPct,
  longDay,
  nextSort,
  nf,
  type SortDir,
  type SortState,
} from './format'
import {
  BasisChip,
  EmptyNote,
  ExportButton,
  ResultCard,
  SortHead,
  SortMenu,
  StripStat,
  TabToolbar,
  TableSkeleton,
  type SortOption,
} from './ui'
import { rangeKey, useAnalyticsQuery } from './use-analytics-query'

const STATE_LABEL: Record<SessionState, string> = {
  marked: 'Marked',
  overdue_unmarked: 'Not marked',
  upcoming: 'Upcoming',
  cancelled: 'Cancelled',
}

const STATE_CLASS: Record<SessionState, string> = {
  marked: 'bg-icon-emerald/15 text-icon-emerald',
  overdue_unmarked: 'bg-icon-amber/15 text-icon-amber',
  upcoming: 'bg-muted text-muted-foreground',
  cancelled: 'bg-icon-rose/15 text-icon-rose',
}

const STATE_OPTIONS: Array<{ value: number; label: string; key: string }> = [
  { value: 0, label: 'All classes', key: 'all' },
  { value: 1, label: 'Marked', key: 'marked' },
  { value: 2, label: 'Not marked', key: 'overdue_unmarked' },
  { value: 3, label: 'Upcoming', key: 'upcoming' },
  { value: 4, label: 'Cancelled', key: 'cancelled' },
]

/** Sorting State is a ranking, not an alphabet: "not marked" is the reason this
 *  tab exists, so ascending puts it first. */
const STATE_RANK: Record<SessionState, number> = {
  overdue_unmarked: 0,
  marked: 1,
  upcoming: 2,
  cancelled: 3,
}

type LogSort = 'date' | 'period' | 'subject' | 'teacher' | 'state' | 'present'

const LOG_SORTS: ReadonlyArray<SortOption<LogSort>> = [
  { value: 'date', label: 'Date' },
  { value: 'period', label: 'Period' },
  { value: 'subject', label: 'Subject' },
  { value: 'teacher', label: 'Teacher' },
  { value: 'state', label: 'State' },
  { value: 'present', label: 'Present' },
]

// Every log field reads best ascending first: chronological, A→Z, unmarked
// classes first, lowest attendance first — so `nextSort`'s default is right.

type TeacherSort =
  | 'teacher'
  | 'sessions'
  | 'marked'
  | 'unmarked'
  | 'compliance'

const teacherDir = (by: TeacherSort): SortDir =>
  by === 'teacher' ? 'asc' : 'desc'

/**
 * Every class in the period whatever happened to it — including the ones nobody
 * marked, which is the whole reason this tab exists. Paired with per-teacher
 * compliance, because "who hasn't marked" is the question that follows.
 */
export function SessionsTab({ range }: { range: AnalyticsRange }) {
  const [state, setState] = useState(0)
  const [subjectId, setSubjectId] = useState<number | null>(null)
  const [sort, setSort] = useState<SortState<LogSort>>({
    by: 'date',
    dir: 'asc',
  })
  // The card asks "who has not marked", so it opens on that answer.
  const [teacherSort, setTeacherSort] = useState<SortState<TeacherSort>>({
    by: 'unmarked',
    dir: 'desc',
  })

  const stateKey = STATE_OPTIONS[state]?.key ?? 'all'

  const { data, loading, error } = useAnalyticsQuery<{
    rows: SessionLogRow[]
    teachers: TeacherRow[]
  }>(
    rangeKey(range, stateKey, subjectId),
    () =>
      Promise.all([
        fetchAnalyticsSessions(range, {
          state: stateKey,
          subject_id: subjectId ?? undefined,
        }),
        fetchAnalyticsTeachers(range),
      ]).then(([s, teachers]) => ({ rows: s.rows, teachers })),
    'Could not load the class log.',
  )

  // The subject filter is built from the current result set, so clearing a
  // narrow filter is what restores the full list.
  const subjects = useMemo(() => {
    const seen = new Map<number, string>()
    for (const r of data?.rows ?? []) seen.set(r.subject_id, r.subject_code)
    return [...seen.entries()].map(([value, label]) => ({ value, label }))
  }, [data])

  const toggleSort = (by: LogSort) => setSort((s) => nextSort(s, by))
  const toggleTeacherSort = (by: TeacherSort) =>
    setTeacherSort((s) => nextSort(s, by, teacherDir(by)))

  const rows = useMemo(() => {
    const { by, dir } = sort
    // A class nobody marked has no attendance to compare — `null` keeps those
    // rows at the bottom whichever way Present is sorted.
    const present = (r: SessionLogRow) =>
      r.state === 'marked' && r.marked > 0 ? r.pct : null
    return [...(data?.rows ?? [])].sort((a, b) => {
      let c = 0
      if (by === 'date') c = cmpText(a.session_date, b.session_date, dir)
      // `period_position` and not `period_label`, which is text: "P10" would
      // sort before "P2".
      else if (by === 'period')
        c = cmpNum(a.period_position, b.period_position, dir)
      else if (by === 'subject') c = cmpText(a.subject_code, b.subject_code, dir)
      else if (by === 'teacher')
        c = cmpText(a.effective_teacher, b.effective_teacher, dir)
      else if (by === 'state')
        c = cmpNum(STATE_RANK[a.state], STATE_RANK[b.state], dir)
      else if (by === 'present') c = cmpNum(present(a), present(b), dir)
      if (c !== 0) return c
      return (
        a.session_date.localeCompare(b.session_date) ||
        a.start_time.localeCompare(b.start_time)
      )
    })
  }, [data, sort])

  const teachers = useMemo(() => {
    const { by, dir } = teacherSort
    return [...(data?.teachers ?? [])].sort((a, b) => {
      let c = 0
      if (by === 'teacher')
        c = cmpText(a.emp_display_name, b.emp_display_name, dir)
      else if (by === 'sessions') c = cmpNum(a.sessions, b.sessions, dir)
      else if (by === 'marked') c = cmpNum(a.marked, b.marked, dir)
      else if (by === 'unmarked')
        c = cmpNum(a.overdue_unmarked, b.overdue_unmarked, dir)
      else if (by === 'compliance')
        c = cmpNum(a.compliance_pct, b.compliance_pct, dir)
      return c !== 0
        ? c
        : (a.emp_display_name ?? '').localeCompare(b.emp_display_name ?? '')
    })
  }, [data, teacherSort])

  const exportCsv = () => {
    downloadCsv(
      'attendance-classes',
      [
        'Date',
        'Day',
        'Period',
        'Time',
        'Subject code',
        'Subject',
        'Scheduled teacher',
        'Teacher who took it',
        'State',
        'Present',
        'Marked',
        'Attendance %',
        'Notes',
      ],
      rows.map((r) => [
        r.session_date,
        WEEKDAYS[r.day_of_week] ?? '',
        r.period_label,
        clockTime(r.start_time),
        r.subject_code,
        r.subject_name,
        r.scheduled_teacher ?? '',
        r.effective_teacher ?? '',
        STATE_LABEL[r.state],
        r.state === 'marked' ? r.attended : '',
        r.state === 'marked' ? r.marked : '',
        r.state === 'marked' && r.marked > 0 ? r.pct : '',
        [
          r.is_substitute && 'substitute',
          r.is_adhoc && 'extra class',
          r.is_elective && 'elective',
          r.cancel_reason,
        ]
          .filter(Boolean)
          .join('; '),
      ]),
    )
  }

  const laggards = teachers.filter((t) => t.overdue_unmarked > 0)

  return (
    <div className="space-y-4 pb-4">
      {laggards.length > 0 && (
        <SectionCard
          title="Attendance still to be marked"
          subtitle="Past classes each teacher has not marked yet"
        >
          <Table>
            <TableHeader>
              <TableRow>
                <SortHead
                  field="teacher"
                  label="Teacher"
                  sort={teacherSort}
                  onSort={toggleTeacherSort}
                />
                <SortHead
                  field="sessions"
                  label="Classes"
                  sort={teacherSort}
                  onSort={toggleTeacherSort}
                  align="right"
                />
                <SortHead
                  field="marked"
                  label="Marked"
                  sort={teacherSort}
                  onSort={toggleTeacherSort}
                  align="right"
                />
                <SortHead
                  field="unmarked"
                  label="Not marked"
                  sort={teacherSort}
                  onSort={toggleTeacherSort}
                  align="right"
                />
                <SortHead
                  field="compliance"
                  label="Done"
                  sort={teacherSort}
                  onSort={toggleTeacherSort}
                  align="right"
                />
              </TableRow>
            </TableHeader>
            <TableBody>
              {laggards.map((t) => (
                <TableRow key={t.employee_id}>
                  <TableCell>
                    {t.emp_display_name ?? '—'}
                    {t.emp_code && (
                      <span className="ml-1 font-mono text-xs text-muted-foreground">
                        {t.emp_code}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {nf(t.sessions)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {nf(t.marked)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-icon-amber">
                    {nf(t.overdue_unmarked)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {fmtPct(t.compliance_pct)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </SectionCard>
      )}

      <TabToolbar
        end={<ExportButton onClick={exportCsv} disabled={rows.length === 0} />}
      >
        <Combobox
          className="w-40"
          value={state}
          options={STATE_OPTIONS.map((o) => ({
            value: o.value,
            label: o.label,
          }))}
          onChange={(v) => setState(v ?? 0)}
          placeholder="All classes"
          aria-label="Filter by state"
        />
        {/* Options are derived from the current result set, so the picker has
            nothing to offer until the first payload lands. */}
        <Combobox
          className="w-44"
          value={subjectId}
          options={subjects}
          onChange={setSubjectId}
          disabled={loading && subjects.length === 0}
          placeholder="All subjects"
          searchPlaceholder="Search subjects…"
          clearLabel="All subjects"
        />
        <SortMenu
          value={sort.by}
          dir={sort.dir}
          options={LOG_SORTS}
          onChange={toggleSort}
        />
        {/* This endpoint doesn't echo the basis, but it is the same rule the
            server applies: a date range means a live session scan. */}
        <BasisChip basis={range.from && range.to ? 'sessions' : 'rollup'} />
      </TabToolbar>

      {loading ? (
        <TableSkeleton cols={6} />
      ) : error ? (
        <EmptyNote>{error}</EmptyNote>
      ) : !data ? null : rows.length === 0 ? (
        <EmptyNote>No classes match these filters.</EmptyNote>
      ) : (
        <ResultCard
          scroll={false}
          summary={
            <StripStat
              value={`${nf(rows.length)} ${rows.length === 1 ? 'class' : 'classes'}`}
            />
          }
        >
        <Table containerClassName={RESULT_SCROLL}>
          <TableHeader className="sticky top-0 z-10 bg-background">
            <TableRow>
              <SortHead
                field="date"
                label="Date"
                sort={sort}
                onSort={toggleSort}
              />
              <SortHead
                field="period"
                label="Period"
                sort={sort}
                onSort={toggleSort}
              />
              <SortHead
                field="subject"
                label="Subject"
                sort={sort}
                onSort={toggleSort}
              />
              <SortHead
                field="teacher"
                label="Teacher"
                sort={sort}
                onSort={toggleSort}
              />
              <SortHead
                field="state"
                label="State"
                sort={sort}
                onSort={toggleSort}
              />
              <SortHead
                field="present"
                label="Present"
                sort={sort}
                onSort={toggleSort}
                align="right"
              />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.session_id}>
                <TableCell className="whitespace-nowrap text-xs">
                  {longDay(r.session_date)}
                  <span className="ml-1 text-muted-foreground">
                    {WEEKDAYS[r.day_of_week]}
                  </span>
                </TableCell>
                <TableCell className="whitespace-nowrap text-xs">
                  {r.period_label}
                  <span className="ml-1 text-muted-foreground">
                    {clockTime(r.start_time)}
                  </span>
                  {r.span > 1 && (
                    <span className="ml-1 text-muted-foreground">
                      ×{r.span}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-xs">
                  <span className="block">{r.subject_name}</span>
                  <span className="font-mono text-muted-foreground">
                    {r.subject_code}
                  </span>
                  <span className="ml-1 text-muted-foreground">
                    {r.is_elective && '· elective'}
                    {r.is_adhoc && ' · extra class'}
                  </span>
                </TableCell>
                <TableCell className="text-xs">
                  {r.effective_teacher ?? '—'}
                  {r.is_substitute && (
                    <span className="block text-muted-foreground">
                      for {r.scheduled_teacher}
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <span
                    className={cn(
                      'inline-flex whitespace-nowrap rounded px-1.5 py-0.5 text-xs font-medium',
                      STATE_CLASS[r.state],
                    )}
                  >
                    {STATE_LABEL[r.state]}
                  </span>
                  {r.cancel_reason && (
                    <span
                      className="ml-1 text-xs text-muted-foreground"
                      title={r.cancel_reason}
                    >
                      {r.cancel_reason}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right text-xs tabular-nums">
                  {r.state === 'marked' ? (
                    <>
                      {nf(r.attended)}/{nf(r.marked)}
                      <span className="ml-1 text-muted-foreground">
                        {fmtPct(r.pct)}
                      </span>
                    </>
                  ) : (
                    '—'
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </ResultCard>
      )}
    </div>
  )
}
