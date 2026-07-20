import * as React from 'react'
import { createPortal } from 'react-dom'

import { cn } from '@/lib/utils'

/**
 * A hover card whose contents are fetched the first time the row is hovered —
 * never with the list query. Wide detail (a student's selections, their full
 * academic record) would multiply the search's cost by the page size for data
 * most rows never reveal.
 *
 * Rendered through a portal with fixed positioning rather than an absolutely
 * positioned child: the results table lives inside an `overflow-x-auto` scroll
 * box, which would clip an in-flow popover at the table's edge.
 */

const VIEWPORT_PADDING = 8
const GAP = 5

/**
 * How long the card survives after the pointer leaves. Without this the card is
 * unreachable: the pointer must leave the trigger to get to it, and a scrollable
 * card can't be scrolled if it closes on the way there.
 */
const CLOSE_DELAY_MS = 150

/** Viewport-clamped fixed coordinates, anchored to the edge the card grows from. */
function cardPosition(
  rect: DOMRect,
  width: number,
  maxHeight: number,
): { top?: number; bottom?: number; left: number; maxHeight: number } {
  const vw = window.innerWidth
  const vh = window.innerHeight

  // Prefer below the trigger; flip above when the bottom would clip and there
  // is more room up there.
  const spaceBelow = vh - rect.bottom - VIEWPORT_PADDING
  const spaceAbove = rect.top - VIEWPORT_PADDING
  const below = spaceBelow >= maxHeight || spaceBelow >= spaceAbove

  // Centre on the trigger, then pull back inside either edge.
  const centred = rect.left + rect.width / 2 - width / 2
  const left = Math.min(
    Math.max(VIEWPORT_PADDING, centred),
    Math.max(VIEWPORT_PADDING, vw - width - VIEWPORT_PADDING),
  )

  // Anchored by the edge nearest the trigger, never by a predicted height: a
  // card opening upward is pinned by its BOTTOM, so it stays glued to the row
  // whatever it ends up containing (a short "Loading…" included). `maxHeight`
  // caps it to the room actually available on that side; taller content
  // scrolls inside the card.
  return below
    ? {
        top: rect.bottom + GAP,
        left,
        maxHeight: Math.min(maxHeight, spaceBelow - GAP),
      }
    : {
        bottom: vh - rect.top + GAP,
        left,
        maxHeight: Math.min(maxHeight, spaceAbove - GAP),
      }
}

export function HoverDetail({
  trigger,
  onOpen,
  children,
  onClick,
  width = 320,
  maxHeight = 320,
  label,
}: {
  /** The always-visible cell content. */
  trigger: React.ReactNode
  /** Fired on hover/focus — kick off the fetch here (it must be idempotent). */
  onOpen: () => void
  /**
   * When set the trigger becomes a real button — the card is a peek, this is
   * the way to pin the same detail open in a modal (and the only path on touch,
   * where there is no hover at all).
   */
  onClick?: () => void
  /** The card body, rendered only while open. */
  children: React.ReactNode
  width?: number
  maxHeight?: number
  /** Accessible name for the trigger, e.g. "Selection details". */
  label: string
}) {
  const ref = React.useRef<HTMLButtonElement>(null)
  const [pos, setPos] = React.useState<ReturnType<typeof cardPosition> | null>(
    null,
  )

  // Hover intent: any enter (trigger OR card) cancels a pending close, so the
  // pointer can cross the gap between them and scroll a long card.
  const closeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const cancelClose = () => {
    if (closeTimer.current === null) return
    clearTimeout(closeTimer.current)
    closeTimer.current = null
  }
  React.useEffect(() => cancelClose, [])

  const open = () => {
    if (!ref.current) return
    cancelClose()
    onOpen()
    setPos(cardPosition(ref.current.getBoundingClientRect(), width, maxHeight))
  }
  const scheduleClose = () => {
    cancelClose()
    closeTimer.current = setTimeout(() => setPos(null), CLOSE_DELAY_MS)
  }
  /** Blur and Escape have no gap to cross — they close at once. */
  const close = () => {
    cancelClose()
    setPos(null)
  }

  return (
    <>
      <button
        ref={ref}
        type="button"
        aria-label={label}
        onMouseEnter={open}
        onMouseLeave={scheduleClose}
        onFocus={open}
        onBlur={close}
        onClick={
          onClick
            ? () => {
                close()
                onClick()
              }
            : undefined
        }
        className={cn(
          'rounded px-1 py-0.5 -mx-1 transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          onClick
            ? 'cursor-pointer hover:bg-accent hover:text-accent-foreground'
            : 'cursor-default underline decoration-dotted decoration-muted-foreground/60 underline-offset-4 hover:decoration-foreground',
        )}
      >
        {trigger}
      </button>
      {pos
        ? createPortal(
            <div
              role="tooltip"
              style={{ ...pos, width }}
              // Its own hover handlers: `mouseleave` doesn't bubble and the card
              // is portalled out of the trigger's subtree, so without these the
              // pointer entering the card would never cancel the close.
              onMouseEnter={cancelClose}
              onMouseLeave={scheduleClose}
              className="scrollbar-themed fixed z-50 flex flex-col overflow-y-auto rounded-lg border bg-popover p-3 text-popover-foreground shadow-lg"
            >
              {children}
              {onClick ? (
                <p className="mt-2 shrink-0 border-t pt-2 text-[11px] text-muted-foreground">
                  Click for more
                </p>
              ) : null}
            </div>,
            document.body,
          )
        : null}
    </>
  )
}

/** Shared card states, so every hover card reads the same while loading. */
export function HoverCardStatus({ text }: { text: string }) {
  return <p className="text-xs text-muted-foreground">{text}</p>
}
