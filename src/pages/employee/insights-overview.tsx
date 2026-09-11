import {
  AlertTriangle,
  Award,
  Briefcase,
  ClipboardCheck,
  ClipboardList,
  Columns3,
  GraduationCap,
  LayoutGrid,
  Percent,
  Users,
} from 'lucide-react'
import { useEffect } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { TabsBar, type TabDef } from '@/components/ui/tabs-bar'
import {
  AXIS_TICK,
  TOOLTIP_STYLE,
} from '@/components/drive-management/chart-chrome'
import { KpiTile } from '@/components/drive-management/drive-analytics'
import {
  readStored,
  shortDay,
  writeStored,
} from '@/components/employee/attendance-analytics/format'
import {
  EmptyNote,
  KpiSkeleton,
} from '@/components/employee/attendance-analytics/ui'
import { NoAccessEmptyState } from '@/components/employee/empty-states'
import {
  AttentionFeed,
  ChartBox,
  DeltaChip,
  InsightsHeader,
  LockedKpi,
  Note,
  InsightsPanel,
} from '@/components/employee/insights/bits'
import { CompareTab } from '@/components/employee/insights/compare-tab'
import {
  parseCompare,
  serialiseCompare,
  type CompareEntity,
} from '@/components/employee/insights/compare-url'
import {
  fmt2,
  fmtPct,
  nf,
  useInsightsQuery,
  useInsightsTab,
  useUrlState,
} from '@/components/employee/insights/insights-utils'
import { useInsightsScope } from '@/components/employee/insights/use-insights-scope'
import { PinnedViewsStrip } from '@/components/employee/insights/views-menu'
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
import {
  INSIGHTS_KEYS,
  OVERVIEW_WINDOWS,
  fetchInsightsOverview,
  isLocked,
  scopeQs,
  type OverviewWindow,
} from '@/lib/insights'

const KEY = INSIGHTS_KEYS.overview
const ROUTE = '/insights'

const TABS: TabDef[] = [
  { key: 'summary', label: 'Summary', icon: LayoutGrid },
  { key: 'compare', label: 'Compare', icon: Columns3 },
]
const TAB_KEYS = TABS.map((t) => t.key)
const LS_COMPARE = 'nucleus.insights.compare'

const parseWindow = (raw: string): OverviewWindow | undefined =>
  raw === '7' || raw === '30' || raw === '90' ? (Number(raw) as OverviewWindow) : undefined
const windowOut = (v: OverviewWindow) => (v === 30 ? undefined : String(v))
const compareIn = (raw: string) => parseCompare(raw)
const compareOut = (v: CompareEntity[]) => serialiseCompare(v)

/**
 * The "what is happening" page. Summary: one scope bar, a KPI strip with
 * period-over-period deltas, the department comparison when the scope spans
 * several, the attention feed and two trends. Compare: up to four entities
 * side by side. A domain the caller's role doesn't grant renders as a locked
 * tile — the overview never leaks a screen they lack.
 */
