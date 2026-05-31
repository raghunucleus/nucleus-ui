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
  /** Non-expiring HMAC-signed code to render as the QR. */
  qr_token: string
  /** Always null — employee cards never expire. */
  valid_until: null
}

export function employeeIdCard(): Promise<EmployeeIdCard> {
  return withEmployeeAuth((token) =>
    apiFetch<EmployeeIdCard>('/employee/id-card', { token }),
  )
}
