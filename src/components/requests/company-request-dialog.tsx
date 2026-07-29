import { useEffect, useState } from 'react'
import { Check, CircleAlert, Undo2, X } from 'lucide-react'

import { formatDate } from '@/components/corporate-relations/bits'
import { ApproversList } from '@/components/requests/approvers-list'
import {
  DecisionDialog,
  SendBackDialog,
} from '@/components/requests/decision-dialogs'
import { rendererFor } from '@/components/requests/payloads'
import { RequestTimeline } from '@/components/requests/request-timeline'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ApiError } from '@/lib/api'
import { getCompanyRequest } from '@/lib/corporate-relations'
import type { ApprovalDetail, ApprovalRow } from '@/lib/employee-requests'
import {
  REQUEST_STATUS_LABELS,
  requestStatusVariant,
} from '@/lib/student-requests'

type CompanyRequest = ApprovalDetail & { can_act: boolean }

/**
 * A company's pending approval request, shown where the company lives.
 *
 * Reviewing a change should not mean hunting for it in the Approvals inbox, so
 * this renders the same body the inbox does — via the shared payload renderer —
 * plus the approver pool and history. Whoever may also DECIDE it (the approvers
 * an admin assigned to the company action) gets the same buttons here; the
 * server settles that with `can_act` rather than the screen the caller is on.
 */
export function CompanyRequestDialog({
  companyId,
  fetchRequest = getCompanyRequest,
  onOpenChange,
  onDecided,
}: {
  /** The company whose request to show; `null` keeps the dialog closed. */
  companyId: number | null
  /**
   * Which screen's endpoint to read through. Defaults to Company Management;
   * Roles or Designations passes its own, authorised by a different screen.
   */
  fetchRequest?: (id: number) => Promise<CompanyRequest | null>
  onOpenChange: (open: boolean) => void
  /** A decision landed — the company row it describes is now stale. */
  onDecided: () => void
}) {
  const [request, setRequest] = useState<CompanyRequest | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [sendingBack, setSendingBack] = useState(false)
  // The one thing an approver may edit while deciding: who owns each job role.
  const [overrides, setOverrides] = useState<Record<string, unknown>>({})

  useEffect(() => {
    if (companyId === null) return
    let cancelled = false
    setLoading(true)
    setError(null)
    setRequest(null)
    setOverrides({})
    fetchRequest(companyId)
      .then((r) => {
        if (!cancelled) setRequest(r)
      })
      .catch((err) => {
        if (cancelled) return
        setError(
          err instanceof ApiError || err instanceof Error
            ? err.message
            : 'Could not load the request.',
        )
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // `fetchRequest` is a module-level constant at every call site; listing it
    // would re-fetch on every render of a caller that inlines one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId])

  const renderer = rendererFor('company_approval')
  const decidable = request?.can_act ?? false

  function afterDecision() {
    setConfirming(false)
    setRejecting(false)
    setSendingBack(false)
    onOpenChange(false)
    onDecided()
  }

  return (
    <>
      <Dialog open={companyId !== null} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2">
              Company Approval
              {request && (
                <Badge variant={requestStatusVariant(request.status)}>
                  {REQUEST_STATUS_LABELS[request.status] ?? request.status}
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              {request
                ? `Raised by ${request.requester.name} · ${request.requester.code} · ${formatDate(request.created_at)}`
                : 'What is waiting for approval on this company.'}
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-2 rounded-lg border bg-card p-8 text-center">
              <CircleAlert className="size-5 text-destructive" />
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
          ) : !request ? (
            <div className="rounded-lg border border-dashed bg-muted/20 px-6 py-10 text-center text-sm text-muted-foreground">
              Nothing is awaiting approval on this company.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border bg-card">
                <renderer.Body
                  row={request as ApprovalRow}
                  detail={request as ApprovalRow}
                  editable={decidable}
                  verdicts={{}}
                  setVerdicts={() => {}}
                  overrides={overrides}
                  setOverrides={setOverrides}
                />
              </div>

              {request.requester_note && (
                <div className="rounded-lg border bg-card p-4">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Requester's note
                  </p>
                  <p className="mt-1 text-sm">{request.requester_note}</p>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border bg-card p-4">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Approvers
                  </p>
                  <ApproversList
                    className="mt-2"
                    approvers={request.approvers}
                    isDecided={request.status !== 'pending'}
                  />
                </div>
                <div className="rounded-lg border bg-card p-4">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    History
                  </p>
                  <RequestTimeline className="mt-2" timeline={request.timeline} />
                </div>
              </div>

              {decidable ? (
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSendingBack(true)}
                  >
                    <Undo2 className="size-4" /> Send back
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => setRejecting(true)}
                  >
                    <X className="size-4" /> Reject
                  </Button>
                  <Button size="sm" onClick={() => setConfirming(true)}>
                    <Check className="size-4" /> Approve
                  </Button>
                </div>
              ) : (
                request.status === 'pending' && (
                  <p className="text-right text-xs text-muted-foreground">
                    You are not an approver for company changes — this is
                    read-only.
                  </p>
                )
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {request && (
        <>
          <DecisionDialog
            row={request as ApprovalRow}
            plan={
              confirming
                ? { kind: 'approve' }
                : rejecting
                  ? { kind: 'reject' }
                  : null
            }
            overrides={overrides}
            onOpenChange={(open) => {
              if (!open) {
                setConfirming(false)
                setRejecting(false)
              }
            }}
            onDone={afterDecision}
          />
          <SendBackDialog
            row={request as ApprovalRow}
            open={sendingBack}
            onOpenChange={setSendingBack}
            onDone={afterDecision}
          />
        </>
      )}
    </>
  )
}
