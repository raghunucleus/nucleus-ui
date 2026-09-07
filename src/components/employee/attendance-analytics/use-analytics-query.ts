import { useEffect, useRef, useState } from 'react'

import { errMsg } from './format'

export interface AsyncState<T> {
  data: T | null
  loading: boolean
  error: string | null
}

/**
 * Fetch-on-input-change for the analytics tabs.
 *
 * Every tab was repeating the same `cancelled`-flag effect with three pieces of
 * state; this centralises it so the in-flight bookkeeping is written once.
 *
 * `loading` is derived rather than set in the effect body: a request that has
 * been started but not yet resolved is exactly "the key we last rendered isn't
 * the key we have data for". That keeps the stale result from a superseded
 * request off the screen without a synchronous setState during the effect,
 * which triggers a cascading render.
 *
 * `key` must change whenever the request should re-run — pass a string built
 * from the query parameters, not an object, so an identical range doesn't
 * refetch on every parent render.
 */
export function useAnalyticsQuery<T>(
  key: string,
  run: () => Promise<T>,
  fallbackMessage: string,
): AsyncState<T> {
  const [state, setState] = useState<{
    key: string
    data: T | null
    error: string | null
  }>({ key: '', data: null, error: null })

  // `run` is a fresh closure on every render; only `key` decides when to
  // refetch. Effects fire in declaration order on every commit, so this one has
  // already refreshed the ref by the time the fetch below reads it — which is
  // why the ref is not written during render.
  const runRef = useRef(run)
  useEffect(() => {
    runRef.current = run
  })

  useEffect(() => {
    let cancelled = false
    runRef
      .current()
      .then((data) => {
        if (!cancelled) setState({ key, data, error: null })
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setState({ key, data: null, error: errMsg(e, fallbackMessage) })
        }
      })
    return () => {
      cancelled = true
    }
  }, [key, fallbackMessage])

  return {
    data: state.key === key ? state.data : null,
    error: state.key === key ? state.error : null,
    loading: state.key !== key,
  }
}

/** Stable cache key for a (group, semester, range) request. */
export function rangeKey(
  range: { group_id: number; programme_semester_id: number; from?: string; to?: string },
  ...extra: Array<string | number | boolean | null | undefined>
): string {
  return [
    range.group_id,
    range.programme_semester_id,
    range.from ?? '',
    range.to ?? '',
    ...extra.map((x) => String(x ?? '')),
  ].join('|')
}
