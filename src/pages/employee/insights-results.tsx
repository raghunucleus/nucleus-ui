import {
  Award,
  BarChart3,
  BookOpen,
  GraduationCap,
  Grid3x3,
  TriangleAlert,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
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
  RESULT_SCROLL,
} from '@/components/employee/attendance-analytics/format'
import {
  EmptyNote,
  ExportButton,
  KpiSkeleton,
  ResultCard,
  SearchField,
  StripStat,
  TabToolbar,
  TableSkeleton,
} from '@/components/employee/attendance-analytics/ui'
import { NoAccessEmptyState } from '@/components/employee/empty-states'
import {
  ChartBox,
  InsightsHeader,
  Note,
  Expandable,
  InsightsPanel,
} from '@/components/employee/insights/bits'
import {
  GROUP_BY_OPTIONS,
  fmt2,
  groupKeyOf,
  groupLabelOf,
  nf,
  url,
  useInsightsQuery,
  useInsightsTab,
  useUrlState,
  type GroupBy,
} from '@/components/employee/insights/insights-utils'
import {
  batchLabel,
  useInsightsScope,
} from '@/components/employee/insights/use-insights-scope'
import { Combobox } from '@/components/ui/combobox'
import { Segmented } from '@/components/ui/segmented'
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
  fetchResultsBacklogs,
  fetchResultsBatches,
  fetchResultsCgpa,
  fetchResultsCorrelation,
  fetchResultsCoverage,
  fetchResultsSubjects,
  scopeQs,
  type CoverageRow,
  type GpaBand,
} from '@/lib/insights'
import { cn } from '@/lib/utils'

const KEY = INSIGHTS_KEYS.results

const TABS: TabDef[] = [
  { key: 'batches', label: 'Batch performance', icon: BarChart3 },
  { key: 'subjects', label: 'Subjects', icon: BookOpen },
  { key: 'cgpa', label: 'CGPA', icon: GraduationCap },
  { key: 'backlogs', label: 'Backlogs', icon: TriangleAlert },
  { key: 'coverage', label: 'Coverage', icon: Grid3x3 },
]
const TAB_KEYS = TABS.map((t) => t.key)
const GRADES = ['O', 'S', 'A', 'B', 'C', 'D', 'F', 'P']
const parseGroupBy = url.word<GroupBy>(['department', 'programme', 'batch'])
const parseMin = url.int(1, 5)

type Scope = ReturnType<typeof useInsightsScope>

/**
 * University results over the scope. Everything is read from the exam-cell
 * caches, so a number here always matches the marks view; the new work is the
 * aggregation — pass %, distributions, subject failure rates, coverage.
 */
