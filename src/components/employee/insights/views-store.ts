import { useSyncExternalStore } from 'react'

import {
  createView,
  deleteView,
  listViews,
  updateView,
  type SavedView,
} from '@/lib/insights-views'

/**
 * One in-memory copy of the employee's saved views, shared by the Views menu
 * in every header and the pinned strip on the Overview, so a pin toggled in
 * the menu appears on the strip without a second fetch. Loaded once per
 * session on first use; every mutation updates it in place.
 */
type State = { views: SavedView[] | null; error: string | null }

let state: State = { views: null, error: null }
let inflight: Promise<void> | null = null
const listeners = new Set<() => void>()

function emit(next: State) {
  state = next
  for (const l of listeners) l()
}

export function refreshViews(): Promise<void> {
  if (inflight) return inflight
  inflight = listViews()
    .then((views) => emit({ views, error: null }))
    .catch((e: unknown) =>
      emit({
        views: state.views,
        error: e instanceof Error ? e.message : 'Could not load saved views.',
      }),
    )
    .finally(() => {
      inflight = null
    })
  return inflight
}

export function useSavedViews(): State {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      if (state.views === null && !inflight) void refreshViews()
      return () => listeners.delete(l)
    },
    () => state,
  )
}

export async function saveView(body: {
  screen_key: string
  route: string
  name: string
  search: string
  is_pinned?: boolean
}): Promise<SavedView> {
  const created = await createView(body)
  emit({ views: [...(state.views ?? []), created], error: null })
  return created
}

export async function patchView(
  id: number,
  body: Partial<Pick<SavedView, 'name' | 'search' | 'is_pinned' | 'sort_order'>>,
): Promise<SavedView> {
  const updated = await updateView(id, body)
  emit({
    views: (state.views ?? []).map((v) => (v.id === id ? updated : v)),
    error: null,
  })
  return updated
}

export async function removeView(id: number): Promise<void> {
  await deleteView(id)
  emit({ views: (state.views ?? []).filter((v) => v.id !== id), error: null })
}
