import { ApiError, apiFetch } from './api'
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  storeTokens,
  type AuthTokens,
} from './student-auth'

/** Mirrors the nucleus-server GET /student/id-card response. */
export interface IdCard {
  student: {
    display_name: string
    student_id: string
    gender: string
    dob: string
    blood_group: string | null
    mobile_number: string
    email: string
    /** Short-lived presigned URL, or null when there's no photo / it's missing. */
    photo_url: string | null
  }
  programme: { name: string; code: string } | null
  department: { short_name: string } | null
  admission_year: { display_year: string } | null
  semester: { roman_format: string; sem_number: number } | null
  section: { code: string } | null
  institution: {
    name: string
    short_name: string | null
    address_line1: string | null
    address_line2: string | null
    city: string | null
    state: string | null
    pincode: string | null
    logo_url: string | null
    affiliation_code: string | null
    aicte_code: string | null
    naac_grade: string | null
    card_footer_note: string | null
  }
  /** Signed JWT to render as the QR payload. */
  qr_token: string
  valid_until: string | null
}

export function studentIdCard(): Promise<IdCard> {
  return withAuth((token) => apiFetch<IdCard>('/student/id-card', { token }))
}

// Local mirror of student-auth's (non-exported) withAuth: run an authenticated
// call, refresh once on 401, otherwise clear the session and surface a 401.
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
