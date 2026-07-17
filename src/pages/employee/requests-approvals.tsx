import { useSearch } from '@tanstack/react-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleAlert,
  ExternalLink,
  Inbox,
  RefreshCw,
  Undo2,
  X,
} from 'lucide-react'
import { toast } from 'sonner'

import { formatDate, Textarea } from '@/components/corporate-relations/bits'
import { NoAccessEmptyState } from '@/components/employee/empty-states'
import { ApproversList } from '@/components/requests/approvers-list'
import {
  RequestModulesPanel,
  type TypeFilter,
} from '@/components/requests/request-modules-panel'
import { RequestTimeline } from '@/components/requests/request-timeline'
import {
  StatusChips,
  type StatusFilter,
} from '@/components/requests/status-chips'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
  decideApproval,
  decideApprovalMixed,
  fetchApproval,
  fetchApprovalCatalog,
  fetchApprovalCounts,
  fetchApprovals,
  sendBackApproval,
  type ApprovalDetail as ApprovalDetailData,
  type ApprovalRow,
  type Paginated,
} from '@/lib/employee-requests'
import {
  changeCertificateUrl,
  changeFromText,
  changeToText,
  labelForChange,
  PROFILE_FIELD_LABELS,
  REQUEST_STATUS_LABELS,
  requestStatusVariant,
  typeLabel,
  type CatalogModule,
  type ItemOutcome,
  type RequestStatus,
  type RequestStatusCounts,
  type RequestType,
} from '@/lib/student-requests'
import { cn } from '@/lib/utils'

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
  }, [status, typeFilter, page])

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
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Approvals</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Requests from students of the batches you verify.
        </p>
      </header>

      <StatusChips
        value={status}
        counts={counts}
        onChange={(next) => {
          setStatus(next)
          setPage(1)
        }}
      />

      <div className="grid gap-4 lg:grid-cols-[16rem_1fr] lg:items-start">
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
                  ? 'Profile-update requests from students of your batches will appear here.'
                  : 'Requests with this status will appear here.'}
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Programme</TableHead>
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
                      <p className="font-medium">{row.student.display_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {row.student.student_id}
                      </p>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm">{row.student.programme_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {row.student.admission_year_display}
                      </p>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm">
                        {typeLabel(catalog, row.request_type)}
                      </p>
                      <p className="max-w-52 truncate text-xs text-muted-foreground">
                        {(row.payload.changes ?? [])
                          .map((c) => labelForChange(c))
                          .join(', ')}
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
  // Per-field verdicts — every field defaults to approve; the submit button
  // adapts to the split (approve all / reject all / mixed).
  const [verdicts, setVerdicts] = useState<Record<string, ItemOutcome>>(() =>
    Object.fromEntries(
      (row.payload.changes ?? []).map((c) => [c.field, 'approved']),
    ),
  )
  const [confirming, setConfirming] = useState(false)
  const [sendingBack, setSendingBack] = useState(false)
  // The row from the list has no approvers/timeline — fetch the full view.
  // Rendering starts from `row` so the page doesn't flash a skeleton.
  const [detail, setDetail] = useState<ApprovalDetailData | null>(null)

  // Prefer the detail payload once loaded: the server enriches it per view
  // (presigned certificate links exist only there). Same item keys either way.
  const changes = (detail ?? row).payload.changes ?? []

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

  const values = changes.map((c) => verdicts[c.field] ?? 'approved')
  const approvedCount = values.filter((v) => v === 'approved').length
  const plan: DecisionPlan =
    approvedCount === values.length
      ? { kind: 'approve' }
      : approvedCount === 0
        ? { kind: 'reject' }
        : { kind: 'mixed', verdicts }
  const planLabel =
    plan.kind === 'approve'
      ? 'Approve all'
      : plan.kind === 'reject'
        ? 'Reject all'
        : `Submit decision (${approvedCount} approved · ${values.length - approvedCount} rejected)`

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button size="sm" variant="outline" onClick={onBack}>
            <ArrowLeft className="size-4" /> Back
          </Button>
          <div>
            <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
              {typeLabel(catalog, row.request_type)}
              <Badge variant={requestStatusVariant(row.status)}>
                {REQUEST_STATUS_LABELS[row.status] ?? row.status}
              </Badge>
            </h1>
            <p className="text-xs text-muted-foreground">
              Submitted {formatDate(row.created_at)}
            </p>
          </div>
        </div>
        {decidable && (
          <div className="flex flex-wrap items-center gap-2">
            {canSendBack && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSendingBack(true)}
              >
                <Undo2 className="size-4" /> Send back
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
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[20rem_1fr] lg:items-start">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Student
          </p>
          <p className="mt-1.5 font-medium">{row.student.display_name}</p>
          <p className="text-sm text-muted-foreground">
            {row.student.student_id}
          </p>
          <p className="mt-2 text-sm">{row.student.programme_name}</p>
          <p className="text-xs text-muted-foreground">
            Admission year {row.student.admission_year_display}
          </p>

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
                Requested changes
              </p>
              {decidable && (
                <p className="text-[11px] text-muted-foreground">
                  Decide each field, then submit
                </p>
              )}
            </div>
            {/* The extended profile can put dozens of items on one request —
                cap the list and scroll inside it. */}
            <div className="max-h-[32rem] space-y-1.5 overflow-y-auto p-3">
              {changes.map((c) => {
                const certificateUrl = changeCertificateUrl(c)
                return (
                  <div
                    key={c.field}
                    className="flex flex-wrap items-center gap-2 rounded-md bg-muted/30 px-3 py-2 text-sm"
                  >
                    <span className="w-32 shrink-0 text-xs font-medium text-muted-foreground">
                      {labelForChange(c)}
                    </span>
                    <span className="text-muted-foreground line-through">
                      {changeFromText(c)}
                    </span>
                    <ArrowRight className="size-3.5 text-muted-foreground" />
                    <span className="min-w-0 flex-1 font-medium break-words">
                      {changeToText(c)}
                      {certificateUrl && (
                        <a
                          href={certificateUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="ml-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                        >
                          <ExternalLink className="size-3" /> View certificate
                        </a>
                      )}
                    </span>
                    {decidable ? (
                      <VerdictToggle
                        value={verdicts[c.field] ?? 'approved'}
                        onChange={(v) =>
                          setVerdicts((prev) => ({ ...prev, [c.field]: v }))
                        }
                      />
                    ) : c.outcome ? (
                      <Badge
                        variant={
                          c.outcome === 'approved' ? 'success' : 'destructive'
                        }
                      >
                        {c.outcome === 'approved' ? 'Approved' : 'Rejected'}
                      </Badge>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </div>

          {row.requester_note && (
            <div className="rounded-lg border bg-card p-4">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Student's note
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
        plan={confirming ? plan : null}
        onOpenChange={(open) => !open && setConfirming(false)}
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

/**
 * Send-back confirmation. The note is REQUIRED — it is the only thing telling
 * the student what to fix, so the button stays disabled until there is one.
 */
function SendBackDialog({
  row,
  open,
  onOpenChange,
  onDone,
}: {
  row: ApprovalRow
  open: boolean
  onOpenChange: (open: boolean) => void
  onDone: () => void
}) {
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) setNote('')
  }, [open])

  async function onConfirm() {
    if (!note.trim()) return
    setBusy(true)
    try {
      await sendBackApproval(row.id, note.trim())
      toast.success('Sent back to the student for changes.')
      onDone()
    } catch (err) {
      toast.error(errMsg(err, 'Could not send the request back.'))
      // 409 = someone decided it first; refresh so the stale view goes away.
      if (err instanceof ApiError && err.status === 409) onDone()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Send back for changes?</DialogTitle>
          <DialogDescription>
            Nothing is applied to {row.student.display_name}&apos;s profile.
            They can revise the request and resubmit it, or cancel it.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <label
            htmlFor="send-back-note"
            className="text-sm font-medium leading-none"
          >
            What needs changing?
          </label>
          <Textarea
            id="send-back-note"
            placeholder="Tell the student exactly what to fix — this is all they will see"
            value={note}
            maxLength={1000}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            disabled={busy || !note.trim()}
            onClick={() => void onConfirm()}
          >
            {busy ? 'Sending…' : 'Send back'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Small Approve/Reject segmented toggle for one change row. */
function VerdictToggle({
  value,
  onChange,
}: {
  value: ItemOutcome
  onChange: (v: ItemOutcome) => void
}) {
  return (
    <div className="flex shrink-0 overflow-hidden rounded-md border">
      <button
        type="button"
        aria-pressed={value === 'approved'}
        onClick={() => onChange('approved')}
        className={cn(
          'flex items-center gap-1 px-2 py-1 text-xs font-medium transition-colors',
          value === 'approved'
            ? 'bg-success/15 text-success'
            : 'bg-card text-muted-foreground hover:bg-muted/40',
        )}
      >
        <Check className="size-3" /> Approve
      </button>
      <button
        type="button"
        aria-pressed={value === 'rejected'}
        onClick={() => onChange('rejected')}
        className={cn(
          'flex items-center gap-1 border-l px-2 py-1 text-xs font-medium transition-colors',
          value === 'rejected'
            ? 'bg-destructive/15 text-destructive'
            : 'bg-card text-muted-foreground hover:bg-muted/40',
        )}
      >
        <X className="size-3" /> Reject
      </button>
    </div>
  )
}

type DecisionPlan =
  | { kind: 'approve' }
  | { kind: 'reject' }
  | { kind: 'mixed'; verdicts: Record<string, ItemOutcome> }

function DecisionDialog({
  row,
  plan,
  onOpenChange,
  onDone,
}: {
  row: ApprovalRow
  plan: DecisionPlan | null
  onOpenChange: (open: boolean) => void
  onDone: () => void
}) {
  const [note, setNote] = useState('')
  // Mixed verdicts don't get their own status — the approver marks the
  // request Approved or Rejected here.
  const [overall, setOverall] = useState<ItemOutcome>('approved')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (plan) {
      setNote('')
      setOverall('approved')
    }
  }, [plan])

  async function onConfirm() {
    if (!plan) return
    setBusy(true)
    try {
      if (plan.kind === 'mixed') {
        await decideApprovalMixed(
          row.id,
          plan.verdicts,
          overall,
          note.trim() || undefined,
        )
        toast.success(
          'Decision recorded — approved fields applied to the student profile.',
        )
      } else {
        await decideApproval(row.id, plan.kind, note.trim() || undefined)
        toast.success(
          plan.kind === 'approve'
            ? 'Request approved — changes applied to the student profile.'
            : 'Request rejected.',
        )
      }
      onDone()
    } catch (err) {
      // 409s cover both "someone else decided first" and "value now clashes";
      // surface the server message and refresh either way.
      toast.error(errMsg(err, 'Could not record the decision.'))
      if (err instanceof ApiError && err.status === 409) onDone()
    } finally {
      setBusy(false)
    }
  }

  const kind = plan?.kind ?? 'approve'
  const rejectedLabels =
    plan?.kind === 'mixed'
      ? Object.entries(plan.verdicts)
          .filter(([, v]) => v === 'rejected')
          .map(
            ([f]) =>
              PROFILE_FIELD_LABELS[f] ??
              (f.startsWith('certification:') ? 'a certification' : f),
          )
          .join(', ')
      : ''

  return (
    <Dialog open={plan !== null} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {kind === 'approve'
              ? 'Approve request?'
              : kind === 'reject'
                ? 'Reject request?'
                : 'Submit mixed decision?'}
          </DialogTitle>
          <DialogDescription>
            {kind === 'approve'
              ? `The requested changes will be applied to ${row.student.display_name}'s profile immediately.`
              : kind === 'reject'
                ? `${row.student.display_name} will be notified that the request was rejected.`
                : `Approved fields will be applied to ${row.student.display_name}'s profile immediately; the rest are rejected (${rejectedLabels}).`}
          </DialogDescription>
        </DialogHeader>
        {kind === 'mixed' && (
          <div className="space-y-1.5">
            <p className="text-sm font-medium leading-none">
              Mark the request as
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                aria-pressed={overall === 'approved'}
                onClick={() => setOverall('approved')}
                className={cn(
                  'flex-1 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors',
                  overall === 'approved'
                    ? 'border-success/40 bg-success/10 text-success'
                    : 'bg-card text-muted-foreground hover:bg-muted/40',
                )}
              >
                Approved
              </button>
              <button
                type="button"
                aria-pressed={overall === 'rejected'}
                onClick={() => setOverall('rejected')}
                className={cn(
                  'flex-1 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors',
                  overall === 'rejected'
                    ? 'border-destructive/40 bg-destructive/10 text-destructive'
                    : 'bg-card text-muted-foreground hover:bg-muted/40',
                )}
              >
                Rejected
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              The per-field results are kept either way — this is the status
              the request shows overall.
            </p>
          </div>
        )}
        <div className="space-y-1.5">
          <label
            htmlFor="decision-note"
            className="text-sm font-medium leading-none"
          >
            Note (optional)
          </label>
          <Textarea
            id="decision-note"
            placeholder="Visible to the student"
            value={note}
            maxLength={1000}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            variant={
              kind === 'reject' || (kind === 'mixed' && overall === 'rejected')
                ? 'destructive'
                : 'default'
            }
            disabled={busy}
            onClick={() => void onConfirm()}
          >
            {busy
              ? 'Saving…'
              : kind === 'approve'
                ? 'Approve'
                : kind === 'reject'
                  ? 'Reject'
                  : 'Submit decision'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
