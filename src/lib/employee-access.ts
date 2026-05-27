import { apiFetch } from './api'
import { withEmployeeAuth } from './employee-auth'

/**
 * Per-attribute scope on a given screen. Either wildcard ("all") — caller
 * should skip filtering — or a specific (possibly empty) set of values.
 *
 *   { all: true }                      → wildcard, no filter
 *   { all: false, values: [1, 2] }     → restricted to these ids
 *   { all: false, values: [] }         → no scope (no access for required slots)
 */
export type AttributeAccess =
  | { all: true }
  | { all: false; values: unknown[] }

/**
 * The effective-access payload returned by `GET /employee/me/access`. Drives
 * the dynamic menu and per-screen rendering for the logged-in employee.
 */
export interface EffectiveAccess {
  employee_id: number
  modules: Record<
    string,
    {
      key: string
      label: string
      icon: string
      order: number
      screen_keys: string[]
    }
  >
  screens: Record<
    string,
    {
      key: string
      module_key: string
      label: string
      platforms: string[]
      web_route?: string
      mobile_route?: string
      actions: string[]
      attributes: Record<string, AttributeAccess>
    }
  >
}

export async function fetchEmployeeAccess(): Promise<EffectiveAccess> {
  return withEmployeeAuth((token) =>
    apiFetch<EffectiveAccess>('/employee/me/access', { token }),
  )
}
