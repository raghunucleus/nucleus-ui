import { RouterProvider } from '@tanstack/react-router'

import { employeeRouter } from '@/employee-router'

/**
 * The signed-in employee app: the router, its layout and every page chunk it
 * lazy-loads. Kept in its own module so the portal can fetch it on demand
 * (`import('./employee-app')`) — the login screen never pulls it in.
 */
export default function EmployeeApp() {
  return <RouterProvider router={employeeRouter} />
}
