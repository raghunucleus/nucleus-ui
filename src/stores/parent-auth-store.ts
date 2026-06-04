import { create } from 'zustand'

import {
  clearSelectedStudentId,
  getSelectedStudentId,
  hasStoredParentSession,
  parentMe,
  setParentSessionExpiredHandler,
  setSelectedStudentId,
  storeParentTokens,
  type GuardianLoginResult,
  type GuardianSummary,
  type LinkedStudent,
} from '@/lib/parent-auth'

interface ParentAuthState {
  /** Whether a guardian is signed into the portal. */
  authed: boolean
  /** Guardian identity (name + mobile). Null until login/hydrate fills it. */
  guardian: GuardianSummary | null
  /** The guardian's linked children. */
  students: LinkedStudent[]
  /** The child currently being viewed. Null → show the Select-Child gate. */
  selectedStudentId: number | null
  /** True while `hydrate()` is refilling guardian/students after a reload. */
  hydrating: boolean

  /** Mark the session authenticated after a successful login. */
  signIn: (result: GuardianLoginResult) => void
  /** After a reload (authed but no guardian in memory) refill from the API. */
  hydrate: () => Promise<void>
  /** Pick a child to view; persisted so it survives reloads. */
  selectStudent: (studentId: number) => void
  /** Clear the selection → back to the Select-Child gate. */
  switchChild: () => void
  /** Clear local tokens + selection and drop back to the login flow. */
  signOut: () => void
}

/**
 * Optimistic initial state — a password-reset link must reach the login flow
 * even if stale tokens linger, so `?reset-token=...` forces a signed-out start.
 */
function initialAuthed(): boolean {
  return (
    hasStoredParentSession() &&
    !new URLSearchParams(window.location.search).has('reset-token')
  )
}

/**
 * Auth state for the parent/guardian portal. Tokens + the selected child id are
 * the only things persisted (in localStorage, via parent-auth.ts); guardian
 * identity and the children list are server data refilled by `hydrate()` on a
 * cold load.
 */
export const useParentAuthStore = create<ParentAuthState>((set, get) => ({
  authed: initialAuthed(),
  guardian: null,
  students: [],
  selectedStudentId: getSelectedStudentId(),
  hydrating: false,

  signIn: (result) => {
    storeParentTokens(result)
    // A single linked child needs no selection step — go straight in.
    const only = result.students.length === 1 ? result.students[0].id : null
    if (only != null) setSelectedStudentId(only)
    set({
      authed: true,
      guardian: result.guardian,
      students: result.students,
      selectedStudentId: only ?? get().selectedStudentId,
      hydrating: false,
    })
  },

  hydrate: async () => {
    if (get().hydrating) return
    set({ hydrating: true })
    try {
      const me = await parentMe()
      // Reconcile any persisted selection against the fresh children list — a
      // child that was unlinked (or a stale id) shouldn't keep us out of the
      // Select-Child gate. Auto-select when exactly one child remains.
      const persisted = getSelectedStudentId()
      let selected =
        persisted != null && me.students.some((s) => s.id === persisted)
          ? persisted
          : null
      if (selected == null && me.students.length === 1) {
        selected = me.students[0].id
      }
      if (selected != null) setSelectedStudentId(selected)
      else clearSelectedStudentId()
      set({
        guardian: { mobile_number: me.mobile_number, display_name: me.display_name },
        students: me.students,
        selectedStudentId: selected,
        hydrating: false,
      })
    } catch {
      // parentMe() already cleared tokens + fired the expired handler on an
      // unrecoverable 401 (which flips `authed` to false). Just stop spinning.
      set({ hydrating: false })
    }
  },

  selectStudent: (studentId) => {
    setSelectedStudentId(studentId)
    set({ selectedStudentId: studentId })
  },

  switchChild: () => {
    clearSelectedStudentId()
    set({ selectedStudentId: null })
  },

  signOut: () => {
    clearSelectedStudentId()
    set({
      authed: false,
      guardian: null,
      students: [],
      selectedStudentId: null,
      hydrating: false,
    })
  },
}))

// Auto-logout: when an authenticated guardian request finds the session
// unrecoverable, drop `authed` so App.tsx falls back to the login screen.
// Tokens are already cleared by the time this fires; we only flip the gate.
setParentSessionExpiredHandler(() => {
  useParentAuthStore.setState({
    authed: false,
    guardian: null,
    students: [],
    selectedStudentId: null,
    hydrating: false,
  })
})
