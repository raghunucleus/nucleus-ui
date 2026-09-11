import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { Textarea } from '@/components/corporate-relations/bits'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ApiError } from '@/lib/api'
import {
  decideApproval,
  decideApprovalMixed,
  sendBackApproval,
  type ApprovalRow,
} from '@/lib/employee-requests'
import { PROFILE_FIELD_LABELS, type ItemOutcome } from '@/lib/student-requests'
import { cn } from '@/lib/utils'

/**
 * The confirmation dialogs behind every approver decision. They live here
 * rather than on the Approvals page because a decision can also be taken where
 * the subject lives — Company Management shows a company's pending request and
 * lets an approver act on it without leaving for the inbox.
 */

function errMsg(err: unknown, fallback: string): string {
  return err instanceof ApiError || err instanceof Error
    ? err.message
    : fallback
}

/**
 * Send-back confirmation. The note is REQUIRED — it is the only thing telling
 * the requester what to fix, so the button stays disabled until there is one.
 */
export function SendBackDialog({
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
      toast.success('Sent back to the requester for changes.')
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
            Nothing is applied. {row.requester.name} can revise the request and
            resubmit it, or cancel it.
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

export type DecisionPlan =
  | { kind: 'approve' }
  | { kind: 'reject' }
  | { kind: 'mixed'; verdicts: Record<string, ItemOutcome> }

export function DecisionDialog({
  row,
  plan,
  overrides,
  onOpenChange,
  onDone,
}: {
  row: ApprovalRow
  plan: DecisionPlan | null
  /** Type-specific approver edits, applied in the same transaction. */
  overrides: Record<string, unknown>
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
      // Edits only ever ride along with an approval — there is nothing to
      // apply on a rejection, and the server 400s if they are sent anyway.
      const edits =
        plan.kind === 'reject' || Object.keys(overrides).length === 0
          ? undefined
          : overrides
      if (plan.kind === 'mixed') {
        await decideApprovalMixed(
          row.id,
          plan.verdicts,
          overall,
          note.trim() || undefined,
          edits,
        )
        toast.success('Decision recorded — approved items applied.')
      } else {
        await decideApproval(
          row.id,
          plan.kind,
          note.trim() || undefined,
          edits,
        )
        toast.success(
          plan.kind === 'approve'
            ? 'Request approved — the changes have been applied.'
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
              ? 'The requested changes will be applied immediately.'
              : kind === 'reject'
                ? `${row.requester.name} will be notified that the request was rejected.`
                : `Approved fields will be applied immediately; the rest are rejected (${rejectedLabels}).`}
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
              The per-field results are kept either way — this is the status the
              request shows overall.
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
