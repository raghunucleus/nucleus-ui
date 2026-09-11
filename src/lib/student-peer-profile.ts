import { apiFetch } from './api'
import { withAuth } from './student-auth'

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
  // Personal fields are null when the owner hid them (see `hidden_fields`) OR
  // when simply unset — `hidden_fields` distinguishes the two.
  gender: string | null
  /** Day + month of birth only — the year is never exposed to a peer. */
  birthday: { day: number; month: number } | null
  blood_group: string | null
  mobile_number: string | null
  email: string | null
  /** Short-lived presigned URL, or null when there's no photo / it's missing / hidden. */
  photo_url: string | null
  programme: { name: string; code: string } | null
  department: { short_name: string } | null
  admission_year: { display_year: string } | null
  semester: { roman_format: string; sem_number: number } | null
  section: { code: string } | null
  /** Personal field keys the owner hid — render these as locked "Hidden" rows. */
  hidden_fields: string[]
}

/** A classmate's limited profile (groupmates only; 403/404 otherwise). */
export function studentPeerProfile(studentId: number): Promise<PeerProfile> {
  return withAuth((token) =>
    apiFetch<PeerProfile>(`/student/chat/participants/${studentId}`, { token }),
  )
}
