import { useEffect } from 'react'
import { RouterProvider } from '@tanstack/react-router'

import { detectAppVariant } from '@/lib/subdomain'
import EmployeeLogin from '@/pages/employee-login'
import StudentParentLogin from '@/pages/student-parent-login'
import SelectChild from '@/pages/parent/select-child'
import { employeeRouter } from '@/employee-router'
import { parentRouter } from '@/parent-router'
import { router } from '@/router'
import { useAuthStore } from '@/stores/auth-store'
import { useEmployeeAuthStore } from '@/stores/employee-auth-store'
import { useParentAuthStore } from '@/stores/parent-auth-store'

function App() {
  if (detectAppVariant() === 'employee') return <EmployeePortal />
  return <MemberPortal />
}

/** Employee portal: routed app once signed in, login flow otherwise. */
function EmployeePortal() {
  const authed = useEmployeeAuthStore((state) => state.authed)
  const signIn = useEmployeeAuthStore((state) => state.signIn)

  if (authed) return <RouterProvider router={employeeRouter} />
  return <EmployeeLogin onAuthenticated={signIn} />
}

/**
 * Member portal (app.* subdomain) — serves both students and parents from one
 * login. A student session takes precedence; a parent session falls through to
 * the Select-Child gate (until a child is picked) and then the parent portal.
 */
function MemberPortal() {
  const studentAuthed = useAuthStore((state) => state.authed)
  const studentSignIn = useAuthStore((state) => state.signIn)

  const parentAuthed = useParentAuthStore((state) => state.authed)
  const parentGuardian = useParentAuthStore((state) => state.guardian)
  const parentHydrating = useParentAuthStore((state) => state.hydrating)
  const parentSelected = useParentAuthStore((state) => state.selectedStudentId)
  const parentHydrate = useParentAuthStore((state) => state.hydrate)

  // Cold reload: tokens linger in localStorage (so `authed` is true) but the
  // guardian/children aren't in memory yet — refill them from /guardian/auth/me.
  useEffect(() => {
    if (parentAuthed && !studentAuthed && !parentGuardian && !parentHydrating) {
      void parentHydrate()
    }
  }, [parentAuthed, studentAuthed, parentGuardian, parentHydrating, parentHydrate])

  if (studentAuthed) return <RouterProvider router={router} />

  if (parentAuthed) {
    if (!parentGuardian) return <PortalBootSplash />
    if (parentSelected == null) return <SelectChild />
    return <RouterProvider router={parentRouter} />
  }

  return <StudentParentLogin onAuthenticated={studentSignIn} />
}

/** Brief full-screen splash while a persisted parent session re-hydrates. */
function PortalBootSplash() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-background">
      <div className="size-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
    </div>
  )
}

export default App
