import { useCallback, useEffect, useState } from 'react'

import { pingServer } from '@/lib/api'
import { useNetworkStore } from '@/stores/network-store'

import { ServerUnreachable } from './server-unreachable'

/** How often we re-probe `/health/live` while offline, awaiting recovery. */
const RECOVERY_POLL_MS = 5_000

/**
 * Server-unreachable detection + full-screen offline takeover. Mounted once at
 * the app root (above every portal/router) so an outage on any screen — login
 * included — shows the takeover. The state machine:
 *
 *  - A passively-reported failure fires one confirming probe before we take
 *    over, so a single transient blip never blanks the screen.
 *  - While offline, poll `/health/live` every 5s and clear on the first success.
 *  - Browser `offline`/`online` events give an instant extra trigger.
 *
 * Recovery bumps the store's `reconnectNonce`; router root layouts key their
 * `<Outlet>` on it, so the active page remounts and refetches — no page reload,
 * the user stays on the same route.
 */
export function ConnectivityMonitor() {
  const status = useNetworkStore((s) => s.status)
  const failureSeq = useNetworkStore((s) => s.failureSeq)
  const [checking, setChecking] = useState(false)

  // Confirm a passively-reported failure with one probe before going offline.
  useEffect(() => {
    if (failureSeq === 0) return
    if (useNetworkStore.getState().status === 'offline') return
    let cancelled = false
    void pingServer().then((ok) => {
      if (!cancelled && !ok) useNetworkStore.getState().setOffline()
    })
    return () => {
      cancelled = true
    }
  }, [failureSeq])

  // While offline, poll for recovery and clear the moment the server answers.
  useEffect(() => {
    if (status !== 'offline') return
    let stopped = false
    const id = window.setInterval(() => {
      void pingServer().then((ok) => {
        if (!stopped && ok) useNetworkStore.getState().setOnline()
      })
    }, RECOVERY_POLL_MS)
    return () => {
      stopped = true
      window.clearInterval(id)
    }
  }, [status])

  // Browser network events: instant offline, confirm-then-clear on return.
  useEffect(() => {
    const onOffline = () => useNetworkStore.getState().setOffline()
    const onOnline = () => {
      void pingServer().then((ok) => {
        if (ok) useNetworkStore.getState().setOnline()
      })
    }
    window.addEventListener('offline', onOffline)
    window.addEventListener('online', onOnline)
    return () => {
      window.removeEventListener('offline', onOffline)
      window.removeEventListener('online', onOnline)
    }
  }, [])

  const handleRetry = useCallback(() => {
    setChecking(true)
    void pingServer().then((ok) => {
      if (ok) useNetworkStore.getState().setOnline()
      setChecking(false)
    })
  }, [])

  if (status !== 'offline') return null
  return <ServerUnreachable onRetry={handleRetry} checking={checking} />
}
