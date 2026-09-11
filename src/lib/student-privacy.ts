import { apiFetch } from './api'
import { withAuth } from './student-auth'

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
