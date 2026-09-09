import { useState } from 'react'
import { Info } from 'lucide-react'

// Mirrors the keys in lib/student-auth.ts. Imported by value there, restated
// here because this component's job is to clean up after a session that origin
// no longer owns — it must not pull the student auth module into the hub bundle.
const LEGACY_STUDENT_KEYS = ['nucleus.student.accessToken', 'nucleus.student.refreshToken']

function readLegacySession(): boolean {
  try {
    const found = LEGACY_STUDENT_KEYS.some((key) => localStorage.getItem(key) !== null)
    // Clear on read: the tokens belong to this origin's localStorage and are
    // unreachable from student.*, so they can never be used again. Leaving them
    // would only make the notice reappear on every visit.
    if (found) LEGACY_STUDENT_KEYS.forEach((key) => localStorage.removeItem(key))
    return found
  } catch {
    // Private mode / storage blocked — nothing to migrate and nothing to say.
    return false
  }
}

/**
 * Shown once to anyone who was signed in back when `app.*` WAS the student
 * portal. Their session lives in this origin's localStorage, which the browser
 * will not share with `student.*` — so it cannot be migrated and they have to
 * sign in again. Saying so is kinder than silently showing a chooser to someone
 * who expected to already be logged in.
 */
export function LegacySessionNotice() {
  const [show] = useState(readLegacySession)
  if (!show) return null

  return (
    <p
      role="status"
      className="mx-auto flex max-w-2xl items-start gap-3 rounded-xl border border-hub-line bg-hub-bg-soft/60 px-4 py-3 text-sm text-hub-ink-dim"
    >
      <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-hub-role-member" />
      <span>
        You were signed in here before. Student sign-in has moved to its own address —
        pick <span className="text-hub-ink">Student portal</span> below and sign in once more.
      </span>
    </p>
  )
}
