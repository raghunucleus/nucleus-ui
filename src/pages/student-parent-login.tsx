import { useEffect, useState, type ReactNode } from 'react'
import { ArrowRight, Eye, EyeOff, GraduationCap } from 'lucide-react'
import { GoogleLogin, type CredentialResponse } from '@react-oauth/google'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ThemeToggle } from '@/components/theme-toggle'
import { ParentLanguageSwitcher } from '@/components/parent-language-switcher'
import { BrandPanel } from '@/components/auth/brand-panel'
import { cn } from '@/lib/utils'
import { ApiError } from '@/lib/api'
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
import {
  parentChangePassword,
  parentLogin,
  parentRequestOtp,
  parentVerifyOtp,
  type GuardianLoginResult,
} from '@/lib/parent-auth'
import { useParentAuthStore } from '@/stores/parent-auth-store'
import { withGlobalLoader } from '@/stores/loader-store'

// Google sign-in is shown only when an OAuth client id is configured.
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_OIDC_CLIENT_ID

type Role = 'student' | 'parent'

export default function StudentParentLogin({
  onAuthenticated,
}: {
  onAuthenticated: () => void
}) {
  const { t } = useTranslation()
  const [role, setRole] = useState<Role>('student')
  // Captured once: a password-reset email links back here with ?reset-token=…
  const [resetToken] = useState(() =>
    new URLSearchParams(window.location.search).get('reset-token'),
  )

  useEffect(() => {
    document.title = 'Sign in — Nucleus'
  }, [])

  if (resetToken) {
    return (
      <PageShell>
        <ResetPasswordPanel token={resetToken} />
      </PageShell>
    )
  }

  return (
    // The language switcher is shown only on the Parent tab — i18n covers the
    // parent experience; the student/employee UIs stay English.
    <PageShell headerExtra={role === 'parent' ? <ParentLanguageSwitcher /> : null}>
      <header className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wider text-primary">
          {t('loginChrome.eyebrow')}
        </p>
        <h2 className="text-3xl font-semibold tracking-tight">
          {t('loginChrome.title')}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t('loginChrome.subtitle')}
        </p>
      </header>

      <RoleTabs role={role} onChange={setRole} />

      {role === 'student' ? (
        <StudentSection onAuthenticated={onAuthenticated} />
      ) : (
        <ParentSection />
      )}

      <p className="text-center text-xs text-muted-foreground">
        {t('loginChrome.needHelp')}{' '}
        <a href="#" className="font-medium text-foreground hover:underline">
          {t('loginChrome.contact')}
        </a>
      </p>
    </PageShell>
  )
}

/** Outer chrome shared by every view on this page. */
function PageShell({
  children,
  headerExtra,
}: {
  children: ReactNode
  /** Optional controls rendered to the left of the theme toggle (e.g. the
   *  parent language switcher, shown only on the Parent tab). */
  headerExtra?: ReactNode
}) {
  return (
    <div className="flex min-h-svh bg-background text-foreground">
      <BrandPanel variant="member" />

      <main className="relative flex flex-1 flex-col px-6 py-8 sm:px-10 lg:w-[28rem] lg:flex-none lg:px-12">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 lg:hidden">
            <div className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground">
              <GraduationCap className="size-5" />
            </div>
            <span className="text-base font-semibold tracking-tight">
              Nucleus
            </span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {headerExtra}
            <ThemeToggle />
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm space-y-8">{children}</div>
        </div>
      </main>
    </div>
  )
}

