import {
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  Grid3x3,
} from 'lucide-react'
import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { DatePicker } from '@/components/ui/date-picker'
import { Segmented } from '@/components/ui/segmented'
import {
  fetchAnalyticsDaily,
  fetchAnalyticsDay,
  fetchAnalyticsStudents,
  type AnalyticsRange,
  type DailyResult,
  type DailyRow,
  type DayDetailResult,
  type StudentRow,
} from '@/lib/attendance-analytics'
import { downloadCsv } from '@/lib/csv'
import { toIsoDate } from '@/lib/teacher-attendance'
import { cn } from '@/lib/utils'
import {
  BAND_COLOR,
  STATUS_CLASS,
  bandOf,
  WEEKDAYS,
  clockTime,
  cmpNum,
  cmpText,
  fmtPct,
  longDay,
  nextSort,
  nf,
  pctOf,
  shortDay,
  type SortState,
} from './format'
import {
  BasisChip,
  EmptyNote,
  ExportButton,
  GridSkeleton,
  PctBadge,
  ResultCard,
  SearchField,
  SortLabel,
  SortMenu,
  StripStat,
  SummaryStrip,
  TabToolbar,
  type SortOption,
} from './ui'
import { rangeKey, useAnalyticsQuery } from './use-analytics-query'

type DaySort = 'roll' | 'name' | 'pct'

const DAY_SORTS: ReadonlyArray<SortOption<DaySort>> = [
  { value: 'roll', label: 'Roll no' },
  { value: 'name', label: 'Name' },
  { value: 'pct', label: 'Attendance' },
]

/** A student's day, pivoted out of the session-major `/daily/:date` payload. */
interface DayStudentRow {
  student_id: number
  roll_no: string
  display_name: string
  /** session_id → status. A session missing here was never marked for them. */
  status: Map<number, string>
  present: number
  held: number
  pct: number
}

/**
 * Day-level attendance.
 *
 * Opens on ONE day, because that is the question an incharge actually asks —
 * "who missed what today" — and the answer is student-wise. The whole-range
 * views (the day strip and the date × student grid) are still here behind the
 * All days toggle; they answer the trend question instead.
 *
 * Both payloads are fetched here rather than one level down, so that a single
 * toolbar can own every control on the tab — the view switch, the day stepper,
 * search, sort and export used to be three separate rows across two
 * components, and the lower two vanished on every refetch.
 */
