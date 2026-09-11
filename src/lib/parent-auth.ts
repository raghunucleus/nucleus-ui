import { ApiError, apiFetch, isTransientApiError } from './api'
import { getDeviceId } from './device-id'
import type { SessionRow } from './sessions'

// ---------------------------------------------------------------------------
// Parent (guardian) auth — mirrors student-auth.ts but for the /guardian/* API.
// A guardian signs in with their mobile number + password, then picks one of
// their linked children; every data request is scoped to that child server-side
// by the GuardianLinkGuard. Tokens + the selected child id live in localStorage
// under a `nucleus.parent.*` namespace, separate from the student session.
// ---------------------------------------------------------------------------

const ACCESS_TOKEN_KEY = 'nucleus.parent.accessToken'
const REFRESH_TOKEN_KEY = 'nucleus.parent.refreshToken'
const SELECTED_STUDENT_KEY = 'nucleus.parent.selectedStudentId'

export interface GuardianSummary {
  mobile_number: string
  display_name: string
}

export interface LinkedStudent {
  id: number
  student_id: string
  display_name: string
  relationship: string
  is_primary: boolean
  is_active: boolean
  programme: { id: number; name: string; code: string } | null
  admission_year: { id: number; year: number; display_year: string } | null
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
}

export interface GuardianLoginResult extends AuthTokens {
  mustChangePassword: boolean
  guardian: GuardianSummary
  students: LinkedStudent[]
}

/** Shape of GET /guardian/auth/me — guardian identity + linked children. */
export interface GuardianProfile {
  mobile_number: string
  display_name: string
  students: LinkedStudent[]
}

// --- token storage ---------------------------------------------------------

export function storeParentTokens(tokens: AuthTokens): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken)
  localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken)
}

export function clearParentTokens(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
}

export function getParentAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY)
}

export function getParentRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY)
}

/** Optimistic "is the guardian signed in" — true when both tokens are stored. */
export function hasStoredParentSession(): boolean {
  return !!getParentAccessToken() && !!getParentRefreshToken()
}

// --- selected child --------------------------------------------------------

export function getSelectedStudentId(): number | null {
  const raw = localStorage.getItem(SELECTED_STUDENT_KEY)
  if (!raw) return null
  const id = Number(raw)
  return Number.isFinite(id) ? id : null
}

export function setSelectedStudentId(studentId: number): void {
  localStorage.setItem(SELECTED_STUDENT_KEY, String(studentId))
}

export function clearSelectedStudentId(): void {
  localStorage.removeItem(SELECTED_STUDENT_KEY)
}

// --- session-expired handler -----------------------------------------------

// When an authenticated request finds the session unrecoverable (access token
// expired and refresh failed), we notify the store so App.tsx falls back to the
// login screen. Registered once by the parent auth store at module load.
let onSessionExpired: (() => void) | null = null

export function setParentSessionExpiredHandler(handler: () => void): void {
  onSessionExpired = handler
}

/** Clear the local session + selection and notify the store (auto-logout). */
function expireParentSession(): void {
  clearParentTokens()
  clearSelectedStudentId()
  onSessionExpired?.()
}

// --- API calls -------------------------------------------------------------

/**
 * Carries this browser's persistent `device_id`, so signing in again here
 * replaces this device's session instead of taking another slot toward the
 * device limit. `device_name` is omitted: the server reads the User-Agent.
 */
export function parentLogin(
  mobileNumber: string,
  password: string,
): Promise<GuardianLoginResult> {
  return apiFetch<GuardianLoginResult>('/guardian/auth/login', {
    method: 'POST',
    body: { mobile_number: mobileNumber, password, device_id: getDeviceId() },
  })
}

/**
 * Finish a login the device limit paused (409 `DEVICE_LIMIT`): sign the chosen
 * devices out, then complete the sign-in. Resolves with the same body as
 * {@link parentLogin} (guardian + linked students), so the caller feeds it into
 * the same success path (forced password change, child selection). Rejects
 * with another DEVICE_LIMIT (same challenge, fresh list) if a racing sign-in
 * took the freed slot, and a 401 once the 5-minute challenge has expired.
 */
export function parentCompleteDeviceLimit(
  challengeToken: string,
  sessionIds: string[],
): Promise<GuardianLoginResult> {
  return apiFetch<GuardianLoginResult>('/guardian/auth/login/device-limit', {
    method: 'POST',
    body: { challengeToken, sessionIds, device_id: getDeviceId() },
  })
}

