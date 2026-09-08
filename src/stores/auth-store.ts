import { create } from 'zustand'

import { clearTokens, hasStoredSession } from '@/lib/student-auth'

interface AuthState {
  /** Whether the student/parent is signed into the portal. */
  authed: boolean
  /** Mark the session authenticated after a successful login. */
  signIn: () => void
  /** Clear local tokens and drop back to the login flow. */
  signOut: () => void
}

/**
 * Optimistic initial state. An emailed password link must reach the login flow
 * even if stale tokens linger, so both `?reset-token=...` (password reset) and
 * `?invite-token=...` (account invitation) force a signed-out start.
 */
function initialAuthed(): boolean {
  const params = new URLSearchParams(window.location.search)
  return (
    hasStoredSession() &&
    !params.has('reset-token') &&
    !params.has('invite-token')
  )
}

/**
 * Auth state for the student/parent portal. Server data is never mirrored
 * here — this only tracks the boolean "is there a usable session".
 */
export const useAuthStore = create<AuthState>((set) => ({
  authed: initialAuthed(),
  signIn: () => set({ authed: true }),
  signOut: () => {
    clearTokens()
    set({ authed: false })
  },
}))
