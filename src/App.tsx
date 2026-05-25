import { RouterProvider } from '@tanstack/react-router'

import { detectAppVariant } from '@/lib/subdomain'
import EmployeeLogin from '@/pages/employee-login'
import StudentParentLogin from '@/pages/student-parent-login'
import { router } from '@/router'
import { useAuthStore } from '@/stores/auth-store'

function App() {
  if (detectAppVariant() === 'employee') return <EmployeeLogin />
  return <StudentPortal />
}

/** Student/parent portal: the routed app when signed in, the login flow otherwise. */
function StudentPortal() {
  const authed = useAuthStore((state) => state.authed)
  const signIn = useAuthStore((state) => state.signIn)

  if (authed) return <RouterProvider router={router} />
  return <StudentParentLogin onAuthenticated={signIn} />
}

export default App
