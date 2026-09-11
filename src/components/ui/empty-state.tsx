import * as React from 'react'
import type { LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * "Nothing here" panel: a dashed card with an icon, a one-line title, an
 * optional explanation and an optional action. One shape for every list,
 * tab and search result — the pages used to carry nine local copies.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  compact = false,
  className,
}: {
  icon?: LucideIcon
  title: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
  /** Tighter padding for a panel inside a card or a table body. */
  compact?: boolean
  className?: string
}) {
  return (
    <div
      role="status"
      className={cn(
        'flex flex-col items-center gap-2 rounded-xl border border-dashed bg-muted/20 text-center',
        compact ? 'px-4 py-6' : 'px-6 py-10',
        className,
      )}
    >
      {Icon ? (
        <Icon
          className={cn(
            'text-muted-foreground',
            compact ? 'size-6' : 'size-8',
          )}
          aria-hidden
        />
      ) : null}
      <div className="text-sm font-medium">{title}</div>
      {description ? (
        <p className="max-w-prose text-xs text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  )
}
