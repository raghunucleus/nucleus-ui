import { useEffect, useLayoutEffect, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ThemeToggle } from '@/components/theme-toggle'
import { ParentLanguageSwitcher } from '@/components/parent-language-switcher'
import {
  authErrorMessage,
  AuthHeading,
  AuthShell,
  AuthTextButton,
  DeviceLimitPicker,
  FormError,
  PasswordInput,
  validateNewPassword,
  type DeviceLimitPickerStrings,
} from '@/components/auth'
import { ApiError, isDeviceLimit } from '@/lib/api'
import {
  parentChangePassword,
  parentCompleteDeviceLimit,
  parentLogin,
  parentRequestOtp,
  parentVerifyOtp,
  type GuardianLoginResult,
} from '@/lib/parent-auth'
import {
  formatRelativeTime,
  toDeviceLimitChallenge,
  type DeviceLimitChallenge,
  type DeviceLimitPayload,
} from '@/lib/sessions'
import { useParentAuthStore } from '@/stores/parent-auth-store'
import { withGlobalLoader } from '@/stores/loader-store'
import i18n, { getStoredParentLang } from '@/lib/i18n'

// ---------------------------------------------------------------------------
// Parent (guardian) login — the only entry point on the parent.* subdomain.
// Same shared kit as the student and employee pages, plus the parent-only
// i18n: English / हिंदी / తెలుగు, with a language switcher in the header.
// Forgot-password is OTP-based (no email reset link), so there is no
// `?reset-token` panel here.
//
// Nothing in @/components/auth calls `t()` — this page translates and passes
// the strings down, which keeps i18next out of the other two login chunks.
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
    <AuthShell
      variant="parent"
      actions={
        <>
          <ParentLanguageSwitcher />
          <ThemeToggle />
        </>
      }
    >
      <ParentSection />
    </AuthShell>
  )
}

// ---------------------------------------------------------------------------
// Parent (guardian) authentication flow
// ---------------------------------------------------------------------------

type ParentMode =
  | 'login'
  | 'forgot'
  | 'forgot-otp'
  | 'change'
  | 'reset-done'
  | 'device-limit'

const MOBILE_RE = /^[6-9]\d{9}$/

/** Parent password policy with translated messages (mirrors the server). */
function validateNewPasswordT(t: TFunction, password: string): string | null {
  return validateNewPassword(password, {
    tooShort: t('pw.errLen'),
    needLetter: t('pw.errLetter'),
    needNumber: t('pw.errNumber'),
  })
}

/** Server error message passthrough, with a translated generic fallback. */
function toMessageT(t: TFunction, err: unknown): string {
  return authErrorMessage(err, t('generic.error'))
}

/** Accessible names for the show/hide toggle inside a password field. */
function passwordToggleLabels(t: TFunction) {
  return { showLabel: t('a11y.showPassword'), hideLabel: t('a11y.hidePassword') }
}

/** The device-limit picker's copy, translated (the kit itself never calls t). */
function deviceLimitStringsT(t: TFunction): DeviceLimitPickerStrings {
  const when = (iso: string) => formatRelativeTime(iso, i18n.language)
  return {
    title: t('devices.limitTitle'),
    description: (signedIn, limit) =>
      t('devices.limitDesc', { count: limit, n: signedIn }),
    lastActive: (iso) => t('devices.lastActive', { when: when(iso) }),
    signedIn: (iso) => t('devices.signedIn', { when: when(iso) }),
    submit: (count) => t('devices.submit', { count }),
    selectPrompt: t('devices.selectPrompt'),
    submitting: t('common.signingIn'),
    raceNotice: t('devices.raceNotice'),
    back: t('common.backToSignIn'),
  }
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
  // A login paused at the device limit. The challenge token is a bearer
  // credential, so it lives here in component state only — never storage or
  // the URL; a reload simply means signing in again.
  const [challenge, setChallenge] = useState<DeviceLimitChallenge | null>(null)
  const [deviceError, setDeviceError] = useState<string | null>(null)
  const [raced, setRaced] = useState(false)
  // Shown on the sign-in form when the picker hands back (challenge expired).
  const [loginError, setLoginError] = useState<string | null>(null)

  function handleLoggedIn(result: GuardianLoginResult) {
    if (result.mustChangePassword) {
      setPendingLogin(result)
      setMode('change')
    } else {
      signIn(result)
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
        () => parentCompleteDeviceLimit(challenge.challengeToken, sessionIds),
        t('common.signingIn'),
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
        backToLogin(t('devices.challengeExpired'))
      } else {
        setRaced(false)
        setDeviceError(toMessageT(t, err))
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
        strings={deviceLimitStringsT(t)}
      />
    )
  }

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
      <div className="space-y-4">
        <AuthHeading
          align="center"
          title={t('done.title')}
          description={t('done.desc')}
        />
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

  // The welcome heading and the help footer belong to the sign-in step only.
  // They used to sit in the page shell and so were rendered above every panel,
  // stacking a second heading on top of "Reset your password" and the rest.
  return (
    <div className="space-y-6">
      <AuthHeading
        eyebrow={t('loginChrome.eyebrow')}
        title={t('loginChrome.title')}
        description={t('loginChrome.subtitle')}
      />

      <ParentLoginForm
        initialError={loginError}
        onForgot={() => setMode('forgot')}
        onLoggedIn={handleLoggedIn}
        onDeviceLimit={handleDeviceLimit}
      />

      <p className="text-center text-xs text-muted-foreground">
        {t('loginChrome.needHelp')}{' '}
        <a href="#" className="font-medium text-foreground hover:underline">
          {t('loginChrome.contact')}
        </a>
      </p>
    </div>
  )
}

