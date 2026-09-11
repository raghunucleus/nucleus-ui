import { useEffect, useMemo, useState } from 'react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { toast } from 'sonner'

import {
  AXIS_TICK,
  TOOLTIP_STYLE,
} from '@/components/drive-management/chart-chrome'
import {
  errMsg,
  shortDay,
} from '@/components/employee/attendance-analytics/format'
import {
  EmptyNote,
  TableSkeleton,
} from '@/components/employee/attendance-analytics/ui'
import { FacetMenu } from '@/components/ui/facet-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  EMPTY_SELECTION,
  fetchInsightsOverview,
  isLocked,
  scopeQs,
  type InsightsOverview,
  type OverviewWindow,
  type ScopeSelection,
} from '@/lib/insights'
import { cn } from '@/lib/utils'
import { ChartBox, DeltaChip, InsightsPanel, Note } from './bits'
import {
  MAX_COMPARE,
  serialiseCompare,
  type CompareEntity,
} from './compare-url'
import { SERIES, fmt2, fmtPct, nf } from './insights-utils'
import type { InsightsScopeState } from './use-insights-scope'

function narrowing(e: CompareEntity): ScopeSelection {
  return {
    ...EMPTY_SELECTION,
    ...(e.kind === 'd' ? { department_ids: [e.id] } : {}),
    ...(e.kind === 'p' ? { programme_ids: [e.id] } : {}),
    ...(e.kind === 'b' ? { programme_admission_year_ids: [e.id] } : {}),
  }
}

type Metric = {
  key: string
  label: string
  read: (o: InsightsOverview) => number | null
  format: (n: number) => string
  unit: 'pts' | 'pct' | 'n'
  good: 'up' | 'down' | 'none'
}

const METRICS: Metric[] = [
  {
    key: 'students',
    label: 'Students',
    read: (o) => (isLocked(o.attendance) ? null : (o.attendance?.students ?? null)),
    format: nf,
    unit: 'n',
    good: 'none',
  },
  {
    key: 'attendance',
    label: 'Attendance',
    read: (o) => (isLocked(o.attendance) || !o.attendance || o.attendance.students === 0 ? null : o.attendance.pct),
    format: fmtPct,
    unit: 'pts',
    good: 'up',
  },
  {
    key: 'below75',
    label: 'Below 75%',
    read: (o) => (isLocked(o.attendance) ? null : (o.attendance?.below_threshold ?? null)),
    format: nf,
    unit: 'n',
    good: 'down',
  },
  {
    key: 'below65',
    label: 'Below 65%',
    read: (o) => (isLocked(o.attendance) ? null : (o.attendance?.below_condonation ?? null)),
    format: nf,
    unit: 'n',
    good: 'down',
  },
  {
    key: 'marking',
    label: 'Marking done',
    read: (o) => (isLocked(o.attendance) ? null : (o.attendance?.compliance_pct ?? null)),
    format: fmtPct,
    unit: 'pts',
    good: 'up',
  },
  {
    key: 'cgpa',
    label: 'Average CGPA',
    read: (o) => (isLocked(o.results) ? null : (o.results?.avg_cgpa ?? null)),
    format: fmt2,
    unit: 'n',
    good: 'up',
  },
  {
    key: 'backlogs',
    label: 'With backlogs',
    read: (o) => (isLocked(o.results) ? null : (o.results?.with_current_backlogs ?? null)),
    format: nf,
    unit: 'n',
    good: 'down',
  },
  {
    key: 'placed',
    label: 'Placed (current batch)',
    read: (o) => (isLocked(o.placements) ? null : (o.placements?.placed_pct ?? null)),
    format: (n) => `${n}%`,
    unit: 'pts',
    good: 'up',
  },
  {
    key: 'offers',
    label: 'Offers',
    read: (o) => (isLocked(o.placements) ? null : (o.placements?.offers ?? null)),
    format: nf,
    unit: 'n',
    good: 'up',
  },
  {
    key: 'pending',
    label: 'Pending approvals',
    read: (o) => (isLocked(o.requests) ? null : (o.requests?.pending ?? null)),
    format: nf,
    unit: 'n',
    good: 'down',
  },
  {
    key: 'stale',
    label: 'Pending over a week',
    read: (o) => (isLocked(o.requests) ? null : (o.requests?.pending_over_7d ?? null)),
    format: nf,
    unit: 'n',
    good: 'down',
  },
]

/**
 * Side-by-side KPIs for up to four departments, programmes or batches. Each
 * column is one cached overview call with that entity as the only narrowing;
 * every value after the first column carries a delta against the first.
 */
