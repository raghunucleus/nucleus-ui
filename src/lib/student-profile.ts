import { apiFetch, apiUpload } from './api'
import { withAuth } from './student-auth'

/**
 * The extended student profile: the server-driven full profile read
 * (GET /student/profile/me), the lookup masters behind FK dropdowns, the
 * personal-email OTP flow, the direct resume upload and the certificate-file
 * staging endpoint. Everything is scoped to the acting student — the server
 * derives them from the JWT, so no ids travel here.
 */

// --- full profile (GET /student/profile/me) ---------------------------------

export type FieldPolicy =
  | 'APPROVAL'
  | 'AUTO_REQUESTABLE'
  | 'OTP_VERIFY'
  | 'NO_APPROVAL'
  | 'AUTO'
  | 'SYSTEM_LOCKED'
  | 'EXISTING_READONLY'
  | 'ADMIN_ONLY'

export type LookupTable =
  | 'countries'
  | 'states'
  | 'districts'
  | 'entrance_exams'
  | 'industry_certifications'
  | 'school_boards_x'
  | 'school_boards_xii'
  | 'diploma_boards'

export interface ProfileFieldView {
  key: string
  label: string
  policy: FieldPolicy
  kind: string
  fk: LookupTable | null
  /** Belongs to an atomic request unit ('entrance_exam' | 'gap'), if any. */
  unit: string | null
  /** Resolved for THIS student's entry type. */
  mandatory: boolean
  /** The student can change it (via approval/OTP/direct, per `policy`). */
  editable: boolean
  /** Locked by an open approval request (its key or its unit's key). */
  pending: boolean
  value: unknown
  /** Human-readable rendering (FK names, Yes/No); null when unset. */
  display: string | null
}

export interface ProfileGroupView {
  key: string
  label: string
  order: number
  fields: ProfileFieldView[]
}

export interface HeldCertification {
  id: number
  industry_certification_id: number
  name: string
  certificate_file_url: string | null
  created_at: string
}

export interface StudentFullProfile {
  entry_type: number
  entry_type_label: string
  student_id: string
  programme_name: string
  admission_year: number
  admission_year_display: string
  pass_out_year: number | null
  /** Already filtered to the student's entry type — render as-is, in order. */
  groups: ProfileGroupView[]
  certifications: HeldCertification[]
  /** Always present — the fields inside are null until each link is set. */
  resume: ResumeView
  personal_email: { value: string | null; pending_email: string | null }
  completeness: { required: number; filled: number; missing: string[] }
}

export function fetchFullProfile(): Promise<StudentFullProfile> {
  return withAuth((token) =>
    apiFetch<StudentFullProfile>('/student/profile/me', { token }),
  )
}

// --- lookups (student-authed masters behind the FK dropdowns) ----------------

export interface LookupOption {
  id: number
  name: string
  country_id?: number
  state_id?: number
}

function fetchLookup(path: string): Promise<LookupOption[]> {
  return withAuth((token) =>
    apiFetch<LookupOption[]>(`/student/lookups/${path}`, { token }),
  )
}

export function fetchCountries(): Promise<LookupOption[]> {
  return fetchLookup('countries')
}

export function fetchStates(countryId?: number): Promise<LookupOption[]> {
  return fetchLookup(
    countryId != null ? `states?country_id=${countryId}` : 'states',
  )
}

export function fetchDistricts(stateId?: number): Promise<LookupOption[]> {
  return fetchLookup(
    stateId != null ? `districts?state_id=${stateId}` : 'districts',
  )
}

export function fetchEntranceExams(): Promise<LookupOption[]> {
  return fetchLookup('entrance-exams')
}

export function fetchIndustryCertifications(): Promise<LookupOption[]> {
  return fetchLookup('industry-certifications')
}

export function fetchSchoolBoardsX(): Promise<LookupOption[]> {
  return fetchLookup('school-boards-x')
}

export function fetchSchoolBoardsXii(): Promise<LookupOption[]> {
  return fetchLookup('school-boards-xii')
}

