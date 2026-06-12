import { ApiError, apiFetch } from './api'

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

// --- API calls ------------------------------------------------------------

export function studentLogin(
  studentId: string,
  password: string,
): Promise<LoginResult> {
  return apiFetch<LoginResult>('/student/auth/login', {
    method: 'POST',
    body: { student_id: studentId, password },
  })
}

export function studentLoginWithGoogle(idToken: string): Promise<LoginResult> {
  return apiFetch<LoginResult>('/student/auth/login/google', {
    method: 'POST',
    body: { idToken },
  })
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

export async function studentLogout(): Promise<void> {
  const token = getAccessToken()
  if (token) {
    try {
      await apiFetch('/student/auth/logout', { method: 'POST', token })
    } catch {
      // Ignore — local tokens are cleared regardless.
    }
  }
  clearTokens()
}

// --- authenticated request helper -----------------------------------------

/**
 * Runs an authenticated call with the stored access token. On a 401 it tries a
 * single refresh-and-retry; if that fails the session is cleared and a 401
 * ApiError is thrown so callers can route back to the login screen.
 */
export async function withAuth<T>(
  call: (token: string) => Promise<T>,
): Promise<T> {
  const token = getAccessToken()
  if (!token) {
    throw new ApiError(401, 'Your session has ended. Please sign in again.')
  }
  try {
    return await call(token)
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      const refreshed = await tryRefresh()
      if (refreshed) return call(refreshed)
      clearTokens()
      throw new ApiError(401, 'Your session has expired. Please sign in again.')
    }
    throw err
  }
}

async function tryRefresh(): Promise<string | null> {
  const refreshToken = getRefreshToken()
  if (!refreshToken) return null
  try {
    const tokens = await apiFetch<AuthTokens>('/student/auth/refresh', {
      method: 'POST',
      body: { refreshToken },
    })
    storeTokens(tokens)
    return tokens.accessToken
  } catch {
    return null
  }
}