function RoleTabs({
  role,
  onChange,
}: {
  role: Role
  onChange: (next: Role) => void
}) {
  const { t } = useTranslation()
  return (
    <div
      role="tablist"
      aria-label="Account type"
      className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1"
    >
      {(['student', 'parent'] as const).map((value) => (
        <button
          key={value}
          type="button"
          role="tab"
          aria-selected={role === value}
          onClick={() => onChange(value)}
          className={cn(
            'rounded-md px-3 py-2 text-sm font-medium transition-colors',
            'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30',
            role === value
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {value === 'student'
            ? t('loginChrome.tabStudent')
            : t('loginChrome.tabParent')}
        </button>
      ))}
    </div>
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
      setError(toMessage(err))
      setSubmitting(false)
    }
  }

  async function handleGoogleSuccess(credential: CredentialResponse) {
    if (submitting) return
    if (!credential.credential) {
      setError('Google sign-in did not return a credential. Please try again.')
      return
    }
    setError(null)
    setSubmitting(true)
    const idToken = credential.credential
    try {
      const result = await withGlobalLoader(
        () => studentLoginWithGoogle(idToken),
        'Signing in…',
      )
      onLoggedIn(result)
    } catch (err) {
      setError(toMessage(err))
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <form className="space-y-5" onSubmit={handleSubmit}>
        {error && <FormError message={error} />}

        <div className="space-y-2">
          <Label htmlFor="student-id">Student ID</Label>
          <Input
            id="student-id"
            name="student-id"
            placeholder="e.g. 23BCS001"
            autoComplete="username"
            autoFocus
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

        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={submitting}
        >
          {submitting ? 'Signing in…' : 'Sign in'}
          {!submitting && <ArrowRight />}
        </Button>
      </form>

      {GOOGLE_CLIENT_ID && (
        <>
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase tracking-wider">
              <span className="bg-background px-3 text-muted-foreground">
                or
              </span>
            </div>
          </div>

          <div
            className="flex justify-center"
            aria-busy={submitting}
            aria-disabled={submitting}
          >
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() =>
                setError('Google sign-in failed. Please try again.')
              }
              useOneTap={false}
              theme="outline"
              size="large"
              text="signin_with"
              width="320"
            />
          </div>
        </>
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
        () =>
          studentChangePassword(accessToken, currentPassword, newPassword),
        'Updating password…',
      )
      storeTokens(tokens)
      onChanged()
    } catch (err) {
      setError(toMessage(err))
      setSubmitting(false)
    }
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">
          Set a new password
        </h2>
        <p className="text-sm text-muted-foreground">
          You are signed in with a temporary password. Choose a new one to
          continue.
        </p>
      </header>

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
        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={submitting}
        >
          {submitting ? 'Saving…' : 'Save and continue'}
        </Button>
        <button
          type="button"
          onClick={onCancel}
          className="w-full text-center text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          Cancel and sign out
        </button>
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
      setError(toMessage(err))
      setSubmitting(false)
    }
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">
          Reset your password
        </h2>
        <p className="text-sm text-muted-foreground">
          Enter your student ID or registered email. We&rsquo;ll send a reset
          link to the email on file.
        </p>
      </header>

      {error && <FormError message={error} />}

      <div className="space-y-2">
        <Label htmlFor="identifier">Student ID or email</Label>
        <Input
          id="identifier"
          name="identifier"
          placeholder="23BCS001 or you@example.com"
          autoComplete="username"
          autoFocus
          required
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
        />
      </div>

      <div className="space-y-3">
        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={submitting}
        >
          {submitting ? 'Sending…' : 'Send reset link'}
        </Button>
        <button
          type="button"
          onClick={onBack}
          className="w-full text-center text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          Back to sign in
        </button>
      </div>
    </form>
  )
}