export function fetchDiplomaBoards(): Promise<LookupOption[]> {
  return fetchLookup('diploma-boards')
}

// --- personal email (OTP flow) -----------------------------------------------

export interface PersonalEmailOtpPending {
  pending_email: string
  expires_in_minutes: number
}

export interface PersonalEmailState {
  personal_email: string | null
  pending_email: string | null
}

export function requestPersonalEmailOtp(
  email: string,
): Promise<PersonalEmailOtpPending> {
  return withAuth((token) =>
    apiFetch<PersonalEmailOtpPending>(
      '/student/profile/personal-email/request-otp',
      { method: 'POST', body: { email }, token },
    ),
  )
}

export function verifyPersonalEmailOtp(
  code: string,
): Promise<PersonalEmailState> {
  return withAuth((token) =>
    apiFetch<PersonalEmailState>('/student/profile/personal-email/verify-otp', {
      method: 'POST',
      body: { code },
      token,
    }),
  )
}

export function cancelPendingPersonalEmail(): Promise<PersonalEmailState> {
  return withAuth((token) =>
    apiFetch<PersonalEmailState>('/student/profile/personal-email/pending', {
      method: 'DELETE',
      token,
    }),
  )
}

// --- resume (direct — no approval) --------------------------------------------

/**
 * The resume as the placement side sees it: two INDEPENDENT links that recruiters
 * both get — a hosted PDF and an external link. Neither masks the other; if one
 * fails (our storage down, Drive permissions revoked) the other still works.
 * Only opens of the Nucleus (hosted) link are counted — external traffic is
 * invisible to us.
 */
export interface ResumeView {
  /**
   * PERMANENT tokenized link (`<api>/public/resumes/<token>`) — never changes,
   * survives re-uploads; 404s while no file is uploaded. Null only if a file
   * was never uploaded.
   */
  hosted_url: string | null
  /** The raw external link (Drive, portfolio…); null while unset. */
  external_url: string | null
  /** When the hosted file was last (re)uploaded; null while none is uploaded. */
  uploaded_at: string | null
  /** Opens of the Nucleus link only — the external link's traffic isn't counted. */
  download_count: number
  last_downloaded_at: string | null
}

/** PDF only, < 2 MB (validated client-side before calling too). */
export function uploadResume(file: File): Promise<ResumeView> {
  return withAuth((token) => {
    const form = new FormData()
    form.append('file', file, file.name)
    return apiUpload<ResumeView>('/student/profile/resume', form, token, 'PUT')
  })
}

/** Removes the hosted file; the external link (if any) is untouched. */
export function deleteResume(): Promise<void> {
  return withAuth((token) =>
    apiFetch<void>('/student/profile/resume', {
      method: 'DELETE',
      token,
    }),
  )
}

/**
 * Sets the external resume link (https:// only, max 512 chars) — a peer of the
 * hosted PDF, which it leaves in place.
 */
export function setResumeExternalUrl(url: string): Promise<ResumeView> {
  return withAuth((token) =>
    apiFetch<ResumeView>('/student/profile/resume/external-url', {
      method: 'PUT',
      body: { url },
      token,
    }),
  )
}

/** Clears the external link; the hosted file (if any) is untouched. */
export function clearResumeExternalUrl(): Promise<ResumeView> {
  return withAuth((token) =>
    apiFetch<ResumeView>('/student/profile/resume/external-url', {
      method: 'DELETE',
      token,
    }),
  )
}

// --- certificate staging --------------------------------------------------------

/**
 * Stage a certificate file (PDF/JPEG/PNG ≤ 5 MB) for a certifications_add
 * entry — the returned key goes into the profile-update request payload.
 */
export function stageCertificateFile(
  file: File,
): Promise<{ certificate_file_key: string }> {
  return withAuth((token) => {
    const form = new FormData()
    form.append('file', file, file.name)
    return apiUpload<{ certificate_file_key: string }>(
      '/student/profile/certifications/files',
      form,
      token,
    )
  })
}