export default function EmployeeInsightsResultsPage() {
  const access = useScreenAccess(KEY)
  const scope = useInsightsScope(KEY)
  const [tab, setTab] = useInsightsTab('nucleus.insights.results.tab', 'batches', TAB_KEYS)
  const [semester, setSemester] = useUrlState<number | null>('semester', null, url.semester, url.semesterOut)
  const [groupBy, setGroupBy] = useUrlState<GroupBy>('group_by', 'batch', parseGroupBy, url.wordOut)

  useEffect(() => {
    document.title = 'Results Insights — Nucleus'
  }, [])

  const qs = useMemo(() => scopeQs(scope.sel), [scope.sel])
  const qsSem = useMemo(
    () => scopeQs(scope.sel, { semester: semester ?? undefined }),
    [scope.sel, semester],
  )
  const ready = scope.tree !== null && scope.batches.length > 0
  const showSemester = tab === 'batches' || tab === 'subjects'

  if (!access) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <NoAccessEmptyState />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <InsightsHeader
        title="Results Insights"
        scope={scope}
        screenKey={KEY}
        route="/insights/results"
        summary={[
          showSemester ? (semester ? `Semester ${semester}` : 'All semesters') : '',
          tab === 'batches' || tab === 'cgpa' ? `By ${groupBy}` : '',
        ]
          .filter(Boolean)
          .join(' · ')}
        activeExtras={(semester ? 1 : 0) + (groupBy !== 'batch' ? 1 : 0)}
        tabs={<TabBar tabs={TABS} active={tab} onChange={setTab} size="sm" className="border-b-0" />}
        controls={
          <>
            {showSemester && (
              <>
                <label htmlFor="insights-results-semester" className="sr-only">
                  Semester
                </label>
                <Combobox
                  size="sm"
                  id="insights-results-semester"
                  className="w-40"
                value={semester ?? 0}
                options={[
                  { value: 0, label: 'All semesters' },
                  ...Array.from({ length: 8 }, (_, i) => ({
                    value: i + 1,
                    label: `Semester ${i + 1}`,
                  })),
                ]}
                  onChange={(v) => setSemester(v ? v : null)}
                />
              </>
            )}
            {(tab === 'batches' || tab === 'cgpa') && (
              <Segmented
                size="sm"
                value={groupBy}
                onChange={setGroupBy}
                options={GROUP_BY_OPTIONS}
                aria-label="Group by"
              />
            )}
          </>
        }
      />
      {scope.error && <EmptyNote>{scope.error}</EmptyNote>}
      {scope.tree && scope.batches.length === 0 && (
        <EmptyNote>No batches fall inside your scope.</EmptyNote>
      )}
      {ready && (
        <div className="space-y-3">
          {tab === 'batches' && <BatchesTab qs={qsSem} scope={scope} groupBy={groupBy} />}
          {tab === 'subjects' && <SubjectsTab qs={qsSem} scope={scope} />}
          {tab === 'cgpa' && <CgpaTab qs={qs} scope={scope} groupBy={groupBy} />}
          {tab === 'backlogs' && <BacklogsTab qs={qs} scope={scope} />}
          {tab === 'coverage' && <CoverageTab qs={qs} scope={scope} />}
        </div>
      )}
    </div>
  )
}

function BandsChart({ bands, counts }: { bands: GpaBand[]; counts: Record<string, number> }) {
  const data = bands.map((b) => ({ key: b.key, label: b.label, count: counts[b.key] ?? 0 }))
  return (
    <ChartBox height={220}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
        <XAxis dataKey="label" tick={AXIS_TICK} />
        <YAxis tick={AXIS_TICK} allowDecimals={false} width={32} />
        <Tooltip contentStyle={TOOLTIP_STYLE} cursor={false} />
        <Bar dataKey="count" name="Students" fill="var(--color-icon-blue)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartBox>
  )
}

// --- batches ------------------------------------------------------------------