function ForgotSentPanel({ onBack }: { onBack: () => void }) {
  return (
    <div className="space-y-5 text-center">
      <h2 className="text-2xl font-semibold tracking-tight">Check your email</h2>
      <p className="text-sm text-muted-foreground">
        If an account matches what you entered, a password-reset link is on its
        way. The link expires shortly, so use it soon.
      </p>
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
      setError(toMessage(err))
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="space-y-5 text-center">
        <h2 className="text-2xl font-semibold tracking-tight">
          Password updated
        </h2>
        <p className="text-sm text-muted-foreground">
          Your password has been changed. You can now sign in with it.
        </p>
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
    <form className="space-y-5" onSubmit={handleSubmit}>
      <header className="space-y-2">
        <h2 className="text-3xl font-semibold tracking-tight">
          Choose a new password
        </h2>
        <p className="text-sm text-muted-foreground">
          Set a new password for your Nucleus student account.
        </p>
      </header>

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
// Parent (guardian) authentication flow
// ---------------------------------------------------------------------------

type ParentMode = 'login' | 'forgot' | 'forgot-otp' | 'change' | 'reset-done'

const MOBILE_RE = /^[6-9]\d{9}$/

/** Parent password policy with translated messages (mirrors the server). */
function validateNewPasswordT(t: TFunction, password: string): string | null {
  if (password.length < 8) return t('pw.errLen')
  if (!/[A-Za-z]/.test(password)) return t('pw.errLetter')
  if (!/\d/.test(password)) return t('pw.errNumber')
  return null
}

/** Server error message passthrough, with a translated generic fallback. */
function toMessageT(t: TFunction, err: unknown): string {
  if (err instanceof ApiError) return err.message
  if (err instanceof Error && err.message) return err.message
  return t('generic.error')
}

function ParentSection() {
  const { t } = useTranslation()
  const signIn = useParentAuthStore((state) => state.signIn)
  const [mode, setMode] = useState<ParentMode>('login')
  // The login response is held while the guardian sets a new password from an
  // admin-issued temporary one — we sign in with it (plus fresh tokens) after.
  const [pendingLogin, setPendingLogin] = useState<GuardianLoginResult | null>(
    null,
  )
  // Remembered across the forgot → OTP steps so the verify call has the number.
  const [otpMobile, setOtpMobile] = useState('')

  if (mode === 'change' && pendingLogin) {
    return (
      <ParentChangePasswordForm
        accessToken={pendingLogin.accessToken}
        onChanged={(tokens) => {
          signIn({
            ...pendingLogin,
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            mustChangePassword: false,
          })
        }}
        onCancel={() => {
          setPendingLogin(null)
          setMode('login')
        }}
      />
    )
  }

  if (mode === 'forgot') {
    return (
      <ParentForgotForm
        onSent={(mobile) => {
          setOtpMobile(mobile)
          setMode('forgot-otp')
        }}
        onBack={() => setMode('login')}
      />
    )
  }

  if (mode === 'forgot-otp') {
    return (
      <ParentOtpForm
        mobile={otpMobile}
        onDone={() => setMode('reset-done')}
        onBack={() => setMode('login')}
      />
    )
  }

  if (mode === 'reset-done') {
    return (
      <div className="space-y-5 text-center">
        <h2 className="text-2xl font-semibold tracking-tight">
          {t('done.title')}
        </h2>
        <p className="text-sm text-muted-foreground">{t('done.desc')}</p>
        <Button
          type="button"
          size="lg"
          className="w-full"
          onClick={() => setMode('login')}
        >
          {t('common.backToSignIn')}
        </Button>
      </div>
    )
  }

  return (
    <ParentLoginForm
      onForgot={() => setMode('forgot')}
      onLoggedIn={(result) => {
        if (result.mustChangePassword) {
          setPendingLogin(result)
          setMode('change')
        } else {
          signIn(result)
        }
      }}
    />
  )
}

function ParentLoginForm({
  onForgot,
  onLoggedIn,
}: {
  onForgot: () => void
  onLoggedIn: (result: GuardianLoginResult) => void
}) {
  const { t } = useTranslation()
  const [mobile, setMobile] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: { preventDefault: () => void }) {
    event.preventDefault()
    if (submitting) return
    setError(null)
    const trimmed = mobile.trim()
    if (!MOBILE_RE.test(trimmed)) {
      setError(t('login.errMobile'))
      return
    }
    setSubmitting(true)
    try {
      const result = await withGlobalLoader(
        () => parentLogin(trimmed, password),
        t('common.signingIn'),
      )
      onLoggedIn(result)
    } catch (err) {
      setError(toMessageT(t, err))
      setSubmitting(false)
    }
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      {error && <FormError message={error} />}

      <div className="space-y-2">
        <Label htmlFor="parent-mobile">{t('login.mobileLabel')}</Label>
        <Input
          id="parent-mobile"
          name="parent-mobile"
          type="tel"
          inputMode="numeric"
          autoComplete="username"
          placeholder={t('login.mobilePlaceholder')}
          maxLength={10}
          autoFocus
          required
          value={mobile}
          onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))}
        />
      </div>

      <PasswordInput
        id="parent-password"
        label={t('login.password')}
        value={password}
        onChange={setPassword}
        autoComplete="current-password"
        onForgot={onForgot}
        forgotLabel={t('login.forgot')}
      />

      <Button type="submit" size="lg" className="w-full" disabled={submitting}>
        {submitting ? t('common.signingIn') : t('common.signIn')}
        {!submitting && <ArrowRight />}
      </Button>
    </form>
  )
}

