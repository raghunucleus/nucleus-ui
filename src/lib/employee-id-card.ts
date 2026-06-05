import { apiFetch } from './api'
import { withEmployeeAuth } from './employee-auth'

/** Mirrors the nucleus-server GET /employee/id-card response. */
export interface EmployeeIdCard {
  employee: {
    emp_display_name: string
    emp_code: string
    gender: string
    dob: string | null
    mobile_number: string
    country_code: string
    email: string
    /** Always null today (no employee photo upload yet); clients show initials. */
    photo_url: string | null
  }
  designation: { name: string; code: string } | null
  department: { name: string; code: string } | null
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
  /** Always null — the employee card itself never expires. */
  valid_until: null
}

/** A freshly issued security pass — what the client polls to rotate the QR. */
export interface SecurityPass {
  qr_token: string
  ttl_seconds: number
  expires_at: string
}

export function employeeIdCard(): Promise<EmployeeIdCard> {
  return withEmployeeAuth((token) =>
    apiFetch<EmployeeIdCard>('/employee/id-card', { token }),
  )
}

/** Issue a fresh single-use security pass to refresh the ID-card QR. */
export function employeeIdCardPass(): Promise<SecurityPass> {
  return withEmployeeAuth((token) =>
    apiFetch<SecurityPass>('/employee/id-card/pass', { token }),
  )
}