export default function EmployeeInsightsOverviewPage() {
  const access = useScreenAccess(KEY)
  const scope = useInsightsScope(KEY)
  const [tab, setTab] = useInsightsTab('nucleus.insights.overview.tab', 'summary', TAB_KEYS)
  const [window, setWindow] = useUrlState<OverviewWindow>('window', 30, parseWindow, windowOut)
  const [compare, setCompareState] = useUrlState<CompareEntity[]>(
    'compare',
    parseCompare(readStored(LS_COMPARE) ?? '') ?? [],
    compareIn,
    compareOut,
  )
  const setCompare = (next: CompareEntity[]) => {
    setCompareState(next)
    writeStored(LS_COMPARE, serialiseCompare(next) ?? '')
  }

  useEffect(() => {
    document.title = 'Insights — Nucleus'
  }, [])

  const qs = scopeQs(scope.sel, { window })
  const { data, loading, error } = useInsightsQuery(
    `overview|${qs}`,
    () => fetchInsightsOverview(qs),
    'Could not load the overview.',
    scope.tree !== null && tab === 'summary',
  )

  if (!access) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <NoAccessEmptyState />
      </div>
    )
  }

  const windowControl = (
    <Segmented
      size="sm"
      value={String(window)}
      onChange={(v) => setWindow(Number(v) as OverviewWindow)}
      options={OVERVIEW_WINDOWS.map((w) => ({ value: String(w), label: `${w} days` }))}
      aria-label="Change window"
    />
  )

  const a = data?.attendance
  const r = data?.results
  const p = data?.placements
  const q = data?.requests
  const d = data?.deltas
  const vsPrior = `vs prior ${window} days`

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <InsightsHeader
        title="Insights"
        scope={scope}
        screenKey={KEY}
        route={ROUTE}
        hideScope={tab === 'compare'}
        summary={`Change vs prior ${window} days`}
        activeExtras={window === 30 ? 0 : 1}
        tabs={<TabsBar tabs={TABS} value={tab} onChange={setTab} className="border-b-0" />}
        controls={windowControl}
      />

      <PinnedViewsStrip />

      {scope.error && <EmptyNote>{scope.error}</EmptyNote>}
      {scope.tree && scope.batches.length === 0 && (
        <EmptyNote>
          No batches fall inside your scope yet. Ask an admin to check the
          departments and programmes on your role.
        </EmptyNote>
      )}

      {tab === 'compare' && scope.tree && (
        <CompareTab scope={scope} window={window} entities={compare} onChange={setCompare} />
      )}

      {tab === 'summary' && (loading || scope.loading) && !scope.error && <KpiSkeleton />}
      {tab === 'summary' && error && <EmptyNote>{error}</EmptyNote>}

      {tab === 'summary' && data && (
        <div className="space-y-4 pb-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {isLocked(a) ? (
              <LockedKpi label="Attendance" />
            ) : (
              <KpiTile
                icon={Percent}
                color="var(--color-icon-emerald)"
                label="Attendance"
                value={a && a.students > 0 ? fmtPct(a.pct) : '—'}
                sub={a ? `${nf(a.students)} students · ${nf(a.below_threshold)} below 75%` : 'No ongoing semester in scope'}
                highlight
                foot={a && <DeltaChip value={d?.attendance?.delta.pct} unit="pts" good="up" label={vsPrior} />}
              />
            )}
            {isLocked(a) ? (
              <LockedKpi label="Marking done" />
            ) : (
              <KpiTile
                icon={ClipboardCheck}
                color="var(--color-icon-violet)"
                label={`Marking done (${window} days)`}
                value={a ? fmtPct(a.compliance_pct) : '—'}
                sub={a ? (a.overdue_unmarked > 0 ? `${nf(a.overdue_unmarked)} past classes unmarked` : 'Every past class is marked') : 'No ongoing semester in scope'}
                foot={a && <DeltaChip value={d?.attendance?.delta.compliance_pct} unit="pts" good="up" label={vsPrior} />}
              />
            )}
            {isLocked(a) ? (
              <LockedKpi label="Below 65%" />
            ) : (
              <KpiTile
                icon={AlertTriangle}
                color="var(--color-icon-rose)"
                label="Below 65%"
                value={a ? nf(a.below_condonation) : '—'}
                sub="Students beyond the condonation band"
                foot={a && <DeltaChip value={d?.attendance?.delta.below_condonation} unit="n" good="down" label={`in the window, ${vsPrior}`} />}
              />
            )}
            {isLocked(r) ? (
              <LockedKpi label="Average CGPA" />
            ) : (
              <KpiTile
                icon={GraduationCap}
                color="var(--color-icon-blue)"
                label="Average CGPA"
                value={r ? fmt2(r.avg_cgpa) : '—'}
                sub={r ? `${nf(r.students_with_cgpa)} students with results` : 'No results in scope'}
                foot={r && <DeltaChip value={d?.results?.delta.avg_sgpa} unit="n" good="up" label={d?.results ? `SGPA, sem ${d.results.latest_semester} vs ${d.results.previous_semester}` : ''} />}
              />
            )}
            {isLocked(r) ? (
              <LockedKpi label="Backlogs" />
            ) : (
              <KpiTile
                icon={Award}
                color="var(--color-icon-orange)"
                label="With current backlogs"
                value={r ? nf(r.with_current_backlogs) : '—'}
                sub={r ? `${nf(r.with_backlog_history)} ever had a backlog` : 'No results in scope'}
                foot={r && <DeltaChip value={d?.results?.delta.with_backlogs} unit="n" good="down" label={d?.results ? `sem ${d.results.latest_semester} vs ${d.results.previous_semester}` : ''} />}
              />
            )}
            {isLocked(p) ? (
              <LockedKpi label="Placed" />
            ) : (
              <KpiTile
                icon={Briefcase}
                color="var(--color-icon-cyan)"
                label={p ? `Placed · ${p.passout_year} batch` : 'Placed'}
                value={p ? `${p.placed_pct}%` : '—'}
                sub={p ? `${nf(p.placed)} of ${nf(p.eligible)} eligible · ${nf(p.offers)} offers` : 'No passout cohort in scope'}
                foot={p && <DeltaChip value={d?.placements?.delta.placed_students} unit="n" good="up" label={`newly placed, ${vsPrior}`} />}
              />
            )}
            {isLocked(q) ? (
              <LockedKpi label="Pending approvals" />
            ) : (
              <KpiTile
                icon={ClipboardList}
                color="var(--color-icon-amber)"
                label="Pending approvals"
                value={q ? nf(q.pending) : '—'}
                sub={q ? `${nf(q.pending_over_7d)} waiting over a week` : 'No requests in scope'}
                foot={q && <DeltaChip value={d?.requests?.delta.raised} unit="n" good="down" label={`raised, ${vsPrior}`} />}
              />
            )}
            <KpiTile
              icon={Users}
              color="var(--color-icon-emerald)"
              label="Scope"
              value={nf(scope.batches.reduce((x, b) => x + b.student_count, 0))}
              sub={`${data.scope.batches} batches · ${data.scope.sections} sections`}
            />
          </div>

          {a && !isLocked(a) && <Note>{a.basis_note}</Note>}

          {data.by_department && data.by_department.length > 1 && (
            <InsightsPanel
              title="Department comparison"
              subtitle="Click a row to narrow every insights screen to that department"
            >
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Department</TableHead>
                    <TableHead className="text-right">Students</TableHead>
                    <TableHead className="text-right">Attendance</TableHead>
                    <TableHead className="text-right">Below 75%</TableHead>
                    <TableHead className="text-right">Marking done</TableHead>
                    <TableHead className="text-right">Avg CGPA</TableHead>
                    <TableHead className="text-right">With backlogs</TableHead>
                    <TableHead className="text-right">Placed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.by_department.map((row) => (
                    <TableRow
                      key={row.department_id}
                      className="cursor-pointer"
                      onClick={() =>
                        scope.setSel({
                          department_ids: [row.department_id],
                          programme_ids: [],
                          programme_admission_year_ids: [],
                          attendance_group_ids: [],
                        })
                      }
                    >
                      <TableCell>
                        <span className="font-medium">{row.code}</span>
                        <span className="ml-2 text-xs text-muted-foreground">{row.name}</span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{nf(row.students)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtPct(row.attendance_pct)}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.below_threshold_pct === null ? '—' : `${row.below_threshold_pct}%`}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtPct(row.compliance_pct)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmt2(row.avg_cgpa)}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.backlog_pct === null ? '—' : `${row.backlog_pct}%`}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.placed_pct === null ? '—' : `${row.placed_pct}%`}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </InsightsPanel>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <InsightsPanel title="Needs attention" subtitle="Ranked by urgency — each opens the screen that explains it">
              <AttentionFeed items={data.attention} />
            </InsightsPanel>

            <InsightsPanel title="Weekly attendance" subtitle="Percentage present per week, last twelve weeks (live scan)">
              {data.weekly_attendance.length === 0 ? (
                <EmptyNote>No marked classes in the last twelve weeks.</EmptyNote>
              ) : (
                <ChartBox height={220}>
                  <LineChart data={data.weekly_attendance}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="week" tick={AXIS_TICK} tickFormatter={shortDay} minTickGap={24} />
                    <YAxis tick={AXIS_TICK} domain={[0, 100]} unit="%" width={44} />
                    <Tooltip
                      contentStyle={TOOLTIP_STYLE}
                      labelFormatter={(l) => `Week of ${shortDay(String(l ?? ''))}`}
                      formatter={(v) => [fmtPct(Number(v ?? 0)), 'Present']}
                    />
                    <Line type="monotone" dataKey="pct" name="Present" stroke="var(--color-icon-emerald)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ChartBox>
              )}
            </InsightsPanel>
          </div>

          {p && !isLocked(p) && data.monthly_placements.length > 0 && (
            <InsightsPanel title={`Placements this year · ${p.passout_year} batch`} subtitle="Students selected per month">
              <ChartBox height={200}>
                <BarChart data={data.monthly_placements}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="month" tick={AXIS_TICK} />
                  <YAxis tick={AXIS_TICK} allowDecimals={false} width={32} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} cursor={false} />
                  <Bar dataKey="placed_students" name="Students placed" fill="var(--color-icon-cyan)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartBox>
            </InsightsPanel>
          )}
        </div>
      )}
    </div>
  )
}
