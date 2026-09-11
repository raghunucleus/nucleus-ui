import { Search, Users } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
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
  EmptyNote,
  KpiSkeleton,
} from '@/components/employee/attendance-analytics/ui'
import { NoAccessEmptyState } from '@/components/employee/empty-states'
import {
  ChartBox,
  InsightsHeader,
  InsightsPanel,
} from '@/components/employee/insights/bits'
import {
  nf,
  useInsightsQuery,
  useInsightsTab,
} from '@/components/employee/insights/insights-utils'
import {
  batchLabel,
  useInsightsScope,
} from '@/components/employee/insights/use-insights-scope'
import { StudentSearchPanel } from '@/components/employee/student-search/student-search-panel'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useScreenAccess } from '@/hooks/use-screen-access'
import { apiFetch } from '@/lib/api'
import { withEmployeeAuth } from '@/lib/employee-auth'
import { INSIGHTS_KEYS, fetchDemographics, scopeQs } from '@/lib/insights'
import type {
  ExportFormat,
  FkOption,
  ParsedNql,
  SearchMeta,
  StudentSearchApi,
  StudentSearchBody,
  StudentSearchResult,
} from '@/lib/student-search'

const KEY = INSIGHTS_KEYS.students

const TABS: TabDef[] = [
  { key: 'demographics', label: 'Composition', icon: Users },
  { key: 'explorer', label: 'Cohort explorer', icon: Search },
]
const TAB_KEYS = TABS.map((t) => t.key)
const HIDE_COLUMNS = ['id']
const ROOT = '/employee/insights/students'

/** The student-query panel bound to the insights endpoints for one scope string. */
function insightsSearchApi(qs: string): StudentSearchApi {
  const suffix = qs ? `?${qs}` : ''
  return {
    meta: () => withEmployeeAuth((token) => apiFetch<SearchMeta>(`${ROOT}/search/meta`, { token })),
    search: (body: StudentSearchBody) =>
      withEmployeeAuth((token) => apiFetch<StudentSearchResult>(`${ROOT}/search${suffix}`, { method: 'POST', body, token })),
    options: (lookup: string, q?: string) => {
      const p = new URLSearchParams({ lookup })
      if (q) p.set('q', q)
      return withEmployeeAuth((token) => apiFetch<FkOption[]>(`${ROOT}/search/options?${p}`, { token }))
    },
    parseNql: (nql: string) =>
      withEmployeeAuth((token) => apiFetch<ParsedNql>(`${ROOT}/search/parse-nql`, { method: 'POST', body: { nql }, token })),
    createExport: (body: StudentSearchBody, format: ExportFormat) =>
      withEmployeeAuth((token) => apiFetch<{ job_id: number }>(`${ROOT}/export${suffix}`, { method: 'POST', body: { ...body, format }, token })),
  }
}

/**
 * Cohort composition over the scope, plus the registry-driven cohort explorer
 * (the same panel as the student directory) scoped to it — so an HOD can ask
 * "CGPA below 6 and attendance below 75" and export the answer.
 */
export default function EmployeeInsightsStudentsPage() {
  const access = useScreenAccess(KEY)
  const scope = useInsightsScope(KEY)
  const [tab, setTab] = useInsightsTab('nucleus.insights.students.tab', 'demographics', TAB_KEYS)

  useEffect(() => {
    document.title = 'Student Insights — Nucleus'
  }, [])

  const qs = useMemo(() => scopeQs(scope.sel), [scope.sel])
  // The panel boots on `api` identity, so one adapter per scope string.
  const api = useMemo(() => insightsSearchApi(qs), [qs])
  const ready = scope.tree !== null && scope.batches.length > 0

  if (!access) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <NoAccessEmptyState />
      </div>
    )
  }

  return (
    <div className="mx-auto flex h-full max-w-7xl flex-col gap-4">
      <InsightsHeader
        title="Student Insights"
        scope={scope}
        screenKey={KEY}
        route="/insights/students"
        tabs={<TabBar tabs={TABS} active={tab} onChange={setTab} size="sm" className="border-b-0" />}
      />
      {scope.error && <EmptyNote>{scope.error}</EmptyNote>}
      {scope.tree && scope.batches.length === 0 && <EmptyNote>No batches fall inside your scope.</EmptyNote>}
      {ready && tab === 'demographics' && <DemographicsTab qs={qs} scope={scope} />}
      {ready && tab === 'explorer' && (
        <div className="min-h-0 flex-1 pb-4">
          <StudentSearchPanel
            key={qs}
            api={api}
            showFilterHelp
            hideColumns={HIDE_COLUMNS}
            stickyColumn="student_id"
          />
        </div>
      )}
    </div>
  )
}