export function DailyTab({ range }: { range: AnalyticsRange }) {
  const [view, setView] = useState<'day' | 'all'>('day')
  const [matrix, setMatrix] = useState(false)
  const [date, setDate] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<SortState<DaySort>>({
    by: 'roll',
    dir: 'asc',
  })
  const toggleSort = (by: DaySort) => setSort((s) => nextSort(s, by))

  // The grid is the one payload that grows as students × days, so it is never
  // requested from the single-day view even if it was left toggled on.
  const wantMatrix = view === 'all' && matrix

  const { data, loading, error } = useAnalyticsQuery<{
    daily: DailyResult
    students: StudentRow[]
  }>(
    rangeKey(range, wantMatrix),
    () =>
      Promise.all([
        fetchAnalyticsDaily(range, wantMatrix),
        wantMatrix
          ? fetchAnalyticsStudents(range)
          : Promise.resolve({ rows: [] as StudentRow[] }),
      ]).then(([daily, s]) => ({ daily, students: s.rows })),
    'Could not load the day-wise view.',
  )

  /** (student, date) → cell. A missing key means no marked class that day —
   *  rendered as a blank, never as an absence. */
  const cellByKey = useMemo(() => {
    const m = new Map<string, { attended: number; held: number; pct: number }>()
    for (const c of data?.daily.matrix?.cells ?? []) {
      m.set(`${c.student_id}:${c.session_date}`, c)
    }
    return m
  }, [data])

  // Memoised for identity, not cost: a fresh `[]` each render would re-run the
  // day-pivot below on every keystroke in the search box.
  const days = useMemo(() => data?.daily.days ?? [], [data])

  // Derived rather than stored, so a group or semester change — which swaps the
  // whole day list — can never leave a stale date selected.
  const selected = useMemo(() => {
    if (days.length === 0) return null
    if (date && days.some((d) => d.session_date === date)) return date
    return latestTaughtDay(days)
  }, [days, date])

  const index = selected
    ? days.findIndex((d) => d.session_date === selected)
    : -1
  const summary = index >= 0 ? days[index] : null

  // The single day's roster. Held here (not in the body) so the toolbar's
  // export and the summary strip can both see it.
  const day = useAnalyticsQuery<DayDetailResult | null>(
    rangeKey(range, 'day', view === 'day' ? (selected ?? '') : ''),
    () =>
      view === 'day' && selected
        ? fetchAnalyticsDay(range, selected)
        : Promise.resolve(null),
    'Could not load that day.',
  )

  const sessions = useMemo(() => day.data?.sessions ?? [], [day.data])

  /**
   * Pivot session-major → student-major.
   *
   * The roster is the union of the students the sessions report, which is the
   * marked roster: an unmarked session carries no rows at all. `held` therefore
   * counts only the sessions a student was actually marked in — the session
   * count would be wrong, because a cross-group elective is on the day for some
   * students and not others.
   */
  const dayRows = useMemo<DayStudentRow[]>(() => {
    const map = new Map<number, DayStudentRow>()
    for (const s of sessions) {
      for (const st of s.students) {
        let row = map.get(st.student_id)
        if (!row) {
          row = {
            student_id: st.student_id,
            roll_no: st.roll_no,
            display_name: st.display_name,
            status: new Map(),
            present: 0,
            held: 0,
            pct: 0,
          }
          map.set(st.student_id, row)
        }
        row.status.set(s.session_id, st.status)
        row.held += 1
        if (st.status === 'present' || st.status === 'late') row.present += 1
      }
    }
    const list = [...map.values()]
    for (const r of list) r.pct = pctOf(r.present, r.held)
    return list
  }, [sessions])

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const list = needle
      ? dayRows.filter(
          (r) =>
            r.display_name.toLowerCase().includes(needle) ||
            r.roll_no.toLowerCase().includes(needle),
        )
      : dayRows
    const { by, dir } = sort
    // A student with nothing marked today has no percentage — `null` sinks them
    // either way, matching the `—` the Day % cell renders.
    const pct = (r: DayStudentRow) => (r.held > 0 ? r.pct : null)
    return [...list].sort((a, b) => {
      const c =
        by === 'name'
          ? cmpText(a.display_name, b.display_name, dir)
          : by === 'pct'
            ? cmpNum(pct(a), pct(b), dir)
            : cmpText(a.roll_no, b.roll_no, dir)
      return c !== 0 ? c : a.roll_no.localeCompare(b.roll_no)
    })
  }, [dayRows, q, sort])

  /** Teaching days only, so the arrows skip weekends and holidays for free. */
  const step = (delta: number) => {
    const next = days[index + delta]
    if (next) setDate(next.session_date)
  }

  /**
   * A picked date that had no classes snaps back to the nearest teaching day at
   * or before it — showing an empty day would look like a data problem. The
   * server also 403s on a date outside an active `from`/`to`, and the day list
   * is already bounded by that range, so snapping keeps us inside it.
   */
  const pickDate = (iso: string) => {
    if (!iso) return
    const exact = days.find((d) => d.session_date === iso)
    if (exact) {
      setDate(exact.session_date)
      return
    }
    const before = [...days].reverse().find((d) => d.session_date <= iso)
    setDate((before ?? days[0]).session_date)
  }

  const exportRangeCsv = () => {
    downloadCsv(
      'attendance-day-wise',
      [
        'Date',
        'Day',
        'Classes marked',
        'Attended',
        'Held',
        'Attendance %',
        'Unmarked',
        'Cancelled',
      ],
      days.map((d) => [
        d.session_date,
        WEEKDAYS[d.day_of_week] ?? '',
        d.sessions_marked,
        d.attended,
        d.held,
        d.held > 0 ? d.pct : '',
        d.overdue_unmarked,
        d.cancelled,
      ]),
    )
  }

  const exportDayCsv = () => {
    if (!selected) return
    downloadCsv(
      `attendance-${selected}`,
      [
        'Roll no',
        'Student',
        ...sessions.map((s) => `${s.period_label} ${s.subject_code}`),
        'Present',
        'Marked',
        'Day %',
      ],
      shown.map((r) => [
        r.roll_no,
        r.display_name,
        ...sessions.map((s) => r.status.get(s.session_id) ?? ''),
        r.present,
        r.held,
        r.held > 0 ? r.pct : '',
      ]),
    )
  }

  const viewSwitch = (
    <Segmented
      aria-label="Day-wise view"
      value={view}
      onChange={setView}
      options={[
        { value: 'day', label: 'Single day' },
        { value: 'all', label: 'All days' },
      ]}
    />
  )

  const basis = data?.daily.basis ?? 'rollup'

  // Whole-tab failure or an empty period — neither view has anything to show,
  // so the toolbar keeps only the switch it can still honour.
  if (error || (!loading && data && days.length === 0)) {
    return (
      <div className="space-y-4 pb-4">
        <TabToolbar>{viewSwitch}</TabToolbar>
        <EmptyNote>
          {error ?? 'No classes were scheduled in this period.'}
        </EmptyNote>
      </div>
    )
  }

  if (view === 'all') {
    return (
      <div className="space-y-4 pb-4">
        <TabToolbar
          end={
            <ExportButton
              onClick={exportRangeCsv}
              disabled={days.length === 0}
            />
          }
        >
          {viewSwitch}
          <Segmented
            aria-label="All-days display"
            value={matrix ? 'grid' : 'days'}
            onChange={(v) => setMatrix(v === 'grid')}
            options={[
              { value: 'days', label: 'Days' },
              { value: 'grid', label: 'Student grid', icon: Grid3x3 },
            ]}
          />
          <BasisChip basis={basis} />
        </TabToolbar>

        {loading ? (
          <GridSkeleton periods={8} />
        ) : (
          <>
            <SummaryStrip className="rounded-lg border">
              <StripStat
                value={`${nf(days.length)} teaching ${days.length === 1 ? 'day' : 'days'}`}
              />
            </SummaryStrip>

            {/* Per-day summary. Clicking a day opens it in the single-day view. */}
            <div className="flex flex-wrap gap-2">
              {days.map((d) => (
                <button
                  key={d.session_date}
                  type="button"
                  onClick={() => {
                    setDate(d.session_date)
                    setView('day')
                  }}
                  className={cn(
                    'flex min-w-[7.5rem] flex-col items-start gap-0.5 rounded-lg border px-3 py-2 text-left transition-colors hover:bg-accent',
                    selected === d.session_date && 'border-primary',
                  )}
                >
                  <span className="text-xs font-medium">
                    {shortDay(d.session_date)}
                    <span className="ml-1 text-muted-foreground">
                      {WEEKDAYS[d.day_of_week]}
                    </span>
                  </span>
                  <PctBadge pct={d.pct} band={d.band} held={d.held} />
                  <span className="text-[0.7rem] text-muted-foreground">
                    {nf(d.sessions_marked)}{' '}
                    {d.sessions_marked === 1 ? 'class' : 'classes'}
                    {d.overdue_unmarked > 0 && (
                      <span className="text-icon-amber">
                        {' '}
                        · {nf(d.overdue_unmarked)} unmarked
                      </span>
                    )}
                  </span>
                </button>
              ))}
            </div>

            {matrix && data?.daily.matrix && (
              <ResultCard footnote="Each square is one day. A faded square means the student had no class marked that day — it is not an absence.">
                <table className="w-full border-separate border-spacing-0 text-xs">
                  <thead>
                    <tr>
                      <th className="sticky left-0 top-0 z-20 border-b border-r bg-background px-3 py-2 text-left font-medium">
                        Student
                      </th>
                      {data.daily.matrix.dates.map((d) => (
                        <th
                          key={d}
                          className="sticky top-0 z-10 whitespace-nowrap border-b bg-background px-1.5 py-2 font-medium"
                        >
                          {shortDay(d)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.students.map((s) => (
                      <tr key={s.student_id}>
                        <td className="sticky left-0 z-10 max-w-[13rem] truncate border-b border-r bg-background px-3 py-1.5">
                          <span className="font-mono text-muted-foreground">
                            {s.roll_no}
                          </span>{' '}
                          {s.display_name}
                        </td>
                        {data.daily.matrix!.dates.map((d) => {
                          const cell = cellByKey.get(`${s.student_id}:${d}`)
                          return (
                            <td
                              key={d}
                              className="border-b p-0.5 text-center"
                              title={
                                cell
                                  ? `${s.display_name} · ${longDay(d)} · ${nf(cell.attended)}/${nf(cell.held)}`
                                  : `${s.display_name} · ${longDay(d)} · no class marked`
                              }
                            >
                              {cell ? (
                                <span
                                  className="inline-block size-5 rounded-sm"
                                  style={{
                                    backgroundColor:
                                      BAND_COLOR[bandOf(cell.pct)] ??
                                      'var(--color-muted)',
                                  }}
                                />
                              ) : (
                                <span className="inline-block size-5 rounded-sm bg-muted/50" />
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ResultCard>
            )}
          </>
        )}
      </div>
    )
  }

  // --- single day ----------------------------------------------------------

  const dayLoading = loading || day.loading

  return (
    <div className="space-y-4 pb-4">
      <TabToolbar
        end={
          <ExportButton onClick={exportDayCsv} disabled={shown.length === 0} />
        }
      >
        {viewSwitch}

        {/* The stepper walks the teaching-day list, so it needs the payload —
            disabled rather than unmounted while that is in flight. */}
        <div className="flex shrink-0 items-center gap-1">
          <Button
            size="icon"
            variant="outline"
            className="size-9"
            aria-label="Previous teaching day"
            disabled={index <= 0}
            onClick={() => step(-1)}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <DatePicker
            value={selected ?? ''}
            onChange={pickDate}
            disabled={days.length === 0}
            min={days[0]?.session_date}
            aria-label="Pick a day"
            triggerClassName="h-9"
          />
          <Button
            size="icon"
            variant="outline"
            className="size-9"
            aria-label="Next teaching day"
            disabled={index < 0 || index >= days.length - 1}
            onClick={() => step(1)}
          >
            <ChevronRight className="size-4" />
          </Button>
          {index >= 0 && (
            <span className="ml-1 whitespace-nowrap text-xs tabular-nums text-muted-foreground">
              {nf(index + 1)}/{nf(days.length)}
            </span>
          )}
        </div>

        {/* Jump to the newest taught day — the stepper alone makes that a walk. */}
        {index >= 0 && index < days.length - 1 && (
          <Button
            size="sm"
            variant="ghost"
            className="h-9 shrink-0"
            onClick={() => setDate(latestTaughtDay(days))}
          >
            <CalendarCheck className="size-4" />
            Latest
          </Button>
        )}

        <SearchField
          value={q}
          onChange={setQ}
          placeholder="Search name or roll no…"
          label="Search students"
          className="w-full sm:w-52"
        />
        <SortMenu
          value={sort.by}
          dir={sort.dir}
          options={DAY_SORTS}
          onChange={toggleSort}
        />
        <BasisChip basis={basis} />
      </TabToolbar>

      {dayLoading ? (
        <GridSkeleton />
      ) : day.error ? (
        <EmptyNote>{day.error}</EmptyNote>
      ) : !selected ? null : sessions.length === 0 ? (
        <EmptyNote>Nothing was scheduled on {longDay(selected)}.</EmptyNote>
      ) : shown.length === 0 ? (
        <EmptyNote>
          No attendance was marked on {longDay(selected)} yet.
        </EmptyNote>
      ) : (
        <>
          <ResultCard
            summary={
              summary && (
                <>
                  <StripStat
                    value={
                      <span className="font-medium text-foreground">
                        {shortDay(summary.session_date)}{' '}
                        {WEEKDAYS[summary.day_of_week]}
                      </span>
                    }
                  />
                  <PctBadge
                    pct={summary.pct}
                    band={summary.band}
                    held={summary.held}
                  />
                  <StripStat
                    value={`${nf(summary.attended)}/${nf(summary.held)} present`}
                  />
                  <StripStat
                    value={`${nf(summary.sessions_marked)} ${summary.sessions_marked === 1 ? 'class' : 'classes'} marked`}
                  />
                  {summary.overdue_unmarked > 0 && (
                    <StripStat
                      tone="amber"
                      value={`${nf(summary.overdue_unmarked)} unmarked`}
                    />
                  )}
                  {summary.cancelled > 0 && (
                    <StripStat value={`${nf(summary.cancelled)} cancelled`} />
                  )}
                  <StripStat
                    className="ml-auto"
                    value={`${nf(shown.length)} ${shown.length === 1 ? 'student' : 'students'}`}
                  />
                </>
              )
            }
            footnote="A dot means the student has no mark for that class — the class is unmarked, or it is an elective they are not enrolled in. It is not an absence, and it is left out of the day percentage."
          >
            <table className="w-full border-separate border-spacing-0 text-xs">
              <thead>
                <tr>
                  {/* Bound to roll no — the leading value in the cell below.
                      Sorting by name stays a dropdown choice. */}
                  <th
                    className="sticky left-0 top-0 z-20 border-b border-r bg-background px-3 py-2 text-left font-medium"
                    aria-sort={
                      sort.by === 'roll'
                        ? sort.dir === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                    }
                  >
                    <SortLabel
                      field="roll"
                      label="Student"
                      sort={sort}
                      onSort={toggleSort}
                    />
                  </th>
                  {sessions.map((s) => (
                    <th
                      key={s.session_id}
                      className="sticky top-0 z-10 whitespace-nowrap border-b bg-background px-2 py-2 font-medium"
                      title={`${s.subject_name}${
                        s.teacher_display_name
                          ? ` · ${s.teacher_display_name}${s.is_substitute ? ' (sub)' : ''}`
                          : ''
                      } · ${clockTime(s.start_time)}–${clockTime(s.end_time)}${
                        s.status === 'completed' ? '' : ` · ${s.status}`
                      }`}
                    >
                      <span className="block">{s.period_label}</span>
                      <span className="block font-mono text-[0.65rem] font-normal text-muted-foreground">
                        {s.subject_code}
                      </span>
                    </th>
                  ))}
                  <th
                    className="sticky top-0 z-10 whitespace-nowrap border-b border-l bg-background px-3 py-2 text-right font-medium"
                    aria-sort={
                      sort.by === 'pct'
                        ? sort.dir === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                    }
                  >
                    <SortLabel
                      field="pct"
                      label="Day %"
                      sort={sort}
                      onSort={toggleSort}
                      align="right"
                    />
                  </th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.student_id}>
                    <td className="sticky left-0 z-10 max-w-[15rem] truncate border-b border-r bg-background px-3 py-1.5">
                      <span className="font-mono text-muted-foreground">
                        {r.roll_no}
                      </span>{' '}
                      {r.display_name}
                    </td>
                    {sessions.map((s) => {
                      const status = r.status.get(s.session_id)
                      return (
                        <td
                          key={s.session_id}
                          className="border-b px-2 py-1.5 text-center"
                          title={
                            status
                              ? `${r.display_name} · ${s.period_label} ${s.subject_code} · ${status}`
                              : `${r.display_name} · ${s.period_label} ${s.subject_code} · not marked`
                          }
                        >
                          {status ? (
                            <span
                              className={cn(
                                'inline-block rounded px-1.5 py-0.5 font-medium capitalize',
                                STATUS_CLASS[status] ??
                                  'bg-muted text-muted-foreground',
                              )}
                            >
                              {status}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/50">·</span>
                          )}
                        </td>
                      )
                    })}
                    <td className="border-b border-l px-3 py-1.5 text-right tabular-nums">
                      {r.held > 0 ? (
                        <>
                          <PctBadge
                            pct={r.pct}
                            band={bandOf(r.pct)}
                            held={r.held}
                          />
                          <span className="ml-1 text-muted-foreground">
                            {nf(r.present)}/{nf(r.held)}
                          </span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ResultCard>

          {/* The same day by class, for the teacher-and-subject read. */}
          <section className="space-y-2">
            <h3 className="text-sm font-semibold">By class</h3>
            <div className="space-y-3">
              {sessions.map((s) => {
                const absent = s.students.filter(
                  (x) => x.status !== 'present' && x.status !== 'late',
                )
                return (
                  <div key={s.session_id} className="rounded-lg border">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-3 py-2">
                      <span className="text-xs font-medium">
                        {s.period_label}
                        <span className="ml-1 font-normal text-muted-foreground">
                          {clockTime(s.start_time)}–{clockTime(s.end_time)}
                        </span>
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm">
                        {s.subject_name}
                        <span className="ml-1 font-mono text-xs text-muted-foreground">
                          {s.subject_code}
                        </span>
                      </span>
                      {s.teacher_display_name && (
                        <span className="text-xs text-muted-foreground">
                          {s.teacher_display_name}
                          {s.is_substitute && ' (sub)'}
                        </span>
                      )}
                      {s.status === 'completed' ? (
                        <span className="text-xs tabular-nums">
                          {nf(s.attended)}/{nf(s.marked)} present ·{' '}
                          {fmtPct(s.pct)}
                        </span>
                      ) : (
                        <span className="rounded bg-muted px-1.5 py-0.5 text-xs capitalize text-muted-foreground">
                          {s.status === 'scheduled' ? 'not marked' : s.status}
                        </span>
                      )}
                    </div>
                    {s.students.length > 0 && (
                      <div className="px-3 py-2">
                        {absent.length === 0 ? (
                          <p className="text-xs text-icon-emerald">
                            Everyone was present.
                          </p>
                        ) : (
                          <>
                            <p className="mb-1.5 text-xs text-muted-foreground">
                              {nf(absent.length)} not present
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {absent.map((a) => (
                                <span
                                  key={a.student_id}
                                  className={cn(
                                    'rounded px-1.5 py-0.5 text-xs',
                                    STATUS_CLASS[a.status] ??
                                      'bg-muted text-muted-foreground',
                                  )}
                                  title={`${a.display_name} — ${a.status}`}
                                >
                                  {a.roll_no}
                                </span>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        </>
      )}
    </div>
  )
}

/** The most recent day that has already happened, else the last one listed. */
function latestTaughtDay(days: DailyRow[]): string {
  const today = toIsoDate(new Date())
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i].session_date <= today) return days[i].session_date
  }
  return days[days.length - 1].session_date
}
