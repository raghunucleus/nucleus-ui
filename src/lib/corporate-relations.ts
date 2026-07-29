import { apiFetch, apiUpload, API_BASE_URL } from './api'
import { getEmployeeAccessToken, withEmployeeAuth } from './employee-auth'
import type { ApprovalDetail } from './employee-requests'
import type { RequestStatus } from './student-requests'

/**
 * Data layer for the corporate-relations company catalog — a thin record:
 * name, URL, logo and categories, plus the two lifecycle flags. Anything
 * richer about a hiring engagement lives on the drive, not the company.
 */
const ROOT = '/employee/corporate-relations/management/companies'
const ATTR_ROOT = '/employee/corporate-relations/attributes'

// --- Shapes ---------------------------------------------------------------

export interface Chip {
  id: number
  name: string
}

/** pending → awaiting sign-off, approved → live, rejected → refused. */
export type CompanyApprovalStatus = 'pending' | 'approved' | 'rejected'

/** A job role and the employee accountable for it. */
export interface CompanyJobRole {
  id: number
  role_name: string
  responsible_employee: {
    id: number
    emp_code: string
    emp_display_name: string
  } | null
}

/** The company's open change request, if it has one. */
export interface CompanyOpenRequest {
  id: number
  status: RequestStatus
  kind: 'create' | 'update'
}

/**
 * `is_active` is a tri-state: `null` while the company awaits approval, `true`
 * once approved, `false` once deactivated. Only an approved request moves
 * either lifecycle field — nothing in the UI writes them directly.
 */
export interface CompanyListItem {
  id: number
  name: string
  website: string | null
  approval_status: CompanyApprovalStatus
  is_active: boolean | null
  logo_url: string | null
  categories: Chip[]
  roles: CompanyJobRole[]
  open_request: CompanyOpenRequest | null
  updated_at: string
}

export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  limit: number
}

export interface CompanyDetail {
  id: number
  name: string
  website: string | null
  logo_url: string | null
  approval_status: CompanyApprovalStatus
  is_active: boolean | null
  categories: Chip[]
  roles: CompanyJobRole[]
  open_request: CompanyOpenRequest | null
  created_at: string
  updated_at: string
}

export interface FormOptions {
  categories: Chip[]
  /** The signed-in employee — the default owner of every new job role. */
  me: { id: number; emp_code: string; emp_display_name: string } | null
}

export interface LookupValue {
  id: number
  name: string
  is_active: boolean
  sort_order: number
}

export interface CompanyRolePayload {
  /** The existing row on an edit; omit/null for a role being added. */
  id?: number | null
  role_name: string
  responsible_employee_id: number
}

export interface CompanyPayload {
  name: string
  website?: string | null
  category_ids?: number[]
  roles: CompanyRolePayload[]
  /** A key returned by the logo upload; only needed when one was staged. */
  logo_key?: string | null
  is_active?: boolean
}

// --- Companies ------------------------------------------------------------

export interface CompanyListParams {
  search?: string
  /** `pending` = awaiting approval (`is_active IS NULL`). */
  status?: 'active' | 'inactive' | 'pending' | 'all'
  approval?: CompanyApprovalStatus | 'all'
  category_ids?: number[]
  // Sorting (whitelisted columns; mirrors the server enum).
  sort_by?: CompanySortField
  sort_dir?: 'asc' | 'desc'
  page?: number
  limit?: number
}

export type CompanySortField = 'name' | 'updated_at'

function qs(params: object): string {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue
    // Arrays serialize to a comma list; empty arrays are omitted.
    if (Array.isArray(v)) {
      if (v.length > 0) sp.set(k, v.join(','))
    } else {
      sp.set(k, String(v))
    }
  }
  const s = sp.toString()
  return s ? `?${s}` : ''
}

export function listCompanies(
  params: CompanyListParams = {},
): Promise<Paginated<CompanyListItem>> {
  return withEmployeeAuth((token) => apiFetch(`${ROOT}${qs(params)}`, { token }))
}

export function getCompany(id: number): Promise<CompanyDetail> {
  return withEmployeeAuth((token) => apiFetch(`${ROOT}/${id}`, { token }))
}

export function getFormOptions(): Promise<FormOptions> {
  return withEmployeeAuth((token) =>
    apiFetch(`${ROOT}/form-options`, { token }),
  )
}

export function createCompany(body: CompanyPayload): Promise<CompanyDetail> {
  return withEmployeeAuth((token) =>
    apiFetch(ROOT, { method: 'POST', body, token }),
  )
}

export function updateCompany(
  id: number,
  body: Partial<CompanyPayload>,
): Promise<CompanyDetail> {
  return withEmployeeAuth((token) =>
    apiFetch(`${ROOT}/${id}`, { method: 'PATCH', body, token }),
  )
}

/**
 * The company's open approval request — everything the Approvals inbox shows
 * for it, so it can be reviewed (and, when `can_act`, decided) right where the
 * company lives. `null` when nothing is pending.
 *
 * Authorised by the company-management screen, NOT by the approvals inbox:
 * anyone who can see the company can see what is pending on it. `can_act` is
 * the separate approver grant.
 */
export function getCompanyRequest(
  id: number,
): Promise<(ApprovalDetail & { can_act: boolean }) | null> {
  return withEmployeeAuth((token) =>
    apiFetch(`${ROOT}/${id}/request`, { token }),
  )
}

/**
 * Upload a logo. For an APPROVED company the object is only staged — put the
 * returned `logo_key` in the save payload and it lands on approval. For a
 * company that isn't live yet it is written straight away (`staged: false`).
 */
export async function uploadCompanyLogo(
  id: number,
  file: File,
): Promise<{ logo_key: string; logo_url: string; staged: boolean }> {
  const token = getEmployeeAccessToken()
  if (!token) throw new Error('Not signed in.')
  const form = new FormData()
  form.append('file', file)
  return apiUpload(`${ROOT}/${id}/logo`, form, token)
}

// --- Company attributes (lookup config) -----------------------------------

/**
 * Categories is the only configurable classifier left. The screen and these
 * calls stay parameterised by kind so adding a second one is a single entry
 * here plus the matching entity server-side.
 */
export const LOOKUP_KINDS = [
  { key: 'categories', label: 'Categories' },
] as const

export type LookupKind = (typeof LOOKUP_KINDS)[number]['key']

export function listAttributes(kind: LookupKind): Promise<LookupValue[]> {
  return withEmployeeAuth((token) =>
    apiFetch(`${ATTR_ROOT}/${kind}`, { token }),
  )
}

export function createAttribute(
  kind: LookupKind,
  body: { name: string; sort_order?: number },
): Promise<LookupValue> {
  return withEmployeeAuth((token) =>
    apiFetch(`${ATTR_ROOT}/${kind}`, { method: 'POST', body, token }),
  )
}

export function updateAttribute(
  kind: LookupKind,
  id: number,
  body: { name?: string; sort_order?: number },
): Promise<LookupValue> {
  return withEmployeeAuth((token) =>
    apiFetch(`${ATTR_ROOT}/${kind}/${id}`, { method: 'PATCH', body, token }),
  )
}

export function setAttributeStatus(
  kind: LookupKind,
  id: number,
  isActive: boolean,
): Promise<LookupValue> {
  return withEmployeeAuth((token) =>
    apiFetch(`${ATTR_ROOT}/${kind}/${id}/status`, {
      method: 'PATCH',
      body: { is_active: isActive },
      token,
    }),
  )
}

/** Absolute URL for an API path (rarely needed; kept for parity with peers). */
export const apiUrl = (path: string) => `${API_BASE_URL}${path}`
