import { create } from 'zustand'

interface LoaderState {
  /** Active blocking-request count — supports overlapping show()/hide() calls. */
  count: number
  /** Whether the global overlay should be visible. */
  visible: boolean
  /** Optional label shown under the spinner. */
  message: string | null

  /** Show the global loader (or bump the count if already shown). */
  show: (message?: string) => void
  /** Hide one show() — the overlay stays up until every show() is matched. */
  hide: () => void
  /** Force-clear the loader, e.g. on a hard navigation reset. */
  reset: () => void
}

/**
 * App-wide blocking loader state. Reference-counted: the overlay stays visible
 * while at least one `show()` is outstanding, so concurrent requests each
 * managing their own show()/hide() pair never hide it out from under another.
 *
 * Usually you don't touch this directly — prefer `withGlobalLoader`.
 */
export const useLoaderStore = create<LoaderState>((set) => ({
  count: 0,
  visible: false,
  message: null,

  show: (message) =>
    set((state) => ({
      count: state.count + 1,
      visible: true,
      message: message ?? state.message,
    })),

  hide: () =>
    set((state) => {
      const count = Math.max(0, state.count - 1)
      return {
        count,
        visible: count > 0,
        message: count > 0 ? state.message : null,
      }
    }),

  reset: () => set({ count: 0, visible: false, message: null }),
}))

/**
 * Runs an async task with the global blocking loader shown for its duration.
 * Reference-counted, so concurrent calls are safe and the loader clears even
 * if the task throws.
 *
 *   await withGlobalLoader(() => studentMe(), 'Loading your dashboard…')
 */
export async function withGlobalLoader<T>(
  task: () => Promise<T>,
  message?: string,
): Promise<T> {
  const { show, hide } = useLoaderStore.getState()
  show(message)
  try {
    return await task()
  } finally {
    hide()
  }
}
