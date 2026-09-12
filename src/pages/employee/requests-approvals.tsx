import { useSearch } from '@tanstack/react-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, CircleAlert, Inbox, RefreshCw, Undo2, X } from 'lucide-react'
import { toast } from 'sonner'

import { formatDate } from '@/components/corporate-relations/bits'
import { NoAccessEmptyState } from '@/components/employee/empty-states'
import { ApproversList } from '@/components/requests/approvers-list'
import {
  DecisionDialog,
  SendBackDialog,
  type DecisionPlan,
} from '@/components/requests/decision-dialogs'
import {
  RequestFilters,
  type DateRange,
  type SortDir,
} from '@/components/requests/request-filters'
import { RequestAvatar } from '@/components/requests/request-avatar'
import {
  RequestModulesPanel,
  type TypeFilter,
} from '@/components/requests/request-modules-panel'
import { rendererFor } from '@/components/requests/payloads'
import { RequestTimeline } from '@/components/requests/request-timeline'
import {
  StatusChips,
  type StatusFilter,
} from '@/components/requests/status-chips'
import { BackButton } from '@/components/ui/back-button'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { Pagination } from '@/components/ui/pagination'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useScreenAccess } from '@/hooks/use-screen-access'
import { ApiError } from '@/lib/api'
import {
  fetchApproval,
  fetchApprovalCatalog,
  fetchApprovalCounts,
  fetchApprovals,
  type ApprovalDetail as ApprovalDetailData,
  type ApprovalRow,
  type Paginated,
} from '@/lib/employee-requests'
import {
  REQUEST_STATUS_LABELS,
  requestStatusVariant,
  typeLabel,
  type CatalogModule,
  type ItemOutcome,
  type RequestStatus,
  type RequestStatusCounts,
  type RequestType,
} from '@/lib/student-requests'

const SCREEN_KEY = 'requests.approvals.review'
const PAGE_SIZE = 20

function errMsg(err: unknown, fallback: string): string {
  return err instanceof ApiError || err instanceof Error
    ? err.message
    : fallback
}

export default function EmployeeRequestsApprovalsPage() {
  const access = useScreenAccess(SCREEN_KEY)

  useEffect(() => {
    document.title = 'Approvals — Nucleus'
  }, [])

  if (!access) return <NoAccessEmptyState />
  return <Approvals actions={access.actions} />
}