function DemographicsTab({ qs, scope }: { qs: string; scope: ReturnType<typeof useInsightsScope> }) {
  const { data, loading, error } = useInsightsQuery(`demo|${qs}`, () => fetchDemographics(qs), 'Could not load the composition.')
  const rows = useMemo(
    () => (data?.by_batch ?? []).map((r) => ({ ...r, label: batchLabel(scope.batchById.get(r.pay_id)) })),
    [data, scope.batchById],
  )
  if (loading) return <KpiSkeleton />
  if (error) return <EmptyNote>{error}</EmptyNote>
  if (!data || rows.length === 0) return <EmptyNote>No students in this scope.</EmptyNote>
  const sum = (k: keyof (typeof rows)[number]) => rows.reduce((a, r) => a + (Number(r[k]) || 0), 0)
  const total = sum('total')
  const pctOf = (n: number) => (total ? Math.round((n / total) * 100) : 0)
  const completeness: Array<[string, number]> = [
    ['Guardian linked', sum('with_guardian')],
    ['Photo', sum('with_photo')],
    ['Aadhaar', sum('with_aadhaar')],
    ['Resume', sum('with_resume')],
    ['ABC id', sum('with_abc_id')],
    ['Personal email', sum('with_personal_email')],
  ]
  return (
    <div className="space-y-4 pb-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile icon={Users} color="var(--color-icon-cyan)" label="Active students" value={nf(total)} sub={`${nf(sum('inactive'))} inactive`} highlight />
        <KpiTile icon={Users} color="var(--color-icon-violet)" label="Female" value={`${pctOf(sum('female'))}%`} sub={`${nf(sum('female'))} students`} />
        <KpiTile icon={Users} color="var(--color-icon-amber)" label="Lateral entry" value={`${pctOf(sum('lateral'))}%`} sub={`${nf(sum('lateral'))} students`} />
        <KpiTile icon={Users} color="var(--color-icon-emerald)" label="Guardian linked" value={`${pctOf(sum('with_guardian'))}%`} sub="Parent login possible" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <InsightsPanel title="Gender by batch">
          <ChartBox height={Math.max(200, rows.length * 24)}>
            <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
              <XAxis type="number" tick={AXIS_TICK} allowDecimals={false} />
              <YAxis type="category" dataKey="label" tick={AXIS_TICK} width={110} />
              <Tooltip contentStyle={TOOLTIP_STYLE} cursor={false} />
              <Legend />
              <Bar dataKey="male" name="Male" stackId="g" fill="var(--color-icon-blue)" />
              <Bar dataKey="female" name="Female" stackId="g" fill="var(--color-icon-violet)" />
              <Bar dataKey="other" name="Other" stackId="g" fill="var(--color-icon-amber)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ChartBox>
        </InsightsPanel>
        <InsightsPanel title="Profile completeness" subtitle="Share of active students with each item">
          <div className="space-y-2">
            {completeness.map(([label, n]) => (
              <div key={label} className="flex items-center gap-3 text-sm">
                <span className="w-32 text-xs text-muted-foreground">{label}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-sm bg-muted">
                  <span className="block h-full bg-icon-emerald" style={{ width: `${pctOf(n)}%` }} />
                </span>
                <span className="w-16 text-right text-xs tabular-nums">{pctOf(n)}%</span>
              </div>
            ))}
          </div>
        </InsightsPanel>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <InsightsPanel title="By batch">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Batch</TableHead>
                <TableHead className="text-right">Active</TableHead>
                <TableHead className="text-right">Inactive</TableHead>
                <TableHead className="text-right">Regular</TableHead>
                <TableHead className="text-right">Lateral</TableHead>
                <TableHead className="text-right">Resume</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.pay_id}>
                  <TableCell className="font-medium">{r.label}</TableCell>
                  <TableCell className="text-right tabular-nums">{nf(r.total)}</TableCell>
                  <TableCell className="text-right tabular-nums">{nf(r.inactive)}</TableCell>
                  <TableCell className="text-right tabular-nums">{nf(r.regular)}</TableCell>
                  <TableCell className="text-right tabular-nums">{nf(r.lateral)}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.total ? Math.round((r.with_resume / r.total) * 100) : 0}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </InsightsPanel>
        <InsightsPanel title="Home districts" subtitle="Where students come from">
          {data.districts.length === 0 ? (
            <EmptyNote>No home district recorded yet.</EmptyNote>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>District</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead className="text-right">Students</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.districts.map((d) => (
                  <TableRow key={`${d.state}|${d.district}`}>
                    <TableCell>{d.district}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{d.state}</TableCell>
                    <TableCell className="text-right tabular-nums">{nf(d.students)}</TableCell>
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
