import { useEffect, useLayoutEffect } from 'react'
import { lazyRouteComponent } from '@tanstack/react-router'

import { NucleusLoader } from '@/components/brand'
// i18n (en/hi/te) is a parent-only feature. Importing it here — and nowhere
// upstream (main.tsx / App.tsx) — keeps i18next and the locale tables out of
// the student, employee and hub chunks. The module initialises on import.
import i18n, { getStoredParentLang } from '@/lib/i18n'
import ParentLogin from '@/pages/parent-login'
import SelectChild from '@/pages/parent/select-child'
import { useParentAuthStore } from '@/stores/parent-auth-store'

// The routed app (router + layout + lazy pages) is its own chunk. The login and
// Select-Child screens are static: they are the pre-app screens, and nesting
// them behind a second `import()` would add a serial round trip.
const ParentApp = lazyRouteComponent(() => import('./parent-app'))

/**
 * Parent/guardian portal (parent.* subdomain). After login a guardian picks one
 * of their linked children at the Select-Child gate (skipped when only one is
 * linked) and then sees the parent router. The saved language is applied across
 * the whole portal here.
 */
export default function ParentPortal() {
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

  // Warm the app chunk from the first screen on, whatever it is — login,
  // hydration splash or Select-Child — so the hop into the router is instant.
  useEffect(() => {
    void ParentApp.preload?.()
  }, [])

  // Cold reload: tokens linger in localStorage (so `authed` is true) but the
  // guardian/children aren't in memory yet — refill them from /guardian/auth/me.
  useEffect(() => {
    if (authed && !guardian && !hydrating) void hydrate()
  }, [authed, guardian, hydrating, hydrate])

  if (!authed) return <ParentLogin />
  if (!guardian) return <PortalBootSplash />
  if (selected == null) return <SelectChild />
  return <ParentApp />
}

/** Brief full-screen splash while a persisted parent session re-hydrates. */
function PortalBootSplash() {
  return <NucleusLoader fullScreen size={64} />
}