function Approvals({ actions }: { actions: string[] }) {
  // Defaults to the actionable slice — an approver opens this to work a queue.
  const [status, setStatus] = useState<StatusFilter>('pending')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>(null)
  const [dateRange, setDateRange] = useState<DateRange>(null)
  const [sortDir, setSortDir] = useState<SortDir>('newest')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<Paginated<ApprovalRow> | null>(null)
  const [catalog, setCatalog] = useState<CatalogModule[]>([])
  const [counts, setCounts] = useState<RequestStatusCounts>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<ApprovalRow | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  // The tree never changes with the filters — fetch it once.
  useEffect(() => {
    fetchApprovalCatalog()
      .then(setCatalog)
      .catch(() => setCatalog([]))
  }, [])

  // `?open=<id>` — the deep-link a "needs your review" notification lands on.
  // The detail view needs the whole row, and the id may not be on the current
  // page (or under the current filter), so fetch it directly rather than
  // hunting for it in `data`. Runs once per id: `openId` comes from the URL and
  // clearing the selection deliberately doesn't re-trigger it.
  const openId = useSearch({ strict: false }).open as number | undefined
  const openedRef = useRef<number | null>(null)
  useEffect(() => {
    if (!openId || openedRef.current === openId) return
    openedRef.current = openId
    fetchApproval(openId)
      .then(setSelected)
      .catch(() =>
        // Decided by someone else, or not one of this employee's batches (the
        // server 404s rather than 403s). The queue behind it is still useful.
        toast.info('That request is no longer available to you.'),
      )
  }, [openId])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [rows, cnt] = await Promise.all([
        fetchApprovals({
          status: status === 'all' ? 'all' : (status as RequestStatus),
          type: typeFilter ? (typeFilter as RequestType) : undefined,
          from: dateRange?.from,
          to: dateRange?.to,
          sort: sortDir,
          page,
          limit: PAGE_SIZE,
        }),
        fetchApprovalCounts(),
      ])
      setData(rows)
      setCounts(cnt)
    } catch (err) {
      setError(errMsg(err, 'Could not load approvals.'))
    } finally {
      setLoading(false)
    }
  }, [status, typeFilter, dateRange, sortDir, page])

  useEffect(() => {
    void load()
  }, [load, reloadToken])

  const refresh = () => setReloadToken((t) => t + 1)

  if (selected) {
    return (
      <ApprovalDetail
        row={selected}
        actions={actions}
        catalog={catalog}
        onBack={() => setSelected(null)}
        onDecided={() => {
          setSelected(null)
          refresh()
        }}
      />
    )
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1

  return (
    <div className="space-y-4">
      <PageHeader title="Approvals" />

      <StatusChips
        value={status}
        counts={counts}
        onChange={(next) => {
          setStatus(next)
          setPage(1)
        }}
      />

      <RequestFilters
        value={dateRange}
        onChange={(next) => {
          setDateRange(next)
          setPage(1)
        }}
        sort={sortDir}
        onSortChange={(next) => {
          setSortDir(next)
          setPage(1)
        }}
      />

      <div className="grid gap-4 lg:grid-cols-[16rem_minmax(0,1fr)] lg:items-start">
        <RequestModulesPanel
          catalog={catalog}
          value={typeFilter}
          onChange={(next) => {
            setTypeFilter(next)
            setPage(1)
          }}
        />

        <div className="space-y-4">
          {loading ? (
            <div className="space-y-2">
              {[0, 1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-12 animate-pulse rounded-lg bg-muted"
                />
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border bg-card p-10 text-center">
              <CircleAlert className="size-6 text-destructive" />
              <p className="text-sm text-muted-foreground">{error}</p>
              <Button size="sm" onClick={refresh}>
                <RefreshCw className="size-4" /> Try again
              </Button>
            </div>
          ) : !data || data.items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed bg-muted/20 px-6 py-14 text-center">
              <Inbox className="size-8 text-muted-foreground" />
              <h3 className="text-sm font-medium">
                {status === 'pending'
                  ? 'Nothing waiting for you'
                  : 'No requests here'}
              </h3>
              <p className="max-w-sm text-xs text-muted-foreground">
                {status === 'pending'
                  ? 'Requests awaiting your decision will appear here.'
                  : 'Requests with this status will appear here.'}
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto rounded-lg border">
            <Table zebra>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Requester</TableHead>
                  <TableHead>Context</TableHead>
                  <TableHead>Request</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((row) => (
                  <TableRow
                    key={row.id}
                    className="cursor-pointer"
                    onClick={() => setSelected(row)}
                  >
                    <TableCell>
                      <RequestAvatar row={row} catalog={catalog} />
                    </TableCell>
                    <TableCell>
                      <p className="font-medium">{row.requester.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {row.requester.code}
                      </p>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm">{row.requester.subtitle ?? '—'}</p>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm">
                        {typeLabel(catalog, row.request_type)}
                      </p>
                      <p className="max-w-52 truncate text-xs text-muted-foreground">
                        {rendererFor(row.request_type).summary(row)}
                      </p>
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatDate(row.created_at)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={requestStatusVariant(row.status)}>
                        {REQUEST_STATUS_LABELS[row.status] ?? row.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
              </div>
              {totalPages > 1 && (
                <div className="flex justify-end">
                  <Pagination
                    page={page}
                    totalPages={totalPages}
                    onPage={setPage}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function ApprovalDetail({
  row,
  actions,
  catalog,
  onBack,
  onDecided,
}: {
  row: ApprovalRow
  actions: string[]
  catalog: CatalogModule[]
  onBack: () => void
  onDecided: () => void
}) {
  const canApprove = actions.includes('approve')
  const canReject = actions.includes('reject')
  const canSendBack = actions.includes('send_back')
  const decidable = row.status === 'pending' && (canApprove || canReject)
  const renderer = rendererFor(row.request_type)

  // Per-item verdicts (types that support them) and the approver's own edits.
  // Both are seeded by the renderer, which owns the payload's shape.
  const [verdicts, setVerdicts] = useState<Record<string, ItemOutcome>>(() =>
    renderer.initialVerdicts ? renderer.initialVerdicts(row) : {},
  )
  const [overrides, setOverrides] = useState<Record<string, unknown>>(() =>
    renderer.initialOverrides ? renderer.initialOverrides(row) : {},
  )
  const [confirming, setConfirming] = useState(false)
  // Whole-request types get an explicit Reject button, so its confirmation is
  // tracked separately from the primary (approve) one.
  const [rejecting, setRejecting] = useState(false)
  const [sendingBack, setSendingBack] = useState(false)
  // The row from the list has no approvers/timeline — fetch the full view.
  // Rendering starts from `row` so the page doesn't flash a skeleton.
  const [detail, setDetail] = useState<ApprovalDetailData | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchApproval(row.id)
      .then((d) => !cancelled && setDetail(d))
      .catch(() => {
        /* The decision UI works without it; the panels just stay empty. */
      })
    return () => {
      cancelled = true
    }
  }, [row.id])

  // Per-item types derive the plan from the verdict split; whole-request types
  // are approved or rejected outright, so the approver picks explicitly.
  const values = Object.values(verdicts)
  const approvedCount = values.filter((v) => v === 'approved').length
  const plan: DecisionPlan = !renderer.perItem
    ? { kind: 'approve' }
    : approvedCount === values.length
      ? { kind: 'approve' }
      : approvedCount === 0
        ? { kind: 'reject' }
        : { kind: 'mixed', verdicts }
  const planLabel = !renderer.perItem
    ? 'Approve'
    : plan.kind === 'approve'
      ? 'Approve all'
      : plan.kind === 'reject'
        ? 'Reject all'
        : `Submit decision (${approvedCount} approved · ${values.length - approvedCount} rejected)`

  return (
    <div className="space-y-4">
      <PageHeader
        leading={
          <BackButton iconOnly label="Back to approvals" onClick={onBack} />
        }
        title={typeLabel(catalog, row.request_type)}
        actions={
          decidable && (
            <>
              {canSendBack && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSendingBack(true)}
                >
                  <Undo2 className="size-4" /> Send back
                </Button>
              )}
              {!renderer.perItem && canReject && (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => setRejecting(true)}
                >
                  <X className="size-4" /> Reject
                </Button>
              )}
              <Button
                size="sm"
                variant={plan.kind === 'reject' ? 'destructive' : 'default'}
                onClick={() => setConfirming(true)}
              >
                {plan.kind === 'reject' ? (
                  <X className="size-4" />
                ) : (
                  <Check className="size-4" />
                )}
                {planLabel}
              </Button>
            </>
          )
        }
      />
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Badge variant={requestStatusVariant(row.status)}>
          {REQUEST_STATUS_LABELS[row.status] ?? row.status}
        </Badge>
        <span>Submitted {formatDate(row.created_at)}</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[20rem_1fr] lg:items-start">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {row.requester.kind === 'student' ? 'Student' : 'Raised by'}
          </p>
          <p className="mt-1.5 font-medium">{row.requester.name}</p>
          <p className="text-sm text-muted-foreground">{row.requester.code}</p>
          {row.requester.subtitle && (
            <p className="mt-2 text-sm">{row.requester.subtitle}</p>
          )}

          {detail && (
            <>
              <p className="mt-4 border-t pt-4 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Approvers
              </p>
              <ApproversList
                className="mt-2"
                approvers={detail.approvers}
                isDecided={row.status !== 'pending'}
              />

              <p className="mt-4 border-t pt-4 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                History
              </p>
              <RequestTimeline className="mt-2" timeline={detail.timeline} />
            </>
          )}
        </div>

        <div className="space-y-3">
          <div className="rounded-lg border bg-card">
            <div className="flex items-center justify-between border-b px-4 py-2.5">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {renderer.title}
              </p>
              {decidable && renderer.perItem && (
                <p className="text-[11px] text-muted-foreground">
                  Decide each field, then submit
                </p>
              )}
            </div>
            <renderer.Body
              row={row}
              detail={detail}
              editable={decidable}
              verdicts={verdicts}
              setVerdicts={setVerdicts}
              overrides={overrides}
              setOverrides={setOverrides}
            />
          </div>

          {row.requester_note && (
            <div className="rounded-lg border bg-card p-4">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Requester's note
              </p>
              <p className="mt-1 text-sm">{row.requester_note}</p>
            </div>
          )}

          {/* A sent-back request is NOT decided — it is parked with the
              student. Same columns carry who/when/why, so label by status. */}
          {row.status !== 'pending' && (
            <div className="rounded-lg border bg-card p-4">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {row.status === 'sent_back' ? 'Sent back' : 'Decision'}
              </p>
              <p className="mt-1 text-sm">
                {row.status === 'sent_back'
                  ? 'Waiting on the student to revise and resubmit'
                  : (REQUEST_STATUS_LABELS[row.status] ?? row.status)}
                {row.decided_by ? ` · ${row.decided_by.emp_display_name}` : ''}
                {row.decided_at ? ` · ${formatDate(row.decided_at)}` : ''}
              </p>
              {row.decision_note && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {row.decision_note}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <DecisionDialog
        row={row}
        plan={confirming ? plan : rejecting ? { kind: 'reject' } : null}
        overrides={overrides}
        onOpenChange={(open) => {
          if (!open) {
            setConfirming(false)
            setRejecting(false)
          }
        }}
        onDone={onDecided}
      />
      <SendBackDialog
        row={row}
        open={sendingBack}
        onOpenChange={setSendingBack}
        onDone={onDecided}
      />
    </div>
  )
}