function BatchesTab({ qs, scope, groupBy }: { qs: string; scope: Scope; groupBy: GroupBy }) {
  const { data, loading, error } = useInsightsQuery(
    `rbatches|${qs}`,
    () => fetchResultsBatches(qs),
    'Could not load batch results.',
  )
  const rows = useMemo(() => {
    type Agg = {
      key: string
      label: string
      semester: number
      students: number
      passed: number
      sgpaSum: number
      bands: Record<string, number>
      backlogs: { none: number; one: number; two: number; three_plus: number }
    }
    const agg = new Map<string, Agg>()
    for (const r of data?.rows ?? []) {
      const b = scope.batchById.get(r.pay_id)
      if (!b) continue
      const k = `${groupKeyOf(groupBy, b)}|${r.semester}`
      const a = agg.get(k) ?? {
        key: k,
        label: groupLabelOf(groupBy, b),
        semester: r.semester,
        students: 0,
        passed: 0,
        sgpaSum: 0,
        bands: {},
        backlogs: { none: 0, one: 0, two: 0, three_plus: 0 },
      }
      a.students += r.students
      a.passed += r.passed
      a.sgpaSum += (r.avg_sgpa ?? 0) * r.students
      for (const [bk, n] of Object.entries(r.bands)) a.bands[bk] = (a.bands[bk] ?? 0) + n
      a.backlogs.none += r.backlogs.none
      a.backlogs.one += r.backlogs.one
      a.backlogs.two += r.backlogs.two
      a.backlogs.three_plus += r.backlogs.three_plus
      agg.set(k, a)
    }
    return [...agg.values()]
      .map((a) => ({
        ...a,
        pass_pct: a.students ? Math.round((a.passed / a.students) * 1000) / 10 : 0,
        avg_sgpa: a.students ? a.sgpaSum / a.students : null,
      }))
      .sort((x, y) => x.label.localeCompare(y.label) || x.semester - y.semester)
  }, [data, scope.batchById, groupBy])

  const totalBands = useMemo(() => {
    const out: Record<string, number> = {}
    for (const r of rows) for (const [k, n] of Object.entries(r.bands)) out[k] = (out[k] ?? 0) + n
    return out
  }, [rows])

  if (loading) return <KpiSkeleton />
  if (error) return <EmptyNote>{error}</EmptyNote>
  if (!data || rows.length === 0) {
    return <EmptyNote>No results have been uploaded for this scope yet.</EmptyNote>
  }
  const students = rows.reduce((a, r) => a + r.students, 0)
  const passed = rows.reduce((a, r) => a + r.passed, 0)
  const chartRows = rows.map((r) => ({ name: `${r.label} · S${r.semester}`, pass_pct: r.pass_pct }))
  return (
    <div className="space-y-4 pb-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile icon={GraduationCap} color="var(--color-icon-blue)" label="Student-semesters" value={nf(students)} sub="Rows with a computed SGPA" />
        <KpiTile icon={Award} color="var(--color-icon-emerald)" label="Cleared all subjects" value={students ? `${Math.round((passed / students) * 1000) / 10}%` : '—'} sub={`${nf(passed)} of ${nf(students)}`} highlight />
        <KpiTile icon={TriangleAlert} color="var(--color-icon-rose)" label="3+ backlogs" value={nf(rows.reduce((a, r) => a + r.backlogs.three_plus, 0))} sub="Student-semesters at risk" />
        <KpiTile icon={BarChart3} color="var(--color-icon-violet)" label="SGPA 8 and above" value={nf((totalBands.b8 ?? 0) + (totalBands.b9 ?? 0))} sub="Student-semesters" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <InsightsPanel title="Pass percentage" subtitle="Students who cleared every subject of the semester">
          <ChartBox height={Math.max(220, chartRows.length * 26)}>
            <BarChart data={chartRows} layout="vertical" margin={{ left: 8, right: 24 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
              <XAxis type="number" domain={[0, 100]} unit="%" tick={AXIS_TICK} />
              <YAxis type="category" dataKey="name" tick={AXIS_TICK} width={120} />
              <Tooltip contentStyle={TOOLTIP_STYLE} cursor={false} formatter={(v) => [`${Number(v ?? 0)}%`, 'Pass']} />
              <Bar dataKey="pass_pct" name="Pass" fill="var(--color-icon-emerald)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ChartBox>
        </InsightsPanel>
        <InsightsPanel title="SGPA distribution" subtitle="Student-semesters in each band">
          <BandsChart bands={data.bands} counts={totalBands} />
        </InsightsPanel>
      </div>
      <Expandable>      <ResultCard scroll={false} summary={<StripStat value={`${nf(rows.length)} rows`} />}>
        <Table containerClassName={RESULT_SCROLL}>
          <TableHeader className="sticky top-0 z-10 bg-background">
            <TableRow>
              <TableHead>{GROUP_BY_OPTIONS.find((o) => o.value === groupBy)?.label}</TableHead>
              <TableHead className="text-right">Sem</TableHead>
              <TableHead className="text-right">Students</TableHead>
              <TableHead className="text-right">Pass %</TableHead>
              <TableHead className="text-right">Avg SGPA</TableHead>
              <TableHead className="text-right">No backlog</TableHead>
              <TableHead className="text-right">1</TableHead>
              <TableHead className="text-right">2</TableHead>
              <TableHead className="text-right">3+</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.key}>
                <TableCell className="font-medium">{r.label}</TableCell>
                <TableCell className="text-right tabular-nums">{r.semester}</TableCell>
                <TableCell className="text-right tabular-nums">{nf(r.students)}</TableCell>
                <TableCell className={cn('text-right tabular-nums', r.pass_pct < 60 && 'text-icon-rose')}>{r.pass_pct}%</TableCell>
                <TableCell className="text-right tabular-nums">{fmt2(r.avg_sgpa)}</TableCell>
                <TableCell className="text-right tabular-nums">{nf(r.backlogs.none)}</TableCell>
                <TableCell className="text-right tabular-nums">{nf(r.backlogs.one)}</TableCell>
                <TableCell className="text-right tabular-nums">{nf(r.backlogs.two)}</TableCell>
                <TableCell className={cn('text-right tabular-nums', r.backlogs.three_plus > 0 && 'text-icon-rose')}>{nf(r.backlogs.three_plus)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ResultCard>      </Expandable>
    </div>
  )
}

// --- subjects -----------------------------------------------------------------

function SubjectsTab({ qs, scope }: { qs: string; scope: Scope }) {
  const { data, loading, error } = useInsightsQuery(
    `rsubjects|${qs}`,
    () => fetchResultsSubjects(qs),
    'Could not load subject results.',
  )
  const [q, setQ] = useState('')
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return (data?.rows ?? [])
      .map((r) => ({ ...r, batch: batchLabel(scope.batchById.get(r.pay_id)) }))
      .filter(
        (r) =>
          !needle ||
          r.subject_code.toLowerCase().includes(needle) ||
          r.subject_name.toLowerCase().includes(needle) ||
          r.batch.toLowerCase().includes(needle),
      )
      .sort((a, b) => b.fail_pct - a.fail_pct || b.appeared - a.appeared)
  }, [data, q, scope.batchById])

  return (
    <div className="space-y-3 pb-4">
      <TabToolbar
        end={
          <ExportButton
            disabled={rows.length === 0}
            onClick={() =>
              downloadCsv(
                'insights-subject-results',
                ['Batch', 'Sem', 'Code', 'Subject', 'Appeared', 'Passed', 'Fail %', 'Failed at first attempt', 'Avg grade points', ...GRADES],
                rows.map((r) => [
                  r.batch, r.semester, r.subject_code, r.subject_name, r.appeared, r.passed, r.fail_pct, r.first_attempt_failed, r.avg_grade_points ?? '',
                  ...GRADES.map((g) => r.grades[g] ?? 0),
                ]),
              )
            }
          />
        }
      >
        <SearchField value={q} onChange={setQ} placeholder="Search subject or batch…" label="Search subjects" />
      </TabToolbar>
      {loading ? (
        <TableSkeleton cols={8} rows={12} />
      ) : error ? (
        <EmptyNote>{error}</EmptyNote>
      ) : rows.length === 0 ? (
        <EmptyNote>No subject results in this scope.</EmptyNote>
      ) : (
        <Expandable>        <ResultCard
          scroll={false}
          summary={<StripStat value={`${nf(rows.length)} subject rows, highest failure first`} />}
          footnote="Best attempt per student. 'First attempt' counts students who failed the regular sitting even if they cleared it in supply."
        >
          <Table containerClassName={RESULT_SCROLL}>
            <TableHeader className="sticky top-0 z-10 bg-background">
              <TableRow>
                <TableHead>Subject</TableHead>
                <TableHead>Batch</TableHead>
                <TableHead className="text-right">Sem</TableHead>
                <TableHead className="text-right">Appeared</TableHead>
                <TableHead className="text-right">Fail %</TableHead>
                <TableHead className="text-right">First attempt</TableHead>
                <TableHead className="text-right">Avg GP</TableHead>
                <TableHead>Grades</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={`${r.pay_id}|${r.semester}|${r.subject_code}`}>
                  <TableCell>
                    <span className="font-mono text-xs">{r.subject_code}</span>
                    <span className="ml-2">{r.subject_name}</span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.batch}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.semester}</TableCell>
                  <TableCell className="text-right tabular-nums">{nf(r.appeared)}</TableCell>
                  <TableCell className={cn('text-right tabular-nums', r.fail_pct >= 30 ? 'text-icon-rose' : r.fail_pct >= 15 ? 'text-icon-amber' : '')}>{r.fail_pct}%</TableCell>
                  <TableCell className="text-right tabular-nums">{nf(r.first_attempt_failed)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt2(r.avg_grade_points)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {GRADES.filter((g) => (r.grades[g] ?? 0) > 0).map((g) => `${g} ${r.grades[g]}`).join(' · ')}
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

// --- cgpa ---------------------------------------------------------------------

function CgpaTab({ qs, scope, groupBy }: { qs: string; scope: Scope; groupBy: GroupBy }) {
  const { data, loading, error } = useInsightsQuery(`rcgpa|${qs}`, () => fetchResultsCgpa(qs), 'Could not load CGPA figures.')
  const corr = useInsightsQuery(`rcorr|${qs}`, () => fetchResultsCorrelation(qs), 'Could not load the correlation.')

  const rows = useMemo(() => {
    type Agg = { key: number; label: string; students: number; with_cgpa: number; cgpaSum: number; max: number | null; backlogs: number; history: number; bands: Record<string, number> }
    const agg = new Map<number, Agg>()
    for (const r of data?.by_batch ?? []) {
      const b = scope.batchById.get(r.pay_id)
      if (!b) continue
      const k = groupKeyOf(groupBy, b)
      const a = agg.get(k) ?? { key: k, label: groupLabelOf(groupBy, b), students: 0, with_cgpa: 0, cgpaSum: 0, max: null, backlogs: 0, history: 0, bands: {} }
      a.students += r.students
      a.with_cgpa += r.with_cgpa
      a.cgpaSum += (r.avg_cgpa ?? 0) * r.with_cgpa
      a.max = r.max_cgpa === null ? a.max : Math.max(a.max ?? 0, r.max_cgpa)
      a.backlogs += r.with_current_backlogs
      a.history += r.with_backlog_history
      for (const [bk, n] of Object.entries(r.bands)) a.bands[bk] = (a.bands[bk] ?? 0) + n
      agg.set(k, a)
    }
    return [...agg.values()].map((a) => ({ ...a, avg: a.with_cgpa ? a.cgpaSum / a.with_cgpa : null })).sort((x, y) => x.label.localeCompare(y.label))
  }, [data, scope.batchById, groupBy])
  const totalBands = useMemo(() => {
    const out: Record<string, number> = {}
    for (const r of rows) for (const [k, n] of Object.entries(r.bands)) out[k] = (out[k] ?? 0) + n
    return out
  }, [rows])

  if (loading) return <KpiSkeleton />
  if (error) return <EmptyNote>{error}</EmptyNote>
  if (!data || rows.length === 0) return <EmptyNote>No CGPA has been computed for this scope yet.</EmptyNote>
  const withCgpa = rows.reduce((a, r) => a + r.with_cgpa, 0)
  const avg = withCgpa ? rows.reduce((a, r) => a + r.cgpaSum, 0) / withCgpa : null
  return (
    <div className="space-y-4 pb-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile icon={GraduationCap} color="var(--color-icon-blue)" label="Average CGPA" value={fmt2(avg)} sub={`${nf(withCgpa)} students with results`} highlight />
        <KpiTile icon={Award} color="var(--color-icon-emerald)" label="CGPA 8 and above" value={nf((totalBands.b8 ?? 0) + (totalBands.b9 ?? 0))} sub="Students" />
        <KpiTile icon={TriangleAlert} color="var(--color-icon-rose)" label="With current backlogs" value={nf(rows.reduce((a, r) => a + r.backlogs, 0))} sub={`${nf(rows.reduce((a, r) => a + r.history, 0))} ever had one`} />
        <KpiTile icon={BarChart3} color="var(--color-icon-violet)" label="Below 6" value={nf((totalBands.lt5 ?? 0) + (totalBands.b5 ?? 0))} sub="Students under placement cutoffs" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <InsightsPanel title="CGPA distribution" subtitle="Students in each band">
          <BandsChart bands={data.bands} counts={totalBands} />
        </InsightsPanel>
        <InsightsPanel title="Attendance vs results" subtitle="Latest SGPA by attendance band in the ongoing semester (raw rollup, adjustments excluded)">
          {corr.loading ? (
            <TableSkeleton cols={3} rows={5} />
          ) : corr.error ? (
            <EmptyNote>{corr.error}</EmptyNote>
          ) : !corr.data || corr.data.bands.length === 0 ? (
            <EmptyNote>Needs both an ongoing semester with attendance and at least one uploaded semester.</EmptyNote>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Attendance band</TableHead>
                  <TableHead className="text-right">Students</TableHead>
                  <TableHead className="text-right">Avg latest SGPA</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {['critical', 'low', 'condonation', 'ok', 'good'].map((band) => {
                  const b = corr.data?.bands.find((x) => x.band === band)
                  if (!b) return null
                  return (
                    <TableRow key={band}>
                      <TableCell>
                        <span className="mr-2 inline-block size-2.5 rounded-full" style={{ backgroundColor: BAND_COLOR[band] }} />
                        {BAND_LABEL[band]}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{nf(b.students)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmt2(b.avg_sgpa)}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </InsightsPanel>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <InsightsPanel title={`By ${GROUP_BY_OPTIONS.find((o) => o.value === groupBy)?.label.toLowerCase()}`}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Group</TableHead>
                <TableHead className="text-right">Students</TableHead>
                <TableHead className="text-right">With CGPA</TableHead>
                <TableHead className="text-right">Avg</TableHead>
                <TableHead className="text-right">Max</TableHead>
                <TableHead className="text-right">Backlogs</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.key}>
                  <TableCell className="font-medium">{r.label}</TableCell>
                  <TableCell className="text-right tabular-nums">{nf(r.students)}</TableCell>
                  <TableCell className="text-right tabular-nums">{nf(r.with_cgpa)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt2(r.avg)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt2(r.max)}</TableCell>
                  <TableCell className="text-right tabular-nums">{nf(r.backlogs)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </InsightsPanel>
        <InsightsPanel title="Top performers" subtitle="Highest CGPA in scope">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Batch</TableHead>
                <TableHead className="text-right">CGPA</TableHead>
                <TableHead className="text-right">Sems</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.top_performers.map((s) => (
                <TableRow key={s.student_id}>
                  <TableCell>
                    <span className="block">{s.display_name}</span>
                    <span className="font-mono text-xs text-muted-foreground">{s.roll_no}</span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{batchLabel(scope.batchById.get(s.pay_id))}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{fmt2(s.cgpa)}</TableCell>
                  <TableCell className="text-right tabular-nums">{s.semesters_count}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </InsightsPanel>
      </div>
    </div>
  )
}

const BAND_LABEL: Record<string, string> = {
  critical: 'Below 50%',
  low: '50–65%',
  condonation: '65–75%',
  ok: '75–85%',
  good: '85% and above',
}

// --- backlogs -----------------------------------------------------------------

function BacklogsTab({ qs, scope }: { qs: string; scope: Scope }) {
  const [min, setMin] = useUrlState('min_backlogs', 1, parseMin, url.intOut)
  const [q, setQ] = useState('')
  const full = `${qs}&min_backlogs=${min}`
  const { data, loading, error } = useInsightsQuery(`rbacklogs|${full}`, () => fetchResultsBacklogs(full), 'Could not load the backlog list.')
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return (data?.rows ?? [])
      .map((r) => ({ ...r, batch: batchLabel(scope.batchById.get(r.pay_id)) }))
      .filter((r) => !needle || r.display_name.toLowerCase().includes(needle) || r.roll_no.toLowerCase().includes(needle) || r.batch.toLowerCase().includes(needle))
  }, [data, q, scope.batchById])
  return (
    <div className="space-y-3 pb-4">
      <TabToolbar
        end={
          <ExportButton
            disabled={rows.length === 0}
            onClick={() =>
              downloadCsv('insights-backlogs', ['Roll no', 'Student', 'Batch', 'CGPA', 'Current backlogs', 'Ever had a backlog', 'Semesters', 'Worst semester'],
                rows.map((r) => [r.roll_no, r.display_name, r.batch, r.cgpa ?? '', r.current_backlogs, r.backlog_history ? 'yes' : 'no', r.semesters_count, r.worst_semester ?? '']))
            }
          />
        }
      >
        <SearchField value={q} onChange={setQ} placeholder="Search name, roll no, batch…" label="Search students" />
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          At least
          <Segmented
            size="sm"
            value={String(min)}
            onChange={(v) => setMin(Number(v))}
            options={[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: String(n) }))}
            aria-label="Minimum current backlogs"
          />
          backlogs
        </span>
      </TabToolbar>
      {loading ? (
        <TableSkeleton cols={7} rows={12} />
      ) : error ? (
        <EmptyNote>{error}</EmptyNote>
      ) : !data || rows.length === 0 ? (
        <EmptyNote>No student carries {min} or more current backlogs in this scope.</EmptyNote>
      ) : (
        <Expandable>        <ResultCard scroll={false} summary={<StripStat value={`${nf(data.total)} students${data.total > rows.length ? ` (showing ${nf(rows.length)})` : ''}`} />}>
          <Table containerClassName={RESULT_SCROLL}>
            <TableHeader className="sticky top-0 z-10 bg-background">
              <TableRow>
                <TableHead className="w-28">Roll no</TableHead>
                <TableHead>Student</TableHead>
                <TableHead>Batch</TableHead>
                <TableHead className="text-right">CGPA</TableHead>
                <TableHead className="text-right">Backlogs</TableHead>
                <TableHead className="text-right">Worst sem</TableHead>
                <TableHead>History</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.student_id}>
                  <TableCell className="font-mono text-xs">{r.roll_no}</TableCell>
                  <TableCell>{r.display_name}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.batch}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt2(r.cgpa)}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums text-icon-rose">{r.current_backlogs}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.worst_semester ?? '—'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.backlog_history ? 'Had backlogs before' : '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ResultCard>        </Expandable>
      )}
    </div>
  )
}

// --- coverage -----------------------------------------------------------------

function CoverageTab({ qs, scope }: { qs: string; scope: Scope }) {
  const { data, loading, error } = useInsightsQuery(`rcoverage|${qs}`, () => fetchResultsCoverage(qs), 'Could not load coverage.')
  const grid = useMemo(() => {
    const byPay = new Map<number, Map<number, CoverageRow>>()
    for (const r of data?.rows ?? []) {
      const m = byPay.get(r.pay_id) ?? new Map<number, CoverageRow>()
      m.set(r.sem_number, r)
      byPay.set(r.pay_id, m)
    }
    return byPay
  }, [data])
  if (loading) return <TableSkeleton cols={9} rows={8} />
  if (error) return <EmptyNote>{error}</EmptyNote>
  if (!data || grid.size === 0) return <EmptyNote>No programme semesters in scope.</EmptyNote>
  const gaps = data.rows.filter((r) => r.gap).length
  return (
    <div className="space-y-3 pb-4">
      {gaps > 0 && (
        <Note tone="amber">
          {nf(gaps)} completed {gaps === 1 ? 'semester has' : 'semesters have'} no results uploaded — highlighted below.
        </Note>
      )}
      <Expandable>      <ResultCard scroll={false} footnote="Each cell is students with results / students in the batch. Grey = semester not started, amber = completed but nothing uploaded.">
        <Table containerClassName={RESULT_SCROLL}>
          <TableHeader className="sticky top-0 z-10 bg-background">
            <TableRow>
              <TableHead>Batch</TableHead>
              {Array.from({ length: 8 }, (_, i) => (
                <TableHead key={i} className="text-center">S{i + 1}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...grid.entries()].map(([payId, sems]) => {
              const b = scope.batchById.get(payId)
              return (
                <TableRow key={payId}>
                  <TableCell className="font-medium">{batchLabel(b)}</TableCell>
                  {Array.from({ length: 8 }, (_, i) => {
                    const c = sems.get(i + 1)
                    if (!c) return <TableCell key={i} className="text-center text-xs text-muted-foreground">·</TableCell>
                    return (
                      <TableCell
                        key={i}
                        className={cn(
                          'text-center text-xs tabular-nums',
                          c.gap && 'bg-icon-amber/15 text-icon-amber',
                          c.status === 'upcoming' && 'text-muted-foreground',
                          c.students_with_results > 0 && 'text-foreground',
                        )}
                        title={`${c.status}${c.computed_at ? ` · uploaded ${c.computed_at.slice(0, 10)}` : ''}`}
                      >
                        {c.status === 'upcoming' && c.students_with_results === 0 ? '—' : `${nf(c.students_with_results)}/${nf(c.students)}`}
                      </TableCell>
                    )
                  })}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </ResultCard>      </Expandable>
    </div>
  )
}
