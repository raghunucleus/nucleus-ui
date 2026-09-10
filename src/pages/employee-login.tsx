import { useEffect, useState } from 'react'
import { ArrowRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  authErrorMessage,
  AuthHeading,
  AuthShell,
  AuthTextButton,
  DeviceLimitPicker,
  FormError,
  GoogleSignInButton,
  PasswordHint,
  PasswordInput,
  validateNewPassword,
} from '@/components/auth'
import {
  acceptInvite,
  validateInvite,
  type InviteInfo,
} from '@/lib/account-invite'
import { ApiError, isDeviceLimit } from '@/lib/api'
import {
  toDeviceLimitChallenge,
  type DeviceLimitChallenge,
  type DeviceLimitPayload,
} from '@/lib/sessions'
import {
  employeeChangePassword,
  employeeCompleteDeviceLimit,
  employeeForgotPassword,
  employeeLogin,
  employeeLoginWithGoogle,
  employeeResetPassword,
  storeEmployeeTokens,
  clearEmployeeTokens,
  type EmployeeLoginResult,
} from '@/lib/employee-auth'
import { withGlobalLoader } from '@/stores/loader-store'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_OIDC_CLIENT_ID

// ---------------------------------------------------------------------------
// Employee login — the entry point on the employee.* subdomain. Mirrors the
// student page (same shared kit from @/components/auth), adapted to emp_code.
// ---------------------------------------------------------------------------

export default function EmployeeLogin({
  onAuthenticated,
}: {
  onAuthenticated: () => void
}) {
  const [resetToken] = useState(() =>
    new URLSearchParams(window.location.search).get('reset-token'),
  )
  const [inviteToken] = useState(() =>
    new URLSearchParams(window.location.search).get('invite-token'),
  )

  useEffect(() => {
    document.title = inviteToken
      ? 'Set your password — Nucleus'
      : 'Employee sign in — Nucleus'
  }, [inviteToken])

  if (resetToken) {
    return (
      <AuthShell variant="employee">
        <ResetPasswordPanel token={resetToken} />
      </AuthShell>
    )
  }

  // Checked after the reset branch: holding both links at once is not a real
  // situation, and a reset is the more recent, more deliberate action.
  if (inviteToken) {
    return (
      <AuthShell variant="employee">
        <AcceptInvitePanel token={inviteToken} />
      </AuthShell>
    )
  }

  return (
    <AuthShell variant="employee">
      <EmployeeSection onAuthenticated={onAuthenticated} />
    </AuthShell>
  )
}

// ---------------------------------------------------------------------------
// Sign-in flow
// ---------------------------------------------------------------------------

type Mode = 'login' | 'forgot' | 'forgot-sent' | 'change' | 'device-limit'

function EmployeeSection({ onAuthenticated }: { onAuthenticated: () => void }) {
  const [mode, setMode] = useState<Mode>('login')
  const [session, setSession] = useState<EmployeeLoginResult | null>(null)
  // A login paused at the device limit. The challenge token is a bearer
  // credential, so it lives here in component state only — never storage or
  // the URL; a reload simply means signing in again.
  const [challenge, setChallenge] = useState<DeviceLimitChallenge | null>(null)
  const [deviceError, setDeviceError] = useState<string | null>(null)
  const [raced, setRaced] = useState(false)
  // Shown on the sign-in form when the picker hands back (challenge expired).
  const [loginError, setLoginError] = useState<string | null>(null)

  function handleLoggedIn(result: EmployeeLoginResult) {
    storeEmployeeTokens(result)
    if (result.mustChangePassword) {
      setSession(result)
      setMode('change')
    } else {
      onAuthenticated()
    }
  }

  function handleDeviceLimit(payload: DeviceLimitPayload) {
    setChallenge(toDeviceLimitChallenge(payload))
    setDeviceError(null)
    setRaced(false)
    setLoginError(null)
    setMode('device-limit')
  }

  function backToLogin(message: string | null = null) {
    setChallenge(null)
    setDeviceError(null)
    setRaced(false)
    setLoginError(message)
    setMode('login')
  }

  async function completeDeviceLimit(sessionIds: string[]) {
    if (!challenge) return
    setDeviceError(null)
    try {
      const result = await withGlobalLoader(
        () => employeeCompleteDeviceLimit(challenge.challengeToken, sessionIds),
        'Signing in…',
      )
      setChallenge(null)
      handleLoggedIn(result)
    } catch (err) {
      if (isDeviceLimit(err)) {
        // A racing sign-in took the freed slot: same challenge, fresh list.
        setChallenge(toDeviceLimitChallenge(err.data))
        setRaced(true)
      } else if (err instanceof ApiError && err.status === 401) {
        // The 5-minute challenge expired — start the sign-in over.
        backToLogin(err.message)
      } else {
        setRaced(false)
        setDeviceError(authErrorMessage(err))
      }
    }
  }

  if (mode === 'device-limit' && challenge) {
    return (
      <DeviceLimitPicker
        sessions={challenge.sessions}
        limit={challenge.limit}
        error={deviceError}
        raced={raced}
        onSubmit={completeDeviceLimit}
        onBack={() => backToLogin()}
      />
    )
  }

  if (mode === 'change' && session) {
    return (
      <ChangePasswordForm
        accessToken={session.accessToken}
        onChanged={onAuthenticated}
        onCancel={() => {
          clearEmployeeTokens()
          setSession(null)
          setMode('login')
        }}
      />
    )
  }

  if (mode === 'forgot') {
    return (
      <ForgotPasswordForm
        onSent={() => setMode('forgot-sent')}
        onBack={() => setMode('login')}
      />
    )
  }

  if (mode === 'forgot-sent') {
    return <ForgotSentPanel onBack={() => setMode('login')} />
  }

  return (
    <EmployeeLoginForm
      initialError={loginError}
      onForgot={() => setMode('forgot')}
      onLoggedIn={handleLoggedIn}
      onDeviceLimit={handleDeviceLimit}
    />
  )
}

