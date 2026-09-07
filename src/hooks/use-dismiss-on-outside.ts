import { useEffect, useRef } from 'react'

/**
 * Close-on-outside-pointerdown plus Escape, for a hand-rolled popover.
 *
 * The repo ships no popover primitive — `date-picker.tsx` and `combobox.tsx`
 * each repeat this effect — so anything that opens a panel needs it again.
 *
 * Attach the returned ref to the popover's ROOT: the element wrapping both the
 * trigger and the panel. A pointerdown on the trigger is then "inside", which
 * is what lets a trigger toggle itself shut instead of the listener closing the
 * panel a moment before the click handler reopens it.
 */
export function useDismissOnOutside<T extends HTMLElement = HTMLDivElement>(
  open: boolean,
  onDismiss: () => void,
) {
  const ref = useRef<T>(null)

  // Held in a ref so an inline arrow from the caller doesn't re-bind the
  // document listeners on every render.
  const dismissRef = useRef(onDismiss)
  useEffect(() => {
    dismissRef.current = onDismiss
  })

  useEffect(() => {
    if (!open) return
    function onPointerDown(e: PointerEvent) {
      if (!ref.current?.contains(e.target as Node)) dismissRef.current()
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') dismissRef.current()
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return ref
}
