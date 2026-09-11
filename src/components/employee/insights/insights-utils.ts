import { useSearch } from '@tanstack/react-router'
import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  errMsg,
  readStored,
  writeStored,
} from '@/components/employee/attendance-analytics/format'
import { currentScopeSearch, replaceSearch } from './scope-url'

/**
 * Hooks, formatters and pure helpers shared by the insights pages. Kept apart
 * from `bits.tsx` because a file exporting both components and plain values
 * breaks Fast Refresh — the same split as `chart-chrome.ts` / `format.ts`.
 */

// --- data -------------------------------------------------------------------

export interface AsyncState<T> {
  data: T | null
  loading: boolean
  error: string | null
}

/**
 * Fetch-on-key-change, same contract as the attendance analytics hook: `loading`
 * is "the key on screen isn't the key we have data for", so a superseded
 * response never renders and nothing writes state during the effect.
 */
export function useInsightsQuery<T>(
  key: string,
  run: () => Promise<T>,
  fallback: string,
  enabled = true,
): AsyncState<T> {
  const [state, setState] = useState<{
    key: string
    data: T | null
    error: string | null
  }>({ key: '', data: null, error: null })

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    run()
      .then((data) => {
        if (!cancelled) setState({ key, data, error: null })
      })
      .catch((e: unknown) => {
        if (!cancelled) setState({ key, data: null, error: errMsg(e, fallback) })
      })
    return () => {
      cancelled = true
    }
    // `run` is a fresh closure every render; only the key decides a refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, fallback, enabled])

  if (!enabled) return { data: null, loading: false, error: null }
  return {
    data: state.key === key ? state.data : null,
    error: state.key === key ? state.error : null,
    loading: state.key !== key,
  }
}

/**
 * Tab state that honours `?tab=` on arrival, remembers the last choice, and
 * writes every change back into the address so tab + scope travel together
 * in a copied link.
 */
export function useInsightsTab(
  storageKey: string,
  fallback: string,
  valid: readonly string[],
): [string, (t: string) => void] {
  const fromUrl = useSearch({ strict: false }).tab as string | undefined
  const [tab, setTabState] = useState(() => {
    const stored = readStored(storageKey)
    const pick = fromUrl && valid.includes(fromUrl) ? fromUrl : stored
    return pick && valid.includes(pick) ? pick : fallback
  })
  const setTab = (t: string) => {
    setTabState(t)
    writeStored(storageKey, t)
    replaceSearch({ tab: t })
  }
  return [tab, setTab]
}

/**
 * A piece of page state mirrored in the address — the screen's own filters
 * (semester, dates, group-by…), so a saved view or a copied link reproduces
 * them. Initialises from the current search, writes through `replaceSearch`
 * on change; the URL is the source of truth for the first render only.
 * `parse` / `serialise` must be stable (module-level) functions.
 */
export function useUrlState<T>(
  key: string,
  fallback: T,
  parse: (raw: string) => T | undefined,
  serialise: (value: T) => string | undefined,
): [T, (next: T) => void] {
  const [value, setValue] = useState<T>(() => {
    const raw = new URLSearchParams(window.location.search).get(key)
    if (raw === null) return fallback
    const parsed = parse(raw)
    return parsed === undefined ? fallback : parsed
  })
  const set = useCallback(
    (next: T) => {
      setValue(next)
      replaceSearch({ [key]: serialise(next) })
    },
    [key, serialise],
  )
  return [value, set]
}

/** Parsers / serialisers for `useUrlState` — shared so they stay stable. */
export const url = {
  semester: (raw: string): number | null | undefined => {
    const n = Number(raw)
    return Number.isInteger(n) && n >= 1 && n <= 8 ? n : undefined
  },
  semesterOut: (v: number | null) => (v ? String(v) : undefined),
  date: (raw: string) => (/^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : undefined),
  dateOut: (v: string) => v || undefined,
  idList: (raw: string): number[] | undefined =>
    /^[1-9]\d*(,[1-9]\d*)*$/.test(raw) ? raw.split(',').map(Number) : undefined,
  idListOut: (v: number[]) => (v.length ? v.join(',') : undefined),
  word:
    <T extends string>(allowed: readonly T[]) =>
    (raw: string): T | undefined =>
      (allowed as readonly string[]).includes(raw) ? (raw as T) : undefined,
  wordOut: (v: string) => v || undefined,
  int: (min: number, max: number) => (raw: string) => {
    const n = Number(raw)
    return Number.isInteger(n) && n >= min && n <= max ? n : undefined
  },
  intOut: (v: number) => String(v),
}

