import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import {
  ArrowLeft,
  CalendarOff,
  ChevronRight,
  CircleAlert,
  FileText,
  Paperclip,
  Plane,
  Plus,
  RefreshCw,
  TriangleAlert,
  Upload,
  X,
} from 'lucide-react'
import { toast } from 'sonner'

import { PageHeader } from '@/components/portal-layout'
import { ApproversList } from '@/components/requests/approvers-list'
import {
  LeaveAttachments,
  LeaveFacts,
  LeaveReason,
} from '@/components/requests/payloads/leave-bits'
import { RequestTimeline } from '@/components/requests/request-timeline'
import { StateView } from '@/components/state-view'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Combobox } from '@/components/ui/combobox'
import { DatePicker } from '@/components/ui/date-picker'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Segmented } from '@/components/ui/segmented'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { ApiError } from '@/lib/api'
import { fetchStudentWeek } from '@/lib/student-academics'
import {
  applyLeave,
  fetchLeave,
  fetchLeaveContext,
  fetchLeaveCounts,
  fetchMyLeaves,
  LEAVE_ATTACHMENT_MAX_BYTES,
  LEAVE_ATTACHMENT_MIMES,
  LEAVE_MAX_ATTACHMENTS,
  LEAVE_STATUS_LABELS,
  LEAVE_STATUSES,
  leaveStatusVariant,
  requestLeaveCancel,
  resubmitLeave,
  withdrawLeave,
  type LeaveAttachmentInput,
  type LeaveContext,
  type LeaveStatus,
  type LeaveStatusCounts,
  type StudentLeave,
  stageLeaveFile,
} from '@/lib/student-leaves'
import {
  fetchMyRequest,
  formatLeaveRange,
  formatLeaveWhen,
  shortTime,
  REQUEST_STATUS_LABELS,
  requestStatusVariant,
  type RequestStatus,
  type StudentRequestDetail,
} from '@/lib/student-requests'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'

