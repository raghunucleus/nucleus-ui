import * as React from 'react'

import { cn } from '@/lib/utils'

/**
 * Pins a screen's top region (back button + primary nav: tabs/title) so it
 * stays visible while the body scrolls. Employee-portal content scrolls inside
 * `<main>`, so `top-0` pins flush beneath the app header. The opaque
 * `bg-background` hides content scrolling under it; `z-10` keeps it below
 * popovers/sheets (`z-50`). Callers supply padding, a `border-b` divider, and
 * `space-y-*` via `className` to fit each screen.
 */
export function StickyHeader({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <div
      data-slot="sticky-header"
      className={cn('sticky top-0 z-10 bg-background', className)}
    >
      {children}
    </div>
  )
}
