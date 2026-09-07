import { useState, type Dispatch, type SetStateAction } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import {
  AXIS_TICK,
  TOOLTIP_STYLE,
} from '@/components/drive-management/chart-chrome'
import { SectionCard } from '@/components/drive-management/drive-analytics'
import { Card } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  fetchAnalyticsSubjects,
  type AnalyticsBasis,
  type AnalyticsRange,
  type SubjectRow,
} from '@/lib/attendance-analytics'
import { downloadCsv } from '@/lib/csv'
import {
  BAND_COLOR,
  fmtPct,
  nf,
} from './format'
import {
  BasisChip,
  EmptyNote,
  ExportButton,
  PctBadge,
  SubjectsSkeleton,
  TabToolbar,
} from './ui'
import { rangeKey, useAnalyticsQuery } from './use-analytics-query'

/** Which subjects the class is skipping, who teaches them, and whether those
 *  classes are even being marked. */
export function SubjectsTab({ range }: { range: AnalyticsRange }) {
  const { data, loading, error } = useAnalyticsQuery<{
    basis: AnalyticsBasis
    rows: SubjectRow[]
  }>(
    rangeKey(range),
    () => fetchAnalyticsSubjects(range),
    'Could not load the subjects.',
  )
  const [open, setOpen] = useState<number | null>(null)

  const rows = data?.rows ?? []

  const exportCsv = () => {
    downloadCsv(
      'attendance-subjects',
      [
        'Code',
        'Subject',
        'Teachers',
        'Attended',
        'Held',
        'Attendance %',
        'Classes marked',
        'Past classes unmarked',
        'Upcoming',
        'Cancelled',
      ],
      rows.map((r) => [
        r.subject_code,
        r.subject_name,
        r.teachers.join('; '),
        r.attended,
        r.held,
        r.held > 0 ? r.pct : '',
        r.sessions_marked,
        r.sessions_overdue_unmarked,
        r.sessions_upcoming,
        r.sessions_cancelled,
      ]),
    )
  }

  return (
    <div className="space-y-4 pb-4">
      <TabToolbar
        end={
          <ExportButton onClick={exportCsv} disabled={rows.length === 0} />
        }
      >
        <BasisChip basis={data?.basis ?? 'rollup'} />
      </TabToolbar>

      {loading ? (
        <SubjectsSkeleton />
      ) : error ? (
        <EmptyNote>{error}</EmptyNote>
      ) : !data ? null : rows.length === 0 ? (
        <EmptyNote>
          No subjects have any marked attendance in this period.
        </EmptyNote>
      ) : (
        <SubjectsBody rows={rows} open={open} setOpen={setOpen} />
      )}
    </div>
  )
}

/** The chart plus the per-subject cards. Split out so the tab body above stays
 *  a readable loading/error/empty switch. */
function SubjectsBody({
  rows,
  open,
  setOpen,
}: {
  rows: SubjectRow[]
  open: number | null
  setOpen: Dispatch<SetStateAction<number | null>>
}) {
  return (
    <div className="space-y-4">
      <SectionCard
        title="Attendance by subject"
        subtitle={`${nf(rows.length)} ${rows.length === 1 ? 'subject' : 'subjects'} · lowest first — the subjects the class is skipping`}
      >
        <div
          style={{
            width: '100%',
            height: Math.max(180, rows.length * 34 + 30),
          }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={[...rows].sort((a, b) => a.pct - b.pct)}
              layout="vertical"
              margin={{ left: 8, right: 16 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--color-border)"
                horizontal={false}
              />
              <XAxis type="number" tick={AXIS_TICK} domain={[0, 100]} unit="%" />
              <YAxis
                type="category"
                dataKey="subject_code"
                tick={AXIS_TICK}
                width={90}
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                cursor={false}
                formatter={(v) => [fmtPct(Number(v ?? 0)), 'Present']}
              />
              <Bar dataKey="pct" name="Present" radius={[0, 4, 4, 0]}>
                {[...rows]
                  .sort((a, b) => a.pct - b.pct)
                  .map((r) => (
                    <Cell key={r.subject_id} fill={BAND_COLOR[r.band]} />
                  ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </SectionCard>

      <div className="space-y-3">
        {rows.map((r) => (
          <Card key={r.subject_id} className="p-4">
            <button
              type="button"
              className="flex w-full items-start justify-between gap-3 text-left"
              onClick={() =>
                setOpen((v) => (v === r.subject_id ? null : r.subject_id))
              }
              aria-expanded={open === r.subject_id}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  {r.subject_name}
                </p>
                <p className="font-mono text-xs text-muted-foreground">
                  {r.subject_code}
                  {r.teachers.length > 0 && (
                    <span className="font-sans"> · {r.teachers.join(', ')}</span>
                  )}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="text-xs text-muted-foreground tabular-nums">
                  {nf(r.attended)}/{nf(r.held)}
                </span>
                <PctBadge pct={r.pct} band={r.band} held={r.held} />
              </div>
            </button>

            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>{nf(r.sessions_marked)} marked</span>
              {r.sessions_overdue_unmarked > 0 && (
                <span className="text-icon-amber">
                  {nf(r.sessions_overdue_unmarked)} past{' '}
                  {r.sessions_overdue_unmarked === 1 ? 'class' : 'classes'} not
                  marked
                </span>
              )}
              {r.sessions_upcoming > 0 && (
                <span>{nf(r.sessions_upcoming)} upcoming</span>
              )}
              {r.sessions_cancelled > 0 && (
                <span>{nf(r.sessions_cancelled)} cancelled</span>
              )}
            </div>

            {open === r.subject_id && (
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div>
                  <p className="mb-2 text-xs font-medium">
                    How the class is spread
                  </p>
                  <ul className="space-y-1">
                    {r.bands.map((b) => (
                      <li
                        key={b.key}
                        className="flex items-center gap-2 text-xs"
                      >
                        <span
                          className="size-2.5 shrink-0 rounded-sm"
                          style={{ backgroundColor: BAND_COLOR[b.key] }}
                        />
                        <span className="flex-1">{b.label}</span>
                        <span className="tabular-nums">{nf(b.count)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="mb-2 text-xs font-medium">
                    Lowest in this subject
                  </p>
                  {r.worst_students.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Nothing marked yet.
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Student</TableHead>
                          <TableHead className="text-right">Classes</TableHead>
                          <TableHead className="text-right">%</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {r.worst_students.map((w) => (
                          <TableRow key={w.student_id}>
                            <TableCell className="text-xs">
                              {w.display_name}
                              <span className="ml-1 font-mono text-muted-foreground">
                                {w.roll_no}
                              </span>
                            </TableCell>
                            <TableCell className="text-right text-xs tabular-nums">
                              {nf(w.attended)}/{nf(w.held)}
                            </TableCell>
                            <TableCell className="text-right text-xs tabular-nums">
                              {fmtPct(w.pct)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  )
}
