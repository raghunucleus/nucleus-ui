import { RouterProvider } from '@tanstack/react-router'

import { parentRouter } from '@/parent-router'

/**
 * The signed-in parent app: the router, its layout and every page chunk it
 * lazy-loads. Kept in its own module so the portal can fetch it on demand
 * (`import('./parent-app')`) — the login and Select-Child screens never pull
 * it in.
 */
export default function ParentApp() {
  return <RouterProvider router={parentRouter} />
}
