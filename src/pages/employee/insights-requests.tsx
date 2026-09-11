import {
  CalendarOff,
  Clock,
  Hourglass,
  Inbox,
  TrendingUp,
  UserCheck,
} from 'lucide-react'
import { useCallback, useEffect, useMemo } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
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
import { shortDay } from '@/components/employee/attendance-analytics/format'
import {
  EmptyNote,
  KpiSkeleton,
  TableSkeleton,
} from '@/components/employee/attendance-analytics/ui'
import { NoAccessEmptyState } from '@/components/employee/empty-states'
import {
  ChartBox,
  InsightsHeader,
  Note,
  InsightsPanel,
} from '@/components/employee/insights/bits'
import {
  fmtHours,
  nf,
  url,
  useInsightsQuery,
  useInsightsTab,
  useUrlState,
} from '@/components/employee/insights/insights-utils'
import {
  batchLabel,
  useInsightsScope,
} from '@/components/employee/insights/use-insights-scope'
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
import {
  INSIGHTS_KEYS,
  REQUEST_TYPE_LABEL,
  fetchRequestsLeaves,
  fetchRequestsSummary,
  scopeQs,
} from '@/lib/insights'
import { cn } from '@/lib/utils'

const KEY = INSIGHTS_KEYS.requests

const TABS: TabDef[] = [
  { key: 'pending', label: 'Pending', icon: Inbox },
  { key: 'turnaround', label: 'Turnaround', icon: Hourglass },
  { key: 'approvers', label: 'Approvers', icon: UserCheck },
  { key: 'trend', label: 'Trend', icon: TrendingUp },
  { key: 'leaves', label: 'Leave volume', icon: CalendarOff },
]
const TAB_KEYS = TABS.map((t) => t.key)

/**
 * Approval health for the scope's students: what is waiting and for how long,
 * how quickly decisions land, who holds the backlog, and how much leave is
 * taken. Pending is always "now"; the decided and raised views follow the
 * window (default: the last 90 days).
 */
