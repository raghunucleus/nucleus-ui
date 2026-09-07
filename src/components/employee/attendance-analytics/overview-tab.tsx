import {
  AlertTriangle,
  CalendarClock,
  ClipboardCheck,
  Percent,
  TriangleAlert,
  Users,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import {
  AXIS_TICK,
  TOOLTIP_STYLE,
} from '@/components/drive-management/chart-chrome'
import {
  KpiTile,
  SectionCard,
} from '@/components/drive-management/drive-analytics'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  fetchAnalyticsOverview,
  type AnalyticsRange,
  type OverviewResult,
} from '@/lib/attendance-analytics'
import {
  BAND_COLOR,
  WEEKDAYS,
  fmtPct,
  nf,
  shortDay,
} from './format'
import {
  BasisChip,
  EmptyNote,
  KpiSkeleton,
  NoteChip,
  PctBadge,
  TabToolbar,
} from './ui'
import { rangeKey, useAnalyticsQuery } from './use-analytics-query'

/** The group at a glance: how it is doing, whether attendance is even being
 *  marked, and which slots leak. */
export function OverviewTab({ range }: { range: AnalyticsRange }) {
  const { data, loading, error } = useAnalyticsQuery<OverviewResult>(
    rangeKey(range),
    () => fetchAnalyticsOverview(range),
    'Could not load the overview.',
  )

  if (loading) return <KpiSkeleton />
  if (error) return <EmptyNote>{error}</EmptyNote>
  if (!data) return null

  const { kpi, compliance, warnings } = data
  const hasData = kpi.held > 0
  const hasNotes =
    data.basis === 'sessions' ||
    warnings.duplicate_elective_sessions > 0 ||
    compliance.overdue_unmarked > 0

  return (
    <div className="space-y-4 pb-4">
      {/* Up to three stacked full-width banners collapse to one chip row. The
          sentences are unchanged — they now live inside each chip. */}
      {hasNotes && (
        <TabToolbar>
          <BasisChip basis={data.basis} />
          {warnings.duplicate_elective_sessions > 0 && (
            <NoteChip
              tone="amber"
              icon={TriangleAlert}
              detail={`${nf(warnings.duplicate_elective_sessions)} cross-group elective ${
                warnings.duplicate_elective_sessions === 1
                  ? 'class'
                  : 'classes'
              } appear more than once for the same slot. If a teacher marked both copies, those classes are counted twice. Ask an admin to clean up the duplicate sessions.`}
            >
              {nf(warnings.duplicate_elective_sessions)} duplicate elective{' '}
              {warnings.duplicate_elective_sessions === 1
                ? 'class'
                : 'classes'}
            </NoteChip>
          )}
          {compliance.overdue_unmarked > 0 && (
            <NoteChip
              tone={compliance.is_locked ? 'muted' : 'amber'}
              icon={CalendarClock}
              detail={`${
                compliance.is_locked
                  ? `This semester is closed, so the ${nf(compliance.overdue_unmarked)} unmarked ${compliance.overdue_unmarked === 1 ? 'class' : 'classes'} can no longer be marked — they are excluded from every percentage above.`
                  : `${nf(compliance.overdue_unmarked)} past ${compliance.overdue_unmarked === 1 ? 'class has' : 'classes have'} not been marked yet. Until they are, every percentage below is computed only over what was marked.`
              }${
                compliance.marked_but_empty > 0
                  ? ` ${nf(compliance.marked_but_empty)} marked ${compliance.marked_but_empty === 1 ? 'class has' : 'classes have'} no students recorded at all.`
                  : ''
              }`}
            >
              {nf(compliance.overdue_unmarked)} unmarked
            </NoteChip>
          )}
        </TabToolbar>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile
          icon={Percent}
          color="var(--color-icon-emerald)"
          label="Group attendance"
          value={hasData ? fmtPct(kpi.pct) : '—'}
          sub={`${nf(kpi.attended)} of ${nf(kpi.held)} classes attended`}
          highlight
        />
        <KpiTile
          icon={Users}
          color="var(--color-icon-cyan)"
          label="Students"
          value={nf(kpi.students)}
          sub={`${nf(kpi.below_threshold)} below ${data.thresholds.threshold}%`}
        />
        <KpiTile
          icon={AlertTriangle}
          color="var(--color-icon-rose)"
          label={`Below ${data.thresholds.condonation}%`}
          value={nf(kpi.below_condonation)}
          sub="Beyond the condonation band"
        />
        <KpiTile
          icon={ClipboardCheck}
          color="var(--color-icon-violet)"
          label="Marking done"
          value={fmtPct(compliance.pct)}
          sub={
            compliance.overdue_unmarked > 0
              ? `${nf(compliance.overdue_unmarked)} past ${compliance.overdue_unmarked === 1 ? 'class' : 'classes'} never marked`
              : 'Every past class is marked'
          }
        />
      </div>

      {!hasData ? (
        <EmptyNote>
          No attendance has been marked for this group in the selected period.
        </EmptyNote>
      ) : (
        <>
          <SectionCard
            title="Attendance trend"
            subtitle="Percentage of the group present each day"
          >
            <div style={{ width: '100%', height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.trend}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--color-border)"
                  />
                  <XAxis
                    dataKey="session_date"
                    tick={AXIS_TICK}
                    tickFormatter={shortDay}
                    minTickGap={24}
                  />
                  <YAxis
                    tick={AXIS_TICK}
                    domain={[0, 100]}
                    unit="%"
                    width={44}
                  />
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
              </ResponsiveContainer>
            </div>
          </SectionCard>

          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard
              title="How the class is spread"
              subtitle="Students in each attendance band"
            >
              <div style={{ width: '100%', height: 240 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.bands}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="var(--color-border)"
                      vertical={false}
                    />
                    <XAxis dataKey="label" tick={AXIS_TICK} />
                    <YAxis tick={AXIS_TICK} allowDecimals={false} width={32} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} cursor={false} />
                    <Bar dataKey="count" name="Students" radius={[4, 4, 0, 0]}>
                      {data.bands.map((b) => (
                        <Cell key={b.key} fill={BAND_COLOR[b.key]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>

            <SectionCard
              title="By day of the week"
              subtitle="Which days the class turns up"
            >
              <div style={{ width: '100%', height: 240 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.by_weekday}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="var(--color-border)"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="bucket"
                      tick={AXIS_TICK}
                      tickFormatter={(d: number) => WEEKDAYS[d] ?? String(d)}
                    />
                    <YAxis
                      tick={AXIS_TICK}
                      domain={[0, 100]}
                      unit="%"
                      width={44}
                    />
                    <Tooltip
                      contentStyle={TOOLTIP_STYLE}
                      cursor={false}
                      labelFormatter={(l) => WEEKDAYS[Number(l)] ?? String(l)}
                      formatter={(v) => [fmtPct(Number(v ?? 0)), 'Present']}
                    />
                    <Bar
                      dataKey="pct"
                      name="Present"
                      fill="var(--color-icon-blue)"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>
          </div>

          <SectionCard
            title="By period of the day"
            subtitle="Classes spanning several periods count against each one, so these bars compare slots — they do not add up to the group total"
          >
            <div style={{ width: '100%', height: 240 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.by_period}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--color-border)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="bucket"
                    tick={AXIS_TICK}
                    tickFormatter={(p: number) => `P${p}`}
                  />
                  <YAxis
                    tick={AXIS_TICK}
                    domain={[0, 100]}
                    unit="%"
                    width={44}
                  />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    cursor={false}
                    labelFormatter={(l) => `Period ${String(l)}`}
                    formatter={(v) => [fmtPct(Number(v ?? 0)), 'Present']}
                  />
                  <Bar
                    dataKey="pct"
                    name="Present"
                    fill="var(--color-icon-violet)"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
            {data.warnings.timetable_templates > 1 && (
              <p className="mt-2 text-xs text-muted-foreground">
                {data.warnings.timetable_templates} timetable templates
                contributed to this period, so period numbers may not line up
                across them — treat this comparison as approximate.
              </p>
            )}
          </SectionCard>

          {data.top_defaulters.length > 0 && (
            <SectionCard
              title="Needs attention first"
              subtitle="The five lowest in the group"
            >
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Roll no</TableHead>
                    <TableHead>Student</TableHead>
                    <TableHead className="text-right">Attended</TableHead>
                    <TableHead className="text-right">Held</TableHead>
                    <TableHead className="text-right">Attendance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.top_defaulters.map((s) => (
                    <TableRow key={s.student_id}>
                      <TableCell className="font-mono text-xs">
                        {s.roll_no}
                      </TableCell>
                      <TableCell>{s.display_name}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {nf(s.attended)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {nf(s.held)}
                      </TableCell>
                      <TableCell className="text-right">
                        <PctBadge pct={s.pct} band={s.band} held={s.held} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </SectionCard>
          )}
        </>
      )}
    </div>
  )
}
