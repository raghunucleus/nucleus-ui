import { useEffect, useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { CalendarClock, CreditCard } from 'lucide-react'

import { PageHeader } from '@/components/portal-layout'
import { DataTable } from '@/components/data-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import {
  ACADEMIC_CONTEXT,
  FEE_DUES,
  FEE_PAYMENTS,
  FEE_STRUCTURE,
  feeTotals,
  formatDate,
  formatINR,
  type FeeComponent,
  type FeeDue,
  type FeePayment,
} from '@/lib/academics-mock'

/** Whole days from today until an ISO date (negative = overdue). */
function daysUntil(iso: string): number {
  const due = new Date(`${iso}T00:00:00`).getTime()
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((due - today.getTime()) / 86_400_000)
}

export default function Fees() {
  useEffect(() => {
    document.title = 'Fees — Nucleus'
  }, [])

  const totals = feeTotals()
  const paidPercent = totals.total === 0 ? 0 : (totals.paid / totals.total) * 100

  const structureColumns = useMemo(() => {
    const col = createColumnHelper<FeeComponent>()
    return [
      col.accessor('label', {
        header: 'Component',
        cell: (ctx) => (
          <span className="font-medium text-foreground">{ctx.getValue()}</span>
        ),
        footer: () => (
          <span className="font-semibold text-foreground">Total payable</span>
        ),
      }),
      col.accessor('amount', {
        header: () => <span className="block text-right">Amount</span>,
        cell: (ctx) => (
          <span className="block text-right tabular-nums">
            {formatINR(ctx.getValue())}
          </span>
        ),
        footer: () => (
          <span className="block text-right font-bold tabular-nums text-foreground">
            {formatINR(totals.total)}
          </span>
        ),
      }),
    ]
  }, [totals.total])

  const paymentColumns = useMemo(() => {
    const col = createColumnHelper<FeePayment>()
    return [
      col.accessor('date', {
        header: 'Date',
        cell: (ctx) => (
          <span className="whitespace-nowrap text-muted-foreground">
            {formatDate(ctx.getValue())}
          </span>
        ),
      }),
      col.accessor('description', {
        header: 'Description',
        cell: (ctx) => (
          <span className="font-medium text-foreground">{ctx.getValue()}</span>
        ),
      }),
      col.accessor('receiptNo', {
        header: 'Receipt no.',
        cell: (ctx) => (
          <span className="font-mono text-xs text-muted-foreground">
            {ctx.getValue()}
          </span>
        ),
      }),
      col.accessor('mode', {
        header: 'Mode',
        cell: (ctx) => (
          <span className="text-muted-foreground">{ctx.getValue()}</span>
        ),
      }),
      col.accessor('amount', {
        header: () => <span className="block text-right">Amount</span>,
        cell: (ctx) => (
          <span className="block text-right font-semibold tabular-nums text-foreground">
            {formatINR(ctx.getValue())}
          </span>
        ),
      }),
      col.display({
        id: 'status',
        header: () => <span className="block text-center">Status</span>,
        cell: () => (
          <div className="text-center">
            <Badge variant="success">Paid</Badge>
          </div>
        ),
      }),
    ]
  }, [])

  return (
    <>
      <PageHeader
        title="Fees"
        subtitle={`${ACADEMIC_CONTEXT.programme} · ${ACADEMIC_CONTEXT.academicYear}`}
        icon={CreditCard}
        accent="rose"
      />

      <Card className="p-5 sm:p-6">
        <div className="grid gap-6 sm:grid-cols-[auto_1fr] sm:items-center">
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Pending dues
            </p>
            <p className="text-3xl font-semibold tracking-tight tabular-nums">
              {formatINR(totals.pending)}
            </p>
            <Badge variant={totals.pending > 0 ? 'warning' : 'success'}>
              {totals.pending > 0 ? 'Payment due' : 'All cleared'}
            </Badge>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Progress value={paidPercent} indicatorClassName="bg-success" />
              <p className="text-xs text-muted-foreground">
                {formatINR(totals.paid)} of {formatINR(totals.total)} paid
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Stat label="Total" value={formatINR(totals.total)} />
              <Stat
                label="Paid"
                value={formatINR(totals.paid)}
                tone="text-success"
              />
              <Stat
                label="Pending"
                value={formatINR(totals.pending)}
                tone="text-warning"
              />
            </div>
          </div>
        </div>
      </Card>

      {FEE_DUES.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">
            Upcoming dues
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {FEE_DUES.map((due) => (
              <DueCard key={due.label} due={due} />
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">
          Fee structure · {ACADEMIC_CONTEXT.academicYear}
        </h2>
        <Card className="overflow-hidden">
          <DataTable columns={structureColumns} data={FEE_STRUCTURE} showFooter />
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">
          Payment history
        </h2>
        <Card className="overflow-hidden">
          <DataTable columns={paymentColumns} data={FEE_PAYMENTS} />
        </Card>
      </section>
    </>
  )
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: string
}) {
  return (
    <div className="rounded-lg bg-muted/50 p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className={cn('mt-0.5 text-sm font-bold tabular-nums', tone)}>
        {value}
      </p>
    </div>
  )
}

function DueCard({ due }: { due: FeeDue }) {
  const days = daysUntil(due.dueDate)
  const overdue = days < 0

  return (
    <Card className="space-y-3 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">{due.label}</h3>
          <p className="mt-0.5 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarClock className="size-3.5" />
            Due {formatDate(due.dueDate)}
          </p>
        </div>
        <p className="text-xl font-bold tabular-nums">{formatINR(due.amount)}</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Badge variant={overdue ? 'destructive' : 'warning'}>
          {overdue
            ? `Overdue by ${Math.abs(days)} days`
            : days === 0
              ? 'Due today'
              : `Due in ${days} days`}
        </Badge>
        <Button size="sm">Pay {formatINR(due.amount)}</Button>
      </div>
    </Card>
  )
}
