import { CloudOff, GraduationCap, RefreshCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type ServerUnreachableProps = {
  /** Trigger an immediate reachability re-check. */
  onRetry: () => void
  /** A manual re-check is in flight (drives the button's spinner/label). */
  checking?: boolean
}

/**
 * Full-screen "can't reach the server" takeover, rendered by
 * `ConnectivityMonitor` when the API is unreachable. Styled after the 404 page
 * (`pages/not-found.tsx`): a `fixed inset-0` overlay with drifting gradient orbs,
 * a faded grid, and staggered entrance. Disappears automatically once the
 * server answers again.
 */
export function ServerUnreachable({
  onRetry,
  checking = false,
}: ServerUnreachableProps) {
  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center overflow-hidden bg-background p-6 text-center text-foreground">
      {/* Floating gradient orbs — purely decorative, slow pulse. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-32 top-12 size-80 rounded-full bg-gradient-to-br from-primary/40 to-secondary/30 blur-3xl animate-pulse [animation-duration:7s]" />
        <div className="absolute -right-32 bottom-12 size-[28rem] rounded-full bg-gradient-to-br from-secondary/30 to-primary/30 blur-3xl animate-pulse [animation-duration:9s] [animation-delay:1.5s]" />
      </div>

      {/* Soft grid overlay — fades out at the edges via radial mask. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-50 [mask-image:radial-gradient(ellipse_at_center,black_25%,transparent_75%)]"
        style={{
          backgroundImage:
            'linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      <div
        role="alert"
        aria-live="assertive"
        className="flex flex-col items-center gap-6"
      >
        <div className="inline-flex animate-in fade-in slide-in-from-bottom-2 items-center gap-2 duration-700">
          <div className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-primary to-secondary text-primary-foreground shadow-sm shadow-primary/30">
            <GraduationCap className="size-5" />
          </div>
          <span className="text-lg font-semibold tracking-tight">Nucleus</span>
        </div>

        {/* Radar/sonar: concentric rings pulse outward around the icon,
            reading as "searching for the server" — echoes the retry loop. */}
        <div className="relative size-20 animate-in fade-in zoom-in-90 duration-700">
          <span
            aria-hidden
            className="absolute inset-0 rounded-full border border-primary/30 animate-ping [animation-duration:2.4s]"
          />
          <span
            aria-hidden
            className="absolute inset-0 rounded-full border border-primary/25 animate-ping [animation-duration:2.4s] [animation-delay:0.8s]"
          />
          <span
            aria-hidden
            className="absolute inset-0 rounded-full border border-primary/20 animate-ping [animation-duration:2.4s] [animation-delay:1.6s]"
          />
          <div className="relative grid size-20 place-items-center rounded-full border bg-card text-primary shadow-sm">
            <CloudOff className="size-9" strokeWidth={1.5} />
          </div>
        </div>

        <div className="flex flex-col items-center gap-2 animate-in fade-in slide-in-from-bottom-3 delay-150 duration-700">
          <h1 className="text-2xl font-semibold tracking-tight">
            Can&rsquo;t reach the server
          </h1>
          <p className="max-w-md text-pretty text-sm text-muted-foreground sm:text-base">
            We&rsquo;re having trouble connecting to Nucleus. We&rsquo;ll keep
            trying and reconnect automatically as soon as it&rsquo;s back.
          </p>
        </div>

        <div className="flex flex-col items-center gap-4 animate-in fade-in slide-in-from-bottom-3 delay-300 duration-700">
          <Button size="lg" onClick={onRetry} disabled={checking}>
            <RefreshCw className={cn(checking && 'animate-spin')} />
            {checking ? 'Checking…' : 'Try again'}
          </Button>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground/80">
            <Dot />
            <Dot className="[animation-delay:180ms]" />
            <Dot className="[animation-delay:360ms]" />
            <span className="ml-1.5">Reconnecting…</span>
          </span>
        </div>
      </div>
    </div>
  )
}

/** A single pulsing dot for the "Reconnecting…" indicator. */
function Dot({ className }: { className?: string }) {
  return (
    <span
      className={cn('size-1.5 rounded-full bg-primary animate-pulse', className)}
    />
  )
}
