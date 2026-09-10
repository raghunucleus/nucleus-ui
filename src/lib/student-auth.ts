import { ApiError, apiFetch, isTransientApiError } from './api'
import { getDeviceId } from './device-id'
import type { SessionRow } from './sessions'

const ACCESS_TOKEN_KEY = 'nucleus.student.accessToken'
const REFRESH_TOKEN_KEY = 'nucleus.student.refreshToken'

export interface StudentSummary {
  id: number
  student_id: string
  display_name: string
  email: string
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
}

export interface LoginResult extends AuthTokens {
  mustChangePassword: boolean
  student: StudentSummary
}

/** Full profile returned by GET /student/auth/me. */
export interface StudentProfile extends StudentSummary {
  gender: string
  dob: string
  blood_group: string | null
  mobile_number: string
  is_active: boolean
  programme: { id: number; name: string; code: string } | null
  admission_year: { id: number; year: number; display_year: string } | null
  /** Presigned, short-lived URL of the profile photo; null when unset. */
  photo_url: string | null
}

// --- token storage --------------------------------------------------------

export function storeTokens(tokens: AuthTokens): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken)
  localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken)
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
}

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY)
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY)
}

/** Optimistic "is the student signed in" — true when both tokens are stored. */
export function hasStoredSession(): boolean {
  return !!getAccessToken() && !!getRefreshToken()
}

/**
 * The signed-in student's id, decoded from the access-token JWT (`sub`). Used
 * by the realtime layer to ignore the student's own messages echoed back to
 * their other devices. Returns null if there's no token or it can't be parsed
 * — callers treat that as "unknown", which only loosens a notification filter.
 */
export function getStudentId(): number | null {
  const token = getAccessToken()
  if (!token) return null
  try {
    const [, payload] = token.split('.')
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    const sub = (JSON.parse(json) as { sub?: unknown }).sub
    const id = Number(sub)
    return Number.isFinite(id) ? id : null
  } catch {
    return null
  }
}

// --- session-expired handler ----------------------------------------------

/**
 * Fired when an authenticated request finds the session unrecoverable — no
 * token, or the access token was rejected AND the refresh was too (expired,
 * or this device was signed out from another one). The auth store registers
 * a handler here that signs out, so a failed refresh anywhere — any page, the
 * chat or notification socket — drops the student back to the login screen
 * the same way. A callback rather than a store import avoids a lib→store cycle.
 */
let onSessionExpired: (() => void) | null = null

export function setStudentSessionExpiredHandler(
  handler: (() => void) | null,
): void {
  onSessionExpired = handler
}

/** Clear the local session and notify the auth store (auto-logout). */
export function expireStudentSession(): void {
  clearTokens()
  onSessionExpired?.()
}

// --- API calls ------------------------------------------------------------

// Every login carries this browser's persistent `device_id`, so signing in
// again here replaces this device's session instead of taking a second slot
// toward the device limit. `device_name` is omitted on purpose: the server
// derives it from the User-Agent.

export function studentLogin(
  studentId: string,
  password: string,
): Promise<LoginResult> {
  return apiFetch<LoginResult>('/student/auth/login', {
    method: 'POST',
    body: { student_id: studentId, password, device_id: getDeviceId() },
  })
}

export function studentLoginWithGoogle(idToken: string): Promise<LoginResult> {
  return apiFetch<LoginResult>('/student/auth/login/google', {
    method: 'POST',
    body: { idToken, device_id: getDeviceId() },
  })
}

/**
 * Finish a login the device limit paused (409 `DEVICE_LIMIT`): sign the chosen
 * devices out, then complete the sign-in. Resolves with the same body as
 * {@link studentLogin}, so the caller feeds it into the same success path
 * (token storage, forced password change). Rejects with another DEVICE_LIMIT
 * (same challenge, fresh list) if a racing sign-in took the freed slot, and a
 * 401 once the 5-minute challenge has expired.
 */
export function studentCompleteDeviceLimit(
  challengeToken: string,
  sessionIds: string[],
): Promise<LoginResult> {
  return apiFetch<LoginResult>('/student/auth/login/device-limit', {
    method: 'POST',
    body: { challengeToken, sessionIds, device_id: getDeviceId() },
  })
}

