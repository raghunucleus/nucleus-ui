import { useEffect, useLayoutEffect } from 'react'
import { RouterProvider } from '@tanstack/react-router'

import { NucleusLoader } from '@/components/brand'
import i18n, { getStoredParentLang } from '@/lib/i18n'
import { detectAppVariant } from '@/lib/subdomain'
import EmployeeLogin from '@/pages/employee-login'
import ParentLogin from '@/pages/parent-login'
import StudentLogin from '@/pages/student-login'
import SelectChild from '@/pages/parent/select-child'
import { employeeRouter } from '@/employee-router'
import { parentRouter } from '@/parent-router'
import { router } from '@/router'
import { useAuthStore } from '@/stores/auth-store'
import { useEmployeeAuthStore } from '@/stores/employee-auth-store'
import { useParentAuthStore } from '@/stores/parent-auth-store'

/**
 * One subdomain → one audience → one portal, each with its own auth store and
 * localStorage namespace (see lib/subdomain.ts): `employee.*` → employee,
 * `parent.*` → parent/guardian, `app.*` → student. The three sessions never
 * overlap, so there is no cross-audience precedence to juggle here.
 */
function App() {
  switch (detectAppVariant()) {
    case 'employee':
      return <EmployeePortal />
    case 'parent':
      return <ParentPortal />
    default:
      return <StudentPortal />
  }
}

/** Employee portal: routed app once signed in, login flow otherwise. */
function EmployeePortal() {
  const authed = useEmployeeAuthStore((state) => state.authed)
  const signIn = useEmployeeAuthStore((state) => state.signIn)

  if (authed) return <RouterProvider router={employeeRouter} />
  return <EmployeeLogin onAuthenticated={signIn} />
}

/**
 * Parent/guardian portal (parent.* subdomain). After login a guardian picks one
 * of their linked children at the Select-Child gate (skipped when only one is
 * linked) and then sees the parent router. i18n (en/hi/te) is a parent-only
 * feature, so the saved language is applied across the whole portal here.
 */
function ParentPortal() {
  const authed = useParentAuthStore((state) => state.authed)
  const guardian = useParentAuthStore((state) => state.guardian)
  const hydrating = useParentAuthStore((state) => state.hydrating)
  const selected = useParentAuthStore((state) => state.selectedStudentId)
  const hydrate = useParentAuthStore((state) => state.hydrate)

  // Apply the parent's saved language before first paint (no English flash).
  // The in-portal switcher updates it live afterwards.
  useLayoutEffect(() => {
    void i18n.changeLanguage(getStoredParentLang())
  }, [])

  // Cold reload: tokens linger in localStorage (so `authed` is true) but the
  // guardian/children aren't in memory yet — refill them from /guardian/auth/me.
  useEffect(() => {
    if (authed && !guardian && !hydrating) void hydrate()
  }, [authed, guardian, hydrating, hydrate])

  if (!authed) return <ParentLogin />
  if (!guardian) return <PortalBootSplash />
  if (selected == null) return <SelectChild />
  return <RouterProvider router={parentRouter} />
}

/** Student portal (app.* subdomain): routed app once signed in, login otherwise. */
function StudentPortal() {
  const authed = useAuthStore((state) => state.authed)
  const signIn = useAuthStore((state) => state.signIn)

  if (authed) return <RouterProvider router={router} />
  return <StudentLogin onAuthenticated={signIn} />
}

/** Brief full-screen splash while a persisted parent session re-hydrates. */
function PortalBootSplash() {
  return <NucleusLoader fullScreen size={64} />
}

export default App
