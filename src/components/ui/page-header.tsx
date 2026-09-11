import * as React from 'react'
import type { LucideIcon } from 'lucide-react'

import { StickyHeader } from '@/components/ui/sticky-header'
import { PAGE_BLEED } from '@/lib/page-bleed'
import { cn } from '@/lib/utils'

/**
 * The one page heading for every in-app page.
 *
 * Row 1 is `title` (+ optional `subtitle`, `icon`, or a `leading` slot such as
 * a back link), then `tabs` (a `TabsBar`), then `actions` pushed to the
 * trailing edge. The tabs block is `flex-1 basis-0 min-w-0`, so it only ever
 * takes the space the title and actions leave — it scrolls inside that box
 * rather than pushing the actions out or wrapping under them — and below `lg`
 * it drops onto its own full-width row. That is what stops a header with a
 * long title, six tabs and a menu from overlapping.
 *
 * `sticky` pins the whole thing flush under the app header (the portal
 * `<main>` is the scroll container; PAGE_BLEED owns the offsets) and paints an
 * opaque background so rows scroll beneath it. Extra rows — a filter bar, a
 * readout, applied chips — go in `children` and stick along with it.
 *
 * Title size is `text-lg`; nothing in a portal page sits above it.
 */
export function PageHeader({
  title,
  subtitle,
  icon: Icon,
  leading,
  actions,
  tabs,
  sticky = false,
  className,
  children,
}: {
  title: React.ReactNode
  subtitle?: React.ReactNode
  /** Small muted glyph before the title. */
  icon?: LucideIcon
  /** Rendered before the title block — a back link, an avatar, a badge. */
  leading?: React.ReactNode
  /** Trailing controls: primary button, menus, pickers. */
  actions?: React.ReactNode
  /** A `<TabsBar className="border-b-0" …/>` — shares row 1 on wide screens. */
  tabs?: React.ReactNode
  /** Pin under the app header with the page-bleed offsets. */
  sticky?: boolean
  className?: string
  /** Extra rows under the title row (filters, readouts, chips). */
  children?: React.ReactNode
}) {
  const row = (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      {leading}
      <div className="flex min-w-0 shrink-0 items-center gap-2">
        {Icon ? (
          <Icon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
        ) : null}
        <div className="min-w-0">
          <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
          {subtitle ? (
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
      </div>
      {tabs ? (
        <div className="min-w-0 flex-1 basis-0 max-lg:order-last max-lg:basis-full">
          {tabs}
        </div>
      ) : null}
      {actions ? (
        <div className="ml-auto flex shrink-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      ) : null}
    </div>
  )

  if (sticky) {
    return (
      <StickyHeader
        className={cn(
          'z-30 space-y-2 border-b bg-background pb-2 pt-4',
          PAGE_BLEED,
          className,
        )}
      >
        {row}
        {children}
      </StickyHeader>
    )
  }

  return (
    <div className={cn('space-y-2', className)}>
      {row}
      {children}
    </div>
  )
}
