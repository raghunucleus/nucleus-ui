/**
 * Shared sign-in kit — composed by the student, employee and parent login
 * pages. Each page owns its own flows and API calls; everything visual lives
 * here so the three screens cannot drift apart again.
 *
 * Nothing in this folder may call `t()` or import `@/lib/i18n`: i18n is
 * parent-only, and pulling it in here would drag i18next into the student and
 * employee login chunks. Pass translated strings in as props instead.
 */
export { AuthShell } from './auth-shell'
export { AuthHeading } from './auth-heading'
export { AuthTextButton } from './auth-text-button'
export { BrandPanel } from './brand-panel'
export {
  DeviceLimitPicker,
  type DeviceLimitPickerStrings,
} from './device-limit-picker'
export { FormError } from './form-error'
export { GoogleSignInButton } from './google-sign-in-button'
export { PasswordHint } from './password-hint'
export { PasswordInput } from './password-input'
export {
  authErrorMessage,
  validateNewPassword,
  type PasswordPolicyMessages,
} from './auth-helpers'