/** Every device this guardian is signed in on, most recently active first. */
export function parentListSessions(): Promise<SessionRow[]> {
  return withParentAuth((token) =>
    apiFetch<SessionRow[]>('/guardian/sessions', { token }),
  )
}

/**
 * Sign one of the guardian's devices out — immediate server-side. Revoking the
 * `current` row ends this session; the caller should then sign out locally.
 */
export function parentRevokeSession(sessionId: string): Promise<void> {
  return withParentAuth((token) =>
    apiFetch<void>(`/guardian/sessions/${encodeURIComponent(sessionId)}`, {
      method: 'DELETE',
      token,
    }),
  )
}

export function parentRequestOtp(
  mobileNumber: string,
): Promise<{ message: string }> {
  return apiFetch<{ message: string }>('/guardian/auth/request-otp', {
    method: 'POST',
    body: { mobile_number: mobileNumber },
  })
}

export function parentVerifyOtp(
  mobileNumber: string,
  otp: string,
  newPassword: string,
): Promise<{ message: string }> {
  return apiFetch<{ message: string }>('/guardian/auth/verify-otp', {
    method: 'POST',
    body: { mobile_number: mobileNumber, otp, newPassword },
  })
}

export function parentChangePassword(
  accessToken: string,
  currentPassword: string,
  newPassword: string,
): Promise<AuthTokens> {
  return apiFetch<AuthTokens>('/guardian/auth/change-password', {
    method: 'POST',
    token: accessToken,
    body: { currentPassword, newPassword },
  })
}

export function parentMe(): Promise<GuardianProfile> {
  return withParentAuth((token) =>
    apiFetch<GuardianProfile>('/guardian/auth/me', { token }),
  )
}

export function parentListStudents(): Promise<LinkedStudent[]> {
  return withParentAuth((token) =>
    apiFetch<LinkedStudent[]>('/guardian/students', { token }),
  )
}

/**
 * Sign THIS device out (other devices stay signed in). Logout needs a valid
 * access token, so it goes through the refresh-aware wrapper — an expired
 * access token must still free this device's slot server-side. Local tokens
 * and the child selection are cleared whatever happens.
 */
export async function parentLogout(): Promise<void> {
  if (getParentAccessToken()) {
    try {
      await withParentAuth((token) =>
        apiFetch('/guardian/auth/logout', { method: 'POST', token }),
      )
    } catch {
      // Ignore — local tokens are cleared regardless.
    }
  }
  clearParentTokens()
  clearSelectedStudentId()
}

// --- authenticated request helper ------------------------------------------

/**
 * Runs an authenticated guardian call with the stored access token. On a 401 it
 * tries a single refresh-and-retry; if the refresh is rejected the session is
 * cleared, the expired handler fires (so the portal drops to login), and a 401
 * ApiError is rethrown. A refresh that fails transiently (offline, 5xx)
 * rethrows that error instead and leaves the session alone. Mirrors
 * student-auth.withAuth.
 */
export async function withParentAuth<T>(
  call: (token: string) => Promise<T>,
): Promise<T> {
  const token = getParentAccessToken()
  if (!token) {
    throw new ApiError(401, 'Your session has ended. Please sign in again.')
  }
  try {
    return await call(token)
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      const refreshed = await tryRefresh()
      if (refreshed) return call(refreshed)
      expireParentSession()
      throw new ApiError(401, 'Your session has expired. Please sign in again.')
    }
    throw err
  }
}

/** Dedupe concurrent refreshes so a burst of 401s triggers a single /refresh. */
let refreshInFlight: Promise<string | null> | null = null

/**
 * Swap the refresh token for a fresh access token: the new token, or null when
 * the session is unrecoverable (no refresh token, or the server rejected it).
 * Rejects on a transient failure (see `isTransientApiError`). Parallel callers
 * coalesce onto one in-flight call — refresh tokens rotate, so N concurrent
 * refreshes from a burst of 401s would churn the session family.
 */
function tryRefresh(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight
  const refreshToken = getParentRefreshToken()
  if (!refreshToken) return Promise.resolve(null)
  refreshInFlight = apiFetch<AuthTokens>('/guardian/auth/refresh', {
    method: 'POST',
    body: { refreshToken },
  })
    .then((tokens) => {
      // Signed out while the refresh was in flight: don't resurrect the
      // session in storage.
      if (!getParentRefreshToken()) return null
      storeParentTokens(tokens)
      return tokens.accessToken
    })
    .catch((err: unknown) => {
      if (isTransientApiError(err)) throw err
      return null
    })
    .finally(() => {
      refreshInFlight = null
    })
  return refreshInFlight
}
