import { ApiError, apiFetch } from './api'

const ACCESS_TOKEN_KEY = 'nucleus.employee.accessToken'
const REFRESH_TOKEN_KEY = 'nucleus.employee.refreshToken'

export interface EmployeeSummary {
  id: number
  emp_code: string
  emp_display_name: string
  email: string
}

export interface EmployeeAuthTokens {
  accessToken: string
  refreshToken: string
}

export interface EmployeeLoginResult extends EmployeeAuthTokens {
  mustChangePassword: boolean
  employee: EmployeeSummary
}

/** Full profile returned by GET /employee/auth/me. */
export interface EmployeeProfile extends EmployeeSummary {
  gender: string
  mobile_number: string
  country_code: string
  is_active: boolean
  department: { id: number; name: string; code: string } | null
  designation: { id: number; name: string; code: string } | null
}

// --- token storage --------------------------------------------------------

export function storeEmployeeTokens(tokens: EmployeeAuthTokens): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken)
  localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken)
}

export function clearEmployeeTokens(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
}

export function getEmployeeAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY)
}

export function getEmployeeRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY)
}

export function hasStoredEmployeeSession(): boolean {
  return !!getEmployeeAccessToken() && !!getEmployeeRefreshToken()
}

// --- API calls ------------------------------------------------------------

export function employeeLogin(
  empCode: string,
  password: string,
): Promise<EmployeeLoginResult> {
  return apiFetch<EmployeeLoginResult>('/employee/auth/login', {
    method: 'POST',
    body: { emp_code: empCode, password },
  })
}

export function employeeLoginWithGoogle(
  idToken: string,
): Promise<EmployeeLoginResult> {
  return apiFetch<EmployeeLoginResult>('/employee/auth/login/google', {
    method: 'POST',
    body: { idToken },
  })
}

export function employeeChangePassword(
  accessToken: string,
  currentPassword: string,
  newPassword: string,
): Promise<EmployeeAuthTokens> {
  return apiFetch<EmployeeAuthTokens>('/employee/auth/change-password', {
    method: 'POST',
    token: accessToken,
    body: { currentPassword, newPassword },
  })
}

export function employeeForgotPassword(
  identifier: string,
): Promise<{ message: string }> {
  return apiFetch<{ message: string }>('/employee/auth/forgot-password', {
    method: 'POST',
    body: { identifier },
  })
}

export function employeeResetPassword(
  token: string,
  newPassword: string,
): Promise<{ message: string }> {
  return apiFetch<{ message: string }>('/employee/auth/reset-password', {
    method: 'POST',
    body: { token, newPassword },
  })
}

export function employeeMe(): Promise<EmployeeProfile> {
  return withEmployeeAuth((token) =>
    apiFetch<EmployeeProfile>('/employee/auth/me', { token }),
  )
}

export async function employeeLogout(): Promise<void> {
  const token = getEmployeeAccessToken()
  if (token) {
    try {
      await apiFetch('/employee/auth/logout', { method: 'POST', token })
    } catch {
      // Ignore — local tokens are cleared regardless.
    }
  }
  clearEmployeeTokens()
}

// --- authenticated request helper -----------------------------------------

/**
 * Fired when an authenticated request finds the session unrecoverable — the
 * access token is expired/invalid AND a refresh attempt failed (refresh token
 * also dead). The auth store registers a handler here to flip `authed` to
 * false so the portal drops back to the login screen (auto-logout). Wired via
 * a callback rather than importing the store to avoid a lib→store cycle.
 */
let onSessionExpired: (() => void) | null = null

export function setEmployeeSessionExpiredHandler(
  handler: (() => void) | null,
): void {
  onSessionExpired = handler
}

/**
 * Runs an authenticated employee call with the stored access token. On a 401
 * it tries a single refresh-and-retry; if that fails the session is cleared,
 * the session-expired handler fires (auto-logout), and a 401 ApiError is
 * thrown so callers can route back to the login screen.
 */
export async function withEmployeeAuth<T>(
  call: (token: string) => Promise<T>,
): Promise<T> {
  const token = getEmployeeAccessToken()
  if (!token) {
    clearEmployeeTokens()
    onSessionExpired?.()
    throw new ApiError(401, 'Your session has ended. Please sign in again.')
  }
  try {
    return await call(token)
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      const refreshed = await tryRefresh()
      if (refreshed) return call(refreshed)
      clearEmployeeTokens()
      onSessionExpired?.()
      throw new ApiError(401, 'Your session has expired. Please sign in again.')
    }
    throw err
  }
}

/**
 * Swap the refresh token for a fresh access token, or null if that fails.
 * Exported for the notification socket, which authenticates once at the
 * handshake rather than per-request and so can't go through `withEmployeeAuth`.
 * Shares the same in-flight dedupe (see below) — a socket reconnect racing an
 * HTTP 401 must not burn the token family.
 */
export function refreshEmployeeAccessToken(): Promise<string | null> {
  return tryRefresh()
}

/** Dedupe concurrent refreshes so a burst of 401s triggers a single /refresh. */
let refreshInFlight: Promise<string | null> | null = null

function tryRefresh(): Promise<string | null> {
  // Coalesce parallel callers onto one in-flight refresh. The server rotates
  // refresh tokens single-use, so two concurrent /refresh calls would make the
  // second look like a replay and burn the whole session family.
  if (refreshInFlight) return refreshInFlight
  const refreshToken = getEmployeeRefreshToken()
  if (!refreshToken) return Promise.resolve(null)
  refreshInFlight = apiFetch<EmployeeAuthTokens>('/employee/auth/refresh', {
    method: 'POST',
    body: { refreshToken },
  })
    .then((tokens) => {
      storeEmployeeTokens(tokens)
      return tokens.accessToken
    })
    .catch(() => null)
    .finally(() => {
      refreshInFlight = null
    })
  return refreshInFlight
}
