import {
  AlertTriangle,
  BarChart3,
  CalendarOff,
  ClipboardCheck,
  Layers,
  Percent,
  TrendingUp,
  TriangleAlert,
  UserCheck,
  Users,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { TabBar, type TabDef } from '@/components/corporate-relations/bits'
import {
  AXIS_TICK,
  TOOLTIP_STYLE,
} from '@/components/drive-management/chart-chrome'
import { KpiTile } from '@/components/drive-management/drive-analytics'
import {
  BAND_COLOR,
  DEFAULT_THRESHOLD,
  RESULT_SCROLL,
  WEEKDAYS,
  isBelow,
  projectionAt,
  readStored,
  shortDay,
  writeStored,
} from '@/components/employee/attendance-analytics/format'
import { StudentDetailSheet } from '@/components/employee/attendance-analytics/student-detail-sheet'
import { ThresholdControl } from '@/components/employee/attendance-analytics/threshold-control'
import {
  BasisChip,
  EmptyNote,
  ExportButton,
  KpiSkeleton,
  PctBadge,
  ResultCard,
  SearchField,
  StripStat,
  TabToolbar,
  TableSkeleton,
} from '@/components/employee/attendance-analytics/ui'
import { NoAccessEmptyState } from '@/components/employee/empty-states'
import {
  BandBar,
  ChartBox,
  InsightsHeader,
  Note,
  TreeToggle,
  Expandable,
  InsightsPanel,
} from '@/components/employee/insights/bits'
import {
  fmtPct,
  nf,
  url,
  useInsightsQuery,
  useInsightsTab,
  useTree,
  useUrlState,
} from '@/components/employee/insights/insights-utils'
import {
  batchLabel,
  useInsightsScope,
} from '@/components/employee/insights/use-insights-scope'
import { Combobox } from '@/components/ui/combobox'
import { DateRangePicker } from '@/components/ui/date-range-picker'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useScreenAccess } from '@/hooks/use-screen-access'
import { downloadCsv } from '@/lib/csv'
import {
  INSIGHTS_KEYS,
  fetchInsightsAttendanceOverview,
  fetchInsightsAttendanceStudent,
  fetchInsightsAttendanceStudents,
  fetchInsightsFaculty,
  fetchInsightsLeaves,
  fetchInsightsRollup,
  fetchInsightsSubjects,
  scopeQs,
  type InsightsStudentRow,
  type RollupRow,
} from '@/lib/insights'
import { cn } from '@/lib/utils'

const KEY = INSIGHTS_KEYS.attendance

const TABS: TabDef[] = [
  { key: 'rollup', label: 'Rollup', icon: Layers },
  { key: 'subjects', label: 'Subjects', icon: BarChart3 },
  { key: 'faculty', label: 'Faculty', icon: UserCheck },
  { key: 'defaulters', label: 'Defaulters', icon: TriangleAlert },
  { key: 'trend', label: 'Trend', icon: TrendingUp },
  { key: 'leaves', label: 'Leaves', icon: CalendarOff },
]
const TAB_KEYS = TABS.map((t) => t.key)
const LEVELS = ['department', 'programme', 'batch', 'section'] as const
const LS_THRESHOLD = 'nucleus.insights.attendance.threshold'

/**
 * Attendance over the caller's scope — every section of every batch, one
 * semester per batch. The same dual basis as the incharge screen: no dates =
 * the whole-semester rollup (official, matches the student dashboard); dates
 * = a live scan of that window, adjustments excluded.
 */
