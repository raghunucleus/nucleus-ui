import type { LucideIcon } from 'lucide-react'
import { RefreshCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface StateViewAction {
  /** Button label. */
  label: string
  /** Fired on click — typically a retry or a call-to-action. */
  onClick: () => void
  /** Leading icon. Defaults to a refresh glyph. */
  icon?: LucideIcon
  /** While true the button is disabled (e.g. a retry already in flight). */
  loading?: boolean
}

export interface StateViewProps {
  /** The situation-relevant glyph — drives the "what is this" read at a glance. */
  icon: LucideIcon
  /** Short headline. */
  title: string
  /** Optional supporting line. */
  description?: string
  /** Optional primary action (retry / CTA). */
  action?: StateViewAction
  /**
   * Compact mode shrinks the artwork + text and drops the card chrome so the
   * state can sit cleanly inside an existing panel (e.g. a chat list pane).
   * Full mode renders a bordered card suitable for a page body.
   */
  compact?: boolean
  className?: string
}

/**
 * The app's default empty / error / not-ready state — a friendly "404-style"
 * panel rather than a bare line of text. A situation-relevant icon floats on a
 * brand-gradient tile inside two pulsing rings; the message and an optional
 * action sit below.
 *
 * Swap only the `icon`, `title`, `description` and `action` per situation — the
 * motion and layout stay consistent everywhere. All motion is gated behind
 * `motion-safe`, so it holds still under the OS "reduce motion" setting.
 */
export function StateView({
  icon: Icon,
  title,
  description,
  action,
  compact = false,
  className,
}: StateViewProps) {
  const ActionIcon = action?.icon ?? RefreshCw
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-5 text-center',
        compact
          ? 'px-5 py-10'
          : 'rounded-2xl border bg-card px-6 py-16 text-card-foreground',
        className,
      )}
    >
      <style>{`@keyframes ncl-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}`}</style>
      <div
        className={cn(
          'relative grid place-items-center',
          compact ? 'size-20' : 'size-28',
        )}
      >
        <span
          className={cn(
            'absolute rounded-full bg-primary/10 motion-safe:animate-ping [animation-duration:2.6s]',
            compact ? 'size-16' : 'size-24',
          )}
        />
        <span
          className={cn(
            'absolute rounded-full border border-primary/15 motion-safe:animate-pulse [animation-duration:2.6s]',
            compact ? 'size-20' : 'size-28',
          )}
        />
        <div
          className={cn(
            'relative grid place-items-center rounded-2xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-lg motion-safe:[animation:ncl-float_3s_ease-in-out_infinite]',
            compact ? 'size-12' : 'size-16',
          )}
        >
          <Icon className={compact ? 'size-6' : 'size-8'} />
        </div>
      </div>

      <div className="space-y-1.5">
        <h2 className={cn('font-semibold', compact ? 'text-sm' : 'text-lg')}>
          {title}
        </h2>
        {description ? (
          <p
            className={cn(
              'mx-auto max-w-sm text-muted-foreground',
              compact ? 'text-xs' : 'text-sm',
            )}
          >
            {description}
          </p>
        ) : null}
      </div>

      {action ? (
        <Button
          size={compact ? 'sm' : 'default'}
          onClick={action.onClick}
          disabled={action.loading}
        >
          <ActionIcon />
          {action.label}
        </Button>
      ) : null}
    </div>
  )
}