export default function EmployeeInsightsRequestsPage() {
  const access = useScreenAccess(KEY)
  const scope = useInsightsScope(KEY)
  const [tab, setTab] = useInsightsTab('nucleus.insights.requests.tab', 'pending', TAB_KEYS)
  const [from, setFrom] = useUrlState('from', '', url.date, url.dateOut)
  const [to, setTo] = useUrlState('to', '', url.date, url.dateOut)

  useEffect(() => {
    document.title = 'Requests & Leaves Insights — Nucleus'
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
  const qs = useMemo(() => scopeQs(scope.sel, from && to ? { from, to } : {}), [scope.sel, from, to])
  const ready = scope.tree !== null && scope.batches.length > 0

  const summary = useInsightsQuery(`rq|${qs}`, () => fetchRequestsSummary(qs), 'Could not load request health.', ready && tab !== 'leaves')
  const leaves = useInsightsQuery(`rql|${qs}`, () => fetchRequestsLeaves(qs), 'Could not load leave volume.', ready && tab === 'leaves')

  if (!access) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <NoAccessEmptyState />
      </div>
    )
  }

  const s = summary.data
  const pendingTotal = s?.pending.reduce((a, r) => a + r.pending, 0) ?? 0
  const over7 = s?.pending.reduce((a, r) => a + r.over_7d, 0) ?? 0

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <InsightsHeader
        title="Requests & Leaves"
        scope={scope}
        screenKey={KEY}
        route="/insights/requests"
        summary={from && to ? `${shortDay(from)} – ${shortDay(to)}` : 'Last 90 days'}
        activeExtras={from && to ? 1 : 0}
        tabs={<TabsBar tabs={TABS} value={tab} onChange={setTab} className="border-b-0" />}
        controls={<DateRangePicker size="sm" from={from} to={to} onChange={changeRange} emptyLabel="Last 90 days" align="end" aria-label="Window" />}
      />
      {scope.error && <EmptyNote>{scope.error}</EmptyNote>}
      {scope.tree && scope.batches.length === 0 && <EmptyNote>No batches fall inside your scope.</EmptyNote>}

      {ready && tab !== 'leaves' && (
        summary.loading ? (
          <KpiSkeleton />
        ) : summary.error ? (
          <EmptyNote>{summary.error}</EmptyNote>
        ) : !s ? null : (
          <div className="space-y-4 pb-4">
            {s.window && (
              <Note>
                Decided and raised figures cover {shortDay(s.window.from)} – {shortDay(s.window.to)}; pending is as of now.
              </Note>
            )}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <KpiTile icon={Inbox} color="var(--color-icon-amber)" label="Pending" value={nf(pendingTotal)} sub={`${nf(s.pending.reduce((a, r) => a + r.sent_back, 0))} sent back for changes`} highlight />
              <KpiTile icon={Clock} color="var(--color-icon-rose)" label="Waiting over a week" value={nf(over7)} sub="Pending requests older than 7 days" />
              <KpiTile icon={Hourglass} color="var(--color-icon-violet)" label="Decided in window" value={nf(s.turnaround.reduce((a, r) => a + r.decided, 0))} sub={`${nf(s.turnaround.reduce((a, r) => a + r.approved, 0))} approved`} />
              <KpiTile icon={UserCheck} color="var(--color-icon-cyan)" label="Approvers with backlog" value={nf(s.approvers.filter((a) => a.pending > 0).length)} sub="Hold at least one pending request" />
            </div>

            {tab === 'pending' && (
              <InsightsPanel title="Pending by type and age">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Pending</TableHead>
                      <TableHead className="text-right">Under 3 days</TableHead>
                      <TableHead className="text-right">3–7 days</TableHead>
                      <TableHead className="text-right">Over 7 days</TableHead>
                      <TableHead className="text-right">Oldest</TableHead>
                      <TableHead className="text-right">Sent back</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {s.pending.map((r) => (
                      <TableRow key={r.request_type}>
                        <TableCell className="font-medium">{REQUEST_TYPE_LABEL[r.request_type] ?? r.request_type}</TableCell>
                        <TableCell className="text-right tabular-nums">{nf(r.pending)}</TableCell>
                        <TableCell className="text-right tabular-nums">{nf(r.under_3d)}</TableCell>
                        <TableCell className="text-right tabular-nums">{nf(r.d3_to_7)}</TableCell>
                        <TableCell className={cn('text-right tabular-nums', r.over_7d > 0 && 'text-icon-rose')}>{nf(r.over_7d)}</TableCell>
                        <TableCell className="text-right tabular-nums">{r.oldest_days === null ? '—' : `${r.oldest_days} d`}</TableCell>
                        <TableCell className="text-right tabular-nums">{nf(r.sent_back)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </InsightsPanel>
            )}

            {tab === 'turnaround' && (
              <InsightsPanel title="Decision turnaround" subtitle="Time from raised to decided, in the window">
                {s.turnaround.length === 0 ? (
                  <EmptyNote>No decisions in the window.</EmptyNote>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Decided</TableHead>
                        <TableHead className="text-right">Approved</TableHead>
                        <TableHead className="text-right">Rejected</TableHead>
                        <TableHead className="text-right">Median</TableHead>
                        <TableHead className="text-right">90th percentile</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {s.turnaround.map((r) => (
                        <TableRow key={r.request_type}>
                          <TableCell className="font-medium">{REQUEST_TYPE_LABEL[r.request_type] ?? r.request_type}</TableCell>
                          <TableCell className="text-right tabular-nums">{nf(r.decided)}</TableCell>
                          <TableCell className="text-right tabular-nums">{nf(r.approved)}</TableCell>
                          <TableCell className="text-right tabular-nums">{nf(r.rejected)}</TableCell>
                          <TableCell className="text-right tabular-nums">{fmtHours(r.median_hours)}</TableCell>
                          <TableCell className="text-right tabular-nums">{fmtHours(r.p90_hours)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </InsightsPanel>
            )}

            {tab === 'approvers' && (
              <InsightsPanel title="Approver backlog" subtitle="A pending request counts against every in-charge or verifier it is routed to">
                {s.approvers.length === 0 ? (
                  <EmptyNote>No approver activity in scope.</EmptyNote>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Approver</TableHead>
                        <TableHead className="text-right">Pending</TableHead>
                        <TableHead className="text-right">Oldest</TableHead>
                        <TableHead className="text-right">Decided in window</TableHead>
                        <TableHead className="text-right">Median turnaround</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {s.approvers.map((r) => (
                        <TableRow key={r.employee_id}>
                          <TableCell>
                            <span className="block">{r.emp_display_name ?? '—'}</span>
                            <span className="font-mono text-xs text-muted-foreground">{r.emp_code ?? ''}</span>
                          </TableCell>
                          <TableCell className={cn('text-right tabular-nums', r.pending > 0 && 'font-medium')}>{nf(r.pending)}</TableCell>
                          <TableCell className={cn('text-right tabular-nums', (r.oldest_days ?? 0) > 7 && 'text-icon-rose')}>{r.oldest_days === null ? '—' : `${r.oldest_days} d`}</TableCell>
                          <TableCell className="text-right tabular-nums">{nf(r.decided)}</TableCell>
                          <TableCell className="text-right tabular-nums">{fmtHours(r.median_hours)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </InsightsPanel>
            )}

            {tab === 'trend' && (
              <InsightsPanel title="Raised vs decided" subtitle="Per month in the window">
                {s.trend.length === 0 ? (
                  <EmptyNote>No requests in the window.</EmptyNote>
                ) : (
                  <ChartBox height={260}>
                    <BarChart data={s.trend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                      <XAxis dataKey="month" tick={AXIS_TICK} />
                      <YAxis tick={AXIS_TICK} allowDecimals={false} width={32} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} cursor={false} />
                      <Legend />
                      <Bar dataKey="raised" name="Raised" fill="var(--color-icon-amber)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="approved" name="Approved" fill="var(--color-icon-emerald)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="rejected" name="Rejected" fill="var(--color-icon-rose)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ChartBox>
                )}
              </InsightsPanel>
            )}
          </div>
        )
      )}

      {ready && tab === 'leaves' && (
        leaves.loading ? (
          <TableSkeleton cols={6} rows={8} />
        ) : leaves.error ? (
          <EmptyNote>{leaves.error}</EmptyNote>
        ) : !leaves.data ? null : (
          <LeaveVolume data={leaves.data} scope={scope} />
        )
      )}
    </div>
  )
}

function LeaveVolume({
  data,
  scope,
}: {
  data: NonNullable<Awaited<ReturnType<typeof fetchRequestsLeaves>>>
  scope: ReturnType<typeof useInsightsScope>
}) {
  const byMonth = useMemo(() => {
    const m = new Map<string, { month: string; applied: number; approved: number; rejected: number; days: number }>()
    for (const r of data.rows) {
      const row = m.get(r.month) ?? { month: r.month, applied: 0, approved: 0, rejected: 0, days: 0 }
      row.applied += r.applied
      row.approved += r.approved
      row.rejected += r.rejected
      row.days += r.days
      m.set(r.month, row)
    }
    return [...m.values()].sort((a, b) => a.month.localeCompare(b.month))
  }, [data])
  const byGroup = useMemo(() => {
    const m = new Map<string, { label: string; applied: number; approved: number; days: number }>()
    for (const r of data.rows) {
      const g = r.group_id === null ? null : scope.groupById.get(r.group_id)
      const key = g ? `g${g.id}` : `p${r.pay_id}`
      const label = g ? `${g.name} · ${batchLabel(scope.batchById.get(g.pay_id))}` : `${batchLabel(scope.batchById.get(r.pay_id))} (no section)`
      const row = m.get(key) ?? { label, applied: 0, approved: 0, days: 0 }
      row.applied += r.applied
      row.approved += r.approved
      row.days += r.days
      m.set(key, row)
    }
    return [...m.values()].sort((a, b) => b.days - a.days)
  }, [data, scope])
  if (data.rows.length === 0) return <EmptyNote>No leaves applied in the window.</EmptyNote>
  return (
    <div className="space-y-4 pb-4">
      {data.window && (
        <Note>
          {shortDay(data.window.from)} – {shortDay(data.window.to)} · approval rate {data.approval_rate}%
        </Note>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <InsightsPanel title="Leaves per month" subtitle="Applications by the month they start">
          <ChartBox height={240}>
            <BarChart data={byMonth}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="month" tick={AXIS_TICK} />
              <YAxis tick={AXIS_TICK} allowDecimals={false} width={32} />
              <Tooltip contentStyle={TOOLTIP_STYLE} cursor={false} />
              <Legend />
              <Bar dataKey="approved" name="Approved" fill="var(--color-icon-emerald)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="rejected" name="Rejected" fill="var(--color-icon-rose)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartBox>
        </InsightsPanel>
        <InsightsPanel title="By section" subtitle="Approved leave days, most first">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Section</TableHead>
                <TableHead className="text-right">Applied</TableHead>
                <TableHead className="text-right">Approved</TableHead>
                <TableHead className="text-right">Days</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byGroup.map((r) => (
                <TableRow key={r.label}>
                  <TableCell className="text-xs">{r.label}</TableCell>
                  <TableCell className="text-right tabular-nums">{nf(r.applied)}</TableCell>
                  <TableCell className="text-right tabular-nums">{nf(r.approved)}</TableCell>
                  <TableCell className="text-right tabular-nums">{nf(r.days)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </InsightsPanel>
      </div>
    </div>
  )
}
