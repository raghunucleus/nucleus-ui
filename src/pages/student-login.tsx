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
import {
  clearTokens,
  storeTokens,
  studentChangePassword,
  studentForgotPassword,
  studentLogin,
  studentLoginWithGoogle,
  studentResetPassword,
  type LoginResult,
} from '@/lib/student-auth'
import { withGlobalLoader } from '@/stores/loader-store'

// Google sign-in is shown only when an OAuth client id is configured.
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_OIDC_CLIENT_ID

// ---------------------------------------------------------------------------
// Student login — the only entry point on the student.* subdomain. Parents have
// their own parent.* portal (see parent-login.tsx), so this page is
// student-only and English-only (no i18n / role tabs / language switcher).
//
// Chrome and form primitives come from @/components/auth — this file owns the
// flows and the API calls, nothing visual.
// ---------------------------------------------------------------------------

export default function StudentLogin({
  onAuthenticated,
}: {
  onAuthenticated: () => void
}) {
  // Captured once: a password-reset email links back here with ?reset-token=…
  const [resetToken] = useState(() =>
    new URLSearchParams(window.location.search).get('reset-token'),
  )
  // …and an account-invitation email with ?invite-token=…
  const [inviteToken] = useState(() =>
    new URLSearchParams(window.location.search).get('invite-token'),
  )

  useEffect(() => {
    document.title = inviteToken
      ? 'Set your password — Nucleus'
      : 'Sign in — Nucleus'
  }, [inviteToken])

  if (resetToken) {
    return (
      <AuthShell variant="member">
        <ResetPasswordPanel token={resetToken} />
      </AuthShell>
    )
  }

  // Checked after the reset branch: holding both links at once is not a real
  // situation, and a reset is the more recent, more deliberate action.
  if (inviteToken) {
    return (
      <AuthShell variant="member">
        <AcceptInvitePanel token={inviteToken} />
      </AuthShell>
    )
  }

  return (
    <AuthShell variant="member">
      <AuthHeading
        eyebrow="Welcome back"
        title="Sign in to Nucleus"
        description="Access your classes, attendance, and announcements."
      />

      <StudentSection onAuthenticated={onAuthenticated} />

      <p className="text-center text-xs text-muted-foreground">
        Need help?{' '}
        <a href="#" className="font-medium text-foreground hover:underline">
          Contact your institution
        </a>
      </p>
    </AuthShell>
  )
}

// ---------------------------------------------------------------------------
// Student authentication flow
// ---------------------------------------------------------------------------

type StudentMode = 'login' | 'forgot' | 'forgot-sent' | 'change'

function StudentSection({ onAuthenticated }: { onAuthenticated: () => void }) {
  const [mode, setMode] = useState<StudentMode>('login')
  const [session, setSession] = useState<LoginResult | null>(null)

  if (mode === 'change' && session) {
    return (
      <ChangePasswordForm
        accessToken={session.accessToken}
        onChanged={onAuthenticated}
        onCancel={() => {
          clearTokens()
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
    <StudentLoginForm
      onForgot={() => setMode('forgot')}
      onLoggedIn={(result) => {
        storeTokens(result)
        if (result.mustChangePassword) {
          setSession(result)
          setMode('change')
        } else {
          onAuthenticated()
        }
      }}
    />
  )
}

function StudentLoginForm({
  onForgot,
  onLoggedIn,
}: {
  onForgot: () => void
  onLoggedIn: (result: LoginResult) => void
}) {
  const [studentId, setStudentId] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: { preventDefault: () => void }) {
    event.preventDefault()
    if (submitting) return
    setError(null)
    setSubmitting(true)
    try {
      const result = await withGlobalLoader(
        () => studentLogin(studentId.trim(), password),
        'Signing in…',
      )
      onLoggedIn(result)
    } catch (err) {
      setError(authErrorMessage(err))
      setSubmitting(false)
    }
  }

  async function handleGoogleSuccess(idToken: string) {
    if (submitting) return
    setError(null)
    setSubmitting(true)
    try {
      const result = await withGlobalLoader(
        () => studentLoginWithGoogle(idToken),
        'Signing in…',
      )
      onLoggedIn(result)
    } catch (err) {
      setError(authErrorMessage(err))
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <form className="space-y-4" onSubmit={handleSubmit}>
        {error && <FormError message={error} />}

        <div className="space-y-1.5">
          <Label htmlFor="student-id">Student ID</Label>
          <Input
            id="student-id"
            name="student-id"
            inputSize="lg"
            autoComplete="username"
            required
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
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
        () => studentChangePassword(accessToken, currentPassword, newPassword),
        'Updating password…',
      )
      storeTokens(tokens)
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
        () => studentForgotPassword(identifier.trim()),
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
            Enter your student ID or registered email. We&rsquo;ll send a reset
            link to the email on file.
          </>
        }
      />

      {error && <FormError message={error} />}

      <div className="space-y-1.5">
        <Label htmlFor="identifier">Student ID or email</Label>
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
        () => studentResetPassword(token, newPassword),
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
        description="Set a new password for your Nucleus student account."
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
 * the form renders, so the student is greeted by name and an expired link says
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
              ? 'Invitation links are single-use and time-limited. Use “Forgot password?” on the sign-in screen, or ask your college office to send a new invitation.'
              : 'It may already have been used, or replaced by a newer invitation. Use “Forgot password?” on the sign-in screen, or ask your college office to send a new one.'
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
            Choose a password to finish setting up your Nucleus student account.
            You will sign in with student ID{' '}
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
