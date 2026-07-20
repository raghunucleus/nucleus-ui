import * as React from 'react'

/**
 * Per-student fetch cache for a hover card (see {@link HoverDetail}).
 *
 * The requested-id set lives in a ref and a failed load writes a `null`
 * sentinel, so a row that errors shows "couldn't load" instead of refetching on
 * every re-render — the same guard `ensureFkOptions` uses for lookup options.
 * `undefined` means "not fetched yet or in flight".
 */
export function useHoverCache<T>(load: (id: number) => Promise<T>) {
  const [byId, setById] = React.useState<Record<number, T | null>>({})
  const requested = React.useRef(new Set<number>())

  const ensure = React.useCallback(
    (id: number) => {
      if (requested.current.has(id)) return
      requested.current.add(id)
      load(id).then(
        (data) => setById((prev) => ({ ...prev, [id]: data })),
        () => setById((prev) => ({ ...prev, [id]: null })),
      )
    },
    [load],
  )

  return { byId, ensure }
}
