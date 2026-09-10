import { useEffect } from 'react'
import { lazyRouteComponent } from '@tanstack/react-router'

import StudentLogin from '@/pages/student-login'
import { useAuthStore } from '@/stores/auth-store'

// The routed app (router + layout + lazy pages) is its own chunk. Static import
// of the login page is deliberate: it is what a signed-out visitor sees first,
// and nesting it behind a second `import()` would add a serial round trip.
const StudentApp = lazyRouteComponent(() => import('./student-app'))

/** Student portal (student.* subdomain): routed app once signed in, login otherwise. */
export default function StudentPortal() {
  const authed = useAuthStore((state) => state.authed)
  const signIn = useAuthStore((state) => state.signIn)

  // Warm the app chunk while the sign-in form is on screen. `preload()` resolves
  // the lazy component synchronously afterwards, so the post-login swap shows
  // no loader when the fetch has already landed.
  useEffect(() => {
    void StudentApp.preload?.()
  }, [])

  if (authed) return <StudentApp />
  return <StudentLogin onAuthenticated={signIn} />
}
