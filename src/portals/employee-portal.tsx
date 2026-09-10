import { useEffect } from 'react'
import { lazyRouteComponent } from '@tanstack/react-router'

import EmployeeLogin from '@/pages/employee-login'
import { useEmployeeAuthStore } from '@/stores/employee-auth-store'

// The routed app (router + layout + lazy pages) is its own chunk. Static import
// of the login page is deliberate: it is what a signed-out visitor sees first,
// and nesting it behind a second `import()` would add a serial round trip.
const EmployeeApp = lazyRouteComponent(() => import('./employee-app'))

/** Employee portal (employee.* subdomain): routed app once signed in, login otherwise. */
export default function EmployeePortal() {
  const authed = useEmployeeAuthStore((state) => state.authed)
  const signIn = useEmployeeAuthStore((state) => state.signIn)

  // Warm the app chunk while the sign-in form is on screen. `preload()` resolves
  // the lazy component synchronously afterwards, so the post-login swap shows
  // no loader when the fetch has already landed.
  useEffect(() => {
    void EmployeeApp.preload?.()
  }, [])

  if (authed) return <EmployeeApp />
  return <EmployeeLogin onAuthenticated={signIn} />
}
