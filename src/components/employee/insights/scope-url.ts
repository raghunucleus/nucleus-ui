import { EMPTY_SELECTION, type ScopeSelection } from '@/lib/insights'

/**
 * The scope lives in the URL as well as in localStorage, so a copied address
 * reproduces the view. These helpers are the one place that knows the query
 * keys; the hook, the tab hook and `go()` all route through them.
 */
export const SCOPE_KEYS = [
  'department_ids',
  'programme_ids',
  'programme_admission_year_ids',
  'attendance_group_ids',
] as const satisfies ReadonlyArray<keyof ScopeSelection>

/** `"1,2,3"` → `[1, 2, 3]`; anything malformed → `[]`. */
export function parseIdList(raw: string | null | undefined): number[] {
  if (!raw) return []
  const out: number[] = []
  for (const part of raw.split(',')) {
    const n = Number(part.trim())
    if (!Number.isInteger(n) || n <= 0) return []
    out.push(n)
  }
  return out
}

/** The scope carried by the current address, or null when it carries none. */
export function readScopeFromUrl(): ScopeSelection | null {
  const p = new URLSearchParams(window.location.search)
  if (!SCOPE_KEYS.some((k) => p.has(k))) return null
  const sel: ScopeSelection = { ...EMPTY_SELECTION }
  for (const k of SCOPE_KEYS) sel[k] = parseIdList(p.get(k))
  return sel
}

/** Scope keys of the current address as a plain record (for `go()`). */
export function currentScopeSearch(): Record<string, string | undefined> {
  const p = new URLSearchParams(window.location.search)
  const out: Record<string, string | undefined> = {}
  for (const k of SCOPE_KEYS) {
    const v = p.get(k)
    if (v) out[k] = v
  }
  return out
}

/**
 * Merge `patch` into the current query string without a navigation — an
 * empty value removes the key. Keeps every unrelated param (`tab`, …).
 */
export function replaceSearch(
  patch: Record<string, string | number | undefined | null>,
): void {
  const p = new URLSearchParams(window.location.search)
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined || v === null || v === '') p.delete(k)
    else p.set(k, String(v))
  }
  const qs = p.toString()
  const next = `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`
  if (next !== `${window.location.pathname}${window.location.search}${window.location.hash}`) {
    window.history.replaceState(window.history.state, '', next)
  }
}

export function scopeToSearchPatch(
  sel: ScopeSelection,
): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {}
  for (const k of SCOPE_KEYS) out[k] = sel[k].length ? sel[k].join(',') : undefined
  return out
}
