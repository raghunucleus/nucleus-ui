import {
  Award,
  Briefcase,
  Building2,
  Filter,
  TrendingUp,
  UserX,
  Users,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
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
import { RESULT_SCROLL } from '@/components/employee/attendance-analytics/format'
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
  SERIES,
  fmt2,
  fmtLpa,
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
import { FacetMenu } from '@/components/ui/facet-menu'
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
  fetchPlacementsCompanies,
  fetchPlacementsFunnel,
  fetchPlacementsSummary,
  fetchPlacementsTrend,
  fetchPlacementsUnplaced,
  scopeQs,
} from '@/lib/insights'
import { cn } from '@/lib/utils'

const KEY = INSIGHTS_KEYS.placements

const TABS: TabDef[] = [
  { key: 'summary', label: 'Summary', icon: Briefcase },
  { key: 'funnel', label: 'Funnel', icon: Filter },
  { key: 'companies', label: 'Companies', icon: Building2 },
  { key: 'trend', label: 'Trend', icon: TrendingUp },
  { key: 'unplaced', label: 'Unplaced', icon: UserX },
]
const TAB_KEYS = TABS.map((t) => t.key)
const parseGroupBy = url.word<GroupBy>(['department', 'programme', 'batch'])

type Scope = ReturnType<typeof useInsightsScope>

/**
 * Placement outcomes over the scope, keyed by passout year. Only Selected
 * rows are outcomes; CTC is what was offered to the student, never the drive's
 * advertised band — the same rules as the coordinator's batch analytics.
 */
