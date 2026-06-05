import { useEffect, useLayoutEffect, useState, type ReactNode } from 'react'
import { ArrowRight, Eye, EyeOff, GraduationCap } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ThemeToggle } from '@/components/theme-toggle'
import { ParentLanguageSwitcher } from '@/components/parent-language-switcher'
import { BrandPanel } from '@/components/auth/brand-panel'
import { ApiError } from '@/lib/api'
import {
  parentChangePassword,
  parentLogin,
  parentRequestOtp,
  parentVerifyOtp,
  type GuardianLoginResult,
} from '@/lib/parent-auth'
import { useParentAuthStore } from '@/stores/parent-auth-store'
import { withGlobalLoader } from '@/stores/loader-store'
import i18n, { getStoredParentLang } from '@/lib/i18n'

// ---------------------------------------------------------------------------
// Parent (guardian) login — the only entry point on the parent.* subdomain.
// Mirrors employee-login.tsx (its own page, separate from the student login)
// but adds the parent-only i18n: English / हिंदी / తెలుగు, with a language
// switcher in the header. Forgot-password is OTP-based (no email reset link),
// so there is no `?reset-token` panel here.
// ---------------------------------------------------------------------------

export default function ParentLogin() {
  useEffect(() => {
    document.title = 'Parent sign in — Nucleus'
  }, [])

  // The whole portal is parent-only, so always render in the parent's chosen
  // language. A layout effect runs before paint so there is no English flash on
  // first render; the in-header switcher updates it live afterwards.
  useLayoutEffect(() => {
    void i18n.changeLanguage(getStoredParentLang())
  }, [])

  return (
    <PageShell>
      <ParentSection />
    </PageShell>
  )
}

/** Outer chrome shared by every view on this page. */
function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-svh bg-background text-foreground">
      <BrandPanel variant="parent" />

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
            <ParentLanguageSwitcher />
            <ThemeToggle />
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm space-y-8">
            <ParentLoginHeader />
            {children}
            <ParentLoginFooter />
          </div>
        </div>
      </main>
    </div>
  )
}

function ParentLoginHeader() {
  const { t } = useTranslation()
  return (
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
  )
}

function ParentLoginFooter() {
  const { t } = useTranslation()
  return (
    <p className="text-center text-xs text-muted-foreground">
      {t('loginChrome.needHelp')}{' '}
      <a href="#" className="font-medium text-foreground hover:underline">
        {t('loginChrome.contact')}
      </a>
    </p>
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
  const mobileGuard = useAutofillGuard()

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
          maxLength={10}
          required
          value={mobile}
          onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))}
          {...mobileGuard}
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

/**
 * Stops the browser silently autofilling a saved credential before the user
 * has focused the field. Keeping the field read-only until focus makes Chrome
 * skip autofill (read-only fields are ignored); removing read-only on focus
 * leaves manual typing and the save prompt unaffected. Spread the result onto
 * an Input, and don't pair it with `autoFocus` (focusing on mount would re-open
 * the door to the very autofill we're blocking).
 */
function useAutofillGuard(): { readOnly: boolean; onFocus: () => void } {
  const [editable, setEditable] = useState(false)
  return { readOnly: !editable, onFocus: () => setEditable(true) }
}

function PasswordInput({
  id,
  label,
  value,
  onChange,
  autoComplete,
  autoFocus,
  onForgot,
  forgotLabel,
}: {
  id: string
  label: string
  value: string
  onChange: (next: string) => void
  autoComplete: string
  autoFocus?: boolean
  onForgot?: () => void
  /** Label for the "forgot password" link — translated by callers. */
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