function errMsg(err: unknown, fallback: string): string {
  return err instanceof ApiError || err instanceof Error
    ? err.message
    : fallback
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

type StatusFilter = LeaveStatus | 'all'

/**
 * Leaves — apply for leave, follow each application through its approval, and
 * ask to cancel an approved one. The approval itself runs through the requests
 * framework (My Requests shows the same items as generic requests); this
 * screen is the leave-shaped view with the actions that belong to a leave.
 */
export default function Leaves() {
  const signOut = useAuthStore((state) => state.signOut)
  const navigate = useNavigate()
  const search = useSearch({ strict: false }) as {
    open?: number
    edit?: number
    apply?: boolean
  }

  const [leaves, setLeaves] = useState<StudentLeave[] | null>(null)
  const [counts, setCounts] = useState<LeaveStatusCounts>({})
  const [context, setContext] = useState<LeaveContext | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [openId, setOpenId] = useState<number | null>(search.open ?? null)
  const [form, setForm] = useState<
    { kind: 'apply' } | { kind: 'edit'; leave: StudentLeave } | null
  >(search.apply ? { kind: 'apply' } : null)
  // `?edit=<id>` arrives before the list has loaded — resolve it once it has.
  const pendingEdit = useRef<number | null>(search.edit ?? null)

  useEffect(() => {
    document.title = 'Leaves — Nucleus'
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [rows, cnt, ctx] = await Promise.all([
        fetchMyLeaves(),
        fetchLeaveCounts(),
        fetchLeaveContext(),
      ])
      setLeaves(rows)
      setCounts(cnt)
      setContext(ctx)
      if (pendingEdit.current !== null) {
        const target = rows.find((l) => l.id === pendingEdit.current)
        pendingEdit.current = null
        if (target?.can_revise) setForm({ kind: 'edit', leave: target })
        else if (target) setOpenId(target.id)
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        signOut()
        return
      }
      setError(errMsg(err, 'Could not load your leaves.'))
    } finally {
      setLoading(false)
    }
  }, [signOut])

  useEffect(() => {
    void load()
  }, [load])

  // Keep the URL honest once a deep-link has been consumed, so a refresh does
  // not re-open the same form/detail.
  useEffect(() => {
    if (search.open || search.edit || search.apply) {
      void navigate({ to: '/leaves', search: {}, replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (loading && leaves === null) return <LeavesSkeleton />
  if (error) return <ErrorState message={error} onRetry={() => void load()} />
  if (!leaves) return null

  if (openId !== null) {
    return (
      <LeaveDetail
        id={openId}
        onBack={() => setOpenId(null)}
        onChanged={() => void load()}
        onRevise={(leave) => setForm({ kind: 'edit', leave })}
        formOpen={form !== null}
        renderForm={() =>
          context && form ? (
            <LeaveFormSheet
              context={context}
              mode={form}
              onClose={() => setForm(null)}
              onSaved={() => {
                setForm(null)
                void load()
              }}
            />
          ) : null
        }
      />
    )
  }

  const visible = leaves.filter(
    (l) => statusFilter === 'all' || l.status === statusFilter,
  )

  return (
    <>
      <PageHeader title="Leaves" icon={Plane} accent="violet" />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <LeaveStatusChips
          value={statusFilter}
          counts={counts}
          onChange={setStatusFilter}
        />
        <Button
          size="sm"
          disabled={!context?.can_apply}
          onClick={() => setForm({ kind: 'apply' })}
        >
          <Plus className="size-4" />
          Apply for leave
        </Button>
      </div>

      {context && !context.can_apply && context.blocker ? (
        <Card className="mb-4 flex items-start gap-3 border-warning/40 bg-warning/10 p-4">
          <CircleAlert className="mt-0.5 size-5 shrink-0 text-warning" />
          <p className="text-sm">{context.blocker}</p>
        </Card>
      ) : null}

      {visible.length === 0 ? (
        <StateView
          icon={CalendarOff}
          title={leaves.length === 0 ? 'No leaves yet' : 'Nothing in this status'}
          description={
            leaves.length === 0
              ? 'Apply for leave and your in-charge will review it. Approved leave shows as "Leave" instead of "Absent" in your attendance.'
              : 'Try a different status.'
          }
          action={
            leaves.length === 0 && context?.can_apply
              ? {
                  label: 'Apply for leave',
                  icon: Plus,
                  onClick: () => setForm({ kind: 'apply' }),
                }
              : undefined
          }
        />
      ) : (
        <div className="space-y-2.5">
          {visible.map((l) => (
            <LeaveRow key={l.id} leave={l} onOpen={() => setOpenId(l.id)} />
          ))}
        </div>
      )}

      {context && form ? (
        <LeaveFormSheet
          context={context}
          mode={form}
          onClose={() => setForm(null)}
          onSaved={() => {
            setForm(null)
            void load()
          }}
        />
      ) : null}
    </>
  )
}

// --- status chips ---------------------------------------------------------------

const ACTIVE_TONE: Record<StatusFilter, string> = {
  all: 'border-primary bg-primary/10 text-primary',
  pending: 'border-warning bg-warning/10 text-warning',
  approved: 'border-success bg-success/10 text-success',
  rejected: 'border-destructive bg-destructive/10 text-destructive',
  withdrawn: 'border-muted-foreground/40 bg-muted text-muted-foreground',
  cancel_requested: 'border-primary bg-primary/10 text-primary',
  cancelled: 'border-muted-foreground/40 bg-muted text-muted-foreground',
}

function LeaveStatusChips({
  value,
  counts,
  onChange,
}: {
  value: StatusFilter
  counts: LeaveStatusCounts
  onChange: (next: StatusFilter) => void
}) {
  const total = Object.values(counts).reduce((a, b) => a + (b ?? 0), 0)
  const chip = (key: StatusFilter, label: string, count: number | undefined) => (
    <button
      key={key}
      type="button"
      onClick={() => onChange(key)}
      aria-pressed={value === key}
      className={cn(
        'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30',
        value === key
          ? ACTIVE_TONE[key]
          : 'border-border bg-card text-muted-foreground hover:bg-muted/40',
      )}
    >
      {label}
      {count !== undefined && (
        <span
          className={cn(
            'inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] leading-none font-semibold',
            value === key ? 'bg-current/15' : 'bg-muted text-muted-foreground',
          )}
        >
          {count}
        </span>
      )}
    </button>
  )
  return (
    <div className="flex flex-wrap items-center gap-2">
      {chip('all', 'All', total)}
      {LEAVE_STATUSES.map((s) => chip(s, LEAVE_STATUS_LABELS[s], counts[s] ?? 0))}
    </div>
  )
}

// --- list row -------------------------------------------------------------------

function LeaveRow({
  leave,
  onOpen,
}: {
  leave: StudentLeave
  onOpen: () => void
}) {
  const sentBack = leave.apply_request?.status === 'sent_back'
  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/30"
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-icon-violet/10 text-icon-violet">
          <Plane className="size-4.5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">
              {formatLeaveWhen(
                leave.from_date,
                leave.to_date,
                leave.from_time,
                leave.to_time,
              )}
            </span>
            <Badge variant={leaveStatusVariant(leave.status)}>
              {sentBack ? 'Sent back' : LEAVE_STATUS_LABELS[leave.status]}
            </Badge>
          </span>
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
            {leave.leave_type.name} ·{' '}
            {leave.from_time
              ? 'Part of the day'
              : `${leave.days} day${leave.days === 1 ? '' : 's'}`}
            {leave.attachments.length > 0 ? (
              <>
                {' · '}
                <Paperclip className="inline size-3 align-[-1px]" />{' '}
                {leave.attachments.length}
              </>
            ) : null}
            {' · applied '}
            {formatDateTime(leave.created_at)}
          </span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
      </button>
    </Card>
  )
}

// --- detail ---------------------------------------------------------------------

function LeaveDetail({
  id,
  onBack,
  onChanged,
  onRevise,
  formOpen,
  renderForm,
}: {
  id: number
  onBack: () => void
  onChanged: () => void
  onRevise: (leave: StudentLeave) => void
  formOpen: boolean
  renderForm: () => React.ReactNode
}) {
  const [leave, setLeave] = useState<StudentLeave | null>(null)
  const [applyReq, setApplyReq] = useState<StudentRequestDetail | null>(null)
  const [cancelReq, setCancelReq] = useState<StudentRequestDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmWithdraw, setConfirmWithdraw] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState('')

  const load = useCallback(async () => {
    setError(null)
    try {
      const l = await fetchLeave(id)
      setLeave(l)
      // The history/approvers live on the framework request(s) — fetch each
      // linked one; a missing request (purged) just means no timeline.
      const [a, c] = await Promise.all([
        l.apply_request ? fetchMyRequest(l.apply_request.id).catch(() => null) : null,
        l.cancel_request ? fetchMyRequest(l.cancel_request.id).catch(() => null) : null,
      ])
      setApplyReq(a)
      setCancelReq(c)
    } catch (err) {
      setError(errMsg(err, 'Could not load this leave.'))
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  // The revise sheet saved — pick up the new dates.
  useEffect(() => {
    if (!formOpen) void load()
  }, [formOpen, load])

  async function onWithdraw() {
    setBusy(true)
    try {
      const next = await withdrawLeave(id)
      toast.success(
        next.status === 'withdrawn'
          ? 'Leave application withdrawn.'
          : 'Cancellation request withdrawn — the leave stays approved.',
      )
      await load()
      onChanged()
    } catch (err) {
      toast.error(errMsg(err, 'Could not withdraw the request.'))
    } finally {
      setBusy(false)
      setConfirmWithdraw(false)
    }
  }

  async function onRequestCancel() {
    setBusy(true)
    try {
      await requestLeaveCancel(id, cancelReason.trim() || undefined)
      toast.success('Cancellation request sent to your in-charge.')
      setCancelOpen(false)
      setCancelReason('')
      await load()
      onChanged()
    } catch (err) {
      toast.error(errMsg(err, 'Could not request the cancellation.'))
    } finally {
      setBusy(false)
    }
  }

  if (error) return <ErrorState message={error} onRetry={() => void load()} />
  if (!leave) return <LeavesSkeleton />

  const sentBack = leave.apply_request?.status === 'sent_back'
  const inEffect = leave.status === 'approved' || leave.status === 'cancel_requested'

  return (
    <>
      <Button variant="ghost" size="sm" className="mb-3" onClick={onBack}>
        <ArrowLeft className="size-4" /> Back to leaves
      </Button>

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem] lg:items-start">
        <div className="space-y-4">
          <Card className="space-y-4 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">Leave application</h2>
              <Badge variant={leaveStatusVariant(leave.status)}>
                {sentBack ? 'Sent back' : LEAVE_STATUS_LABELS[leave.status]}
              </Badge>
            </div>

            <LeaveFacts
              leaveType={leave.leave_type.name}
              from={leave.from_date}
              to={leave.to_date}
              fromTime={leave.from_time}
              toTime={leave.to_time}
              days={leave.days}
            />

            {inEffect ? (
              <p className="rounded-md bg-icon-violet/10 px-3 py-2 text-xs text-icon-violet">
                This leave is in effect: classes on these dates show as
                <span className="font-semibold"> Leave</span> in your attendance
                instead of Absent. It still counts as a class not attended.
              </p>
            ) : null}

            {sentBack && leave.apply_request?.decision_note ? (
              <div className="rounded-lg border border-warning/40 bg-warning/10 p-3">
                <p className="text-xs font-medium text-warning">
                  Sent back for changes
                </p>
                <p className="mt-1 text-sm break-words">
                  {leave.apply_request.decision_note}
                </p>
              </div>
            ) : null}
            {leave.status === 'rejected' && leave.apply_request?.decision_note ? (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3">
                <p className="text-xs font-medium text-destructive">
                  Rejected
                </p>
                <p className="mt-1 text-sm break-words">
                  {leave.apply_request.decision_note}
                </p>
              </div>
            ) : null}

            <LeaveReason reason={leave.reason} />
            <LeaveAttachments attachments={leave.attachments} />

            {leave.cancel_request ? (
              <CancellationBlock request={leave.cancel_request} cancelledAt={leave.cancelled_at} />
            ) : null}

            <p className="text-xs text-muted-foreground">
              Applied on {formatDateTime(leave.created_at)}
              {leave.decided_at
                ? ` · decided ${formatDateTime(leave.decided_at)}`
                : ''}
            </p>

            {leave.can_revise || leave.can_withdraw || leave.can_request_cancel ? (
              <div className="flex flex-wrap items-center gap-2 border-t pt-4">
                {leave.can_revise ? (
                  <Button size="sm" onClick={() => onRevise(leave)}>
                    Revise &amp; resubmit
                  </Button>
                ) : null}
                {leave.can_request_cancel ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setCancelOpen(true)}
                  >
                    Request cancellation
                  </Button>
                ) : null}
                {leave.can_withdraw ? (
                  confirmWithdraw ? (
                    <>
                      <span className="text-xs text-muted-foreground">
                        {leave.status === 'cancel_requested'
                          ? 'Withdraw the cancellation request?'
                          : 'Withdraw this application?'}
                      </span>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={busy}
                        onClick={() => void onWithdraw()}
                      >
                        Yes, withdraw
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => setConfirmWithdraw(false)}
                      >
                        Keep it
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setConfirmWithdraw(true)}
                    >
                      {leave.status === 'cancel_requested'
                        ? 'Withdraw cancellation request'
                        : 'Withdraw application'}
                    </Button>
                  )
                ) : null}
              </div>
            ) : null}
          </Card>
        </div>

        <div className="space-y-4">
          {applyReq ? (
            <>
              <Card className="p-4">
                <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  History
                </h3>
                <RequestTimeline timeline={applyReq.timeline} />
              </Card>
              {cancelReq ? (
                <Card className="p-4">
                  <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Cancellation history
                  </h3>
                  <RequestTimeline timeline={cancelReq.timeline} />
                </Card>
              ) : null}
              <Card className="p-4">
                <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  In-charges
                </h3>
                <ApproversList
                  approvers={applyReq.approvers}
                  isDecided={leave.status !== 'pending'}
                />
              </Card>
            </>
          ) : null}
        </div>
      </div>

      <Dialog open={cancelOpen} onOpenChange={(o) => !busy && setCancelOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request cancellation</DialogTitle>
            <DialogDescription>
              Your in-charge will review this. The leave stays in effect until
              they approve; then any classes marked Leave revert to Absent.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="cancel-reason">Reason (optional)</Label>
            <textarea
              id="cancel-reason"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              maxLength={1000}
              rows={3}
              placeholder="Why do you no longer need this leave?"
              className="w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setCancelOpen(false)}
            >
              Back
            </Button>
            <Button disabled={busy} onClick={() => void onRequestCancel()}>
              Send request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {renderForm()}
    </>
  )
}

function CancellationBlock({
  request,
  cancelledAt,
}: {
  request: NonNullable<StudentLeave['cancel_request']>
  cancelledAt: string | null
}) {
  const status = request.status as RequestStatus
  const copy: Record<string, string> = {
    pending: 'Cancellation requested — waiting for your in-charge.',
    sent_back: 'Cancellation request sent back with a note.',
    approved: `Cancelled${cancelledAt ? ` on ${formatDateTime(cancelledAt)}` : ''}.`,
    rejected: 'Cancellation was refused — the leave remains in effect.',
    cancelled: 'You withdrew the cancellation request.',
  }
  return (
    <div className="rounded-md border bg-muted/20 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Cancellation
        </p>
        <Badge variant={requestStatusVariant(status)}>
          {REQUEST_STATUS_LABELS[status] ?? status}
        </Badge>
      </div>
      <p className="mt-1 text-sm">{copy[status] ?? status}</p>
      {request.decision_note ? (
        <p className="mt-1 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Reviewer note:</span>{' '}
          {request.decision_note}
        </p>
      ) : null}
    </div>
  )
}

// --- apply / revise form --------------------------------------------------------

interface StagedFile extends LeaveAttachmentInput {
  uploading?: boolean
}

/** How much of the calendar the leave covers — picked before any date is. */
type Duration = 'single' | 'range'
/** For a single day: the whole day, or only some of its classes. */
type DayPart = 'full' | 'partial'

/**
 * The day's classes, from the student's own timetable. Cancelled ones are
 * filtered out by the caller: a class that won't run can't be missed, and
 * letting one be picked would stretch the derived window over classes the
 * student never meant to include.
 */
interface DayClass {
  session_id: number
  period_label: string
  subject_name: string
  start_time: string
  end_time: string
}

/**
 * The clock window covered by a set of picked classes: earliest start to
 * latest end. Anything scheduled between them is inside the window too — the
 * UI shows those as covered so what the student sees is what the server
 * patches.
 */
function windowOf(
  classes: DayClass[],
  picked: ReadonlySet<number>,
): { from: string; to: string } | null {
  const chosen = classes.filter((c) => picked.has(c.session_id))
  if (chosen.length === 0) return null
  return {
    from: chosen.reduce((a, c) => (c.start_time < a ? c.start_time : a), chosen[0].start_time),
    to: chosen.reduce((a, c) => (c.end_time > a ? c.end_time : a), chosen[0].end_time),
  }
}

/** Is this class inside the window, whether or not it was ticked? */
function coveredBy(
  c: DayClass,
  w: { from: string; to: string } | null,
): boolean {
  if (!w) return false
  return c.start_time < w.to && c.end_time > w.from
}

function LeaveFormSheet({
  context,
  mode,
  onClose,
  onSaved,
}: {
  context: LeaveContext
  mode: { kind: 'apply' } | { kind: 'edit'; leave: StudentLeave }
  onClose: () => void
  onSaved: () => void
}) {
  const editing = mode.kind === 'edit' ? mode.leave : null
  const [typeId, setTypeId] = useState<number | null>(
    editing?.leave_type.id ?? null,
  )
  const [from, setFrom] = useState(editing?.from_date ?? '')
  const [to, setTo] = useState(editing?.to_date ?? '')
  const [duration, setDuration] = useState<Duration>(() =>
    editing && editing.from_date !== editing.to_date ? 'range' : 'single',
  )
  const [dayPart, setDayPart] = useState<DayPart>(() =>
    editing?.from_time ? 'partial' : 'full',
  )
  // Sessions the student ticked. The submitted window is derived from these,
  // never stored as ids — see windowOf().
  const [picked, setPicked] = useState<Set<number>>(new Set())
  const [dayClasses, setDayClasses] = useState<DayClass[] | null>(null)
  const [classesLoading, setClassesLoading] = useState(false)
  const [classesError, setClassesError] = useState<string | null>(null)
  const [reason, setReason] = useState(editing?.reason ?? '')
  const [files, setFiles] = useState<StagedFile[]>(
    editing?.attachments.map((a) => ({
      key: a.key,
      name: a.name,
      mime: a.mime,
      size: a.size,
    })) ?? [],
  )
  const [submitting, setSubmitting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Keep the range sane as the student picks: moving "from" past "to" drags
  // "to" along, so the pair never goes backwards.
  function onFrom(iso: string) {
    setFrom(iso)
    if (to && iso > to) setTo(iso)
  }

  // A single-day leave keeps both ends on the same date, so the rest of the
  // form (and the server's part-day check) sees one date either way.
  function onSingleDate(iso: string) {
    setFrom(iso)
    setTo(iso)
    setPicked(new Set())
  }

  function onDuration(next: Duration) {
    setDuration(next)
    if (next === 'range') {
      // Part-day is a single-date concept — drop it rather than silently
      // sending a window the server would reject.
      setDayPart('full')
      setPicked(new Set())
    } else if (from) {
      setTo(from)
    }
  }

  // The day's classes, loaded only when the student actually asks for a
  // part-day leave. Re-fetched whenever the date changes.
  useEffect(() => {
    if (dayPart !== 'partial' || !from) {
      setDayClasses(null)
      setClassesError(null)
      return
    }
    let cancelled = false
    setClassesLoading(true)
    setClassesError(null)
    fetchStudentWeek(from, from)
      .then((res) => {
        if (cancelled) return
        setDayClasses(
          res.cells
            .filter((c) => c.status !== 'cancelled')
            .map((c) => ({
              session_id: c.session_id,
              period_label: c.period_label,
              subject_name: c.subject_name,
              start_time: c.start_time,
              end_time: c.end_time,
            }))
            .sort((a, b) => a.start_time.localeCompare(b.start_time)),
        )
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setDayClasses(null)
        setClassesError(errMsg(err, "Couldn't load that day's classes."))
      })
      .finally(() => {
        if (!cancelled) setClassesLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [dayPart, from])

  const dayWindow = windowOf(dayClasses ?? [], picked)

  const typeOptions = context.leave_types.map((t) => ({
    value: t.id,
    label: t.name,
  }))
  // A deactivated type on a sent-back application stays selectable so the
  // student is not forced to change it just to resubmit.
  if (editing && !typeOptions.some((o) => o.value === editing.leave_type.id)) {
    typeOptions.unshift({
      value: editing.leave_type.id,
      label: editing.leave_type.name,
    })
  }

  const sem = context.semester
  const outsideSemester =
    from !== '' &&
    to !== '' &&
    sem !== null &&
    ((sem.planned_start_date !== null && from < sem.planned_start_date) ||
      (sem.planned_end_date !== null && to > sem.planned_end_date))

  const days =
    from && to && to >= from
      ? Math.round(
          (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
            86_400_000,
        ) + 1
      : 0

  const canSubmit =
    typeId !== null &&
    from !== '' &&
    to !== '' &&
    to >= from &&
    // A part-day leave with nothing picked has no window to send.
    (dayPart === 'full' || dayWindow !== null) &&
    !files.some((f) => f.uploading) &&
    !submitting

  async function onPickFile(file: File | undefined) {
    if (!file) return
    if (!(LEAVE_ATTACHMENT_MIMES as readonly string[]).includes(file.type)) {
      toast.info('Proof files must be PDF, JPEG or PNG.')
      return
    }
    if (file.size > LEAVE_ATTACHMENT_MAX_BYTES) {
      toast.info('Each file must be 5 MB or smaller.')
      return
    }
    if (files.length >= LEAVE_MAX_ATTACHMENTS) {
      toast.info(`You can attach up to ${LEAVE_MAX_ATTACHMENTS} files.`)
      return
    }
    const tempKey = `pending:${file.name}:${Date.now()}`
    setFiles((prev) => [
      ...prev,
      { key: tempKey, name: file.name, mime: file.type, size: file.size, uploading: true },
    ])
    try {
      const staged = await stageLeaveFile(file)
      setFiles((prev) => prev.map((f) => (f.key === tempKey ? staged : f)))
    } catch (err) {
      setFiles((prev) => prev.filter((f) => f.key !== tempKey))
      toast.error(errMsg(err, 'Could not upload the file.'))
    }
  }

  async function onSubmit() {
    if (!canSubmit || typeId === null) return
    setSubmitting(true)
    try {
      const input = {
        leave_type_id: typeId,
        from_date: from,
        to_date: duration === 'single' ? from : to,
        // Send 'HH:MM' — the server normalises to PG `time`.
        from_time: dayWindow ? shortTime(dayWindow.from) : undefined,
        to_time: dayWindow ? shortTime(dayWindow.to) : undefined,
        reason: reason.trim() || undefined,
        attachments: files.map(({ key, name, mime, size }) => ({
          key,
          name,
          mime,
          size,
        })),
      }
      if (editing) {
        await resubmitLeave(editing.id, input)
        toast.success('Application resubmitted to your in-charge.')
      } else {
        await applyLeave(input)
        toast.success('Leave application sent to your in-charge.')
      }
      onSaved()
    } catch (err) {
      toast.error(errMsg(err, 'Could not submit the application.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Sheet open onOpenChange={(open) => !open && !submitting && onClose()}>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>
            {editing ? 'Revise leave application' : 'Apply for leave'}
          </SheetTitle>
          <SheetDescription>
            {context.group
              ? `Goes to the in-charge${context.incharges.length === 1 ? '' : 's'} of ${context.group.name}${
                  context.incharges.length > 0
                    ? ` — ${context.incharges.map((i) => i.emp_display_name).join(', ')}`
                    : ''
                }.`
              : 'Goes to your attendance group in-charge for approval.'}
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-3">
          {editing?.apply_request?.decision_note ? (
            <div className="rounded-lg border border-warning/40 bg-warning/10 p-3">
              <p className="text-xs font-medium text-warning">
                Sent back for changes
              </p>
              <p className="mt-1 text-sm break-words">
                {editing.apply_request.decision_note}
              </p>
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="leave-type">Leave type</Label>
            <Combobox
              id="leave-type"
              value={typeId}
              options={typeOptions}
              onChange={setTypeId}
              placeholder="Choose a type"
              emptyMessage="No leave types"
            />
          </div>

          <div className="space-y-2">
            <Label>How long?</Label>
            <Segmented<Duration>
              aria-label="Leave duration"
              value={duration}
              onChange={onDuration}
              options={[
                { value: 'single', label: 'Single day' },
                { value: 'range', label: 'Multiple days' },
              ]}
            />
          </div>

          {duration === 'single' ? (
            <div className="space-y-1.5">
              <Label>Date</Label>
              <DatePicker
                value={from}
                onChange={onSingleDate}
                clearable
                placeholder="Pick a date"
                triggerClassName="h-9 w-full"
                aria-label="Date of leave"
              />
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>From</Label>
                <DatePicker
                  value={from}
                  onChange={onFrom}
                  clearable
                  placeholder="First day"
                  triggerClassName="h-9 w-full"
                  aria-label="First day of leave"
                />
              </div>
              <div className="space-y-1.5">
                <Label>To</Label>
                <DatePicker
                  value={to}
                  onChange={setTo}
                  clearable
                  min={from || undefined}
                  placeholder="Last day"
                  triggerClassName="h-9 w-full"
                  aria-label="Last day of leave"
                />
              </div>
            </div>
          )}
          {duration === 'range' && days > 0 ? (
            <p className="text-xs text-muted-foreground">
              {days} day{days === 1 ? '' : 's'} · {formatLeaveRange(from, to)}
            </p>
          ) : null}

          {duration === 'single' && from ? (
            <div className="space-y-2">
              <Label>How much of the day?</Label>
              <Segmented<DayPart>
                aria-label="How much of the day"
                value={dayPart}
                onChange={(next) => {
                  setDayPart(next)
                  if (next === 'full') setPicked(new Set())
                }}
                options={[
                  { value: 'full', label: 'Full day' },
                  { value: 'partial', label: 'Part of the day' },
                ]}
              />
            </div>
          ) : null}

          {duration === 'single' && from && dayPart === 'partial' ? (
            <DayClassPicker
              classes={dayClasses}
              loading={classesLoading}
              error={classesError}
              picked={picked}
              onToggle={(id) =>
                setPicked((prev) => {
                  const next = new Set(prev)
                  if (next.has(id)) next.delete(id)
                  else next.add(id)
                  return next
                })
              }
              window={dayWindow}
            />
          ) : null}

          {outsideSemester && sem ? (
            <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
              <p>
                These dates fall outside the current semester
                {sem.name ? ` (${sem.name}` : ' ('}
                {sem.planned_start_date && sem.planned_end_date
                  ? `: ${formatLeaveRange(sem.planned_start_date, sem.planned_end_date)}`
                  : ''}
                ). You can still apply — your in-charge will review it.
              </p>
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="leave-reason">Reason (optional)</Label>
            <textarea
              id="leave-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={1000}
              rows={4}
              placeholder="A short note for your in-charge"
              className="w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Proof (optional)</Label>
              <span className="text-xs text-muted-foreground">
                PDF, JPEG or PNG · up to {LEAVE_MAX_ATTACHMENTS} files · 5 MB each
              </span>
            </div>
            {files.length > 0 ? (
              <ul className="space-y-1.5">
                {files.map((f) => (
                  <li
                    key={f.key}
                    className="flex items-center gap-2 rounded-lg border bg-muted/20 px-3 py-2 text-sm"
                  >
                    <FileText className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate" title={f.name}>
                      {f.name}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {f.uploading ? 'Uploading…' : `${Math.max(1, Math.round(f.size / 1024))} KB`}
                    </span>
                    <button
                      type="button"
                      aria-label={`Remove ${f.name}`}
                      disabled={f.uploading}
                      onClick={() =>
                        setFiles((prev) => prev.filter((x) => x.key !== f.key))
                      }
                      className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                    >
                      <X className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            <input
              ref={fileRef}
              type="file"
              accept={LEAVE_ATTACHMENT_MIMES.join(',')}
              className="hidden"
              onChange={(e) => {
                void onPickFile(e.target.files?.[0])
                e.target.value = ''
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={files.length >= LEAVE_MAX_ATTACHMENTS}
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="size-4" />
              Add file
            </Button>
          </div>
        </div>

        <SheetFooter className="flex-row items-center justify-end gap-2 border-t">
          <Button variant="outline" disabled={submitting} onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!canSubmit} onClick={() => void onSubmit()}>
            {submitting
              ? 'Sending…'
              : editing
                ? 'Resubmit'
                : 'Send application'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

/**
 * The day's classes as tick-boxes. Picking classes is only how the student
 * expresses a time window — the summary spells out the window that will
 * actually be sent, and anything scheduled inside it is shown as covered even
 * if it wasn't ticked, so the preview can't disagree with the server.
 */
function DayClassPicker({
  classes,
  loading,
  error,
  picked,
  onToggle,
  window: win,
}: {
  classes: DayClass[] | null
  loading: boolean
  error: string | null
  picked: ReadonlySet<number>
  onToggle: (sessionId: number) => void
  window: { from: string; to: string } | null
}) {
  if (loading) {
    return (
      <div className="space-y-1.5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-11 animate-pulse rounded-lg bg-muted/60" />
        ))}
      </div>
    )
  }
  if (error) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
        <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
        <p>{error}</p>
      </div>
    )
  }
  if (!classes || classes.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
        No classes are scheduled for this date, so there is nothing to take
        part-day leave from. Pick another date, or apply for the full day.
      </div>
    )
  }
  return (
    <div className="space-y-2">
      <Label>Which classes will you miss?</Label>
      <ul className="space-y-1.5">
        {classes.map((c) => {
          const ticked = picked.has(c.session_id)
          // Inside the window but not ticked — covered anyway, because the
          // window is a span, not a set. Say so rather than let the student
          // believe it's excluded.
          const covered = !ticked && coveredBy(c, win)
          return (
            <li key={c.session_id}>
              <label
                className={cn(
                  'flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm transition-colors',
                  ticked || covered ? 'border-primary/50 bg-primary/5' : 'hover:bg-muted/40',
                )}
              >
                <input
                  type="checkbox"
                  className="size-4 shrink-0 accent-primary"
                  checked={ticked || covered}
                  onChange={() => onToggle(c.session_id)}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">
                    {c.subject_name}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {c.period_label} · {shortTime(c.start_time)}–
                    {shortTime(c.end_time)}
                    {covered ? ' · inside the window' : ''}
                  </span>
                </span>
              </label>
            </li>
          )
        })}
      </ul>
      {win ? (
        <p className="text-xs text-muted-foreground">
          Leave from <span className="font-medium tabular-nums">{shortTime(win.from)}</span> to{' '}
          <span className="font-medium tabular-nums">{shortTime(win.to)}</span> ·{' '}
          {classes.filter((c) => coveredBy(c, win)).length} class
          {classes.filter((c) => coveredBy(c, win)).length === 1 ? '' : 'es'} covered
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Pick at least one class.
        </p>
      )}
    </div>
  )
}

// --- page states --------------------------------------------------------------

function LeavesSkeleton() {
  return (
    <div className="space-y-2.5">
      <div className="h-16 animate-pulse rounded-2xl bg-muted" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />
      ))}
    </div>
  )
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border bg-card p-10 text-center text-card-foreground">
      <div className="grid size-12 place-items-center rounded-full bg-destructive/10 text-destructive">
        <CircleAlert className="size-6" />
      </div>
      <div className="space-y-1">
        <h2 className="text-sm font-semibold">Couldn’t load your leaves</h2>
        <p className="max-w-sm text-xs text-muted-foreground">{message}</p>
      </div>
      <Button size="sm" onClick={onRetry}>
        <RefreshCw className="size-4" /> Try again
      </Button>
    </div>
  )
}
