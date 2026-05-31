import { create } from 'zustand'

import {
  clearEmployeeTokens,
  hasStoredEmployeeSession,
  setEmployeeSessionExpiredHandler,
} from '@/lib/employee-auth'

interface EmployeeAuthState {
  /** Whether the employee is signed into the portal. */
  authed: boolean
  /** Mark the session authenticated after a successful login. */
  signIn: () => void
  /** Clear local tokens and drop back to the login flow. */
  signOut: () => void
}

/**
 * Optimistic initial state — a password-reset link must reach the login flow
 * even if stale tokens linger, so `?reset-token=...` forces a signed-out start.
 */
function initialAuthed(): boolean {
  return (
    hasStoredEmployeeSession() &&
    !new URLSearchParams(window.location.search).has('reset-token')
  )
}

/**
 * Auth state for the employee portal. Server data is never mirrored here —
 * this only tracks the boolean "is there a usable session".
 */
export const useEmployeeAuthStore = create<EmployeeAuthState>((set) => ({
  authed: initialAuthed(),
  signIn: () => set({ authed: true }),
  signOut: () => {
    clearEmployeeTokens()
    set({ authed: false })
  },
}))

// Auto-logout: when an authenticated request finds the session unrecoverable
// (access token expired and refresh failed), drop `authed` so App.tsx falls
// back to the employee login screen. Tokens are already cleared by the time
// this fires; we only flip the gate. Registered once at module load.
setEmployeeSessionExpiredHandler(() => {
  useEmployeeAuthStore.setState({ authed: false })
})