export function CompareTab({
  scope,
  window,
  entities,
  onChange,
}: {
  scope: InsightsScopeState
  window: OverviewWindow
  entities: CompareEntity[]
  onChange: (next: CompareEntity[]) => void
}) {
  const [state, setState] = useState<{
    key: string
    data: Array<InsightsOverview | null> | null
    error: string | null
  }>({ key: '', data: null, error: null })

  const key = `${serialiseCompare(entities) ?? ''}|${window}`
  useEffect(() => {
    if (entities.length === 0) return
    let cancelled = false
    Promise.all(
      entities.map((e) =>
        fetchInsightsOverview(scopeQs(narrowing(e), { window })),
      ),
    )
      .then((data) => {
        if (!cancelled) setState({ key, data, error: null })
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setState({ key, data: null, error: errMsg(e, 'Could not compare.') })
        }
      })
    return () => {
      cancelled = true
    }
    // `entities` is derived from `key`; the key is what should trigger a refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const tree = scope.tree
  const label = (e: CompareEntity): string => {
    if (!tree) return `${e.kind}:${e.id}`
    if (e.kind === 'd') return tree.departments.find((d) => d.id === e.id)?.code ?? `#${e.id}`
    if (e.kind === 'p') return tree.programmes.find((p) => p.id === e.id)?.code ?? `#${e.id}`
    const b = tree.batches.find((x) => x.pay_id === e.id)
    return b ? `${b.programme_code} · ${b.display_year}` : `#${e.id}`
  }

  const pick = (kind: CompareEntity['kind'], ids: number[]) => {
    const rest = entities.filter((e) => e.kind !== kind)
    const next = [...rest, ...ids.map((id) => ({ kind, id }))]
    if (next.length > MAX_COMPARE) {
      toast.info(`Compare up to ${MAX_COMPARE} at a time.`)
      return
    }
    onChange(next)
  }
  const selectedOf = (kind: CompareEntity['kind']) =>
    entities.filter((e) => e.kind === kind).map((e) => e.id)

  const data = state.key === key ? state.data : null
  const loading = entities.length > 0 && state.key !== key
  const error = state.key === key ? state.error : null

  const weekly = useMemo(() => {
    if (!data) return []
    const weeks = new Map<string, Record<string, number | string>>()
    data.forEach((o, i) => {
      for (const w of o?.weekly_attendance ?? []) {
        const row = weeks.get(w.week) ?? { week: w.week }
        row[`e${i}`] = w.pct
        weeks.set(w.week, row)
      }
    })
    return [...weeks.values()].sort((a, b) =>
      String(a.week).localeCompare(String(b.week)),
    )
  }, [data])

  return (
    <div className="space-y-4 pb-4">
      <div className="flex flex-wrap items-center gap-2">
        {tree && tree.departments.length > 0 && (
          <FacetMenu
            label="Departments"
            options={tree.departments
              .filter((d) => tree.batches.some((b) => b.department_id === d.id))
              .map((d) => ({ id: d.id, name: d.code, sub: d.name }))}
            selected={selectedOf('d')}
            onChange={(ids) => pick('d', ids)}
            size="sm"
          />
        )}
        {tree && tree.programmes.length > 0 && (
          <FacetMenu
            label="Programmes"
            options={tree.programmes
              .filter((p) => tree.batches.some((b) => b.programme_id === p.id))
              .map((p) => ({ id: p.id, name: p.code, sub: p.display_name || p.name }))}
            selected={selectedOf('p')}
            onChange={(ids) => pick('p', ids)}
            size="sm"
          />
        )}
        {tree && tree.batches.length > 0 && (
          <FacetMenu
            label="Batches"
            options={tree.batches.map((b) => ({
              id: b.pay_id,
              name: `${b.programme_code} · ${b.display_year}`,
              hint: b.student_count,
            }))}
            selected={selectedOf('b')}
            onChange={(ids) => pick('b', ids)}
            searchPlaceholder="Search batches…"
            size="sm"
          />
        )}
        <span className="text-xs text-muted-foreground">
          {entities.length} of {MAX_COMPARE} picked
        </span>
      </div>

      {entities.length < 2 ? (
        <EmptyNote>
          Pick at least two departments, programmes or batches to compare.
        </EmptyNote>
      ) : loading ? (
        <TableSkeleton cols={entities.length + 1} rows={METRICS.length} />
      ) : error ? (
        <EmptyNote>{error}</EmptyNote>
      ) : !data ? null : (
        <>
          <Note>
            Attendance and marking are whole-semester figures; placements are
            the current passout batch of each entity. Differences read against
            the first column.
          </Note>
          <InsightsPanel title="Side by side">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Metric</TableHead>
                  {entities.map((e, i) => (
                    <TableHead key={`${e.kind}${e.id}`} className="text-right">
                      <span
                        className="mr-1.5 inline-block size-2 rounded-full align-middle"
                        style={{ backgroundColor: SERIES[i % SERIES.length] }}
                      />
                      {label(e)}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {METRICS.map((m) => {
                  const values = data.map((o) => (o ? m.read(o) : null))
                  const base = values[0]
                  return (
                    <TableRow key={m.key}>
                      <TableCell className="font-medium">{m.label}</TableCell>
                      {values.map((v, i) => (
                        <TableCell
                          key={i}
                          className={cn('text-right tabular-nums', i === 0 && 'font-medium')}
                        >
                          <span className="block">{v === null ? '—' : m.format(v)}</span>
                          {i > 0 && (
                            <span className="block">
                              {v === null || base === null ? (
                                <span className="text-[11px] text-muted-foreground">—</span>
                              ) : (
                                <DeltaChip
                                  value={Math.round((v - base) * 10) / 10}
                                  unit={m.unit}
                                  good={m.good}
                                  label=""
                                />
                              )}
                            </span>
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </InsightsPanel>

          {weekly.length > 0 && (
            <InsightsPanel
              title="Weekly attendance"
              subtitle="Percentage present per week, last twelve weeks"
            >
              <ChartBox height={260}>
                <LineChart data={weekly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="week" tick={AXIS_TICK} tickFormatter={shortDay} minTickGap={24} />
                  <YAxis tick={AXIS_TICK} domain={[0, 100]} unit="%" width={44} />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    labelFormatter={(l) => `Week of ${shortDay(String(l ?? ''))}`}
                    formatter={(v, name) => [fmtPct(Number(v ?? 0)), String(name)]}
                  />
                  <Legend />
                  {entities.map((e, i) => (
                    <Line
                      key={`${e.kind}${e.id}`}
                      type="monotone"
                      dataKey={`e${i}`}
                      name={label(e)}
                      stroke={SERIES[i % SERIES.length]}
                      strokeWidth={2}
                      dot={false}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ChartBox>
            </InsightsPanel>
          )}
        </>
      )}
    </div>
  )
}
