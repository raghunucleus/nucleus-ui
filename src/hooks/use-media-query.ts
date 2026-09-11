import { useCallback, useSyncExternalStore } from 'react'

const canQuery = () =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'

/**
 * A live CSS media query, e.g. `useMediaQuery('(min-width: 1024px)')` for
 * Tailwind's `lg`. Use it only where the two widths need DIFFERENT markup
 * (a side panel vs. a bottom sheet) — plain responsive classes are cheaper
 * whenever the same markup can simply reflow.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!canQuery()) return () => {}
      const mql = window.matchMedia(query)
      mql.addEventListener('change', onChange)
      return () => mql.removeEventListener('change', onChange)
    },
    [query],
  )
  const getSnapshot = useCallback(
    () => canQuery() && window.matchMedia(query).matches,
    [query],
  )
  return useSyncExternalStore(subscribe, getSnapshot, () => false)
}
