import * as React from 'react'

import { PAGE_BLEED } from '@/lib/page-bleed'
import { cn } from '@/lib/utils'

export interface TabDef {
  key: string
  label: string
  icon?: React.ComponentType<{ className?: string }>
}

/**
 * Sets `data-overflow` on a horizontally scrolling strip while there is more
 * content to the right, which the `tabs-scroll` utility turns into a trailing
 * fade. Measured from a ResizeObserver (which also fires once on observe) and
 * the strip's own scroll events, so nothing is computed in render.
 */
function useOverflowFade(
  ref: React.RefObject<HTMLElement | null>,
  revision: string,
): boolean {
  const [overflow, setOverflow] = React.useState(false)
  React.useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => {
      setOverflow(el.scrollWidth - el.clientWidth - el.scrollLeft > 1)
    }
    const ro = new ResizeObserver(update)
    ro.observe(el)
    el.addEventListener('scroll', update, { passive: true })
    return () => {
      ro.disconnect()
      el.removeEventListener('scroll', update)
    }
    // `revision` re-arms the observer when the tab set changes, since a new
    // tab widens the content without resizing the strip itself.
  }, [ref, revision])
  return overflow
}

/**
 * Underline tab strip — the central-ui pattern ("Summary | List | Boards …").
 *
 * The strip scrolls horizontally when it does not fit (no visible scrollbar;
 * a trailing fade says "more to the right") instead of wrapping or shoving
 * its neighbours, so a row that holds six tabs and an actions cluster can
 * never overlap. Pass it to `PageHeader`'s `tabs`: in the employee and parent
 * portals that makes it the first row of the page, flush at the content's
 * left edge (the title lives in the app header); in the student portal it
 * shares the title row and drops onto its own row below `lg`.
 *
 * - `actions` render at the trailing edge (`ml-auto`) — filters, pickers, a
 *   "Views" menu.
 * - `bleed` turns it into a full-width `h-11` bar flush under the app header
 *   (flow-project-shell style); otherwise it sizes to its content and sits
 *   inside whatever row it is given.
 * - `className="border-b-0"` when the divider belongs to the wrapping row.
 *
 * Keyboard: a real `role="tablist"` with roving tabindex; ←/→ wrap, Home/End
 * jump. Selecting also scrolls the active tab into view.
 */
export function TabsBar({
  tabs,
  value,
  onChange,
  size = 'default',
  actions,
  bleed = false,
  className,
  'aria-label': ariaLabel,
}: {
  tabs: readonly TabDef[]
  value: string
  onChange: (key: string) => void
  /** `sm` = tighter tabs for dense toolbars. */
  size?: 'sm' | 'default'
  actions?: React.ReactNode
  bleed?: boolean
  className?: string
  'aria-label'?: string
}) {
  const listRef = React.useRef<HTMLDivElement>(null)
  const revision = tabs.map((t) => t.key).join('|')
  const overflow = useOverflowFade(listRef, revision)

  // Keep the active tab visible when it changes (a scrolled-off tab picked
  // through the keyboard, or a page that restores a tab from the URL).
  React.useEffect(() => {
    const active = listRef.current?.querySelector<HTMLElement>(
      '[role="tab"][data-state="active"]',
    )
    active?.scrollIntoView({ inline: 'nearest', block: 'nearest' })
  }, [value])

  const activeIndex = Math.max(
    0,
    tabs.findIndex((t) => t.key === value),
  )

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (tabs.length === 0) return
    let next: number | null = null
    if (e.key === 'ArrowRight') next = (activeIndex + 1) % tabs.length
    else if (e.key === 'ArrowLeft')
      next = (activeIndex - 1 + tabs.length) % tabs.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = tabs.length - 1
    if (next === null) return
    e.preventDefault()
    onChange(tabs[next].key)
    const buttons =
      listRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
    buttons?.[next]?.focus()
  }

  return (
    <div
      className={cn(
        'flex min-w-0 items-center gap-2 border-b',
        bleed && cn(PAGE_BLEED, 'h-11 shrink-0 bg-background'),
        className,
      )}
    >
      <div
        ref={listRef}
        role="tablist"
        aria-label={ariaLabel}
        aria-orientation="horizontal"
        data-overflow={overflow || undefined}
        onKeyDown={onKeyDown}
        className="tabs-scroll -mb-px flex min-w-0 flex-1 items-stretch gap-1 self-stretch overflow-x-auto"
      >
        {tabs.map((t, i) => {
          const on = i === activeIndex
          const Icon = t.icon
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={on}
              tabIndex={on ? 0 : -1}
              data-state={on ? 'active' : 'inactive'}
              onClick={() => onChange(t.key)}
              className={cn(
                'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 font-medium outline-none transition-colors',
                'focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-inset',
                size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-2 text-sm',
                on
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {Icon ? (
                <Icon className={size === 'sm' ? 'size-3.5' : 'size-4'} />
              ) : null}
              {t.label}
            </button>
          )
        })}
      </div>
      {actions ? (
        <div className="ml-auto flex shrink-0 items-center gap-1">{actions}</div>
      ) : null}
    </div>
  )
}