function ParentChangePasswordForm({
  accessToken,
  onChanged,
  onCancel,
}: {
  accessToken: string
  onChanged: (tokens: { accessToken: string; refreshToken: string }) => void
  onCancel: () => void
}) {
  const { t } = useTranslation()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: { preventDefault: () => void }) {
    event.preventDefault()
    if (submitting) return
    setError(null)

    const policyError = validateNewPasswordT(t, newPassword)
    if (policyError) return setError(policyError)
    if (newPassword !== confirmPassword) {
      return setError(t('pw.mismatch'))
    }

    setSubmitting(true)
    try {
      const tokens = await withGlobalLoader(
        () => parentChangePassword(accessToken, currentPassword, newPassword),
        t('common.saving'),
      )
      onChanged(tokens)
    } catch (err) {
      setError(toMessageT(t, err))
      setSubmitting(false)
    }
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">
          {t('change.title')}
        </h2>
        <p className="text-sm text-muted-foreground">{t('change.desc')}</p>
      </header>

      {error && <FormError message={error} />}

      <PasswordInput
        id="parent-current-password"
        label={t('change.temp')}
        value={currentPassword}
        onChange={setCurrentPassword}
        autoComplete="current-password"
        autoFocus
      />
      <PasswordInput
        id="parent-new-password"
        label={t('change.newPw')}
        value={newPassword}
        onChange={setNewPassword}
        autoComplete="new-password"
      />
      <PasswordInput
        id="parent-confirm-password"
        label={t('change.confirm')}
        value={confirmPassword}
        onChange={setConfirmPassword}
        autoComplete="new-password"
      />

      <p className="text-xs text-muted-foreground">{t('pw.hint')}</p>

      <div className="space-y-3">
        <Button type="submit" size="lg" className="w-full" disabled={submitting}>
          {submitting ? t('common.saving') : t('change.save')}
        </Button>
        <button
          type="button"
          onClick={onCancel}
          className="w-full text-center text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          {t('change.cancel')}
        </button>
      </div>
    </form>
  )
}

function ParentForgotForm({
  onSent,
  onBack,
}: {
  onSent: (mobile: string) => void
  onBack: () => void
}) {
  const { t } = useTranslation()
  const [mobile, setMobile] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: { preventDefault: () => void }) {
    event.preventDefault()
    if (submitting) return
    setError(null)
    const trimmed = mobile.trim()
    if (!MOBILE_RE.test(trimmed)) {
      setError(t('login.errMobile'))
      return
    }
    setSubmitting(true)
    try {
      await withGlobalLoader(() => parentRequestOtp(trimmed), t('common.sending'))
      onSent(trimmed)
    } catch (err) {
      setError(toMessageT(t, err))
      setSubmitting(false)
    }
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">
          {t('forgot.title')}
        </h2>
        <p className="text-sm text-muted-foreground">{t('forgot.desc')}</p>
      </header>

      {error && <FormError message={error} />}

      <div className="space-y-2">
        <Label htmlFor="parent-forgot-mobile">{t('login.mobileLabel')}</Label>
        <Input
          id="parent-forgot-mobile"
          name="parent-forgot-mobile"
          type="tel"
          inputMode="numeric"
          autoComplete="username"
          placeholder={t('login.mobilePlaceholder')}
          maxLength={10}
          autoFocus
          required
          value={mobile}
          onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))}
        />
      </div>

      <div className="space-y-3">
        <Button type="submit" size="lg" className="w-full" disabled={submitting}>
          {submitting ? t('common.sending') : t('forgot.send')}
        </Button>
        <button
          type="button"
          onClick={onBack}
          className="w-full text-center text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          {t('common.backToSignIn')}
        </button>
      </div>
    </form>
  )
}

