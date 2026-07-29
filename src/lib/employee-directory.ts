import * as React from 'react'

import { apiFetch } from './api'
import { withEmployeeAuth } from './employee-auth'

/**
 * The staff directory typeahead behind every employee-portal people picker.
 *
 * The endpoint is authenticated but not screen-gated, so one client serves
 * callers sitting behind different screens (the company form, the approvals
 * screen). The directory is never loaded wholesale — the server caps a page at
 * 50 and this re-queries as you type.
 */
export interface DirectoryEmployee {
  id: number
  emp_code: string
  emp_display_name: string
  designation: string | null
  department: string | null
}

const ROOT = '/employee/directory/employees'
export const DIRECTORY_PAGE_SIZE = 20
const DEBOUNCE_MS = 250

export function searchEmployees(
  q: string | undefined,
  limit = DIRECTORY_PAGE_SIZE,
): Promise<DirectoryEmployee[]> {
  const sp = new URLSearchParams({ limit: String(limit) })
  if (q) sp.set('q', q)
  return withEmployeeAuth((token) => apiFetch(`${ROOT}?${sp}`, { token }))
}

/** Resolve specific ids — includes deactivated employees, unlike the search. */
export function resolveEmployees(ids: number[]): Promise<DirectoryEmployee[]> {
  if (ids.length === 0) return Promise.resolve([])
  const sp = new URLSearchParams({ ids: ids.join(',') })
  return withEmployeeAuth((token) => apiFetch(`${ROOT}?${sp}`, { token }))
}

/** Debounced server-side search. Pass your own query state. */
export function useEmployeeSearch(query: string): {
  rows: DirectoryEmployee[]
  loading: boolean
} {
  const [debounced, setDebounced] = React.useState('')

  React.useEffect(() => {
    const t = window.setTimeout(() => setDebounced(query.trim()), DEBOUNCE_MS)
    return () => window.clearTimeout(t)
  }, [query])

  // Results carry the key they were fetched for, so "a fetch is in flight" is
  // derived rather than tracked in a second state variable.
  const [result, setResult] = React.useState<{
    key: string
    rows: DirectoryEmployee[]
  } | null>(null)

  // Monotonic request id: a response that lands out of order is dropped rather
  // than overwriting a newer result with a stale one.
  const seqRef = React.useRef(0)

  React.useEffect(() => {
    const seq = ++seqRef.current
    searchEmployees(debounced || undefined)
      .then((rows) => {
        if (seq === seqRef.current) setResult({ key: debounced, rows })
      })
      .catch(() => {
        if (seq === seqRef.current) setResult({ key: debounced, rows: [] })
      })
  }, [debounced])

  return { rows: result?.rows ?? [], loading: result?.key !== debounced }
}

/**
 * Resolve ids to rows so a saved selection renders a name without loading the
 * directory. One batched fetch per new set of ids, cached for the component's
 * lifetime.
 */
export function useEmployeeNames(ids: number[]): Map<number, DirectoryEmployee> {
  const [known, setKnown] = React.useState<Map<number, DirectoryEmployee>>(
    () => new Map(),
  )
  const requestedRef = React.useRef<Set<number>>(new Set())

  // Depend on the contents, not the array identity, so an inline literal
  // doesn't re-run this on every render.
  const idsKey = ids.join(',')

  React.useEffect(() => {
    const wanted = idsKey ? idsKey.split(',').map(Number) : []
    const missing = wanted.filter((id) => !requestedRef.current.has(id))
    if (missing.length === 0) return
    for (const id of missing) requestedRef.current.add(id)
    void resolveEmployees(missing)
      .then((rows) =>
        setKnown((prev) => {
          const next = new Map(prev)
          for (const e of rows) next.set(e.id, e)
          return next
        }),
      )
      .catch(() => {
        /* unresolved ids fall back to whatever the caller renders */
      })
  }, [idsKey])

  return known
}
