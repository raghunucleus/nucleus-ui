import { useState } from 'react'
import { detectAppVariant } from '@/lib/subdomain'
import EmployeeLogin from '@/pages/employee-login'
import StudentParentLogin from '@/pages/student-parent-login'
import StudentHome from '@/pages/student-home'
import { clearTokens, hasStoredSession } from '@/lib/student-auth'

function App() {
  if (detectAppVariant() === 'employee') return <EmployeeLogin />
  return <StudentPortal />
}

/** Student/parent portal: the dashboard when signed in, the login flow otherwise. */
function StudentPortal() {
  const [authed, setAuthed] = useState(
    // A password-reset link must reach the login flow even if tokens linger.
    () =>
      hasStoredSession() &&
      !new URLSearchParams(window.location.search).has('reset-token'),
  )

  if (authed) {
    return (
      <StudentHome
        onSignOut={() => {
          clearTokens()
          setAuthed(false)
        }}
      />
    )
  }

  return <StudentParentLogin onAuthenticated={() => setAuthed(true)} />
}

export default App
