import { createContext, useContext } from 'react'

import type {
  AttributeAccess,
  EffectiveAccess,
} from '@/lib/employee-access'

export const EmployeeAccessContext = createContext<EffectiveAccess | null>(null)

/**
 * Read the current employee's effective access payload. Returns `null` until
 * the portal has finished fetching it on mount.
 */
export function useEmployeeAccess(): EffectiveAccess | null {
  return useContext(EmployeeAccessContext)
}

/**
 * Look up the access for a specific screen. Returns `null` when the employee
 * does not have access (i.e. the screen is not in their effective screens) —
 * the caller renders a no-access empty state in that case.
 *
 * `attributes` is keyed by attribute name; each entry is `AttributeAccess`,
 * which is a discriminated union: `{ all: true }` means wildcard (caller
 * skips filtering), otherwise `{ all: false, values }` gives the explicit
 * scope. Use the `scopeIds(...)` helper to collapse to a simple
 * `number[] | 'all'` for the common case.
 */
export function useScreenAccess(screenKey: string): {
  actions: string[]
  attributes: Record<string, AttributeAccess>
} | null {
  const access = useEmployeeAccess()
  if (!access) return null
  const slot = access.screens[screenKey]
  if (!slot) return null
  return { actions: slot.actions, attributes: slot.attributes }
}

/**
 * Sentinel returned by `scopeIds` when the attribute is wildcarded. The
 * calling screen should NOT filter — render everything.
 */
export const SCOPE_ALL = 'all' as const
export type ScopeIds = number[] | typeof SCOPE_ALL

/**
 * Read a numeric-id scope from an `AttributeAccess` map. Returns:
 *   - `'all'` when the attribute is wildcarded (no filter — render everything)
 *   - `number[]` of ids otherwise (possibly empty — `[]` means "no scope set",
 *     render the no-scope empty state)
 */
export function scopeIds(
  attributes: Record<string, AttributeAccess> | undefined,
  attributeKey: string,
): ScopeIds {
  const slot = attributes?.[attributeKey]
  if (!slot) return []
  if (slot.all) return SCOPE_ALL
  return slot.values
    .map((v) => (typeof v === 'number' ? v : Number(v)))
    .filter((v) => Number.isFinite(v))
}
