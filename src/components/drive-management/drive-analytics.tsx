import {
  AlertTriangle,
  BellRing,
  CheckCircle2,
  Clock,
  Trophy,
  UserCheck,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  Bar,
  BarChart,
  Cell,
  Funnel as RFunnel,
  FunnelChart,
  LabelList,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { ApiError } from '@/lib/api'
import {
  getDriveAnalytics,
  type DriveAnalytics,
  type DriveBreakdownRow,
} from '@/lib/drive-management'
import { cn } from '@/lib/utils'

// --- theme-aware chart palette (all resolve light/dark via CSS tokens) ------

/** Distribution colors, one per lifecycle status code. */
const STATUS_COLOR: Record<number, string> = {
  10: 'var(--color-muted-foreground)',
  20: 'var(--color-icon-amber)',
  30: 'var(--color-icon-blue)',
  40: 'var(--color-icon-rose)',
  50: 'var(--color-icon-violet)',
  60: 'var(--color-icon-emerald)',
  70: 'var(--color-icon-orange)',
  80: 'var(--color-icon-cyan)',
}

/** The funnel ramp: pool → invited → accepted → selected. */
const FUNNEL_COLOR: Record<string, string> = {
  imported: 'var(--color-icon-cyan)',
  invited: 'var(--color-icon-amber)',
  accepted: 'var(--color-icon-blue)',
  selected: 'var(--color-icon-emerald)',
}

const SERIES = {
  imported: { key: 'imported', name: 'Imported', color: 'var(--color-icon-cyan)' },
  accepted: { key: 'accepted', name: 'Accepted', color: 'var(--color-icon-blue)' },
  selected: {
    key: 'selected',
    name: 'Selected',
    color: 'var(--color-icon-emerald)',
  },
} as const

const TOOLTIP_STYLE = {
  background: 'var(--color-card)',
  border: '1px solid var(--color-border)',
  borderRadius: 8,
  color: 'var(--color-foreground)',
  fontSize: 12,
  boxShadow: '0 4px 12px rgb(0 0 0 / 0.08)',
} as const

const AXIS_TICK = { fontSize: 12, fill: 'var(--color-muted-foreground)' } as const

// --- formatting -------------------------------------------------------------

const nf = (n: number) => n.toLocaleString('en-IN')

/** A rate in [0,1] as a whole percent, or an em dash when it's undefined. */
const pct = (v: number | null | undefined): string =>
  v == null ? '—' : `${Math.round(v * 100)}%`

/** Human "time to respond" — hours below a day, else days to one decimal. */
function durationLabel(hours: number | null): string {
  if (hours == null) return '—'
  if (hours < 24) return `${hours.toFixed(1)} h`
  return `${(hours / 24).toFixed(1)} days`
}

// ---------------------------------------------------------------------------

export function DriveAnalyticsTab({ driveId }: { driveId: number }) {
  const [data, setData] = useState<DriveAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getDriveAnalytics(driveId)
      .then((d) => {
        if (!cancelled) {
          setData(d)
          setError(null)
        }
      })
      .catch((e: unknown) => {
        if (!cancelled)
          setError(
            e instanceof ApiError || e instanceof Error
              ? e.message
              : 'Could not load analytics.',
          )
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [driveId])

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 pb-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
        <div className="h-64 animate-pulse rounded-xl bg-muted" />
        <div className="h-64 animate-pulse rounded-xl bg-muted" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-5xl">
        <Card className="p-8 text-center text-sm text-muted-foreground">
          {error ?? 'No analytics available.'}
        </Card>
      </div>
    )
  }

  if (data.totals.total === 0) {
    return (
      <div className="mx-auto max-w-5xl">
        <Card className="p-10 text-center text-sm text-muted-foreground">
          No students imported into this drive yet. Use the Filter tab to add
          candidates — analytics appear once the drive gets going.
        </Card>
      </div>
    )
  }

  const { totals, rates, funnel } = data
  const responded =
    data.response_time.buckets.reduce((s, b) => s + b.count, 0) > 0

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-8">
      {/* 1 — headline KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <KpiTile
          icon={Users}
          color="var(--color-icon-cyan)"
          label="Candidates"
          value={nf(totals.total)}
          sub="imported into the drive"
        />
        <KpiTile
          icon={BellRing}
          color="var(--color-icon-amber)"
          label="Invited"
          value={nf(totals.invited)}
          sub={`${pct(rates.invite_rate)} of candidates`}
        />
        <KpiTile
          icon={UserCheck}
          color="var(--color-icon-blue)"
          label="Accepted"
          value={nf(totals.accepted)}
          sub={`${pct(rates.acceptance_rate)} acceptance`}
        />
        <KpiTile
          icon={Trophy}
          color="var(--color-icon-emerald)"
          label="Selected"
          value={nf(totals.selected)}
          sub={`${pct(rates.selection_rate)} of attendees`}
          highlight
        />
        <KpiTile
          icon={Clock}
          color="var(--color-icon-violet)"
          label="Awaiting"
          value={nf(totals.invited - totals.accepted - totals.denied)}
          sub="yet to respond"
        />
      </div>

      {/* 2 — conversion funnel */}
      <SectionCard
        title="Conversion funnel"
        subtitle="How candidates progress from import to offer."
      >
        <Funnel stages={funnel} />
      </SectionCard>

      {/* 3 — key rates */}
      <SectionCard title="Conversion rates">
        <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
          <RateBar label="Invite rate" hint="invited ÷ imported" value={rates.invite_rate} />
          <RateBar
            label="Response rate"
            hint="responded ÷ invited"
            value={rates.response_rate}
          />
          <RateBar
            label="Acceptance rate"
            hint="accepted ÷ invited"
            value={rates.acceptance_rate}
          />
          <RateBar
            label="Selection rate"
            hint="selected ÷ attended"
            value={rates.selection_rate}
            tone="success"
          />
          <RateBar
            label="No-show rate"
            hint="not attended ÷ accepted"
            value={rates.no_show_rate}
            tone="warn"
          />
          <RateBar
            label="Offer yield"
            hint="selected ÷ imported"
            value={rates.offer_yield}
            tone="success"
          />
        </div>
      </SectionCard>

      {/* 4 — status distribution */}
      <SectionCard
        title="Current status"
        subtitle="Where every candidate stands right now."
      >
        <StatusDonut data={data} />
      </SectionCard>

      {/* 5 — demographic breakdowns */}
      <div className="grid gap-4 lg:grid-cols-2">
        <BreakdownCard
          title="By branch"
          rows={data.breakdowns.programme}
          series={[SERIES.imported, SERIES.accepted, SERIES.selected]}
          horizontal
        />
        <BreakdownCard
          title="By passout year"
          rows={data.breakdowns.passout_year}
          series={[SERIES.imported, SERIES.accepted, SERIES.selected]}
        />
        <BreakdownCard
          title="By gender"
          rows={data.breakdowns.gender}
          series={[SERIES.imported, SERIES.accepted, SERIES.selected]}
        />
        <BreakdownCard
          title="By entry type"
          rows={data.breakdowns.entry_type}
          series={[SERIES.imported, SERIES.accepted, SERIES.selected]}
        />
      </div>

      {/* 6 — CGPA analysis */}
      <SectionCard
        title="Academic profile"
        subtitle="Does the drive skew toward higher CGPA?"
      >
        <CgpaAnalysis data={data} />
      </SectionCard>

      {/* 7 — response dynamics */}
      {responded ? (
        <SectionCard
          title="Response dynamics"
          subtitle={`Average time to respond: ${durationLabel(
            data.response_time.avg_hours,
          )}`}
        >
          <ResponseBuckets buckets={data.response_time.buckets} />
        </SectionCard>
      ) : null}

      {/* 8 — reasons */}
      {data.reasons.denied.length > 0 || data.reasons.revoked.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <ReasonsCard
            title="Why students declined"
            rows={data.reasons.denied}
            tone="var(--color-icon-rose)"
          />
          <ReasonsCard
            title="Why we revoked"
            rows={data.reasons.revoked}
            tone="var(--color-muted-foreground)"
          />
        </div>
      ) : null}

      {/* 9 — needs attention */}
      <SectionCard title="Needs attention">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <AttentionTile
            icon={Users}
            label="Not yet invited"
            value={data.attention.not_invited}
          />
          <AttentionTile
            icon={Clock}
            label="Awaiting response"
            value={data.attention.awaiting_response}
          />
          <AttentionTile
            icon={AlertTriangle}
            label="Stale invites (7 d+)"
            value={data.attention.stale_invites}
            warn={data.attention.stale_invites > 0}
          />
          <AttentionTile
            icon={CheckCircle2}
            label="Awaiting outcome"
            value={data.attention.awaiting_outcome}
          />
        </div>
      </SectionCard>
    </div>
  )
}