export default function EmployeeInsightsAttendancePage() {
  const access = useScreenAccess(KEY)
  const scope = useInsightsScope(KEY)
  const [tab, setTab] = useInsightsTab(
    'nucleus.insights.attendance.tab',
    'rollup',
    TAB_KEYS,
  )
  const [semester, setSemester] = useUrlState<number | null>('semester', null, url.semester, url.semesterOut)
  const [from, setFrom] = useUrlState('from', '', url.date, url.dateOut)
  const [to, setTo] = useUrlState('to', '', url.date, url.dateOut)

  useEffect(() => {
    document.title = 'Attendance Insights — Nucleus'
  }, [])

  const today = scope.tree?.today ?? ''
  const changeRange = useCallback(
    ({ from: f, to: t }: { from: string; to: string }) => {
      const a = f && today && f > today ? today : f
      const b = t && today && t > today ? today : t
      if (!a && !b) {
        setFrom('')
        setTo('')
      } else if (a && !b) {
        setFrom(a)
        setTo(today)
      } else if (!a && b) {
        setFrom(b)
        setTo(b)
      } else {
        setFrom(a)
        setTo(b)
      }
    },
    [today, setFrom, setTo],
  )

  const qs = useMemo(
    () =>
      scopeQs(scope.sel, {
        semester: semester ?? undefined,
        ...(from && to ? { from, to } : {}),
      }),
    [scope.sel, semester, from, to],
  )
  const ready = scope.tree !== null && scope.batches.length > 0

  if (!access) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <NoAccessEmptyState />
      </div>
    )
  }

  const semesterOptions = [
    { value: 0, label: 'Current semester' },
    ...Array.from({ length: 8 }, (_, i) => ({
      value: i + 1,
      label: `Semester ${i + 1}`,
    })),
  ]

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <InsightsHeader
        title="Attendance Insights"
        scope={scope}
        screenKey={KEY}
        route="/insights/attendance"
        summary={[
          semester ? `Semester ${semester}` : 'Current semester',
          from && to ? `${shortDay(from)} – ${shortDay(to)}` : 'Whole semester',
        ].join(' · ')}
        activeExtras={(semester ? 1 : 0) + (from && to ? 1 : 0)}
        tabs={
          <TabBar
            tabs={TABS}
            active={tab}
            onChange={setTab}
            className="border-b-0"
          />
        }
        controls={
          <>
            <label htmlFor="insights-semester" className="sr-only">
              Semester
            </label>
            <Combobox
              size="sm"
              id="insights-semester"
              className="w-44"
              value={semester ?? 0}
              options={semesterOptions}
              onChange={(v) => setSemester(v ? v : null)}
              placeholder="Semester…"
              searchPlaceholder="Search…"
            />
            <DateRangePicker
              size="sm"
              from={from}
              to={to}
              onChange={changeRange}
              emptyLabel="Whole semester"
              align="end"
              aria-label="Date range"
            />
          </>
        }
      />

      {scope.error && <EmptyNote>{scope.error}</EmptyNote>}
      {scope.tree && scope.batches.length === 0 && (
        <EmptyNote>No batches fall inside your scope.</EmptyNote>
      )}

      {ready && (
        <div className="space-y-3">
          {tab === 'rollup' && <RollupTab qs={qs} scope={scope} />}
          {tab === 'subjects' && <SubjectsTab qs={qs} />}
          {tab === 'faculty' && <FacultyTab qs={qs} />}
          {tab === 'defaulters' && <DefaultersTab qs={qs} />}
          {tab === 'trend' && <TrendTab qs={qs} />}
          {tab === 'leaves' && <LeavesTab qs={qs} scope={scope} />}
        </div>
      )}
    </div>
  )
}

// --- rollup -------------------------------------------------------------------

