import { RouterProvider } from '@tanstack/react-router'

import { router } from '@/router'

/**
 * The signed-in student app: the router, its layout and every page chunk it
 * lazy-loads. Kept in its own module so the portal can fetch it on demand
 * (`import('./student-app')`) — the login screen never pulls it in.
 */
export default function StudentApp() {
  return <RouterProvider router={router} />
}
