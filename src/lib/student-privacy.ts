import { ApiError, apiFetch } from './api'
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  storeTokens,
  type AuthTokens,
} from './student-auth'

/**
 * Profile-privacy settings — which personal fields the signed-in student hides
 * from peers (the classmate profile shown in chat). Mirrors nucleus-server
 * /student/profile/privacy. Hiding `birthday` also drops the student from
 * classmates' birthday lists.
 */

/** Personal fields a student may hide. Order drives the settings screen. */
export const HIDEABLE_FIELDS = [
  { key: 'photo', label: 'Photo', description: 'Your profile photo' },
  { key: 'email', label: 'Email', description: 'Your email address' },
  {
    key: 'mobile',
    label: 'Mobile',
    description: 'Your mobile number — hidden by default',
  },
  { key: 'birthday', label: 'Birthday', description: 'Your birthday' },
  { key: 'blood_group', label: 'Blood group', description: 'Your blood group' },
  { key: 'gender', label: 'Gender', description: 'Your gender' },
] as const

export type HideableField = (typeof HIDEABLE_FIELDS)[number]['key']

export interface ProfilePrivacy {
  /** Personal fields hidden from peers. Empty = everything visible. */
  hidden: HideableField[]
}

export function fetchProfilePrivacy(): Promise<ProfilePrivacy> {
  return withAuth((token) =>
    apiFetch<ProfilePrivacy>('/student/profile/privacy', { token }),
  )
}

export function updateProfilePrivacy(
  hidden: HideableField[],
): Promise<ProfilePrivacy> {
  return withAuth((token) =>
    apiFetch<ProfilePrivacy>('/student/profile/privacy', {
      method: 'PATCH',
      token,
      body: { hidden },
    }),
  )
}

// Local mirror of student-auth's withAuth: run an authenticated call, refresh
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
