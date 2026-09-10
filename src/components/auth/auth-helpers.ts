import { ApiError } from '@/lib/api'

/** Translatable copy for {@link validateNewPassword}. */
export type PasswordPolicyMessages = {
  tooShort: string
  needLetter: string
  needNumber: string
}

const DEFAULT_POLICY_MESSAGES: PasswordPolicyMessages = {
  tooShort: 'Password must be at least 8 characters.',
  needLetter: 'Password must contain at least one letter.',
  needNumber: 'Password must contain at least one number.',
}

/**
 * Mirrors the server-side `strongPasswordSchema` so people get instant
 * feedback instead of a round trip. Returns the first failure, or null.
 *
 * Messages are injected rather than looked up, so this stays free of i18n —
 * the parent portal passes its translated strings.
 */
export function validateNewPassword(
  password: string,
  messages: Partial<PasswordPolicyMessages> = {},
): string | null {
  const copy = { ...DEFAULT_POLICY_MESSAGES, ...messages }
  if (password.length < 8) return copy.tooShort
  if (!/[A-Za-z]/.test(password)) return copy.needLetter
  if (!/\d/.test(password)) return copy.needNumber
  return null
}

/**
 * Turns whatever a failed auth call threw into something worth showing.
 * `ApiError` carries the server's own message, which is the useful one.
 */
export function authErrorMessage(
  err: unknown,
  fallback = 'Something went wrong. Please try again.',
): string {
  if (err instanceof ApiError) return err.message
  if (err instanceof Error && err.message) return err.message
  return fallback
}
