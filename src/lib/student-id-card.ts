import { apiFetch } from './api'
import { withAuth } from './student-auth'

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
  /** Single-use, short-lived security pass to render as the QR. */
  qr_token: string
  /** Seconds the qr_token is valid for — drives the countdown. */
  ttl_seconds: number
  /** ISO timestamp the qr_token expires at. */
  expires_at: string
  valid_until: string | null
}

/** A freshly issued security pass — what the client polls to rotate the QR. */
export interface SecurityPass {
  qr_token: string
  ttl_seconds: number
  expires_at: string
}

export function studentIdCard(): Promise<IdCard> {
  return withAuth((token) => apiFetch<IdCard>('/student/id-card', { token }))
}

/** Issue a fresh single-use security pass to refresh the ID-card QR. */
export function studentIdCardPass(): Promise<SecurityPass> {
  return withAuth((token) =>
    apiFetch<SecurityPass>('/student/id-card/pass', { token }),
  )
}
