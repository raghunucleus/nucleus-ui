import { useState } from 'react'
import { Check, ChevronRight, Goal, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
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
  acceptPlacementInvite,
  PLACEMENT_STATUS,
  PLACEMENT_STATUS_BADGE,
  PLACEMENT_STATUS_LABELS,
  rejectPlacementInvite,
  type PlacementDriveRecord,
  type PlacementInvite,
} from '@/lib/student-placements'
import { cn } from '@/lib/utils'

function errMsg(err: unknown, fallback: string): string {
  return err instanceof ApiError || err instanceof Error
    ? err.message
    : fallback
}

export function formatPlacementDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/** Same as `formatPlacementDate` but with the time — for the registration deadline. */
export function formatPlacementDateTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/** Company logo (or an initial tile) shared by the invite/drive cards. */
export function CompanyBadge({
  name,
  logoUrl,
}: {
  name: string
  logoUrl: string | null
}) {
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={name}
        className="size-10 shrink-0 rounded-lg border object-contain"
      />
    )
  }
  return (
    <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-icon-blue/10 text-sm font-semibold text-icon-blue">
      {name.charAt(0).toUpperCase() || <Goal className="size-4.5" />}
    </span>
  )
}

/**
 * One pending invitation — used by both the Placements Invites tab and the
 * Approvals page so accept/deny behave identically everywhere.
 */
export function PlacementInviteCard({
  invite,
  onView,
  onChanged,
}: {
  invite: PlacementInvite
  /** Open the drive detail (JD, package, designations). */
  onView: () => void
  /** Fired after a successful accept/deny so the parent can refetch. */
  onChanged: () => void
}) {
  const [accepting, setAccepting] = useState(false)
  const [denyOpen, setDenyOpen] = useState(false)

  const onAccept = async () => {
    setAccepting(true)
    try {
      await acceptPlacementInvite(invite.drive_id)
      toast.success(`You're in — ${invite.drive_name} added to your Drives.`)
      onChanged()
    } catch (err) {
      toast.error(errMsg(err, 'Could not accept the invitation.'))
    } finally {
      setAccepting(false)
    }
  }

  const meta = [
    invite.offer_type,
    invite.job_locations.length > 0 ? invite.job_locations.join(', ') : null,
    invite.drive_date ? `Drive ${formatPlacementDate(invite.drive_date)}` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        <CompanyBadge name={invite.company.name} logoUrl={invite.company.logo_url} />
        <button
          type="button"
          onClick={onView}
          className="min-w-0 flex-1 text-left"
        >
          <span className="flex items-center gap-1.5 text-sm font-semibold hover:underline">
            <span className="truncate">{invite.drive_name}</span>
            <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
          </span>
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
            {invite.company.name}
            {meta ? ` · ${meta}` : ''}
          </span>
        </button>
        <div className="flex shrink-0 items-center gap-1.5">
          <Button size="sm" onClick={() => void onAccept()} disabled={accepting}>
            {accepting ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Check className="size-3.5" />
            )}
            Accept
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setDenyOpen(true)}
            disabled={accepting}
          >
            <X className="size-3.5" />
            Deny
          </Button>
        </div>
      </div>

      <DenyInviteDialog
        invite={denyOpen ? invite : null}
        onClose={() => setDenyOpen(false)}
        onDenied={onChanged}
      />
    </Card>
  )
}

/** Deny-with-required-reason dialog, shared wherever an invite can be denied. */
export function DenyInviteDialog({
  invite,
  onClose,
  onDenied,
}: {
  invite: PlacementInvite | null
  onClose: () => void
  onDenied: () => void
}) {
  const [reason, setReason] = useState('')
  const [denying, setDenying] = useState(false)

  const onDeny = async () => {
    if (!invite || !reason.trim()) return
    setDenying(true)
    try {
      await rejectPlacementInvite(invite.drive_id, reason.trim())
      toast.success(`Invitation for ${invite.drive_name} denied.`)
      setReason('')
      onClose()
      onDenied()
    } catch (err) {
      toast.error(errMsg(err, 'Could not deny the invitation.'))
    } finally {
      setDenying(false)
    }
  }

  return (
    <Dialog
      open={!!invite}
      onOpenChange={(open) => {
        if (!open) {
          setReason('')
          onClose()
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Deny this invitation?</DialogTitle>
          <DialogDescription>
            Tell the placement cell why you're passing on {invite?.drive_name}.
            This can't be undone.
          </DialogDescription>
        </DialogHeader>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={512}
          rows={4}
          className="w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setReason('')
              onClose()
            }}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => void onDeny()}
            disabled={denying || !reason.trim()}
          >
            {denying ? <Loader2 className="size-4 animate-spin" /> : null}
            Deny invitation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * A read-only row for any non-pending record: status badge plus, for rows the
 * student denied or the cell revoked, the reason instead of the drive date.
 * Shared by the Placements Drives/Invites tabs and the Approvals page.
 */
export function PlacementRecordRow({
  record: r,
  onOpen,
}: {
  record: PlacementDriveRecord
  onOpen: (driveId: number) => void
}) {
  const showReason =
    (r.status === PLACEMENT_STATUS.DENIED ||
      r.status === PLACEMENT_STATUS.REVOKED) &&
    r.rejection_reason
  return (
    <Card
      className={cn(
        'overflow-hidden',
        (r.status === PLACEMENT_STATUS.DENIED ||
          r.status === PLACEMENT_STATUS.REVOKED) &&
          'opacity-80',
      )}
    >
      <button
        type="button"
        onClick={() => onOpen(r.drive_id)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/30"
      >
        <CompanyBadge name={r.company.name} logoUrl={r.company.logo_url} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2 text-sm font-semibold">
            <span className="truncate">{r.drive_name}</span>
            <Badge variant={PLACEMENT_STATUS_BADGE[r.status]}>
              {PLACEMENT_STATUS_LABELS[r.status] ?? r.status}
            </Badge>
          </span>
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
            {showReason
              ? r.rejection_reason
              : `${r.company.name}${
                  r.drive_date
                    ? ` · Drive ${formatPlacementDate(r.drive_date)}`
                    : ''
                }`}
          </span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
      </button>
    </Card>
  )
}
