import { create } from 'zustand'

interface AppDrawerState {
  /** Whether the modules app drawer is open. */
  open: boolean
  /** Open or close the drawer — shared by the header trigger, the
   *  dashboard "View more" tile and the Ctrl/⌘+K shortcut. */
  setOpen: (open: boolean) => void
}

/**
 * Open state for the modules app drawer. It lives in a store because the
 * drawer can be opened from several places (header button, Ctrl/⌘+K, and the
 * dashboard's "View more" tile) while the drawer itself renders in the header.
 */
export const useAppDrawerStore = create<AppDrawerState>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}))
