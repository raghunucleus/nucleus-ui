import { Award, Briefcase, IndianRupee, TrendingUp, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
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
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ApiError } from '@/lib/api'
import {
  getCoordinatorStudentsAnalytics,
  type CoordinatorStudentsAnalytics,
} from '@/lib/placement-coordinator-students'

/**
 * Placement Coordinator > Analytics — where this batch actually went: how many
 * were placed, at which companies, on what kind of offer, and who did best.
 *
 * Everything here comes from drives the students were *selected* in. The
 * readiness flags are deliberately absent: both default to true for every
 * student, so charting them says nothing.
 *
 * Reuses the drive-analytics building blocks (KpiTile, SectionCard, the chart
 * chrome) so the two analytics surfaces read as one system.
 */

const nf = (n: number) => n.toLocaleString('en-IN')

/** CTC is stored in LPA already; this is display only. */
const ctcLabel = (v: number | null) => (v == null ? '—' : `₹${v} LPA`)

export function CoordinatorStudentsAnalyticsTab({ payId }: { payId: number }) {
  const [data, setData] = useState<CoordinatorStudentsAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getCoordinatorStudentsAnalytics(payId)
      .then((d) => {
        if (!cancelled) {
          setData(d)
          setError(null)
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(
            e instanceof ApiError || e instanceof Error
              ? e.message
              : 'Could not load analytics.',
          )
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [payId])

  if (loading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    )
  }
  if (error) {
    return (
      <Card className="p-10 text-center text-sm text-destructive">{error}</Card>
    )
  }
  if (!data) return null

  const { totals, companies, offer_types: offerTypes } = data
  const nothingPlaced = totals.placed === 0

  return (
    <div className="space-y-4 pb-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile
          icon={Users}
          color="var(--color-icon-cyan)"
          label="Students"
          value={nf(totals.total)}
          sub={data.batch.label}
        />
        <KpiTile
          icon={TrendingUp}
          color="var(--color-icon-emerald)"
          label="Placed"
          value={nf(totals.placed)}
          sub={`${totals.placement_pct}% of the batch · ${nf(totals.total_offers)} offer${totals.total_offers === 1 ? '' : 's'}`}
          highlight
        />
        <KpiTile
          icon={Award}
          color="var(--color-icon-violet)"
          label="Highest CTC"
          value={ctcLabel(totals.highest_ctc)}
          sub="Best single offer in the batch"
        />
        <KpiTile
          icon={IndianRupee}
          color="var(--color-icon-blue)"
          label="Average CTC"
          value={ctcLabel(totals.avg_ctc)}
          sub="Across all offers"
        />
      </div>

      <SectionCard
        title="Companies placed in"
        subtitle="Students placed per company. A student with offers from two companies counts in both."
      >
        {companies.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No one in this batch has been selected in a drive yet.
          </p>
        ) : (
          <>
            <div
              style={{
                width: '100%',
                height: Math.max(160, companies.length * 40 + 30),
              }}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={companies} layout="vertical">
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--color-border)"
                    horizontal={false}
                  />
                  <XAxis type="number" tick={AXIS_TICK} allowDecimals={false} />
                  <YAxis
                    type="category"
                    dataKey="company_name"
                    tick={AXIS_TICK}
                    width={140}
                  />
                  <Tooltip contentStyle={TOOLTIP_STYLE} cursor={false} />
                  <Bar
                    dataKey="students_placed"
                    name="Students placed"
                    fill="var(--color-icon-emerald)"
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <Table className="mt-4">
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead className="text-right">Students</TableHead>
                  <TableHead className="text-right">Offers</TableHead>
                  <TableHead className="text-right">Highest CTC</TableHead>
                  <TableHead className="text-right">Average CTC</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {companies.map((c) => (
                  <TableRow key={c.company_id}>
                    <TableCell className="font-medium">
                      {c.company_name}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {nf(c.students_placed)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {nf(c.offers)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {ctcLabel(c.max_ctc)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {ctcLabel(c.avg_ctc)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard
          title="Offer types"
          subtitle="How the batch's offers split across full-time roles and internships."
        >
          {offerTypes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No offers yet.</p>
          ) : (
            <>
              <div
                style={{
                  width: '100%',
                  height: Math.max(160, offerTypes.length * 44 + 30),
                }}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={offerTypes} layout="vertical">
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="var(--color-border)"
                      horizontal={false}
                    />
                    <XAxis
                      type="number"
                      tick={AXIS_TICK}
                      allowDecimals={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="label"
                      tick={AXIS_TICK}
                      width={110}
                    />
                    <Tooltip contentStyle={TOOLTIP_STYLE} cursor={false} />
                    <Bar
                      dataKey="offers"
                      name="Offers"
                      fill="var(--color-icon-amber)"
                      radius={[0, 4, 4, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {/* A type can be both full-time and internship, so the flags are
                  shown as badges rather than folded into two buckets. */}
              <ul className="mt-3 space-y-1.5">
                {offerTypes.map((t) => (
                  <li
                    key={t.label}
                    className="flex items-center justify-between gap-2 text-sm"
                  >
                    <span className="flex items-center gap-1.5">
                      {t.label}
                      {t.is_full_time && (
                        <Badge variant="secondary">Full-time</Badge>
                      )}
                      {t.is_internship && (
                        <Badge variant="secondary">Internship</Badge>
                      )}
                    </span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {nf(t.students)} student{t.students === 1 ? '' : 's'}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </SectionCard>

        <SectionCard
          title="Top performers"
          subtitle="Ranked by number of offers, then best CTC."
        >
          {nothingPlaced ? (
            <p className="text-sm text-muted-foreground">
              No one in this batch has been selected in a drive yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10" />
                  <TableHead>Roll number</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="text-right">Offers</TableHead>
                  <TableHead className="text-right">Best CTC</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.top_performers.map((p, i) => (
                  <TableRow key={p.student_id}>
                    <TableCell>
                      {i < 3 ? (
                        <Award
                          className={
                            i === 0
                              ? 'size-4 text-icon-amber'
                              : i === 1
                                ? 'size-4 text-muted-foreground'
                                : 'size-4 text-icon-orange'
                          }
                        />
                      ) : (
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {i + 1}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {p.roll_no}
                    </TableCell>
                    <TableCell className="font-medium">
                      {p.display_name}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {nf(p.offers)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {ctcLabel(p.best_ctc)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </SectionCard>
      </div>

      {nothingPlaced && companies.length === 0 && (
        <Card className="flex items-center gap-3 p-5 text-sm text-muted-foreground">
          <Briefcase className="size-4 shrink-0" />
          Once students from this batch are marked Selected in a drive, their
          offers, companies and CTC will appear here.
        </Card>
      )}
    </div>
  )
}
