import { useEffect, useState } from 'react'
import { Hourglass } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/corporate-relations/bits'
import { ApiError } from '@/lib/api'
import {
  fetchProfileUpdateContext,
  PROFILE_FIELD_LABELS,
  resubmitProfileUpdateRequest,
  submitProfileUpdateRequest,
  type ProfileUpdateContext,
  type ProfileUpdateField,
  type StudentRequest,
} from '@/lib/student-requests'
import { cn } from '@/lib/utils'

function errMsg(err: unknown, fallback: string): string {
  return err instanceof ApiError || err instanceof Error
    ? err.message
    : fallback
}

const EMPTY_FORM: Record<ProfileUpdateField, string> = {
  mobile_number: '',
  email: '',
  blood_group: '',
  abc_id: '',
}

/**
 * The profile module's "raise a profile-update request" form. Lives with the
 * Profile screen (requests are raised from the owning module, never from
 * My Requests — that screen only tracks them). Prefills from the current
 * profile and submits only the changed fields. Fields already covered by a
 * pending request are warned about and disabled — the others stay
 * requestable, so several pending requests can coexist without duplicates.
 */
export function ProfileUpdateRequestDialog({
  open,
  onOpenChange,
  onSubmitted,
  editRequest,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Fired after a successful submit (dialog closes itself first). */
  onSubmitted?: () => void
  /**
   * A sent-back request to revise instead of raising a new one. Its values
   * prefill the form and submitting PUTs over it, putting it back in the queue.
   */
  editRequest?: StudentRequest | null
}) {
  const [context, setContext] = useState<ProfileUpdateContext | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const isEdit = !!editRequest

  useEffect(() => {
    if (!open) return
    setContext(null)
    setLoadError(null)
    setNote(editRequest?.requester_note ?? '')
    let cancelled = false
    fetchProfileUpdateContext()
      .then((ctx) => {
        if (cancelled) return
        setContext(ctx)
        // Start from the live profile, then overlay whatever this request was
        // asking for — so a revise opens showing the student's own values, not
        // the ones they were trying to change away from.
        const next: Record<ProfileUpdateField, string> = {
          mobile_number: ctx.current.mobile_number,
          email: ctx.current.email,
          blood_group: ctx.current.blood_group ?? '',
          abc_id: ctx.current.abc_id ?? '',
        }
        for (const c of editRequest?.payload.changes ?? []) {
          next[c.field] = c.to
        }
        setForm(next)
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setLoadError(errMsg(err, 'Could not load your current details.'))
      })
    return () => {
      cancelled = true
    }
  }, [open, editRequest])

  function setField(field: ProfileUpdateField, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  /**
   * Fields locked by some OTHER open request. The request being revised is
   * excluded — its own fields are in the server's open set, so leaving them in
   * would disable the very fields the student was asked to fix. Mirrors the
   * server's `assertResubmittable`, which excludes the request from its own
   * clash check for the same reason.
   */
  const ownFields = new Set(
    (editRequest?.payload.changes ?? []).map((c) => c.field),
  )
  const pendingFields = new Set(
    (context?.pending_fields ?? []).filter((f) => !ownFields.has(f)),
  )

  // Only fields that differ from the current profile are submitted; fields
  // already pending approval are disabled (a duplicate would 409 server-side
  // anyway). Values are validated with the same rules the server enforces so
  // errors surface before the round-trip.
  const diff: Partial<Record<ProfileUpdateField, string>> = {}
  const fieldErrors: Partial<Record<ProfileUpdateField, string>> = {}
  if (context) {
    if (!pendingFields.has('mobile_number')) {
      const mobile = form.mobile_number.trim()
      if (mobile && mobile !== context.current.mobile_number) {
        if (!/^[6-9]\d{9}$/.test(mobile)) {
          fieldErrors.mobile_number = 'Enter a 10-digit Indian mobile number'
        } else {
          diff.mobile_number = mobile
        }
      }
    }
    if (!pendingFields.has('email')) {
      const email = form.email.trim().toLowerCase()
      if (email && email !== context.current.email.toLowerCase()) {
        if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 255) {
          fieldErrors.email = 'Enter a valid email address'
        } else {
          diff.email = email
        }
      }
    }
    if (!pendingFields.has('blood_group')) {
      const bloodGroup = form.blood_group
      if (bloodGroup && bloodGroup !== (context.current.blood_group ?? '')) {
        diff.blood_group = bloodGroup
      }
    }
    if (!pendingFields.has('abc_id')) {
      const abcId = form.abc_id.trim()
      if (abcId && abcId !== (context.current.abc_id ?? '')) {
        if (!/^\d{12}$/.test(abcId)) {
          fieldErrors.abc_id = 'ABC ID must be exactly 12 digits'
        } else {
          diff.abc_id = abcId
        }
      }
    }
  }
  const hasErrors = Object.keys(fieldErrors).length > 0
  const hasChanges = Object.keys(diff).length > 0

  async function onSubmit() {
    if (!hasChanges || hasErrors) return
    setBusy(true)
    try {
      if (editRequest) {
        await resubmitProfileUpdateRequest(editRequest.id, {
          changes: diff,
          note: note.trim() || undefined,
        })
        toast.success('Request resubmitted for approval.')
      } else {
        await submitProfileUpdateRequest({
          changes: diff,
          note: note.trim() || undefined,
        })
        toast.success(
          'Request submitted for approval — track it in My Requests.',
        )
      }
      onOpenChange(false)
      onSubmitted?.()
    } catch (err) {
      toast.error(errMsg(err, 'Could not submit the request.'))
    } finally {
      setBusy(false)
    }
  }

  const pendingLabels = (context?.pending_fields ?? [])
    .map((f) => PROFILE_FIELD_LABELS[f] ?? f)
    .join(', ')

  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'Revise your request' : 'Request profile changes'}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Update the values and resubmit — this replaces your earlier request and sends it back for review.'
              : 'Edit the values you want changed — your batch’s profile verifiers will review them.'}
          </DialogDescription>
        </DialogHeader>

        {loadError ? (
          <p className="text-sm text-destructive">{loadError}</p>
        ) : !context ? (
          <div className="space-y-2.5">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-9 animate-pulse rounded-md bg-muted" />
            ))}
          </div>
        ) : (
          <div className="space-y-3.5">
            {pendingFields.size > 0 && (
              <div className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 p-3.5">
                <Hourglass className="mt-0.5 size-4 shrink-0 text-warning" />
                <p className="text-sm text-muted-foreground">
                  Already pending approval: {pendingLabels}. You can still
                  request changes to the other fields.
                </p>
              </div>
            )}
            <FieldBlock
              id="req-mobile"
              label="Mobile number"
              pending={pendingFields.has('mobile_number')}
              error={fieldErrors.mobile_number}
            >
              <Input
                id="req-mobile"
                inputMode="numeric"
                value={form.mobile_number}
                disabled={pendingFields.has('mobile_number')}
                onChange={(e) => setField('mobile_number', e.target.value)}
              />
            </FieldBlock>
            <FieldBlock
              id="req-email"
              label="Email"
              pending={pendingFields.has('email')}
              error={fieldErrors.email}
            >
              <Input
                id="req-email"
                type="email"
                value={form.email}
                disabled={pendingFields.has('email')}
                onChange={(e) => setField('email', e.target.value)}
              />
            </FieldBlock>
            <FieldBlock
              id="req-blood"
              label="Blood group"
              pending={pendingFields.has('blood_group')}
            >
              <select
                id="req-blood"
                value={form.blood_group}
                disabled={pendingFields.has('blood_group')}
                onChange={(e) => setField('blood_group', e.target.value)}
                className={cn(
                  'h-9 w-full rounded-md border border-input bg-background px-2 text-sm shadow-xs',
                  'outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                )}
              >
                <option value="">Not set</option>
                {context.blood_groups.map((bg) => (
                  <option key={bg} value={bg}>
                    {bg}
                  </option>
                ))}
              </select>
            </FieldBlock>
            <FieldBlock
              id="req-abc"
              label="ABC ID"
              pending={pendingFields.has('abc_id')}
              error={fieldErrors.abc_id}
            >
              <Input
                id="req-abc"
                inputMode="numeric"
                placeholder="12-digit Academic Bank of Credits ID"
                value={form.abc_id}
                disabled={pendingFields.has('abc_id')}
                onChange={(e) => setField('abc_id', e.target.value)}
              />
            </FieldBlock>
            <div className="space-y-1.5">
              <Label htmlFor="req-note">Note (optional)</Label>
              <Textarea
                id="req-note"
                placeholder="Anything the reviewer should know"
                value={note}
                maxLength={1000}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
            {!hasChanges && !hasErrors && (
              <p className="text-xs text-muted-foreground">
                {isEdit
                  ? 'Every value now matches your profile — change one to resubmit, or cancel the request instead.'
                  : 'Change at least one value to submit a request.'}
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
          {context && !loadError && (
            <Button
              disabled={busy || !hasChanges || hasErrors}
              onClick={() => void onSubmit()}
            >
              {busy ? 'Submitting…' : 'Submit for approval'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Label + control + per-field "pending approval" hint / validation error. */
function FieldBlock({
  id,
  label,
  pending,
  error,
  children,
}: {
  id: string
  label: string
  pending: boolean
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label htmlFor={id}>{label}</Label>
        {pending && (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-warning">
            <Hourglass className="size-3" /> Pending approval
          </span>
        )}
      </div>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
