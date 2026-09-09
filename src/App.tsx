import { Suspense } from 'react'

import { NucleusLoader } from '@/components/brand'
import { Portal } from '@/portals/portal'

/**
 * Renders this hostname's portal (see portals/portal.tsx for the mapping).
 *
 * The Suspense boundary is the safety net for whichever lazy chunk is not yet
 * in memory: normally nothing, because main.tsx preloads the portal before
 * mounting and each portal preloads its routed app while the login form is on
 * screen. It shows on a signed-in cold reload (portal chunk in, app chunk still
 * downloading) and on very slow networks. Route-level chunks never reach it —
 * the routers own their own pending boundary (`RoutePending`).
 */
function App() {
  return (
    <Suspense fallback={<NucleusLoader fullScreen size={64} />}>
      <Portal />
    </Suspense>
  )
}

export default App
