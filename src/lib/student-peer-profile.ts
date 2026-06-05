import { ApiError, apiFetch } from './api'
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  storeTokens,
  type AuthTokens,
} from './student-auth'

/**
 * A classmate's limited profile, shown when the caller taps them in chat.
 * Mirrors the nucleus-server PeerProfile (GET /student/chat/participants/:id).
 * The server only returns this for a student in the caller's own attendance
 * group; the birthday is day/month only (never the birth year).
 */
export interface PeerProfile {
  id: number
  /** Roll number. */
  student_id: string
  display_name: string
  gender: string
  /** Day + month of birth only — the year is never exposed to a peer. */
  birthday: { day: number; month: number } | null
  blood_group: string | null
  mobile_number: string
  email: string
  /** Short-lived presigned URL, or null when there's no photo / it's missing. */
  photo_url: string | null
  programme: { name: string; code: string } | null
  department: { short_name: string } | null
  admission_year: { display_year: string } | null
  semester: { roman_format: string; sem_number: number } | null
  section: { code: string } | null
}

/** A classmate's limited profile (groupmates only; 403/404 otherwise). */
export function studentPeerProfile(studentId: number): Promise<PeerProfile> {
  return withAuth((token) =>
    apiFetch<PeerProfile>(`/student/chat/participants/${studentId}`, { token }),
  )
}

// Local mirror of student-id-card's withAuth: run an authenticated call, refresh
// once on 401, otherwise clear the session and surface a 401.
async function withAuth<T>(call: (token: string) => Promise<T>): Promise<T> {
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
