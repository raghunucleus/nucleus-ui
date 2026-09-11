import { useEffect, useState } from 'react'
import { Laptop, Smartphone } from 'lucide-react'
import { toast } from 'sonner'

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
import { ApiError } from '@/lib/api'
import {
  formatRelativeTime,
  isMobileDeviceName,
  type SessionRow,
} from '@/lib/sessions'
import { cn } from '@/lib/utils'

/**
 * Every visible string, with an English default. The parent portal passes
 * translated ones; this component must not import i18n (it is shared with the
 * English-only student and employee portals, whose chunks stay i18n-free).
 */
export type DevicesListStrings = {
  thisDevice: string
  lastActive: (iso: string) => string
  signedIn: (iso: string) => string
  signOut: string
  signingOut: string
  cancel: string
  empty: string
  loadError: string
  retry: string
  confirmTitle: (session: SessionRow) => string
  confirmDescription: (session: SessionRow) => string
  signedOutToast: (session: SessionRow) => string
  alreadySignedOut: string
  revokeError: string
}

const DEFAULT_STRINGS: DevicesListStrings = {
  thisDevice: 'This device',
  lastActive: (iso) => `Last active ${formatRelativeTime(iso)}`,
  signedIn: (iso) => `Signed in ${formatRelativeTime(iso)}`,
  signOut: 'Sign out',
  signingOut: 'Signing out…',
  cancel: 'Cancel',
  empty: 'No signed-in devices found.',
  loadError: "Couldn't load your devices.",
  retry: 'Try again',
  confirmTitle: (s) =>
    s.current ? 'Sign out of this device?' : `Sign out of “${s.device_name}”?`,
  confirmDescription: (s) =>
    s.current
      ? "You'll be returned to the sign-in screen."
      : 'That device is disconnected immediately and will need to sign in again.',
  signedOutToast: (s) => `Signed out of “${s.device_name}”.`,
  alreadySignedOut: 'That device was already signed out.',
  revokeError: 'Could not sign that device out. Please try again.',
}

type Props = {
  /**
   * The audience's list call (`studentListSessions` etc.). Pass a stable,
   * module-level function — it is an effect dependency.
   */
  load: () => Promise<SessionRow[]>
  /** The audience's revoke call (`studentRevokeSession` etc.). */
  revoke: (sessionId: string) => Promise<void>
  /**
   * The `current` row was signed out: this session is dead server-side, so
   * clear local tokens and drop to the login screen now rather than waiting
   * for the next request to 401.
   */
  onCurrentRevoked: () => void
  strings?: Partial<DevicesListStrings>
  className?: string
}

/**
 * "My devices": every device this account is signed in on, with a per-row
 * sign-out behind a confirm. Ported from central-ui's Devices tab. No IP by
 * design — it reads as noise to the owner.
 *
 * Renders only the list and its states; the page supplies the heading and
 * any card chrome around it.
 */
export function DevicesList({
  load,
  revoke,
  onCurrentRevoked,
  strings,
  className,
}: Props) {
  const copy = { ...DEFAULT_STRINGS, ...strings }
  const [rows, setRows] = useState<SessionRow[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  // The row the confirm dialog is about. Kept after close so the dialog's
  // text doesn't blank out during its exit animation.
  const [target, setTarget] = useState<SessionRow | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const list = await load()
        if (alive) setRows(list)
      } catch {
        // An unrecoverable 401 has already signed the user out through the
        // auth wrapper; anything else shows the retry state.
        if (alive) setFailed(true)
      }
    })()
    return () => {
      alive = false
    }
  }, [load, reloadKey])

  function retry() {
    setFailed(false)
    setRows(null)
    setReloadKey((k) => k + 1)
  }

  function askToRevoke(session: SessionRow) {
    setTarget(session)
    setConfirmOpen(true)
  }

  function dropRow(id: string) {
    setRows((prev) => prev?.filter((r) => r.id !== id) ?? prev)
  }

  async function confirmRevoke() {
    const session = target
    if (!session || busyId) return
    setBusyId(session.id)
    try {
      await revoke(session.id)
      setConfirmOpen(false)
      if (session.current) {
        onCurrentRevoked()
        return
      }
      dropRow(session.id)
      toast.success(copy.signedOutToast(session))
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        // Already gone (signed out elsewhere, or expired) — the list was stale.
        setConfirmOpen(false)
        dropRow(session.id)
        toast.info(copy.alreadySignedOut)
      } else if (err instanceof ApiError && err.status === 401) {
        // The session itself is over; the auth wrapper has signed out.
        setConfirmOpen(false)
      } else {
        toast.error(copy.revokeError)
      }
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className={cn('space-y-4', className)}>
      {failed ? (
        <div className="space-y-3 rounded-xl border p-6 text-center">
          <p className="text-sm text-muted-foreground">{copy.loadError}</p>
          <Button variant="outline" onClick={retry}>
            {copy.retry}
          </Button>
        </div>
      ) : rows === null ? (
        <DevicesSkeleton />
      ) : rows.length === 0 ? (
        <p className="rounded-xl border p-6 text-center text-sm text-muted-foreground">
          {copy.empty}
        </p>
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card text-card-foreground">
          {rows.map((s) => {
            const Icon = isMobileDeviceName(s.device_name) ? Smartphone : Laptop
            return (
              <li key={s.id} className="flex items-center gap-3 px-4 py-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-sm font-medium">
                      {s.device_name}
                    </span>
                    {s.current && (
                      <Badge className="shrink-0">{copy.thisDevice}</Badge>
                    )}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {copy.lastActive(s.last_used_at)} ·{' '}
                    {copy.signedIn(s.created_at)}
                  </p>
                </div>
                <Button
                  variant="outline"
                  className="shrink-0"
                  disabled={busyId !== null}
                  onClick={() => askToRevoke(s)}
                >
                  {busyId === s.id ? copy.signingOut : copy.signOut}
                </Button>
              </li>
            )
          })}
        </ul>
      )}

      <Dialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!busyId) setConfirmOpen(open)
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{target ? copy.confirmTitle(target) : null}</DialogTitle>
            <DialogDescription>
              {target ? copy.confirmDescription(target) : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={busyId !== null}
              onClick={() => setConfirmOpen(false)}
            >
              {copy.cancel}
            </Button>
            <Button
              variant="destructive"
              disabled={busyId !== null}
              onClick={() => void confirmRevoke()}
            >
              {busyId ? copy.signingOut : copy.signOut}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/** Two rows — the default device limit — shaped like the real ones. */
function DevicesSkeleton() {
  return (
    <ul
      aria-hidden
      className="divide-y overflow-hidden rounded-xl border bg-card"
    >
      {[0, 1].map((i) => (
        <li key={i} className="flex items-center gap-3 px-4 py-3">
          <div className="shimmer size-9 shrink-0 rounded-lg bg-muted/60" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="shimmer h-3.5 w-40 max-w-full rounded bg-muted/60" />
            <div className="shimmer h-3 w-56 max-w-full rounded bg-muted/60" />
          </div>
          <div className="shimmer h-9 w-20 shrink-0 rounded-md bg-muted/60" />
        </li>
      ))}
    </ul>
  )
}