// --- building blocks --------------------------------------------------------

function KpiTile({
  icon: Icon,
  color,
  label,
  value,
  sub,
  highlight,
}: {
  icon: LucideIcon
  color: string
  label: string
  value: string
  sub: string
  highlight?: boolean
}) {
  return (
    <Card
      className={cn(
        'p-4',
        highlight && 'ring-1 ring-icon-emerald/40',
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className="grid size-7 place-items-center rounded-lg text-white"
          style={{ backgroundColor: color }}
        >
          <Icon className="size-4" />
        </span>
        <span className="text-xs font-medium text-muted-foreground">
          {label}
        </span>
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums">{value}</p>
      <p className="mt-0.5 truncate text-xs text-muted-foreground" title={sub}>
        {sub}
      </p>
    </Card>
  )
}

function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <Card className="p-5">
      <div className="mb-4">
        <h2 className="text-sm font-semibold">{title}</h2>
        {subtitle ? (
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
      {children}
    </Card>
  )
}

function Funnel({
  stages,
}: {
  stages: DriveAnalytics['funnel']
}) {
  // Recharts reads each segment's colour off the datum's `fill`.
  const chartData = stages.map((s) => ({ ...s, fill: FUNNEL_COLOR[s.key] }))
  const height = Math.max(260, stages.length * 68)

  return (
    <div>
      <div style={{ width: '100%', height }}>
        <ResponsiveContainer width="100%" height="100%">
          <FunnelChart margin={{ top: 8, right: 96, bottom: 8, left: 16 }}>
            <Tooltip
              cursor={false}
              contentStyle={TOOLTIP_STYLE}
              formatter={(v) => [nf(Number(v ?? 0)), 'Students']}
            />
            <RFunnel
              dataKey="count"
              data={chartData}
              isAnimationActive
              stroke="var(--color-card)"
              strokeWidth={2}
            >
              <LabelList
                position="right"
                dataKey="label"
                stroke="none"
                fill="var(--color-foreground)"
                className="text-xs font-medium"
              />
            </RFunnel>
          </FunnelChart>
        </ResponsiveContainer>
      </div>

      {/* Counts + stage-over-stage conversion — the funnel's headline insight. */}
      <div className="mt-2 flex flex-wrap justify-center gap-x-5 gap-y-1.5">
        {stages.map((s, i) => {
          const prev = i > 0 ? stages[i - 1] : null
          const conv =
            prev && prev.count > 0 ? (s.count / prev.count) * 100 : null
          return (
            <span key={s.key} className="flex items-center gap-1.5 text-xs">
              <span
                className="size-2.5 shrink-0 rounded-sm"
                style={{ backgroundColor: FUNNEL_COLOR[s.key] }}
              />
              <span className="font-medium">{s.label}</span>
              <span className="tabular-nums text-muted-foreground">
                {nf(s.count)}
                {conv != null ? ` · ${Math.round(conv)}% of ${prev?.label}` : ''}
              </span>
            </span>
          )
        })}
      </div>
    </div>
  )
}

function RateBar({
  label,
  hint,
  value,
  tone = 'default',
}: {
  label: string
  hint: string
  value: number | null
  tone?: 'default' | 'success' | 'warn'
}) {
  const bar =
    tone === 'success'
      ? 'bg-success'
      : tone === 'warn'
        ? 'bg-warning'
        : 'bg-primary'
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-sm font-semibold tabular-nums">{pct(value)}</span>
      </div>
      <Progress
        value={value == null ? 0 : value * 100}
        indicatorClassName={value == null ? 'bg-muted-foreground/30' : bar}
      />
      <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>
    </div>
  )
}

function StatusDonut({ data }: { data: DriveAnalytics }) {
  const slices = data.status_distribution.filter((s) => s.count > 0)
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
            >
              {slices.map((s) => (
                <Cell key={s.status} fill={STATUS_COLOR[s.status]} />
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
      <ul className="grid flex-1 grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2">
        {slices.map((s) => (
          <li
            key={s.status}
            className="flex items-center gap-2 text-sm"
          >
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: STATUS_COLOR[s.status] }}
            />
            <span className="flex-1 truncate text-muted-foreground">
              {s.label}
            </span>
            <span className="font-medium tabular-nums">{nf(s.count)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

interface Series {
  key: string
  name: string
  color: string
}

function BreakdownCard({
  title,
  rows,
  series,
  horizontal,
}: {
  title: string
  rows: DriveBreakdownRow[]
  series: readonly Series[]
  horizontal?: boolean
}) {
  const empty = rows.length === 0
  const height = horizontal
    ? Math.max(140, rows.length * 44 + 20)
    : 220
  return (
    <Card className="p-5">
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      {empty ? (
        <p className="py-8 text-center text-xs text-muted-foreground">
          No data yet.
        </p>
      ) : (
        <>
          <div style={{ width: '100%', height }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={rows}
                layout={horizontal ? 'vertical' : 'horizontal'}
                margin={{ top: 4, right: 8, bottom: 4, left: 4 }}
                barGap={2}
              >
                {horizontal ? (
                  <>
                    <XAxis type="number" tick={AXIS_TICK} allowDecimals={false} />
                    <YAxis
                      type="category"
                      dataKey="label"
                      tick={AXIS_TICK}
                      width={110}
                    />
                  </>
                ) : (
                  <>
                    <XAxis dataKey="label" tick={AXIS_TICK} />
                    <YAxis tick={AXIS_TICK} allowDecimals={false} width={28} />
                  </>
                )}
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  cursor={{ fill: 'var(--color-muted)', opacity: 0.4 }}
                  formatter={(v, n) => [nf(Number(v ?? 0)), String(n)]}
                />
                {series.map((s) => (
                  <Bar
                    key={s.key}
                    dataKey={s.key}
                    name={s.name}
                    fill={s.color}
                    radius={2}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
          <Legend series={series} />
        </>
      )}
    </Card>
  )
}

function Legend({ series }: { series: readonly Series[] }) {
  return (
    <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1">
      {series.map((s) => (
        <span
          key={s.key}
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
  )
}

function CgpaAnalysis({ data }: { data: DriveAnalytics }) {
  const bands = data.breakdowns.cgpa_band
  const { avg_pool, avg_selected } = data.cgpa
  const lift =
    avg_pool != null && avg_selected != null ? avg_selected - avg_pool : null

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <StatChip label="Avg CGPA — all candidates" value={avg_pool?.toFixed(2) ?? '—'} />
        <StatChip
          label="Avg CGPA — selected"
          value={avg_selected?.toFixed(2) ?? '—'}
          accent
        />
        {lift != null ? (
          <StatChip
            label="Selected vs pool"
            value={`${lift >= 0 ? '+' : ''}${lift.toFixed(2)}`}
            tone={lift >= 0 ? 'success' : 'warn'}
          />
        ) : null}
      </div>
      {bands.length > 0 ? (
        <div style={{ width: '100%', height: 200 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={bands}
              margin={{ top: 4, right: 8, bottom: 4, left: 4 }}
              barGap={2}
            >
              <XAxis dataKey="label" tick={AXIS_TICK} />
              <YAxis tick={AXIS_TICK} allowDecimals={false} width={28} />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                cursor={{ fill: 'var(--color-muted)', opacity: 0.4 }}
                formatter={(v, n) => [nf(Number(v ?? 0)), String(n)]}
              />
              <Bar
                dataKey="imported"
                name="Candidates"
                fill="var(--color-icon-cyan)"
                radius={2}
              />
              <Bar
                dataKey="selected"
                name="Selected"
                fill="var(--color-icon-emerald)"
                radius={2}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : null}
    </div>
  )
}

function StatChip({
  label,
  value,
  accent,
  tone,
}: {
  label: string
  value: string
  accent?: boolean
  tone?: 'success' | 'warn'
}) {
  const valueColor =
    tone === 'success'
      ? 'text-success'
      : tone === 'warn'
        ? 'text-warning'
        : accent
          ? 'text-icon-emerald'
          : ''
  return (
    <div className="rounded-lg border bg-card px-3 py-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className={cn('text-lg font-bold tabular-nums', valueColor)}>{value}</p>
    </div>
  )
}

function ResponseBuckets({
  buckets,
}: {
  buckets: DriveAnalytics['response_time']['buckets']
}) {
  return (
    <div style={{ width: '100%', height: 200 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={buckets}
          margin={{ top: 4, right: 8, bottom: 4, left: 4 }}
        >
          <XAxis dataKey="label" tick={AXIS_TICK} />
          <YAxis tick={AXIS_TICK} allowDecimals={false} width={28} />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            cursor={{ fill: 'var(--color-muted)', opacity: 0.4 }}
            formatter={(v) => [nf(Number(v ?? 0)), 'Students']}
          />
          <Bar
            dataKey="count"
            name="Students"
            fill="var(--color-icon-blue)"
            radius={3}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function ReasonsCard({
  title,
  rows,
  tone,
}: {
  title: string
  rows: DriveAnalytics['reasons']['denied']
  tone: string
}) {
  const max = rows.reduce((m, r) => Math.max(m, r.count), 0)
  return (
    <Card className="p-5">
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      {rows.length === 0 ? (
        <p className="py-6 text-center text-xs text-muted-foreground">
          Nothing recorded.
        </p>
      ) : (
        <ul className="space-y-2.5">
          {rows.map((r, i) => (
            <li key={i}>
              <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 flex-1 truncate" title={r.reason}>
                  {r.reason}
                </span>
                <span className="shrink-0 font-medium tabular-nums">
                  {nf(r.count)}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${max > 0 ? (r.count / max) * 100 : 0}%`,
                    backgroundColor: tone,
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

function AttentionTile({
  icon: Icon,
  label,
  value,
  warn,
}: {
  icon: LucideIcon
  label: string
  value: number
  warn?: boolean
}) {
  return (
    <div
      className={cn(
        'rounded-lg border bg-card p-3',
        warn && 'border-warning/40 bg-warning/5',
      )}
    >
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className={cn('size-3.5', warn && 'text-warning')} />
        <span className="text-[11px] font-medium">{label}</span>
      </div>
      <p className="mt-1 text-xl font-bold tabular-nums">{nf(value)}</p>
    </div>
  )
}