function RollupTab({
  qs,
  scope,
}: {
  qs: string
  scope: ReturnType<typeof useInsightsScope>
}) {
  const { data, loading, error } = useInsightsQuery(
    `rollup|${qs}`,
    () => fetchInsightsRollup(qs),
    'Could not load the rollup.',
  )
  const tree = useTree(data?.rows, LEVELS, scope.multiDepartment ? 2 : 3)

  const narrowTo = (r: RollupRow) => {
    if (r.level === 'department') {
      scope.setSel({
        department_ids: [r.id],
        programme_ids: [],
        programme_admission_year_ids: [],
        attendance_group_ids: [],
      })
    } else if (r.level === 'programme') {
      scope.setSel({
        programme_ids: [r.id],
        programme_admission_year_ids: [],
        attendance_group_ids: [],
      })
    } else if (r.level === 'batch') {
      scope.setSel({
        programme_admission_year_ids: [r.id],
        attendance_group_ids: [],
      })
    } else {
      scope.setSel({ attendance_group_ids: [r.id] })
    }
  }

  if (loading) return <TableSkeleton cols={8} rows={10} />
  if (error) return <EmptyNote>{error}</EmptyNote>
  if (!data) {
    return (
      <EmptyNote>
        No section in scope has that semester. Pick another semester or clear
        the date range.
      </EmptyNote>
    )
  }
  const t = data.totals
  return (
    <div className="space-y-3 pb-4">
      <TabToolbar>
        <BasisChip basis={data.basis} />
        {data.locked && (
          <Note>
            Every semester in scope is closed — unmarked classes are history,
            not a to-do.
          </Note>
        )}
      </TabToolbar>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile
          icon={Percent}
          color="var(--color-icon-emerald)"
          label="Attendance"
          value={t.held > 0 ? fmtPct(t.pct) : '—'}
          sub={`${nf(t.attended)} of ${nf(t.held)} classes attended`}
          highlight
        />
        <KpiTile
          icon={Users}
          color="var(--color-icon-cyan)"
          label="Students"
          value={nf(t.students)}
          sub={`${nf(t.below_threshold)} below ${data.thresholds.threshold}%`}
        />
        <KpiTile
          icon={AlertTriangle}
          color="var(--color-icon-rose)"
          label={`Below ${data.thresholds.condonation}%`}
          value={nf(t.below_condonation)}
          sub="Beyond the condonation band"
        />
        <KpiTile
          icon={ClipboardCheck}
          color="var(--color-icon-violet)"
          label="Marking done"
          value={fmtPct(t.compliance_pct)}
          sub={
            t.overdue_unmarked > 0
              ? `${nf(t.overdue_unmarked)} past classes never marked`
              : 'Every past class is marked'
          }
        />
      </div>

      <Expandable>
      <ResultCard
        scroll={false}
        summary={
          <StripStat value="Click a name to narrow the scope to it; expand rows for the levels below." />
        }
        footnote="A batch's marking figures include cross-group elective classes, which belong to no single section — so a batch is not always the sum of its sections."
      >
        <Table containerClassName={RESULT_SCROLL}>
          <TableHeader className="sticky top-0 z-10 bg-background">
            <TableRow>
              <TableHead>Scope</TableHead>
              <TableHead className="text-right">Students</TableHead>
              <TableHead className="text-right">Attended / held</TableHead>
              <TableHead className="text-right">Attendance</TableHead>
              <TableHead>Spread</TableHead>
              <TableHead className="text-right">Below 75%</TableHead>
              <TableHead className="text-right">Below 65%</TableHead>
              <TableHead className="text-right">Marking</TableHead>
              <TableHead className="text-right">Unmarked</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tree.visible.map((r) => (
              <TableRow
                key={r.key}
                className={cn(
                  r.level === 'department' && 'bg-muted/40 font-medium',
                  r.level === 'programme' && 'bg-muted/20',
                )}
              >
                <TableCell>
                  <TreeToggle
                    open={tree.opened.has(r.key)}
                    hasChildren={r.has_children}
                    depth={r.depth}
                    onToggle={() => tree.toggle(r.key)}
                  >
                    <button
                      type="button"
                      className="text-left hover:underline"
                      onClick={() => narrowTo(r)}
                    >
                      {r.label}
                      {r.sublabel && (
                        <span className="ml-1.5 text-xs text-muted-foreground">
                          {r.sublabel}
                        </span>
                      )}
                    </button>
                  </TreeToggle>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {nf(r.students)}
                </TableCell>
                <TableCell className="text-right text-xs tabular-nums text-muted-foreground">
                  {nf(r.attended)} / {nf(r.held)}
                </TableCell>
                <TableCell className="text-right">
                  <PctBadge pct={r.pct} band={r.band} held={r.held} />
                </TableCell>
                <TableCell>
                  <BandBar bands={r.bands} colors={BAND_COLOR} total={r.students} />
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {nf(r.below_threshold)}
                </TableCell>
                <TableCell
                  className={cn(
                    'text-right tabular-nums',
                    r.below_condonation > 0 && 'text-icon-rose',
                  )}
                >
                  {nf(r.below_condonation)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {r.marked + r.overdue_unmarked > 0
                    ? fmtPct(r.compliance_pct)
                    : '—'}
                </TableCell>
                <TableCell
                  className={cn(
                    'text-right tabular-nums',
                    r.overdue_unmarked > 0 && 'text-icon-amber',
                  )}
                >
                  {nf(r.overdue_unmarked)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ResultCard>      </Expandable>
    </div>
  )
}

// --- subjects -----------------------------------------------------------------

function SubjectsTab({ qs }: { qs: string }) {
  const { data, loading, error } = useInsightsQuery(
    `subjects|${qs}`,
    () => fetchInsightsSubjects(qs),
    'Could not load the subjects.',
  )
  const [q, setQ] = useState('')
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return (data?.rows ?? [])
      .filter(
        (r) =>
          !needle ||
          r.subject_code.toLowerCase().includes(needle) ||
          r.subject_name.toLowerCase().includes(needle) ||
          r.teachers.some((t) => t.toLowerCase().includes(needle)),
      )
      .sort((a, b) => a.pct - b.pct)
  }, [data, q])

  return (
    <div className="space-y-3 pb-4">
      <TabToolbar
        end={
          <ExportButton
            disabled={rows.length === 0}
            onClick={() =>
              downloadCsv(
                'insights-subjects',
                ['Code', 'Subject', 'Teachers', 'Attended', 'Held', '%', 'Marked', 'Unmarked', 'Upcoming'],
                rows.map((r) => [
                  r.subject_code,
                  r.subject_name,
                  r.teachers.join('; '),
                  r.attended,
                  r.held,
                  r.pct,
                  r.sessions_marked,
                  r.sessions_overdue_unmarked,
                  r.sessions_upcoming,
                ]),
              )
            }
          />
        }
      >
        <SearchField
          value={q}
          onChange={setQ}
          placeholder="Search subject or teacher…"
          label="Search subjects"
        />
        <BasisChip basis={data?.basis ?? 'rollup'} />
      </TabToolbar>
      {loading ? (
        <TableSkeleton cols={7} rows={10} />
      ) : error ? (
        <EmptyNote>{error}</EmptyNote>
      ) : rows.length === 0 ? (
        <EmptyNote>No subjects with attendance in this scope.</EmptyNote>
      ) : (
        <Expandable>        <ResultCard
          scroll={false}
          summary={<StripStat value={`${nf(rows.length)} subjects, lowest first`} />}
        >
          <Table containerClassName={RESULT_SCROLL}>
            <TableHeader className="sticky top-0 z-10 bg-background">
              <TableRow>
                <TableHead>Subject</TableHead>
                <TableHead>Teachers</TableHead>
                <TableHead className="text-right">Attendance</TableHead>
                <TableHead>Spread</TableHead>
                <TableHead className="text-right">Marked</TableHead>
                <TableHead className="text-right">Unmarked</TableHead>
                <TableHead>Weakest</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const students = r.bands.reduce((a, b) => a + b.count, 0)
                return (
                  <TableRow key={r.subject_id}>
                    <TableCell>
                      <span className="font-mono text-xs">{r.subject_code}</span>
                      <span className="ml-2">{r.subject_name}</span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.teachers.join(', ') || '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <PctBadge pct={r.pct} band={r.band} held={r.held} />
                    </TableCell>
                    <TableCell>
                      <BandBar bands={r.bands} colors={BAND_COLOR} total={students} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {nf(r.sessions_marked)}
                    </TableCell>
                    <TableCell
                      className={cn(
                        'text-right tabular-nums',
                        r.sessions_overdue_unmarked > 0 && 'text-icon-amber',
                      )}
                    >
                      {nf(r.sessions_overdue_unmarked)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.worst_students
                        .slice(0, 3)
                        .map((s) => `${s.display_name} (${s.pct}%)`)
                        .join(', ')}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </ResultCard>        </Expandable>
      )}
    </div>
  )
}

// --- faculty -------------------------------------------------------------------

function FacultyTab({ qs }: { qs: string }) {
  const { data, loading, error } = useInsightsQuery(
    `faculty|${qs}`,
    () => fetchInsightsFaculty(qs),
    'Could not load the faculty view.',
  )
  const [q, setQ] = useState('')
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return (data ?? []).filter(
      (r) =>
        !needle ||
        (r.emp_display_name ?? '').toLowerCase().includes(needle) ||
        (r.emp_code ?? '').toLowerCase().includes(needle) ||
        (r.department_code ?? '').toLowerCase().includes(needle),
    )
  }, [data, q])
  const overdue = rows.reduce((a, r) => a + r.overdue_unmarked, 0)

  return (
    <div className="space-y-3 pb-4">
      <TabToolbar
        end={
          <ExportButton
            disabled={rows.length === 0}
            onClick={() =>
              downloadCsv(
                'insights-faculty',
                ['Code', 'Name', 'Department', 'Sessions', 'Marked', 'Unmarked', 'Upcoming', 'Cancelled', 'Substituted in', 'Marking %', 'Sessions/week', 'Subjects', 'Sections', 'Class attendance %'],
                rows.map((r) => [
                  r.emp_code ?? '',
                  r.emp_display_name ?? '',
                  r.department_code ?? '',
                  r.sessions,
                  r.marked,
                  r.overdue_unmarked,
                  r.upcoming,
                  r.cancelled,
                  r.substituted_in,
                  r.compliance_pct,
                  r.sessions_per_week,
                  r.subjects,
                  r.sections,
                  r.held > 0 ? r.pct : '',
                ]),
              )
            }
          />
        }
      >
        <SearchField
          value={q}
          onChange={setQ}
          placeholder="Search name, code or department…"
          label="Search faculty"
        />
      </TabToolbar>
      {loading ? (
        <TableSkeleton cols={9} rows={12} />
      ) : error ? (
        <EmptyNote>{error}</EmptyNote>
      ) : rows.length === 0 ? (
        <EmptyNote>No classes in this scope.</EmptyNote>
      ) : (
        <Expandable>        <ResultCard
          scroll={false}
          summary={
            <>
              <StripStat value={`${nf(rows.length)} teachers`} />
              <StripStat
                label="Unmarked"
                value={nf(overdue)}
                tone={overdue > 0 ? 'amber' : 'default'}
              />
            </>
          }
          footnote="Sessions per week counts scheduled and marked classes over the weeks that have already passed. Class attendance is how students turned up for this teacher's marked classes."
        >
          <Table containerClassName={RESULT_SCROLL}>
            <TableHeader className="sticky top-0 z-10 bg-background">
              <TableRow>
                <TableHead>Teacher</TableHead>
                <TableHead>Dept</TableHead>
                <TableHead className="text-right">Sessions</TableHead>
                <TableHead className="text-right">Marked</TableHead>
                <TableHead className="text-right">Unmarked</TableHead>
                <TableHead className="text-right">Marking</TableHead>
                <TableHead className="text-right">Per week</TableHead>
                <TableHead className="text-right">Subjects</TableHead>
                <TableHead className="text-right">Sections</TableHead>
                <TableHead className="text-right">Class attendance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.employee_id ?? 'none'}>
                  <TableCell>
                    <span className="block">{r.emp_display_name ?? 'Unassigned'}</span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {r.emp_code ?? ''}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {r.department_code ?? '—'}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {nf(r.sessions)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {nf(r.marked)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      'text-right tabular-nums',
                      r.overdue_unmarked > 0 && 'text-icon-amber',
                    )}
                  >
                    {nf(r.overdue_unmarked)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.marked + r.overdue_unmarked > 0
                      ? fmtPct(r.compliance_pct)
                      : '—'}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.sessions_per_week}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {nf(r.subjects)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {nf(r.sections)}
                  </TableCell>
                  <TableCell className="text-right">
                    <PctBadge pct={r.pct} band={bandOf(r.pct)} held={r.held} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ResultCard>        </Expandable>
      )}
    </div>
  )
}