function ParentLoginForm({
  initialError,
  onForgot,
  onLoggedIn,
  onDeviceLimit,
}: {
  initialError: string | null
  onForgot: () => void
  onLoggedIn: (result: GuardianLoginResult) => void
  /** Every device slot is taken — hand over to the picker. */
  onDeviceLimit: (payload: DeviceLimitPayload) => void
}) {
  const { t } = useTranslation()
  const [mobile, setMobile] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(initialError)
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
      setSubmitting(false)
      if (isDeviceLimit(err)) onDeviceLimit(err.data)
      else setError(toMessageT(t, err))
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      {error && <FormError message={error} />}

      <div className="space-y-1.5">
        <Label htmlFor="parent-mobile">{t('login.mobileLabel')}</Label>
        <Input
          id="parent-mobile"
          name="parent-mobile"
          inputSize="lg"
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
        {...passwordToggleLabels(t)}
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
    <form className="space-y-4" onSubmit={handleSubmit}>
      <AuthHeading title={t('change.title')} description={t('change.desc')} />

      {error && <FormError message={error} />}

      <PasswordInput
        id="parent-current-password"
        label={t('change.temp')}
        value={currentPassword}
        onChange={setCurrentPassword}
        autoComplete="current-password"
        autoFocus
        {...passwordToggleLabels(t)}
      />
      <PasswordInput
        id="parent-new-password"
        label={t('change.newPw')}
        value={newPassword}
        onChange={setNewPassword}
        autoComplete="new-password"
        {...passwordToggleLabels(t)}
      />
      <PasswordInput
        id="parent-confirm-password"
        label={t('change.confirm')}
        value={confirmPassword}
        onChange={setConfirmPassword}
        autoComplete="new-password"
        {...passwordToggleLabels(t)}
      />

      <p className="text-xs text-muted-foreground">{t('pw.hint')}</p>

      <div className="space-y-3">
        <Button type="submit" size="lg" className="w-full" disabled={submitting}>
          {submitting ? t('common.saving') : t('change.save')}
        </Button>
        <AuthTextButton onClick={onCancel}>{t('change.cancel')}</AuthTextButton>
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
      await withGlobalLoader(
        () => parentRequestOtp(trimmed),
        t('common.sending'),
      )
      onSent(trimmed)
    } catch (err) {
      setError(toMessageT(t, err))
      setSubmitting(false)
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <AuthHeading title={t('forgot.title')} description={t('forgot.desc')} />

      {error && <FormError message={error} />}

      <div className="space-y-1.5">
        <Label htmlFor="parent-forgot-mobile">{t('login.mobileLabel')}</Label>
        <Input
          id="parent-forgot-mobile"
          name="parent-forgot-mobile"
          inputSize="lg"
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
        <AuthTextButton onClick={onBack}>
          {t('common.backToSignIn')}
        </AuthTextButton>
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
    <form className="space-y-4" onSubmit={handleSubmit}>
      <AuthHeading
        title={t('otp.title')}
        description={t('otp.desc', { mobile })}
      />

      {error && <FormError message={error} />}

      <div className="space-y-1.5">
        <Label htmlFor="parent-otp">{t('otp.codeLabel')}</Label>
        <Input
          id="parent-otp"
          name="parent-otp"
          inputSize="lg"
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
        {...passwordToggleLabels(t)}
      />
      <PasswordInput
        id="parent-otp-confirm-password"
        label={t('otp.confirm')}
        value={confirmPassword}
        onChange={setConfirmPassword}
        autoComplete="new-password"
        {...passwordToggleLabels(t)}
      />

      <p className="text-xs text-muted-foreground">{t('pw.hint')}</p>

      <div className="space-y-3">
        <Button type="submit" size="lg" className="w-full" disabled={submitting}>
          {submitting ? t('common.saving') : t('otp.set')}
        </Button>
        <AuthTextButton onClick={onBack}>
          {t('common.backToSignIn')}
        </AuthTextButton>
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