function EmployeeLoginForm({
  initialError,
  onForgot,
  onLoggedIn,
  onDeviceLimit,
}: {
  initialError: string | null
  onForgot: () => void
  onLoggedIn: (result: EmployeeLoginResult) => void
  /** Every device slot is taken — hand over to the picker. */
  onDeviceLimit: (payload: DeviceLimitPayload) => void
}) {
  const [empCode, setEmpCode] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(initialError)
  const [submitting, setSubmitting] = useState(false)

  function handleFailure(err: unknown) {
    setSubmitting(false)
    if (isDeviceLimit(err)) onDeviceLimit(err.data)
    else setError(authErrorMessage(err))
  }

  async function handleSubmit(event: { preventDefault: () => void }) {
    event.preventDefault()
    if (submitting) return
    setError(null)
    setSubmitting(true)
    try {
      const result = await withGlobalLoader(
        () => employeeLogin(empCode.trim(), password),
        'Signing in…',
      )
      onLoggedIn(result)
    } catch (err) {
      handleFailure(err)
    }
  }

  async function handleGoogleSuccess(idToken: string) {
    if (submitting) return
    setError(null)
    setSubmitting(true)
    try {
      const result = await withGlobalLoader(
        () => employeeLoginWithGoogle(idToken),
        'Signing in…',
      )
      onLoggedIn(result)
    } catch (err) {
      handleFailure(err)
    }
  }

  return (
    <div className="space-y-6">
      <AuthHeading
        eyebrow="Faculty & staff"
        title="Welcome back"
        description="Sign in with your employee credentials to continue."
      />

      <form className="space-y-4" onSubmit={handleSubmit}>
        {error && <FormError message={error} />}

        <div className="space-y-1.5">
          <Label htmlFor="emp-code">Employee code</Label>
          <Input
            id="emp-code"
            name="emp-code"
            inputSize="lg"
            autoComplete="username"
            autoFocus
            required
            value={empCode}
            onChange={(e) => setEmpCode(e.target.value)}
          />
        </div>

        <PasswordInput
          id="password"
          label="Password"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
          onForgot={onForgot}
        />

        <Button type="submit" size="lg" className="w-full" disabled={submitting}>
          {submitting ? 'Signing in…' : 'Sign in'}
          {!submitting && <ArrowRight />}
        </Button>
      </form>

      {GOOGLE_CLIENT_ID && (
        <GoogleSignInButton
          disabled={submitting}
          onSuccess={handleGoogleSuccess}
          onError={setError}
        />
      )}

      <p className="text-center text-xs text-muted-foreground">
        Trouble signing in?{' '}
        <a href="#" className="font-medium text-foreground hover:underline">
          Contact IT support
        </a>
      </p>
    </div>
  )
}

