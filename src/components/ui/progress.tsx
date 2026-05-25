import * as React from 'react'

import { cn } from '@/lib/utils'

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Completion percentage (0–100). Values outside the range are clamped. */
  value?: number
  /** Classes for the filled portion — e.g. a tone override like `bg-success`. */
  indicatorClassName?: string
}

/**
 * Slim determinate progress bar. The fill width is a runtime value, so it is
 * applied via `style`; all colors come from theme tokens via `className`.
 */
function Progress({
  value = 0,
  className,
  indicatorClassName,
  ...props
}: ProgressProps) {
  const pct = Math.max(0, Math.min(100, value))
  return (
    <div
      data-slot="progress"
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn(
        'h-2 w-full overflow-hidden rounded-full bg-muted',
        className,
      )}
      {...props}
    >
      <div
        className={cn(
          'h-full rounded-full bg-primary transition-all',
          indicatorClassName,
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

export { Progress }
