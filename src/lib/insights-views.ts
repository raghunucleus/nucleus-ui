import { apiFetch } from './api'
import { withEmployeeAuth } from './employee-auth'

/**
 * Personal saved views for the Insights screens (`/employee/insights/views`).
 * A view is a screen + the query string that reproduces it (tab, scope
 * narrowing, the screen's own filters). Server-side, per employee, so it
 * follows the person across devices.
 */

export interface SavedView {
  id: number
  screen_key: string
  route: string
  name: string
  /** Query string without the leading `?`. */
  search: string
  is_pinned: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

const ROOT = '/employee/insights/views'

export function listViews(): Promise<SavedView[]> {
  return withEmployeeAuth((token) => apiFetch<SavedView[]>(ROOT, { token }))
}

export function createView(body: {
  screen_key: string
  route: string
  name: string
  search: string
  is_pinned?: boolean
}): Promise<SavedView> {
  return withEmployeeAuth((token) =>
    apiFetch<SavedView>(ROOT, { method: 'POST', body, token }),
  )
}

export function updateView(
  id: number,
  body: Partial<Pick<SavedView, 'name' | 'search' | 'is_pinned' | 'sort_order'>>,
): Promise<SavedView> {
  return withEmployeeAuth((token) =>
    apiFetch<SavedView>(`${ROOT}/${id}`, { method: 'PATCH', body, token }),
  )
}

export function deleteView(id: number): Promise<void> {
  return withEmployeeAuth((token) =>
    apiFetch<void>(`${ROOT}/${id}`, { method: 'DELETE', token }),
  )
}

/** `"a=1&b=2"` → `{ a: '1', b: '2' }` for `go()`. */
export function searchToRecord(search: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of new URLSearchParams(search)) if (v) out[k] = v
  return out
}
