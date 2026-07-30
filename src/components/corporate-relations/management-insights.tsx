import {
  AlertTriangle,
  Building2,
  CalendarClock,
  CalendarDays,
  CircleSlash,
  ClipboardCheck,
  Briefcase,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { Card } from '@/components/ui/card'
import { AXIS_TICK, TOOLTIP_STYLE } from '@/components/drive-management/chart-chrome'
import {
  KpiTile,
  SectionCard,
} from '@/components/drive-management/drive-analytics'
import { ApiError } from '@/lib/api'
import {
  NO_STATUS_ID,
  type CrViewFilters,
  type FollowUpPreset,
} from '@/lib/cr-view-filters'
import type {
  CrViewGroupContext,
  CrViewYearOption,
} from '@/lib/corporate-relations'
import {
  CHIP_DIMENSIONS,
  buildChipMix,
  buildCompanyCoverage,
  buildCrWorkload,
  buildFollowUpCounts,
  buildManagementSummary,
  buildStatusBreakdown,
  getManagementActivity,
  type InsightSlice,
  type ManagementActivity,
  type ManagementRow,
} from '@/lib/management-view'
import { cn } from '@/lib/utils'

/**
 * The status colour ramp. Statuses are an admin-configured master with no fixed
 * count, so colours cycle by POSITION in that master rather than by id — which
 * keeps a status the same colour across every chart on the screen for one page
 * load. All CSS tokens, never hex, so light/dark resolve on their own.
 */
const STATUS_RAMP = [
  'var(--color-icon-blue)',
  'var(--color-icon-emerald)',
  'var(--color-icon-amber)',
  'var(--color-icon-violet)',
  'var(--color-icon-cyan)',
  'var(--color-icon-rose)',
  'var(--color-icon-orange)',
]

/** Rows with no status at all read as absence, not as another category. */
const NO_STATUS_COLOR = 'var(--color-muted-foreground)'

/** How many companies the coverage chart lists before it stops. */
const TOP_COMPANIES = 12

/** How many bars a mix card shows before it stops. */
const TOP_CHIPS = 8

const nf = (n: number) => n.toLocaleString('en-IN')

/**
 * Every chart resolves a click through the INDEX recharts passes as the second
 * argument, indexing back into the array the chart was given — not through the
 * datum in the first argument, whose published type describes the rectangle
 * recharts drew rather than the row behind it (reading the row off it needs a
 * cast that the library is free to invalidate). The index always lines up with
 * the `data` prop, and `Pie` reports clicks the same way, so both use one rule.
 */

/** 'YYYY-MM' → "Jul 26" for the trend axis. */
function monthLabel(month: string): string {
  const [y, m] = month.split('-')
  const d = new Date(Number(y), Number(m) - 1, 1)
  return `${d.toLocaleString('en-IN', { month: 'short' })} ${y.slice(2)}`
}

/** The follow-up tiles, urgency first. `any` and the presets' overlap are noted. */
const FOLLOW_UP_TILES: {
  preset: Exclude<FollowUpPreset, 'any'>
  label: string
  icon: LucideIcon
  warn?: boolean
}[] = [
  { preset: 'overdue', label: 'Overdue', icon: AlertTriangle, warn: true },
  { preset: 'today', label: 'Due today', icon: CalendarClock },
  { preset: 'this_week', label: 'Due this week', icon: CalendarDays },
  { preset: 'this_month', label: 'Due this month', icon: CalendarDays },
  { preset: 'not_set', label: 'No follow-up set', icon: CircleSlash },
]

/**
 * The Insights tab — what management reads instead of scrolling the table.
 *
 * Every number here is derived from `rows`, which is the table's ALREADY
 * filtered set. Two consequences, both deliberate:
 *  1. Drilling in narrows the charts too, so the panel doubles as a lens.
 *  2. A chart's count and the list it filters to are the same computation, so
 *     they cannot disagree. That is why nothing here is a second server query.
 *
 * The one exception is the activity trend: status history is not in the list
 * payload, so it is fetched per year and is explicitly year-wide.
 */
export function ManagementInsights({
  rows,
  ctx,
  year,
  filtersActive,
  onDrill,
  onClearFilters,
}: {
  /** The filtered rows — NOT the raw list. */
  rows: ManagementRow[]
  ctx: CrViewGroupContext
  year: CrViewYearOption
  filtersActive: boolean
  /** Merge a facet patch into the table's filters and show the Records tab. */
  onDrill: (patch: Partial<CrViewFilters>) => void
  onClearFilters: () => void
}) {
  const summary = useMemo(() => buildManagementSummary(rows), [rows])
  const statuses = useMemo(() => buildStatusBreakdown(rows, ctx), [rows, ctx])
  const workload = useMemo(() => buildCrWorkload(rows, ctx), [rows, ctx])
  const companies = useMemo(() => buildCompanyCoverage(rows), [rows])
  const followUp = useMemo(() => buildFollowUpCounts(rows), [rows])

  // Colour per status id, assigned by master position so every chart agrees.
  const statusColor = useMemo(() => {
    const map = new Map<number, string>()
    ctx.statuses.forEach((s, i) =>
      map.set(s.id, STATUS_RAMP[i % STATUS_RAMP.length]),
    )
    map.set(NO_STATUS_ID, NO_STATUS_COLOR)
    return map
  }, [ctx.statuses])

  /**
   * The status facet ids that select exactly the rows a chart segment counted.
   *
   * The charts bucket by the EFFECTIVE status — what the cell displays, which
   * for a row with nothing recorded is the master default. The facet, though,
   * matches the RECORDED status and puts blanks under its `NO_STATUS_ID`
   * sentinel. So the default status' segment has to select both, or clicking a
   * slice of 31 would filter to the handful that recorded it explicitly.
   */
  const statusFacetIds = (statusId: number): number[] =>
    statusId !== NO_STATUS_ID && statusId === ctx.defaultStatus?.id
      ? [statusId, NO_STATUS_ID]
      : [statusId]

  if (rows.length === 0) {
    return (
      <Card className="p-10 text-center text-sm text-muted-foreground">
        {filtersActive
          ? 'No rows match the current filters — nothing to chart.'
          : `No job roles to report on for ${year.display_year}.`}
      </Card>
    )
  }

  return (
    <div className="space-y-5 pb-8">
      {filtersActive && (
        <p className="text-xs text-muted-foreground">
          Charts reflect the {nf(rows.length)} filtered{' '}
          {rows.length === 1 ? 'role' : 'roles'}.{' '}
          <button
            type="button"
            onClick={onClearFilters}
            className="underline underline-offset-2 hover:text-foreground"
          >
            Clear all filters
          </button>{' '}
          to see the whole year.
        </p>
      )}

      {/* 1 — headline counts */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <KpiTile
          icon={Building2}
          color="var(--color-icon-cyan)"
          label="Companies"
          value={nf(summary.companies)}
          sub="with at least one job role"
        />
        <KpiTile
          icon={Briefcase}
          color="var(--color-icon-blue)"
          label="Job roles"
          value={nf(summary.roles)}
          sub={`tracked for ${year.display_year}`}
        />
        <KpiTile
          icon={ClipboardCheck}
          color="var(--color-icon-emerald)"
          label="Recorded"
          value={nf(summary.recorded)}
          sub={`${Math.round((summary.recorded / summary.roles) * 100)}% of roles`}
          highlight
        />
        <KpiTile
          icon={CircleSlash}
          color="var(--color-muted-foreground)"
          label="Not started"
          value={nf(summary.not_started)}
          sub="nothing recorded this year"
        />
        <KpiTile
          icon={AlertTriangle}
          color="var(--color-icon-rose)"
          label="Overdue"
          value={nf(summary.overdue)}
          sub="follow-up date has passed"
        />
        <KpiTile
          icon={Users}
          color="var(--color-icon-violet)"
          label="CRs involved"
          value={nf(summary.crs)}
          sub="responsible for these roles"
        />
      </div>

      {/* 2 — where every role stands */}
      <SectionCard
        title="Current status"
        subtitle="Where every job role stands right now. Click a status to filter the list."
      >
        <StatusDonut
          slices={statuses}
          color={statusColor}
          total={rows.length}
          onPick={(id) => onDrill({ status_ids: statusFacetIds(id) })}
        />
      </SectionCard>

      {/* 3 — the CR level: who carries what, and how far along it is */}
      <SectionCard
        title="CR workload"
        subtitle="Job roles per CR, split by current status. Click a segment to filter to that CR and status."
      >
        <CrWorkloadChart
          rows={workload}
          statuses={statuses}
          color={statusColor}
          onPick={(crId, statusId) =>
            onDrill(
              statusId === null
                ? { cr_ids: [crId] }
                : { cr_ids: [crId], status_ids: statusFacetIds(statusId) },
            )
          }
        />
      </SectionCard>

      {/* 4 — follow-up health. Tiles, not bars: the presets overlap by design
          (this week includes today), so a part-to-whole chart would lie. Each
          count is exactly what clicking it filters to. */}
      <SectionCard
        title="Follow-up health"
        subtitle="Counted the way the filter counts — click a tile to see those roles. Windows overlap: this week includes today."
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {FOLLOW_UP_TILES.map((t) => (
            <button
              key={t.preset}
              type="button"
              onClick={() => onDrill({ follow_up: t.preset })}
              className={cn(
                'rounded-lg border bg-card p-3 text-left transition-colors hover:border-primary/50 hover:bg-accent/40',
                t.warn && followUp[t.preset] > 0 && 'border-warning/40 bg-warning/5',
              )}
            >
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <t.icon
                  className={cn(
                    'size-3.5',
                    t.warn && followUp[t.preset] > 0 && 'text-warning',
                  )}
                />
                <span className="text-[11px] font-medium">{t.label}</span>
              </div>
              <p className="mt-1 text-xl font-bold tabular-nums">
                {nf(followUp[t.preset])}
              </p>
            </button>
          ))}
        </div>
      </SectionCard>

      {/* 5 — company coverage */}
      <SectionCard
        title="Companies by job roles"
        subtitle={
          companies.length > TOP_COMPANIES
            ? `Top ${TOP_COMPANIES} of ${nf(companies.length)} companies. Click a bar to filter to that company.`
            : 'Click a bar to filter to that company.'
        }
      >
        <CompanyChart
          rows={companies.slice(0, TOP_COMPANIES)}
          onPick={(id) => onDrill({ company_ids: [id] })}
        />
      </SectionCard>

      {/* 6 — attribute mix, one card per multi-select dimension */}
      <div className="grid gap-4 lg:grid-cols-2">
        {CHIP_DIMENSIONS.map((d) => (
          <MixCard
            key={d.key}
            title={d.label}
            slices={buildChipMix(rows, d.pick)}
            onPick={(id) => onDrill({ [d.key]: [id] } as Partial<CrViewFilters>)}
          />
        ))}
      </div>

      {/* 7 — the one server-side aggregate */}
      <ActivityTrend yearId={year.id} yearLabel={year.display_year} />
    </div>
  )
}

// --- charts -----------------------------------------------------------------

function StatusDonut({
  slices,
  color,
  total,
  onPick,
}: {
  slices: InsightSlice[]
  color: Map<number, string>
  total: number
  onPick: (id: number) => void
}) {
  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row">
      <div className="h-52 w-52 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="count"
              nameKey="label"
              innerRadius={58}
              outerRadius={84}
              paddingAngle={2}
              stroke="var(--color-card)"
              strokeWidth={2}
              onClick={(_, index) => onPick(slices[index].id)}
              className="cursor-pointer"
            >
              {slices.map((s) => (
                <Cell
                  key={s.id}
                  fill={color.get(s.id) ?? NO_STATUS_COLOR}
                />
              ))}
            </Pie>
            <Tooltip
              cursor={false}
              contentStyle={TOOLTIP_STYLE}
              formatter={(v, n) => [nf(Number(v ?? 0)), String(n)]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="grid w-full flex-1 grid-cols-1 gap-x-6 gap-y-0.5 sm:grid-cols-2">
        {slices.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => onPick(s.id)}
              className="flex w-full items-center gap-2 rounded px-1 py-1 text-left text-sm hover:bg-accent/50"
            >
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: color.get(s.id) ?? NO_STATUS_COLOR }}
              />
              <span className="min-w-0 flex-1 truncate text-muted-foreground">
                {s.label}
              </span>
              <span className="font-medium tabular-nums">{nf(s.count)}</span>
              <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">
                {Math.round((s.count / total) * 100)}%
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * One horizontal bar per CR, stacked by current status.
 *
 * Recharts stacks by dataKey, so each status becomes its own key on a flat datum
 * (`s<id>`). Clicking a segment carries both the CR and that status; clicking the
 * name column carries the CR alone.
 */
function CrWorkloadChart({
  rows,
  statuses,
  color,
  onPick,
}: {
  rows: ReturnType<typeof buildCrWorkload>
  statuses: InsightSlice[]
  color: Map<number, string>
  onPick: (crId: number, statusId: number | null) => void
}) {
  const data = useMemo(
    () =>
      rows.map((w) => {
        const datum: Record<string, string | number> = {
          cr_id: w.cr.id,
          label: w.cr.emp_display_name,
          total: w.total,
        }
        for (const s of statuses) datum[`s${s.id}`] = w.by_status[s.id] ?? 0
        return datum
      }),
    [rows, statuses],
  )

  const height = Math.max(160, rows.length * 38 + 30)

  return (
    <div className="space-y-3">
      <div style={{ width: '100%', height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 4, right: 16, bottom: 4, left: 4 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--color-border)"
              horizontal={false}
            />
            <XAxis type="number" tick={AXIS_TICK} allowDecimals={false} />
            <YAxis
              type="category"
              dataKey="label"
              tick={AXIS_TICK}
              width={140}
              interval={0}
            />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              cursor={{ fill: 'var(--color-muted)', opacity: 0.4 }}
              formatter={(v, n) => [nf(Number(v ?? 0)), String(n)]}
            />
            {statuses.map((s) => (
              <Bar
                key={s.id}
                dataKey={`s${s.id}`}
                name={s.label}
                stackId="s"
                maxBarSize={26}
                fill={color.get(s.id) ?? NO_STATUS_COLOR}
                className="cursor-pointer"
                onClick={(_, index) => {
                  const hit = rows[index]
                  if (hit) onPick(hit.cr.id, s.id)
                }}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Per-CR summary — the numbers a stacked bar cannot show, and the
          click target for "just this CR". */}
      <ul className="divide-y rounded-lg border">
        {rows.map((w) => (
          <li key={w.cr.id}>
            <button
              type="button"
              onClick={() => onPick(w.cr.id, null)}
              className="flex w-full flex-wrap items-baseline gap-x-3 gap-y-1 px-3 py-2 text-left text-sm hover:bg-accent/50"
            >
              <span className="min-w-0 flex-1 truncate font-medium">
                {w.cr.emp_display_name}
                <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                  {w.cr.emp_code}
                </span>
              </span>
              <span className="tabular-nums text-muted-foreground">
                {nf(w.total)} {w.total === 1 ? 'role' : 'roles'}
              </span>
              <span className="tabular-nums text-muted-foreground">
                {nf(w.recorded)} recorded
              </span>
              <span
                className={cn(
                  'tabular-nums',
                  w.overdue > 0 ? 'text-warning' : 'text-muted-foreground',
                )}
              >
                {nf(w.overdue)} overdue
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function CompanyChart({
  rows,
  onPick,
}: {
  rows: ReturnType<typeof buildCompanyCoverage>
  onPick: (id: number) => void
}) {
  const height = Math.max(160, rows.length * 34 + 30)
  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={rows}
          layout="vertical"
          margin={{ top: 4, right: 16, bottom: 4, left: 4 }}
          barGap={2}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--color-border)"
            horizontal={false}
          />
          <XAxis type="number" tick={AXIS_TICK} allowDecimals={false} />
          <YAxis
            type="category"
            dataKey="name"
            tick={AXIS_TICK}
            width={150}
            interval={0}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            cursor={{ fill: 'var(--color-muted)', opacity: 0.4 }}
            formatter={(v, n) => [nf(Number(v ?? 0)), String(n)]}
          />
          <Bar
            dataKey="roles"
            name="Job roles"
            fill="var(--color-icon-blue)"
            radius={[0, 3, 3, 0]}
            maxBarSize={14}
            className="cursor-pointer"
            onClick={(_, index) => {
              const hit = rows[index]
              if (hit) onPick(hit.id)
            }}
          />
          <Bar
            dataKey="recorded"
            name="Recorded"
            fill="var(--color-icon-emerald)"
            radius={[0, 3, 3, 0]}
            maxBarSize={14}
            className="cursor-pointer"
            onClick={(_, index) => {
              const hit = rows[index]
              if (hit) onPick(hit.id)
            }}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/**
 * One multi-select dimension as horizontal bars. Counts are per role and a role
 * with two chips counts under both — stated on the card, because the bars
 * deliberately do not sum to the row total.
 */
function MixCard({
  title,
  slices,
  onPick,
}: {
  title: string
  slices: InsightSlice[]
  onPick: (id: number) => void
}) {
  const shown = slices.slice(0, TOP_CHIPS)
  const height = Math.max(140, shown.length * 32 + 24)
  return (
    <Card className="p-5">
      <h2 className="text-sm font-semibold">{title}</h2>
      {shown.length === 0 ? (
        <p className="py-8 text-center text-xs text-muted-foreground">
          Nothing recorded for this year.
        </p>
      ) : (
        <>
          <p className="mb-3 text-xs text-muted-foreground">
            {slices.length > TOP_CHIPS
              ? `Top ${TOP_CHIPS} of ${slices.length}. A role counts under each value it carries.`
              : 'A role counts under each value it carries.'}
          </p>
        <div style={{ width: '100%', height }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={shown}
              layout="vertical"
              margin={{ top: 4, right: 16, bottom: 4, left: 4 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--color-border)"
                horizontal={false}
              />
              <XAxis type="number" tick={AXIS_TICK} allowDecimals={false} />
              <YAxis
                type="category"
                dataKey="label"
                tick={AXIS_TICK}
                width={130}
                interval={0}
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                cursor={{ fill: 'var(--color-muted)', opacity: 0.4 }}
                formatter={(v) => [nf(Number(v ?? 0)), 'Job roles']}
              />
              <Bar
                dataKey="count"
                name="Job roles"
                fill="var(--color-icon-violet)"
                radius={[0, 3, 3, 0]}
                maxBarSize={22}
                className="cursor-pointer"
                onClick={(_, index) => {
                  const hit = shown[index]
                  if (hit) onPick(hit.id)
                }}
              />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </Card>
  )
}

/**
 * Monthly status movement for the year, plus who has been doing it.
 *
 * The only chart on the screen that is NOT derived from the table's rows, so it
 * is the only one filters do not touch — labelled as such rather than left to
 * look inconsistent.
 */
function ActivityTrend({
  yearId,
  yearLabel,
}: {
  yearId: number
  yearLabel: string
}) {
  const [data, setData] = useState<ManagementActivity | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    getManagementActivity(yearId)
      .then((d) => {
        if (!cancelled) setData(d)
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(
            e instanceof ApiError || e instanceof Error
              ? e.message
              : 'Could not load the activity trend.',
          )
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [yearId])

  const chart = useMemo(
    () => (data?.months ?? []).map((m) => ({ ...m, label: monthLabel(m.month) })),
    [data],
  )
  const busiest = useMemo(
    () => Math.max(0, ...chart.map((m) => m.changes)),
    [chart],
  )

  return (
    <SectionCard
      title="Status activity"
      subtitle={`Status changes recorded per month for ${yearLabel} — the whole year, not affected by the filters above.`}
    >
      {loading ? (
        <div className="h-56 animate-pulse rounded-lg bg-muted" />
      ) : error ? (
        <p className="py-6 text-sm text-destructive">{error}</p>
      ) : busiest === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          No status changes recorded in the last 12 months.
        </p>
      ) : (
        <div className="space-y-5">
          <div style={{ width: '100%', height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chart}
                margin={{ top: 4, right: 12, bottom: 4, left: 4 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--color-border)"
                  vertical={false}
                />
                <XAxis dataKey="label" tick={AXIS_TICK} />
                <YAxis tick={AXIS_TICK} allowDecimals={false} width={28} />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  cursor={{ stroke: 'var(--color-border)' }}
                  formatter={(v, n) => [nf(Number(v ?? 0)), String(n)]}
                />
                <Line
                  type="monotone"
                  dataKey="changes"
                  name="Status changes"
                  stroke="var(--color-icon-blue)"
                  strokeWidth={2}
                  dot={{ r: 2 }}
                />
                <Line
                  type="monotone"
                  dataKey="records"
                  name="Records touched"
                  stroke="var(--color-icon-emerald)"
                  strokeWidth={2}
                  strokeDasharray="4 3"
                  dot={{ r: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* The two series overlap whenever every change lands on a different
              record, so they need naming outside the tooltip. */}
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-1">
            {[
              { name: 'Status changes', color: 'var(--color-icon-blue)' },
              { name: 'Records touched', color: 'var(--color-icon-emerald)' },
            ].map((s) => (
              <span
                key={s.name}
                className="flex items-center gap-1.5 text-xs text-muted-foreground"
              >
                <span
                  className="size-2.5 rounded-sm"
                  style={{ backgroundColor: s.color }}
                />
                {s.name}
              </span>
            ))}
          </div>

          {(data?.top_movers.length ?? 0) > 0 && (
            <div>
              <h3 className="mb-2 text-xs font-medium text-muted-foreground">
                Most active CRs
              </h3>
              <ul className="space-y-1.5">
                {data?.top_movers.map((m, i) => (
                  <li
                    key={m.employee?.id ?? `unknown-${i}`}
                    className="flex items-center gap-3 text-sm"
                  >
                    <span className="min-w-0 flex-1 truncate">
                      {m.employee?.emp_display_name ?? 'Unknown (removed)'}
                    </span>
                    <span className="font-medium tabular-nums">
                      {nf(m.changes)}
                    </span>
                    <span className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                      <span
                        className="block h-full rounded-full bg-icon-blue"
                        style={{
                          width: `${(m.changes / (data.top_movers[0]?.changes || 1)) * 100}%`,
                        }}
                      />
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </SectionCard>
  )
}
