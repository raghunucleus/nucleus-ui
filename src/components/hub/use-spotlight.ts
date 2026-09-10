import { useCallback, useEffect, useRef, type PointerEvent } from 'react'

import { usePrefersReducedMotion } from '@/components/brand'

/**
 * Tracks the pointer inside an element as `--mx` / `--my` percentages, which the
 * `hub-spotlight` utility reads to place its radial wash.
 *
 * Writes are coalesced into one rAF so a fast mouse can't queue more style
 * updates than the compositor will draw, and the rect is read inside that frame
 * (not on every event) to keep layout reads off the hot path.
 *
 * Mouse only. On touch there is no hover, and a "move" from a finger would just
 * leave the wash stranded wherever it lifted. Under reduced motion no handler is
 * returned at all, so React never attaches the listener.
 */
export function useSpotlight<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const frame = useRef(0)
  const reducedMotion = usePrefersReducedMotion()

  const onPointerMove = useCallback((event: PointerEvent<T>) => {
    if (event.pointerType !== 'mouse') return
    const element = ref.current
    if (!element) return

    const { clientX, clientY } = event
    cancelAnimationFrame(frame.current)
    frame.current = requestAnimationFrame(() => {
      const rect = element.getBoundingClientRect()
      if (!rect.width || !rect.height) return
      element.style.setProperty('--mx', `${((clientX - rect.left) / rect.width) * 100}%`)
      element.style.setProperty('--my', `${((clientY - rect.top) / rect.height) * 100}%`)
    })
  }, [])

  useEffect(() => () => cancelAnimationFrame(frame.current), [])

  return { ref, onPointerMove: reducedMotion ? undefined : onPointerMove }
}
