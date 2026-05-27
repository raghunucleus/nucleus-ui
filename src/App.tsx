import { RouterProvider } from '@tanstack/react-router'

import { detectAppVariant } from '@/lib/subdomain'
import EmployeeLogin from '@/pages/employee-login'
import StudentParentLogin from '@/pages/student-parent-login'
import { employeeRouter } from '@/employee-router'
import { router } from '@/router'
import { useAuthStore } from '@/stores/auth-store'
import { useEmployeeAuthStore } from '@/stores/employee-auth-store'

function App() {
  if (detectAppVariant() === 'employee') return <EmployeePortal />
  return <StudentPortal />
}

/** Employee portal: routed app once signed in, login flow otherwise. */
function EmployeePortal() {
  const authed = useEmployeeAuthStore((state) => state.authed)
  const signIn = useEmployeeAuthStore((state) => state.signIn)

  if (authed) return <RouterProvider router={employeeRouter} />
  return <EmployeeLogin onAuthenticated={signIn} />
}

/** Student/parent portal: routed app when signed in, login flow otherwise. */
function StudentPortal() {
  const authed = useAuthStore((state) => state.authed)
  const signIn = useAuthStore((state) => state.signIn)

  if (authed) return <RouterProvider router={router} />
  return <StudentParentLogin onAuthenticated={signIn} />
}

export default App