export default function EmployeeInsightsPlacementsPage() {
  const access = useScreenAccess(KEY)
  const scope = useInsightsScope(KEY)
  const [tab, setTab] = useInsightsTab('nucleus.insights.placements.tab', 'summary', TAB_KEYS)
  const [years, setYears] = useUrlState<number[]>('passout_years', [], url.idList, url.idListOut)
  const [groupBy, setGroupBy] = useUrlState<GroupBy>('group_by', 'batch', parseGroupBy, url.wordOut)

  useEffect(() => {
    document.title = 'Placement Insights — Nucleus'
  }, [])

  const yearOptions = useMemo(() => {
    const counts = new Map<number, number>()
    for (const b of scope.batches) {
      counts.set(b.passout_year, (counts.get(b.passout_year) ?? 0) + 1)
    }
    return [...counts.entries()]
      .sort(([a], [b]) => b - a)
      .map(([y, n]) => ({
        id: y,
        name: String(y),
        hint: `${n} ${n === 1 ? 'batch' : 'batches'}`,
      }))
  }, [scope.batches])
  const validYears = useMemo(
    () => years.filter((y) => yearOptions.some((o) => o.id === y)),
    [years, yearOptions],
  )
  const qs = useMemo(
    () => scopeQs(scope.sel, { passout_years: validYears.join(',') || undefined }),
    [scope.sel, validYears],
  )
  const ready = scope.tree !== null && scope.batches.length > 0

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
        title="Placement Insights"
        scope={scope}
        screenKey={KEY}
        route="/insights/placements"
        summary={[
          validYears.length ? `Passout ${validYears.join(', ')}` : 'All passout years',
          tab === 'summary' ? `By ${groupBy}` : '',
        ]
          .filter(Boolean)
          .join(' · ')}
        activeExtras={(validYears.length ? 1 : 0) + (groupBy !== 'batch' ? 1 : 0)}
        tabs={<TabsBar tabs={TABS} value={tab} onChange={setTab} className="border-b-0" />}
        controls={
          <>
            {yearOptions.length > 1 && (
              <FacetMenu
                label="Passout years"
                options={yearOptions}
                selected={validYears}
                onChange={setYears}
                searchPlaceholder="Search years…"
                size="sm"
              />
            )}
            {tab === 'summary' && (
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
      {scope.tree && scope.batches.length === 0 && <EmptyNote>No batches fall inside your scope.</EmptyNote>}
      {ready && (
        <div className="space-y-3">
          {tab === 'summary' && <SummaryTab qs={qs} scope={scope} groupBy={groupBy} />}
          {tab === 'funnel' && <FunnelTab qs={qs} />}
          {tab === 'companies' && <CompaniesTab qs={qs} />}
          {tab === 'trend' && <TrendTab qs={qs} />}
          {tab === 'unplaced' && <UnplacedTab qs={qs} scope={scope} />}
        </div>
      )}
    </div>
  )
}

// --- summary ------------------------------------------------------------------

function SummaryTab({ qs, scope, groupBy }: { qs: string; scope: Scope; groupBy: GroupBy }) {
  const { data, loading, error } = useInsightsQuery(`psummary|${qs}`, () => fetchPlacementsSummary(qs), 'Could not load the placement summary.')
  const rows = useMemo(() => {
    type Agg = { key: string; label: string; cohort: number; eligible: number; placed: number; offers: number; ft: number; intern: number; multi: number; ctcSum: number; ctcN: number; highest: number | null; median: number | null; single: boolean }
    const agg = new Map<string, Agg>()
    for (const r of data?.rows ?? []) {
      const b = scope.batchById.get(r.pay_id)
      if (!b) continue
      const k = `${groupKeyOf(groupBy, b)}|${r.passout_year ?? ''}`
      const a = agg.get(k) ?? { key: k, label: `${groupLabelOf(groupBy, b)}${groupBy === 'batch' ? '' : ` · ${r.passout_year ?? '—'}`}`, cohort: 0, eligible: 0, placed: 0, offers: 0, ft: 0, intern: 0, multi: 0, ctcSum: 0, ctcN: 0, highest: null, median: r.median_ctc, single: true }
      if (agg.has(k)) a.single = false
      a.cohort += r.cohort
      a.eligible += r.eligible
      a.placed += r.placed
      a.offers += r.offers
      a.ft += r.full_time_offers
      a.intern += r.internship_offers
      a.multi += r.multi_offer_students
      if (r.avg_ctc !== null) {
        a.ctcSum += r.avg_ctc * r.full_time_offers
        a.ctcN += r.full_time_offers
      }
      a.highest = r.highest_ctc === null ? a.highest : Math.max(a.highest ?? 0, r.highest_ctc)
      agg.set(k, a)
    }
    return [...agg.values()].map((a) => ({ ...a, avg: a.ctcN ? a.ctcSum / a.ctcN : null, pct: a.eligible ? Math.round((a.placed / a.eligible) * 100) : 0 })).sort((x, y) => x.label.localeCompare(y.label))
  }, [data, scope.batchById, groupBy])

  if (loading) return <KpiSkeleton />
  if (error) return <EmptyNote>{error}</EmptyNote>
  if (!data || rows.length === 0) return <EmptyNote>No students in this scope.</EmptyNote>
  const t = rows.reduce(
    (acc, r) => ({ cohort: acc.cohort + r.cohort, eligible: acc.eligible + r.eligible, placed: acc.placed + r.placed, offers: acc.offers + r.offers, highest: Math.max(acc.highest, r.highest ?? 0), ctcSum: acc.ctcSum + r.ctcSum, ctcN: acc.ctcN + r.ctcN }),
    { cohort: 0, eligible: 0, placed: 0, offers: 0, highest: 0, ctcSum: 0, ctcN: 0 },
  )
  return (
    <div className="space-y-4 pb-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile icon={Briefcase} color="var(--color-icon-cyan)" label="Placed" value={t.eligible ? `${Math.round((t.placed / t.eligible) * 100)}%` : '—'} sub={`${nf(t.placed)} of ${nf(t.eligible)} eligible (${nf(t.cohort)} in cohort)`} highlight />
        <KpiTile icon={Award} color="var(--color-icon-emerald)" label="Offers" value={nf(t.offers)} sub={`${nf(rows.reduce((a, r) => a + r.multi, 0))} students with more than one`} />
        <KpiTile icon={TrendingUp} color="var(--color-icon-violet)" label="Average CTC" value={t.ctcN ? fmtLpa(t.ctcSum / t.ctcN) : '—'} sub="Full-time offers" />
        <KpiTile icon={Users} color="var(--color-icon-amber)" label="Highest CTC" value={t.highest ? fmtLpa(t.highest) : '—'} sub="Across the scope" />
      </div>
      <InsightsPanel title="Placed percentage" subtitle="Of eligible students, per group and passout year">
        <ChartBox height={Math.max(200, rows.length * 26)}>
          <BarChart data={rows.map((r) => ({ name: r.label, pct: r.pct }))} layout="vertical" margin={{ left: 8, right: 24 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
            <XAxis type="number" domain={[0, 100]} unit="%" tick={AXIS_TICK} />
            <YAxis type="category" dataKey="name" tick={AXIS_TICK} width={140} />
            <Tooltip contentStyle={TOOLTIP_STYLE} cursor={false} formatter={(v) => [`${Number(v ?? 0)}%`, 'Placed']} />
            <Bar dataKey="pct" name="Placed" fill="var(--color-icon-cyan)" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ChartBox>
      </InsightsPanel>
      <Expandable>      <ResultCard scroll={false} summary={<StripStat value={`${nf(rows.length)} rows`} />} footnote="Median CTC is shown only for single-batch rows — a median cannot be combined across batches.">
        <Table containerClassName={RESULT_SCROLL}>
          <TableHeader className="sticky top-0 z-10 bg-background">
            <TableRow>
              <TableHead>Group</TableHead>
              <TableHead className="text-right">Cohort</TableHead>
              <TableHead className="text-right">Eligible</TableHead>
              <TableHead className="text-right">Placed</TableHead>
              <TableHead className="text-right">Placed %</TableHead>
              <TableHead className="text-right">Offers</TableHead>
              <TableHead className="text-right">Full-time</TableHead>
              <TableHead className="text-right">Intern</TableHead>
              <TableHead className="text-right">Avg CTC</TableHead>
              <TableHead className="text-right">Median</TableHead>
              <TableHead className="text-right">Highest</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.key}>
                <TableCell className="font-medium">{r.label}</TableCell>
                <TableCell className="text-right tabular-nums">{nf(r.cohort)}</TableCell>
                <TableCell className="text-right tabular-nums">{nf(r.eligible)}</TableCell>
                <TableCell className="text-right tabular-nums">{nf(r.placed)}</TableCell>
                <TableCell className="text-right font-medium tabular-nums">{r.pct}%</TableCell>
                <TableCell className="text-right tabular-nums">{nf(r.offers)}</TableCell>
                <TableCell className="text-right tabular-nums">{nf(r.ft)}</TableCell>
                <TableCell className="text-right tabular-nums">{nf(r.intern)}</TableCell>
                <TableCell className="text-right tabular-nums">{fmt2(r.avg)}</TableCell>
                <TableCell className="text-right tabular-nums">{r.single ? fmt2(r.median) : '—'}</TableCell>
                <TableCell className="text-right tabular-nums">{fmt2(r.highest)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ResultCard>      </Expandable>
    </div>
  )
}

// --- funnel -------------------------------------------------------------------

function FunnelTab({ qs }: { qs: string }) {
  const { data, loading, error } = useInsightsQuery(`pfunnel|${qs}`, () => fetchPlacementsFunnel(qs), 'Could not load the funnel.')
  if (loading) return <KpiSkeleton />
  if (error) return <EmptyNote>{error}</EmptyNote>
  if (!data || data.totals.imported === 0) return <EmptyNote>No drive participation in this scope.</EmptyNote>
  const rates: Array<[string, number, string]> = [
    ['Invited of imported', data.rates.invite_rate, 'invite rate'],
    ['Responded to invite', data.rates.response_rate, 'response rate'],
    ['Accepted of responded', data.rates.acceptance_rate, 'acceptance'],
    ['No-shows of accepted', data.rates.no_show_rate, 'no-show rate'],
    ['Selected of attended', data.rates.selection_rate, 'selection rate'],
    ['Selected of invited', data.rates.offer_yield, 'offer yield'],
  ]
  return (
    <div className="space-y-4 pb-4">
      <Note>
        {nf(data.drives)} drives · {nf(data.totals.awaiting_response)} invites awaiting a response · {nf(data.totals.revoked)} revoked
      </Note>
      <div className="grid gap-4 lg:grid-cols-2">
        <InsightsPanel title="Funnel" subtitle="Every drive participation of the scope, aggregated">
          <ChartBox height={260}>
            <BarChart data={data.stages} layout="vertical" margin={{ left: 8, right: 32 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
              <XAxis type="number" tick={AXIS_TICK} allowDecimals={false} />
              <YAxis type="category" dataKey="label" tick={AXIS_TICK} width={80} />
              <Tooltip contentStyle={TOOLTIP_STYLE} cursor={false} />
              <Bar dataKey="count" name="Participations" fill="var(--color-icon-cyan)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ChartBox>
        </InsightsPanel>
        <InsightsPanel title="Rates">
          <div className="grid gap-3 sm:grid-cols-2">
            {rates.map(([label, v, sub]) => (
              <div key={label} className="rounded-lg border p-3">
                <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
                <p className="mt-1 text-xl font-bold tabular-nums">{v}%</p>
                <p className="text-xs text-muted-foreground">{sub}</p>
              </div>
            ))}
          </div>
        </InsightsPanel>
      </div>
    </div>
  )
}

// --- companies ----------------------------------------------------------------

function CompaniesTab({ qs }: { qs: string }) {
  const { data, loading, error } = useInsightsQuery(`pcompanies|${qs}`, () => fetchPlacementsCompanies(qs), 'Could not load companies.')
  if (loading) return <TableSkeleton cols={5} rows={10} />
  if (error) return <EmptyNote>{error}</EmptyNote>
  const rows = data?.rows ?? []
  if (rows.length === 0) return <EmptyNote>No selections in this scope yet.</EmptyNote>
  return (
    <div className="space-y-3 pb-4">
      <TabToolbar end={<ExportButton onClick={() => downloadCsv('insights-companies', ['Company', 'Students placed', 'Offers', 'Max CTC', 'Avg CTC'], rows.map((r) => [r.company_name, r.students_placed, r.offers, r.max_ctc ?? '', r.avg_ctc ?? '']))} />} />
      <Expandable>      <ResultCard scroll={false} summary={<StripStat value={`${nf(rows.length)} companies, most students placed first`} />}>
        <Table containerClassName={RESULT_SCROLL}>
          <TableHeader className="sticky top-0 z-10 bg-background">
            <TableRow>
              <TableHead>Company</TableHead>
              <TableHead className="text-right">Students placed</TableHead>
              <TableHead className="text-right">Offers</TableHead>
              <TableHead className="text-right">Max CTC</TableHead>
              <TableHead className="text-right">Avg CTC</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.company_id}>
                <TableCell className="font-medium">{r.company_name}</TableCell>
                <TableCell className="text-right tabular-nums">{nf(r.students_placed)}</TableCell>
                <TableCell className="text-right tabular-nums">{nf(r.offers)}</TableCell>
                <TableCell className="text-right tabular-nums">{fmt2(r.max_ctc)}</TableCell>
                <TableCell className="text-right tabular-nums">{fmt2(r.avg_ctc)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ResultCard>      </Expandable>
    </div>
  )
}

// --- trend --------------------------------------------------------------------

function TrendTab({ qs }: { qs: string }) {
  const { data, loading, error } = useInsightsQuery(`ptrend|${qs}`, () => fetchPlacementsTrend(qs), 'Could not load the trend.')
  const series = useMemo(() => {
    const years = [...new Set((data?.rows ?? []).map((r) => r.passout_year ?? 0))].sort()
    const months = [...new Set((data?.rows ?? []).map((r) => r.month))].sort()
    const cum = new Map<number, number>()
    const points = months.map((m) => {
      const p: Record<string, number | string> = { month: m }
      for (const y of years) {
        const hit = (data?.rows ?? []).find((r) => (r.passout_year ?? 0) === y && r.month === m)
        cum.set(y, (cum.get(y) ?? 0) + (hit?.placed_students ?? 0))
        p[String(y)] = cum.get(y) ?? 0
      }
      return p
    })
    return { years, points }
  }, [data])
  if (loading) return <KpiSkeleton />
  if (error) return <EmptyNote>{error}</EmptyNote>
  if (!data || series.points.length === 0) return <EmptyNote>No dated selections in this scope.</EmptyNote>
  return (
    <div className="space-y-4 pb-4">
      <InsightsPanel title="Cumulative students placed" subtitle="Per passout year, by the month the outcome was recorded">
        <ChartBox height={280}>
          <LineChart data={series.points}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey="month" tick={AXIS_TICK} minTickGap={24} />
            <YAxis tick={AXIS_TICK} allowDecimals={false} width={40} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            {series.years.length > 1 && <Legend />}
            {series.years.map((y, i) => (
              <Line key={y} type="monotone" dataKey={String(y)} name={`${y} batch`} stroke={SERIES[i % SERIES.length]} strokeWidth={2} dot={false} />
            ))}
          </LineChart>
        </ChartBox>
      </InsightsPanel>
    </div>
  )
}

// --- unplaced -----------------------------------------------------------------

function UnplacedTab({ qs, scope }: { qs: string; scope: Scope }) {
  const { data, loading, error } = useInsightsQuery(`punplaced|${qs}`, () => fetchPlacementsUnplaced(qs), 'Could not load the unplaced list.')
  const [q, setQ] = useState('')
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
            onClick={() => downloadCsv('insights-unplaced', ['Roll no', 'Student', 'Batch', 'Passout', 'CGPA', 'Backlogs', 'Drives invited', 'Drives attended', 'Last activity'], rows.map((r) => [r.roll_no, r.display_name, r.batch, r.passout_year ?? '', r.cgpa ?? '', r.current_backlogs, r.drives_invited, r.drives_attended, r.last_activity?.slice(0, 10) ?? '']))}
          />
        }
      >
        <SearchField value={q} onChange={setQ} placeholder="Search name, roll no, batch…" label="Search students" />
      </TabToolbar>
      {loading ? (
        <TableSkeleton cols={8} rows={12} />
      ) : error ? (
        <EmptyNote>{error}</EmptyNote>
      ) : !data || rows.length === 0 ? (
        <EmptyNote>Every eligible student in this scope has a selection.</EmptyNote>
      ) : (
        <Expandable>        <ResultCard scroll={false} summary={<StripStat value={`${nf(data.total)} eligible students without a selection${data.total > rows.length ? ` (showing ${nf(rows.length)})` : ''}`} />} footnote="Eligible = allowed by the department and interested in placements. Best CGPA first.">
          <Table containerClassName={RESULT_SCROLL}>
            <TableHeader className="sticky top-0 z-10 bg-background">
              <TableRow>
                <TableHead className="w-28">Roll no</TableHead>
                <TableHead>Student</TableHead>
                <TableHead>Batch</TableHead>
                <TableHead className="text-right">Passout</TableHead>
                <TableHead className="text-right">CGPA</TableHead>
                <TableHead className="text-right">Backlogs</TableHead>
                <TableHead className="text-right">Invited</TableHead>
                <TableHead className="text-right">Attended</TableHead>
                <TableHead className="text-right">Last activity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.student_id}>
                  <TableCell className="font-mono text-xs">{r.roll_no}</TableCell>
                  <TableCell>{r.display_name}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.batch}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.passout_year ?? '—'}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt2(r.cgpa)}</TableCell>
                  <TableCell className={cn('text-right tabular-nums', r.current_backlogs > 0 && 'text-icon-rose')}>{r.current_backlogs}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.drives_invited}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.drives_attended}</TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">{r.last_activity?.slice(0, 10) ?? '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ResultCard>        </Expandable>
      )}
    </div>
  )
}
