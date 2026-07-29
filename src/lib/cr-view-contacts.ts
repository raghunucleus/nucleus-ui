import type {
  CrViewContact,
  CrViewContactWrite,
} from '@/lib/corporate-relations'

/**
 * Draft state + validation for the repeatable HR-contact rows, shared by the
 * standalone contacts dialog and the full-row edit sheet. A non-component
 * module so the component files stay fast-refresh clean.
 */

/** The same literals the rest of the codebase validates with. */
const MOBILE_RE = /^[6-9]\d{9}$/
const EMAIL_RE = /^\S+@\S+\.\S+$/

export interface ContactDraft {
  /** Server id — absent until the row is saved. */
  id?: number
  /** Stable local key, so React state survives removals. */
  uid: string
  hr_name: string
  hr_designation: string
  hr_mobile: string
  hr_landline: string
  hr_email: string
}

let uidCounter = 0
const nextUid = () => `c${++uidCounter}`

export const emptyContact = (): ContactDraft => ({
  uid: nextUid(),
  hr_name: '',
  hr_designation: '',
  hr_mobile: '',
  hr_landline: '',
  hr_email: '',
})

export const fromSaved = (c: CrViewContact): ContactDraft => ({
  id: c.id,
  uid: nextUid(),
  hr_name: c.hr_name,
  hr_designation: c.hr_designation ?? '',
  hr_mobile: c.hr_mobile ?? '',
  hr_landline: c.hr_landline ?? '',
  hr_email: c.hr_email ?? '',
})

export type ContactErrors = Partial<
  Record<'hr_name' | 'hr_mobile' | 'hr_email', string>
>

/**
 * Per-row rules, memoised by the caller. Mirrors the server schema exactly:
 * name required; mobile a 10-digit Indian number when given; email a valid
 * address when given. The landline is deliberately loose free text (STD codes,
 * extensions), capped by the input's maxLength.
 */
export function validateDrafts(drafts: ContactDraft[]): {
  byUid: Record<string, ContactErrors>
  firstError: string | null
} {
  const byUid: Record<string, ContactErrors> = {}
  let firstError: string | null = null
  for (const d of drafts) {
    const errors: ContactErrors = {}
    if (!d.hr_name.trim()) {
      errors.hr_name = 'Give the contact a name'
    }
    const mobile = d.hr_mobile.trim()
    if (mobile && !MOBILE_RE.test(mobile)) {
      errors.hr_mobile = 'Enter a 10-digit Indian mobile number'
    }
    const email = d.hr_email.trim()
    if (email && (!EMAIL_RE.test(email) || email.length > 255)) {
      errors.hr_email = 'Enter a valid email address'
    }
    if (Object.keys(errors).length > 0) {
      byUid[d.uid] = errors
      firstError ??= Object.values(errors)[0] ?? null
    }
  }
  return { byUid, firstError }
}

/** Rows the user added but never touched are noise, not an error — drop them. */
export function keptDrafts(drafts: ContactDraft[]): ContactDraft[] {
  return drafts.filter(
    (d) =>
      d.hr_name.trim() ||
      d.hr_designation.trim() ||
      d.hr_mobile.trim() ||
      d.hr_landline.trim() ||
      d.hr_email.trim(),
  )
}

/** Drafts → the PATCH payload shape: trimmed, email lowercased, `''` → null. */
export function toWrites(drafts: ContactDraft[]): CrViewContactWrite[] {
  return drafts.map((d) => ({
    ...(d.id !== undefined ? { id: d.id } : {}),
    hr_name: d.hr_name.trim(),
    hr_designation: d.hr_designation.trim() || null,
    hr_mobile: d.hr_mobile.trim() || null,
    hr_landline: d.hr_landline.trim() || null,
    hr_email: d.hr_email.trim().toLowerCase() || null,
  }))
}