function ParentOtpForm({
  mobile,
  onDone,
  onBack,
}: {
  mobile: string
  onDone: () => void
  onBack: () => void
}) {
  const { t } = useTranslation()
  const [otp, setOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: { preventDefault: () => void }) {
    event.preventDefault()
    if (submitting) return
    setError(null)

    if (!/^\d{6}$/.test(otp.trim())) {
      return setError(t('otp.errCode'))
    }
    const policyError = validateNewPasswordT(t, newPassword)
    if (policyError) return setError(policyError)
    if (newPassword !== confirmPassword) {
      return setError(t('pw.mismatch'))
    }

    setSubmitting(true)
    try {
      await withGlobalLoader(
        () => parentVerifyOtp(mobile, otp.trim(), newPassword),
        t('common.saving'),
      )
      onDone()
    } catch (err) {
      setError(toMessageT(t, err))
      setSubmitting(false)
    }
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">
          {t('otp.title')}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t('otp.desc', { mobile })}
        </p>
      </header>

      {error && <FormError message={error} />}

      <div className="space-y-2">
        <Label htmlFor="parent-otp">{t('otp.codeLabel')}</Label>
        <Input
          id="parent-otp"
          name="parent-otp"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder={t('otp.codePlaceholder')}
          maxLength={6}
          autoFocus
          required
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
        />
      </div>

      <PasswordInput
        id="parent-otp-new-password"
        label={t('otp.newPw')}
        value={newPassword}
        onChange={setNewPassword}
        autoComplete="new-password"
      />
      <PasswordInput
        id="parent-otp-confirm-password"
        label={t('otp.confirm')}
        value={confirmPassword}
        onChange={setConfirmPassword}
        autoComplete="new-password"
      />

      <p className="text-xs text-muted-foreground">{t('pw.hint')}</p>

      <div className="space-y-3">
        <Button type="submit" size="lg" className="w-full" disabled={submitting}>
          {submitting ? t('common.saving') : t('otp.set')}
        </Button>
        <button
          type="button"
          onClick={onBack}
          className="w-full text-center text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          {t('common.backToSignIn')}
        </button>
      </div>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Small shared pieces
// ---------------------------------------------------------------------------

function PasswordInput({
  id,
  label,
  value,
  onChange,
  autoComplete,
  autoFocus,
  onForgot,
  forgotLabel = 'Forgot password?',
}: {
  id: string
  label: string
  value: string
  onChange: (next: string) => void
  autoComplete: string
  autoFocus?: boolean
  onForgot?: () => void
  /** Label for the "forgot password" link — translated by parent callers;
   *  defaults to English so the student flow is unchanged. */
  forgotLabel?: string
}) {
  const [shown, setShown] = useState(false)

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor={id}>{label}</Label>
        {onForgot && (
          <button
            type="button"
            onClick={onForgot}
            className="text-xs font-medium text-primary hover:underline"
          >
            {forgotLabel}
          </button>
        )}
      </div>
      <div className="relative">
        <Input
          id={id}
          type={shown ? 'text' : 'password'}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          required
          className="pr-11"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          onClick={() => setShown((v) => !v)}
          className="absolute inset-y-0 right-0 grid w-11 place-items-center text-muted-foreground transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:outline-none"
          aria-label={shown ? 'Hide password' : 'Show password'}
        >
          {shown ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
    </div>
  )
}

function PasswordHint() {
  return (
    <p className="text-xs text-muted-foreground">
      Use at least 8 characters, including a letter and a number.
    </p>
  )
}

function FormError({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400"
    >
      {message}
    </p>
  )
}

/** Mirrors the server-side strongPasswordSchema so users get instant feedback. */
function validateNewPassword(password: string): string | null {
  if (password.length < 8) return 'Password must be at least 8 characters.'
  if (!/[A-Za-z]/.test(password)) {
    return 'Password must contain at least one letter.'
  }
  if (!/\d/.test(password)) return 'Password must contain at least one number.'
  return null
}

function toMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message
  if (err instanceof Error && err.message) return err.message
  return 'Something went wrong. Please try again.'
}