function ChangePasswordForm({
  accessToken,
  onChanged,
  onCancel,
}: {
  accessToken: string
  onChanged: () => void
  onCancel: () => void
}) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: { preventDefault: () => void }) {
    event.preventDefault()
    if (submitting) return
    setError(null)

    const policyError = validateNewPassword(newPassword)
    if (policyError) return setError(policyError)
    if (newPassword !== confirmPassword) {
      return setError('The new passwords do not match.')
    }

    setSubmitting(true)
    try {
      const tokens = await withGlobalLoader(
        () => employeeChangePassword(accessToken, currentPassword, newPassword),
        'Updating password…',
      )
      storeEmployeeTokens(tokens)
      onChanged()
    } catch (err) {
      setError(authErrorMessage(err))
      setSubmitting(false)
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <AuthHeading
        title="Set a new password"
        description="You are signed in with a temporary password. Choose a new one to continue."
      />

      {error && <FormError message={error} />}

      <PasswordInput
        id="current-password"
        label="Temporary password"
        value={currentPassword}
        onChange={setCurrentPassword}
        autoComplete="current-password"
        autoFocus
      />
      <PasswordInput
        id="new-password"
        label="New password"
        value={newPassword}
        onChange={setNewPassword}
        autoComplete="new-password"
      />
      <PasswordInput
        id="confirm-password"
        label="Confirm new password"
        value={confirmPassword}
        onChange={setConfirmPassword}
        autoComplete="new-password"
      />

      <PasswordHint />

      <div className="space-y-3">
        <Button type="submit" size="lg" className="w-full" disabled={submitting}>
          {submitting ? 'Saving…' : 'Save and continue'}
        </Button>
        <AuthTextButton onClick={onCancel}>Cancel and sign out</AuthTextButton>
      </div>
    </form>
  )
}

function ForgotPasswordForm({
  onSent,
  onBack,
}: {
  onSent: () => void
  onBack: () => void
}) {
  const [identifier, setIdentifier] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: { preventDefault: () => void }) {
    event.preventDefault()
    if (submitting) return
    setError(null)
    setSubmitting(true)
    try {
      await withGlobalLoader(
        () => employeeForgotPassword(identifier.trim()),
        'Sending reset link…',
      )
      onSent()
    } catch (err) {
      setError(authErrorMessage(err))
      setSubmitting(false)
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <AuthHeading
        title="Reset your password"
        description={
          <>
            Enter your employee code or registered email. We&rsquo;ll send a
            reset link to the email on file.
          </>
        }
      />

      {error && <FormError message={error} />}

      <div className="space-y-1.5">
        <Label htmlFor="identifier">Employee code or email</Label>
        <Input
          id="identifier"
          name="identifier"
          inputSize="lg"
          autoComplete="username"
          autoFocus
          required
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
        />
      </div>

      <div className="space-y-3">
        <Button type="submit" size="lg" className="w-full" disabled={submitting}>
          {submitting ? 'Sending…' : 'Send reset link'}
        </Button>
        <AuthTextButton onClick={onBack}>Back to sign in</AuthTextButton>
      </div>
    </form>
  )
}

function ForgotSentPanel({ onBack }: { onBack: () => void }) {
  return (
    <div className="space-y-4">
      <AuthHeading
        align="center"
        title="Check your email"
        description="If an account matches what you entered, a password-reset link is on its way. The link expires shortly, so use it soon."
      />
      <Button type="button" size="lg" className="w-full" onClick={onBack}>
        Back to sign in
      </Button>
    </div>
  )
}