/** Every device this student is signed in on, most recently active first. */
export function studentListSessions(): Promise<SessionRow[]> {
  return withAuth((token) =>
    apiFetch<SessionRow[]>('/student/sessions', { token }),
  )
}

/**
 * Sign one of the student's devices out — immediate server-side (its tokens
 * die and its sockets are cut). Revoking the `current` row ends this session;
 * the caller should then sign out locally.
 */
export function studentRevokeSession(sessionId: string): Promise<void> {
  return withAuth((token) =>
    apiFetch<void>(`/student/sessions/${encodeURIComponent(sessionId)}`, {
      method: 'DELETE',
      token,
    }),
  )
}

export function studentChangePassword(
  accessToken: string,
  currentPassword: string,
  newPassword: string,
): Promise<AuthTokens> {
  return apiFetch<AuthTokens>('/student/auth/change-password', {
    method: 'POST',
    token: accessToken,
    body: { currentPassword, newPassword },
  })
}

export function studentForgotPassword(
  identifier: string,
): Promise<{ message: string }> {
  return apiFetch<{ message: string }>('/student/auth/forgot-password', {
    method: 'POST',
    body: { identifier },
  })
}

export function studentResetPassword(
  token: string,
  newPassword: string,
): Promise<{ message: string }> {
  return apiFetch<{ message: string }>('/student/auth/reset-password', {
    method: 'POST',
    body: { token, newPassword },
  })
}

export function studentMe(): Promise<StudentProfile> {
  return withAuth((token) =>
    apiFetch<StudentProfile>('/student/auth/me', { token }),
  )
}

/**
 * Sign THIS device out (other devices stay signed in). Logout needs a valid
 * access token, so it goes through the refresh-aware wrapper — an expired
 * access token must still free this device's slot server-side. Local tokens
 * are cleared whatever happens.
 */
export async function studentLogout(): Promise<void> {
  if (getAccessToken()) {
    try {
      await withAuth((token) =>
        apiFetch('/student/auth/logout', { method: 'POST', token }),
      )
    } catch {
      // Ignore — local tokens are cleared regardless.
    }
  }
  clearTokens()
}

// --- authenticated request helper -----------------------------------------

/**
 * Runs an authenticated call with the stored access token. On a 401 it tries a
 * single refresh-and-retry; if the refresh is rejected the session is expired
 * (tokens cleared, auth store signs out) and a 401 ApiError is thrown. A
 * refresh that fails transiently (offline, 5xx) rethrows that error instead
 * and leaves the session alone — it may well still be valid.
 *
 * The one student wrapper: every `student-*.ts` module calls this rather than
 * keeping its own copy, so they all share the single-flight refresh below.
 */
export async function withAuth<T>(
  call: (token: string) => Promise<T>,
): Promise<T> {
  const token = getAccessToken()
  if (!token) {
    expireStudentSession()
    throw new ApiError(401, 'Your session has ended. Please sign in again.')
  }
  try {
    return await call(token)
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      const refreshed = await refreshStudentAccessToken()
      if (refreshed) return call(refreshed)
      expireStudentSession()
      throw new ApiError(401, 'Your session has expired. Please sign in again.')
    }
    throw err
  }
}

/** Dedupe concurrent refreshes so a burst of 401s triggers a single /refresh. */
let refreshInFlight: Promise<string | null> | null = null

/**
 * Swap the refresh token for a fresh access token. Resolves the new token, or
 * null when the session is unrecoverable (no refresh token, or the server
 * rejected it — expired, or signed out from another device). Rejects when the
 * refresh couldn't be completed for a transient reason (see
 * `isTransientApiError`), which says nothing about the session.
 *
 * Exported for the chat and notification sockets, which authenticate once at
 * the handshake rather than per request. Parallel callers — a socket
 * reconnect racing a burst of HTTP 401s — coalesce onto one in-flight call:
 * refresh tokens rotate, so N concurrent refreshes would churn the family.
 */
export function refreshStudentAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight
  const refreshToken = getRefreshToken()
  if (!refreshToken) return Promise.resolve(null)
  refreshInFlight = apiFetch<AuthTokens>('/student/auth/refresh', {
    method: 'POST',
    body: { refreshToken },
  })
    .then((tokens) => {
      // Signed out while the refresh was in flight: don't resurrect the
      // session in storage.
      if (!getRefreshToken()) return null
      storeTokens(tokens)
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
