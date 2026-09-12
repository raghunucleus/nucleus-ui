import * as React from 'react'
import { createPortal } from 'react-dom'
import type { LucideIcon } from 'lucide-react'

import { StickyHeader } from '@/components/ui/sticky-header'
import { useHeaderSlot } from '@/hooks/use-header-slot'
import { PAGE_BLEED } from '@/lib/page-bleed'
import { cn } from '@/lib/utils'

/**
 * The one page heading for every in-app page.
 *
 * In the employee and parent portals the app header owns a title slot
 * (`HeaderSlotContext`, filled by the shell where the hamburger used to be),
 * and the heading — `leading` (a back control), `icon`, `title` — is
 * portalled into it. What stays on the page is row 1 = `tabs` (a
 * `<TabsBar className="border-b-0" …/>`, starting at the content's left edge)
 * with `actions` at the trailing edge, then `children` (filter rows, readouts,
 * chips). With nothing to put in flow the component renders only the portal, so
 * a page whose heading is just a title adds no empty box to `space-y-*`.
 *
 * The student portal has no slot; there the heading renders inline as row 1,
 * sharing the row with `tabs` and `actions` (the tabs box takes only the width
 * the title and actions leave, and drops to its own row below `lg`).
 *
 * Render exactly ONE `PageHeader` per page, at the top level of the page's
 * return and above any loading/error branches — never inside a dialog, sheet,
 * panel or tab body. Two mounted at once show two titles in the header; one
 * that mounts only once data arrives leaves the header blank while loading, so
 * pass a static fallback (`drive?.drive_name ?? 'Drive'`) instead.
 *
 * `sticky` pins the in-flow rows flush under the app header (the portal
 * `<main>` is the scroll container; PAGE_BLEED owns the offsets) with an opaque
 * background so rows scroll beneath them.
 *
 * Title size is `text-lg`; nothing in a portal page sits above it.
 */
export function PageHeader({
  title,
  icon: Icon,
  leading,
  actions,
  tabs,
  sticky = false,
  className,
  children,
}: {
  title: React.ReactNode
  /** Small muted glyph before the title (hidden on phones in the header). */
  icon?: LucideIcon
  /** Rendered before the title — a back control, an avatar, a badge. */
  leading?: React.ReactNode
  /** Trailing controls: primary button, menus, pickers. */
  actions?: React.ReactNode
  /** A `<TabsBar className="border-b-0" …/>` — row 1 of the page content. */
  tabs?: React.ReactNode
  /** Pin the in-flow rows under the app header with the page-bleed offsets. */
  sticky?: boolean
  className?: string
  /** Extra rows under the tabs/actions row (filters, readouts, chips). */
  children?: React.ReactNode
}) {
  const slot = useHeaderSlot()

  // Dev-only tripwire for the one-per-page rule above.
  React.useEffect(() => {
    if (import.meta.env.DEV && slot && slot.querySelectorAll('h1').length > 1) {
      console.warn(
        'PageHeader: more than one page heading is mounted — the app header shows them all.',
      )
    }
  }, [slot])

  if (slot) {
    const portal = createPortal(
      <>
        {leading ? (
          <div className="flex shrink-0 items-center">{leading}</div>
        ) : null}
        {Icon ? (
          <Icon
            className="hidden size-5 shrink-0 text-muted-foreground sm:block"
            aria-hidden
          />
        ) : null}
        <h1 className="min-w-0 truncate text-lg font-semibold tracking-tight">
          {title}
        </h1>
      </>,
      slot,
    )

    const row =
      tabs || actions ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {tabs ? <div className="min-w-0 flex-1 basis-0">{tabs}</div> : null}
          {actions ? (
            <div className="ml-auto flex shrink-0 flex-wrap items-center gap-2">
              {actions}
            </div>
          ) : null}
        </div>
      ) : null

    if (!row && !children) return portal

    return (
      <>
        {portal}
        {sticky ? (
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
        ) : (
          <div className={cn('space-y-2', className)}>
            {row}
            {children}
          </div>
        )}
      </>
    )
  }

  // No header slot (student portal): the heading is row 1 of the page.
  const row = (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      {leading}
      <div className="flex min-w-0 shrink-0 items-center gap-2">
        {Icon ? (
          <Icon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
        ) : null}
        <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
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