function ResetPasswordPanel({ token }: { token: string }) {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  async function handleSubmit(event: { preventDefault: () => void }) {
    event.preventDefault()
    if (submitting) return
    setError(null)

    const policyError = validateNewPassword(newPassword)
    if (policyError) return setError(policyError)
    if (newPassword !== confirmPassword) {
      return setError('The passwords do not match.')
    }

    setSubmitting(true)
    try {
      await withGlobalLoader(
        () => employeeResetPassword(token, newPassword),
        'Updating password…',
      )
      setDone(true)
    } catch (err) {
      setError(authErrorMessage(err))
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="space-y-4">
        <AuthHeading
          align="center"
          title="Password updated"
          description="Your password has been changed. You can now sign in with it."
        />
        <Button
          type="button"
          size="lg"
          className="w-full"
          onClick={() => {
            window.location.href = window.location.pathname
          }}
        >
          Go to sign in
        </Button>
      </div>
    )
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <AuthHeading
        title="Choose a new password"
        description="Set a new password for your Nucleus employee account."
      />

      {error && <FormError message={error} />}

      <PasswordInput
        id="reset-new-password"
        label="New password"
        value={newPassword}
        onChange={setNewPassword}
        autoComplete="new-password"
        autoFocus
      />
      <PasswordInput
        id="reset-confirm-password"
        label="Confirm new password"
        value={confirmPassword}
        onChange={setConfirmPassword}
        autoComplete="new-password"
      />

      <PasswordHint />

      <Button type="submit" size="lg" className="w-full" disabled={submitting}>
        {submitting ? 'Saving…' : 'Update password'}
      </Button>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Account invitation ("set your password")
// ---------------------------------------------------------------------------

type InvitePhase =
  | { k: 'checking' }
  | { k: 'invalid'; reason: 'expired' | 'invalid' }
  | { k: 'ready'; info: InviteInfo }
  | { k: 'done' }

/**
 * Landing screen for an emailed invitation link.
 *
 * Unlike the reset panel this has a lookup phase: the token is checked before
 * the form renders, so the person is greeted by name and an expired link says
 * so up front instead of after they have typed a password twice.
 */
function AcceptInvitePanel({ token }: { token: string }) {
  const [phase, setPhase] = useState<InvitePhase>({ k: 'checking' })
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false
    validateInvite(token)
      .then((res) => {
        if (cancelled) return
        setPhase(
          res.valid
            ? { k: 'ready', info: res }
            : { k: 'invalid', reason: res.reason },
        )
      })
      // A transport failure is indistinguishable from a bad token here, and
      // "invalid" is the safe thing to show — it points at the same recovery.
      .catch(() => {
        if (!cancelled) setPhase({ k: 'invalid', reason: 'invalid' })
      })
    return () => {
      cancelled = true
    }
  }, [token])

  async function handleSubmit(event: { preventDefault: () => void }) {
    event.preventDefault()
    if (submitting) return
    setError(null)

    const policyError = validateNewPassword(newPassword)
    if (policyError) return setError(policyError)
    if (newPassword !== confirmPassword) {
      return setError('The passwords do not match.')
    }

    setSubmitting(true)
    try {
      await withGlobalLoader(
        () => acceptInvite(token, newPassword),
        'Setting your password…',
      )
      setPhase({ k: 'done' })
    } catch (err) {
      setError(authErrorMessage(err))
      setSubmitting(false)
    }
  }

  if (phase.k === 'checking') {
    return (
      <div className="space-y-4 text-center">
        <div
          className="mx-auto size-8 animate-spin rounded-full border-2 border-muted border-t-primary"
          aria-hidden="true"
        />
        <p className="text-sm text-muted-foreground">
          Checking your invitation…
        </p>
      </div>
    )
  }

  if (phase.k === 'invalid') {
    return (
      <div className="space-y-4">
        <AuthHeading
          align="center"
          title={
            phase.reason === 'expired'
              ? 'This invitation link has expired'
              : "This invitation link isn't valid"
          }
          description={
            phase.reason === 'expired'
              ? 'Invitation links are single-use and time-limited. Use “Forgot password?” on the sign-in screen, or ask your administrator to send a new invitation.'
              : 'It may already have been used, or replaced by a newer invitation. Use “Forgot password?” on the sign-in screen, or ask your administrator to send a new one.'
          }
        />
        <Button
          type="button"
          size="lg"
          className="w-full"
          onClick={() => {
            window.location.href = window.location.pathname
          }}
        >
          Go to sign in
        </Button>
      </div>
    )
  }

  if (phase.k === 'done') {
    return (
      <div className="space-y-4">
        <AuthHeading
          align="center"
          title="Your account is ready"
          description="Your password has been set. You can now sign in with it."
        />
        <Button
          type="button"
          size="lg"
          className="w-full"
          onClick={() => {
            window.location.href = window.location.pathname
          }}
        >
          Go to sign in
        </Button>
      </div>
    )
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <AuthHeading
        title={`Welcome, ${phase.info.display_name}`}
        description={
          <>
            Choose a password to finish setting up your Nucleus employee
            account. You will sign in with employee code{' '}
            <span className="font-medium text-foreground">
              {phase.info.login_identifier}
            </span>
            .
          </>
        }
      />

      {error && <FormError message={error} />}

      <PasswordInput
        id="invite-new-password"
        label="New password"
        value={newPassword}
        onChange={setNewPassword}
        autoComplete="new-password"
        autoFocus
      />
      <PasswordInput
        id="invite-confirm-password"
        label="Confirm new password"
        value={confirmPassword}
        onChange={setConfirmPassword}
        autoComplete="new-password"
      />

      <PasswordHint />

      <Button type="submit" size="lg" className="w-full" disabled={submitting}>
        {submitting ? 'Saving…' : 'Set password'}
      </Button>
    </form>
  )
}
