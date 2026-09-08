import { apiFetch } from '@/lib/api'

/**
 * Account invitations — the "set your password" link a new employee or student
 * receives by email.
 *
 * One module rather than a pair in `student-auth.ts` / `employee-auth.ts`: the
 * endpoint is genuinely audience-agnostic (a single route serves both portals
 * and reports which audience the token belongs to), so splitting it would
 * imply two routes that do not exist.
 */

export type InviteSubjectType = 'employee' | 'student'

export type InviteInfo = {
  subject_type: InviteSubjectType
  display_name: string
  /** emp_code or student_id — what they will type to sign in. */
  login_identifier: string
  email_masked: string
  expires_at: string
}

export type InviteCheck =
  | ({ valid: true } & InviteInfo)
  | { valid: false; reason: 'expired' | 'invalid' }

/**
 * Never rejects for a bad token — an expired invitation comes back as
 * `{ valid: false, reason: 'expired' }` so the screen can say so precisely.
 * Only a transport failure throws.
 */
export function validateInvite(token: string): Promise<InviteCheck> {
  return apiFetch<InviteCheck>('/account-invite/validate', {
    method: 'POST',
    body: { token },
  })
}

export function acceptInvite(
  token: string,
  newPassword: string,
): Promise<{ message: string; subject_type: InviteSubjectType }> {
  return apiFetch<{ message: string; subject_type: InviteSubjectType }>(
    '/account-invite/accept',
    { method: 'POST', body: { token, newPassword } },
  )
}