function bandOf(pct: number): string {
  if (pct < 50) return 'critical'
  if (pct < 65) return 'low'
  if (pct < 75) return 'condonation'
  if (pct < 85) return 'ok'
  return 'good'
}

// --- defaulters ---------------------------------------------------------------

function DefaultersTab({ qs }: { qs: string }) {
  const { data, loading, error } = useInsightsQuery(
    `students|${qs}`,
    () => fetchInsightsAttendanceStudents(qs),
    'Could not load the students.',
  )
  const [q, setQ] = useState('')
  const [threshold, setThreshold] = useState(() => {
    const n = Number(readStored(LS_THRESHOLD))
    return Number.isFinite(n) && n > 0 && n <= 100 ? n : DEFAULT_THRESHOLD
  })
  const [open, setOpen] = useState<InsightsStudentRow | null>(null)
  const remaining = data?.sessions_remaining ?? 0

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return (data?.rows ?? [])
      .filter((r) => isBelow(r.attended, r.held, threshold))
      .filter(
        (r) =>
          !needle ||
          r.display_name.toLowerCase().includes(needle) ||
          r.roll_no.toLowerCase().includes(needle) ||
          (r.group_name ?? '').toLowerCase().includes(needle) ||
          (r.batch_label ?? '').toLowerCase().includes(needle),
      )
      .sort((a, b) => a.attended / a.held - b.attended / b.held)
  }, [data, q, threshold])

  return (
    <div className="space-y-3 pb-4">
      <TabToolbar
        end={
          <ExportButton
            disabled={rows.length === 0}
            onClick={() =>
              downloadCsv(
                'insights-defaulters',
                ['Roll no', 'Student', 'Section', 'Batch', 'Attended', 'Held', '%', `Classes needed for ${threshold}%`, 'Absent streak'],
                rows.map((r) => {
                  const proj = projectionAt(r.attended, r.held, remaining, threshold)
                  return [
                    r.roll_no,
                    r.display_name,
                    r.group_name ?? '',
                    r.batch_label ?? '',
                    r.attended,
                    r.held,
                    r.pct,
                    proj.sessions_needed === null ? 'Not reachable' : proj.sessions_needed,
                    r.current_absent_streak,
                  ]
                }),
              )
            }
          />
        }
      >
        <SearchField
          value={q}
          onChange={setQ}
          placeholder="Search name, roll no, section…"
          label="Search students"
        />
        <ThresholdControl
          value={threshold}
          onChange={(v) => {
            setThreshold(v)
            writeStored(LS_THRESHOLD, String(v))
          }}
        />
        <BasisChip basis={data?.basis ?? 'rollup'} />
      </TabToolbar>
      {loading ? (
        <TableSkeleton cols={7} rows={12} />
      ) : error ? (
        <EmptyNote>{error}</EmptyNote>
      ) : !data ? null : rows.length === 0 ? (
        <EmptyNote>No student is below {threshold}% in this scope.</EmptyNote>
      ) : (
        <Expandable>        <ResultCard
          scroll={false}
          summary={
            <>
              <StripStat
                value={`${nf(rows.length)} of ${nf(data.rows.length)} below ${threshold}%`}
              />
              {remaining > 0 && (
                <StripStat label="Classes left (approx.)" value={nf(remaining)} />
              )}
            </>
          }
        >
          <Table containerClassName={RESULT_SCROLL}>
            <TableHeader className="sticky top-0 z-10 bg-background">
              <TableRow>
                <TableHead className="w-28">Roll no</TableHead>
                <TableHead>Student</TableHead>
                <TableHead>Section</TableHead>
                <TableHead>Batch</TableHead>
                <TableHead className="text-right">Attended</TableHead>
                <TableHead className="text-right">Held</TableHead>
                <TableHead className="text-right">Overall</TableHead>
                <TableHead className="text-right">To reach {threshold}%</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const proj = projectionAt(r.attended, r.held, remaining, threshold)
                return (
                  <TableRow
                    key={r.student_id}
                    className="cursor-pointer"
                    onClick={() => setOpen(r)}
                  >
                    <TableCell className="font-mono text-xs">{r.roll_no}</TableCell>
                    <TableCell>
                      <span className="block">{r.display_name}</span>
                      {r.current_absent_streak >= 3 && (
                        <span className="text-xs text-icon-rose">
                          Absent {r.current_absent_streak} days running
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">{r.group_name ?? '—'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.batch_label ?? '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {nf(r.attended)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {nf(r.held)}
                    </TableCell>
                    <TableCell className="text-right">
                      <PctBadge pct={r.pct} band={r.band} held={r.held} />
                    </TableCell>
                    <TableCell
                      className={cn(
                        'text-right text-xs tabular-nums',
                        proj.sessions_needed === null && 'text-icon-rose',
                      )}
                    >
                      {proj.sessions_needed === null
                        ? `Max ${fmtPct(proj.max_achievable_pct)}`
                        : `${nf(proj.sessions_needed)} more`}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </ResultCard>        </Expandable>
      )}

      <StudentDetailSheet
        load={(id) => fetchInsightsAttendanceStudent(qs, id)}
        loadKey={qs}
        student={open}
        threshold={threshold}
        sessionsRemaining={remaining}
        onClose={() => setOpen(null)}
      />
    </div>
  )
}

// --- trend --------------------------------------------------------------------

function TrendTab({ qs }: { qs: string }) {
  const { data, loading, error } = useInsightsQuery(
    `trend|${qs}`,
    () => fetchInsightsAttendanceOverview(qs),
    'Could not load the trend.',
  )
  if (loading) return <KpiSkeleton />
  if (error) return <EmptyNote>{error}</EmptyNote>
  if (!data || data.kpi.held === 0) {
    return <EmptyNote>No attendance has been marked in this scope yet.</EmptyNote>
  }
  return (
    <div className="space-y-4 pb-4">
      <TabToolbar>
        <BasisChip basis={data.basis} />
        {data.warnings.duplicate_elective_sessions > 0 && (
          <Note tone="amber" icon={TriangleAlert}>
            {nf(data.warnings.duplicate_elective_sessions)} cross-group elective
            classes appear more than once for the same slot; if both copies were
            marked, they count twice.
          </Note>
        )}
      </TabToolbar>
      <InsightsPanel
        title="Attendance trend"
        subtitle="Percentage of the scope present each day"
      >
        <ChartBox height={260}>
          <LineChart data={data.trend}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis
              dataKey="session_date"
              tick={AXIS_TICK}
              tickFormatter={shortDay}
              minTickGap={24}
            />
            <YAxis tick={AXIS_TICK} domain={[0, 100]} unit="%" width={44} />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              labelFormatter={(l) => shortDay(String(l ?? ''))}
              formatter={(v) => [fmtPct(Number(v ?? 0)), 'Present']}
            />
            <Line
              type="monotone"
              dataKey="pct"
              name="Present"
              stroke="var(--color-icon-emerald)"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ChartBox>
      </InsightsPanel>
      <div className="grid gap-4 lg:grid-cols-2">
        <InsightsPanel title="How students are spread" subtitle="Students in each band">
          <ChartBox>
            <BarChart data={data.bands}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="label" tick={AXIS_TICK} />
              <YAxis tick={AXIS_TICK} allowDecimals={false} width={32} />
              <Tooltip contentStyle={TOOLTIP_STYLE} cursor={false} />
              <Bar dataKey="count" name="Students" radius={[4, 4, 0, 0]}>
                {data.bands.map((b) => (
                  <Cell key={b.key} fill={BAND_COLOR[b.key]} />
                ))}
              </Bar>
            </BarChart>
          </ChartBox>
        </InsightsPanel>
        <InsightsPanel title="By day of the week" subtitle="Which days students turn up">
          <ChartBox>
            <BarChart data={data.by_weekday}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis
                dataKey="bucket"
                tick={AXIS_TICK}
                tickFormatter={(d: number) => WEEKDAYS[d] ?? String(d)}
              />
              <YAxis tick={AXIS_TICK} domain={[0, 100]} unit="%" width={44} />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                cursor={false}
                labelFormatter={(l) => WEEKDAYS[Number(l)] ?? String(l)}
                formatter={(v) => [fmtPct(Number(v ?? 0)), 'Present']}
              />
              <Bar dataKey="pct" name="Present" fill="var(--color-icon-blue)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartBox>
        </InsightsPanel>
      </div>
      <InsightsPanel
        title="By period of the day"
        subtitle="Classes spanning several periods count against each one — bars compare slots and do not add up"
      >
        <ChartBox>
          <BarChart data={data.by_period}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
            <XAxis dataKey="bucket" tick={AXIS_TICK} tickFormatter={(p: number) => `P${p}`} />
            <YAxis tick={AXIS_TICK} domain={[0, 100]} unit="%" width={44} />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              cursor={false}
              labelFormatter={(l) => `Period ${String(l)}`}
              formatter={(v) => [fmtPct(Number(v ?? 0)), 'Present']}
            />
            <Bar dataKey="pct" name="Present" fill="var(--color-icon-violet)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartBox>
      </InsightsPanel>
    </div>
  )
}

// --- leaves -------------------------------------------------------------------

function LeavesTab({
  qs,
  scope,
}: {
  qs: string
  scope: ReturnType<typeof useInsightsScope>
}) {
  const { data, loading, error } = useInsightsQuery(
    `leaves|${qs}`,
    () => fetchInsightsLeaves(qs),
    'Could not load leave volume.',
  )
  const pivot = useMemo(() => {
    const types = [...new Set((data?.by_group ?? []).map((r) => r.leave_type))]
    const byGroup = new Map<number, Map<string, { approved: number; days: number; pending: number }>>()
    for (const r of data?.by_group ?? []) {
      const m = byGroup.get(r.group_id) ?? new Map()
      m.set(r.leave_type, { approved: r.approved, days: r.approved_days, pending: r.pending })
      byGroup.set(r.group_id, m)
    }
    return { types, byGroup }
  }, [data])

  if (loading) return <TableSkeleton cols={5} rows={8} />
  if (error) return <EmptyNote>{error}</EmptyNote>
  if (!data) return <EmptyNote>No sections in scope.</EmptyNote>
  const groupName = (id: number) => {
    const g = scope.groupById.get(id)
    return g ? `${g.name} · ${batchLabel(scope.batchById.get(g.pay_id))}` : `#${id}`
  }
  return (
    <div className="space-y-4 pb-4">
      <TabToolbar>
        <Note>
          Window {shortDay(data.window.from)} – {shortDay(data.window.to)}.{' '}
          {data.pending.count > 0
            ? `${nf(data.pending.count)} leave requests pending, oldest ${data.pending.oldest_days ?? 0} days.`
            : 'No leave requests pending.'}
        </Note>
      </TabToolbar>
      <div className="grid gap-4 lg:grid-cols-2">
        <InsightsPanel title="Approved leave days by section" subtitle="Per leave type">
          {pivot.byGroup.size === 0 ? (
            <EmptyNote>No leaves in the window.</EmptyNote>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Section</TableHead>
                  {pivot.types.map((t) => (
                    <TableHead key={t} className="text-right">
                      {t}
                    </TableHead>
                  ))}
                  <TableHead className="text-right">Days</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...pivot.byGroup.entries()].map(([gid, m]) => {
                  const total = [...m.values()].reduce((a, v) => a + v.days, 0)
                  return (
                    <TableRow key={gid}>
                      <TableCell className="text-xs">{groupName(gid)}</TableCell>
                      {pivot.types.map((t) => (
                        <TableCell key={t} className="text-right tabular-nums">
                          {m.get(t)?.days ?? 0}
                        </TableCell>
                      ))}
                      <TableCell className="text-right font-medium tabular-nums">
                        {total}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </InsightsPanel>
        <InsightsPanel title="Most leave days" subtitle="Approved leave in the window">
          {data.top_students.length === 0 ? (
            <EmptyNote>No approved leaves in the window.</EmptyNote>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Section</TableHead>
                  <TableHead className="text-right">Leaves</TableHead>
                  <TableHead className="text-right">Days</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.top_students.map((s) => (
                  <TableRow key={s.student_id}>
                    <TableCell>
                      <span className="block">{s.display_name}</span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {s.roll_no}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs">{groupName(s.group_id)}</TableCell>
                    <TableCell className="text-right tabular-nums">{s.leaves}</TableCell>
                    <TableCell className="text-right tabular-nums">{s.days}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </InsightsPanel>
      </div>
    </div>
  )
}
