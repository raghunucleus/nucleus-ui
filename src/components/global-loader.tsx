import { useEffect } from 'react'

import { Spinner } from '@/components/ui/spinner'
import { useLoaderStore } from '@/stores/loader-store'

/**
 * App-wide blocking loading overlay. Mount once at the app root; trigger it
 * from anywhere via `withGlobalLoader` or the `useLoaderStore` actions.
 */
export function GlobalLoader() {
  const visible = useLoaderStore((state) => state.visible)
  const message = useLoaderStore((state) => state.message)

  // Lock background scroll while the blocking overlay is up.
  useEffect(() => {
    if (!visible) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [visible])

  if (!visible) return null

  return (
    <div
      data-slot="global-loader"
      aria-busy="true"
      className="fixed inset-0 z-50 grid place-items-center bg-background/70 backdrop-blur-sm animate-in fade-in-0 duration-150"
    >
      <div className="flex flex-col items-center gap-3 rounded-xl border bg-card px-8 py-7 text-card-foreground shadow-lg animate-in fade-in-0 zoom-in-95 duration-150">
        <Spinner size="lg" label={message ?? 'Loading'} className="text-primary" />
        {message ? <p className="text-sm font-medium">{message}</p> : null}
      </div>
    </div>
  )
}
