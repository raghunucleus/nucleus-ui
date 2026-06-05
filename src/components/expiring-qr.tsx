import { useCallback, useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { RefreshCw, ScanLine } from 'lucide-react'

import { Button } from '@/components/ui/button'

export interface SecurityPass {
  qr_token: string
  ttl_seconds: number
  expires_at: string
}

/**
 * The scannable ID-card QR: a single-use, 60-second security pass. It does NOT
 * auto-refresh — a countdown ticks to zero and stops, then the holder clicks
 * Regenerate to issue a fresh pass (which also invalidates the previous one
 * server-side). The countdown pauses while the browser tab is hidden.
 */
export function ExpiringQr({
  initialToken,
  ttlSeconds,
  caption,
  fetchPass,
}: {
  initialToken: string
  ttlSeconds: number
  caption: string
  fetchPass: () => Promise<SecurityPass>
}) {
  const [token, setToken] = useState(initialToken)
  const [secondsLeft, setSecondsLeft] = useState(ttlSeconds)
  const [regenerating, setRegenerating] = useState(false)
  const [failed, setFailed] = useState(false)

  // One ticking interval, paused while the tab is hidden (the web analog of
  // pausing when a screen is unfocused). State persists across hide/show, and
  // the interval restarts whenever a new token is issued.
  useEffect(() => {
    let id: ReturnType<typeof setInterval> | null = null
    const start = () => {
      if (id) return
      id = setInterval(() => {
        setSecondsLeft((s) => (s <= 0 ? 0 : s - 1))
      }, 1000)
    }
    const stop = () => {
      if (id) {
        clearInterval(id)
        id = null
      }
    }
    const onVisibility = () => {
      if (document.hidden) stop()
      else start()
    }
    if (!document.hidden) start()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      stop()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [token])

  const regenerate = useCallback(async () => {
    setRegenerating(true)
    setFailed(false)
    try {
      const pass = await fetchPass()
      setToken(pass.qr_token)
      setSecondsLeft(pass.ttl_seconds)
    } catch {
      setFailed(true)
    } finally {
      setRegenerating(false)
    }
  }, [fetchPass])

  const expired = secondsLeft <= 0

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="rounded-xl bg-white p-3 shadow-sm">
        <div className={expired ? 'opacity-20' : undefined}>
          <QRCodeSVG value={token} size={150} level="M" />
        </div>
      </div>
      <div className="text-center">
        {expired ? (
          <p className="text-sm font-medium text-destructive">
            QR expired — click Regenerate
          </p>
        ) : (
          <>
            <p className="flex items-center justify-center gap-1.5 text-sm font-medium">
              <ScanLine className="size-4 text-icon-violet" />
              Expires in {secondsLeft}s
            </p>
            <p className="font-mono text-xs text-muted-foreground">{caption}</p>
          </>
        )}
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={regenerate}
        disabled={regenerating}
      >
        <RefreshCw className={regenerating ? 'animate-spin' : undefined} />
        Regenerate QR
      </Button>
      {failed ? (
        <p className="text-xs text-destructive">
          Couldn&rsquo;t refresh. Try again.
        </p>
      ) : null}
    </div>
  )
}