/** Fixed categorical order for multi-series charts — never cycled. */
export const SERIES = [
  'var(--color-icon-cyan)',
  'var(--color-icon-violet)',
  'var(--color-icon-amber)',
  'var(--color-icon-emerald)',
  'var(--color-icon-rose)',
  'var(--color-icon-blue)',
]

/**
 * Client-side navigation between insights screens — the pattern the home page
 * uses. By default the current scope query rides along so the destination
 * shows the same departments / batches even in a browser with empty storage;
 * `merge: false` navigates to exactly the given search (saved views).
 */
export function go(
  path: string,
  search?: Record<string, string | undefined>,
  opts: { merge?: boolean } = {},
) {
  const p = new URLSearchParams()
  const base = opts.merge === false ? {} : currentScopeSearch()
  for (const [k, v] of Object.entries({ ...base, ...search })) {
    if (v) p.set(k, v)
  }
  const qs = p.toString()
  window.history.pushState({}, '', qs ? `${path}?${qs}` : path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

// --- formatters -------------------------------------------------------------

export const nf = (n: number) => n.toLocaleString('en-IN')
export const fmt1 = (n: number | null | undefined) =>
  n === null || n === undefined ? '—' : n.toFixed(1)
export const fmt2 = (n: number | null | undefined) =>
  n === null || n === undefined ? '—' : n.toFixed(2)
export const fmtPct = (n: number | null | undefined) =>
  n === null || n === undefined ? '—' : `${n.toFixed(1)}%`
export const fmtLpa = (n: number | null | undefined) =>
  n === null || n === undefined ? '—' : `${n.toFixed(2)} LPA`
export const fmtHours = (h: number | null | undefined) => {
  if (h === null || h === undefined) return '—'
  if (h < 48) return `${h.toFixed(1)} h`
  return `${(h / 24).toFixed(1)} d`
}

// --- hierarchy ---------------------------------------------------------------

export interface TreeRow {
  key: string
  parent_key: string | null
  level: string
}

/**
 * Expand/collapse over a flat parent-keyed list. Expanded state is a set of
 * keys; `defaultDepth` opens everything down to that level on first paint.
 */
export function useTree<R extends TreeRow>(
  rows: R[] | undefined,
  levels: readonly string[],
  defaultDepth: number,
) {
  const [open, setOpen] = useState<Set<string> | null>(null)
  const opened = useMemo(() => {
    if (open) return open
    const s = new Set<string>()
    for (const r of rows ?? []) {
      if (levels.indexOf(r.level) < defaultDepth) s.add(r.key)
    }
    return s
  }, [open, rows, levels, defaultDepth])

  const visible = useMemo(() => {
    const byParent = new Map<string | null, R[]>()
    for (const r of rows ?? []) {
      const list = byParent.get(r.parent_key) ?? []
      list.push(r)
      byParent.set(r.parent_key, list)
    }
    const out: Array<R & { depth: number; has_children: boolean }> = []
    const walk = (parent: string | null, depth: number) => {
      for (const r of byParent.get(parent) ?? []) {
        const kids = byParent.get(r.key) ?? []
        out.push({ ...r, depth, has_children: kids.length > 0 })
        if (opened.has(r.key)) walk(r.key, depth + 1)
      }
    }
    walk(null, 0)
    return out
  }, [rows, opened])

  const toggle = (key: string) =>
    setOpen((prev) => {
      const next = new Set(prev ?? opened)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  return { visible, opened, toggle }
}

// --- group-by ----------------------------------------------------------------

export type GroupBy = 'department' | 'programme' | 'batch'

export const GROUP_BY_OPTIONS: Array<{ value: GroupBy; label: string }> = [
  { value: 'department', label: 'Department' },
  { value: 'programme', label: 'Programme' },
  { value: 'batch', label: 'Batch' },
]

export function groupKeyOf(
  by: GroupBy,
  b: { department_id: number; programme_id: number; pay_id: number },
): number {
  return by === 'department'
    ? b.department_id
    : by === 'programme'
      ? b.programme_id
      : b.pay_id
}

export function groupLabelOf(
  by: GroupBy,
  b: {
    department_code: string
    programme_code: string
    display_year: string
  },
): string {
  return by === 'department'
    ? b.department_code
    : by === 'programme'
      ? b.programme_code
      : `${b.programme_code} · ${b.display_year}`
}
