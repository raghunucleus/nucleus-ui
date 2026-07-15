import { apiFetch, apiUpload, API_BASE_URL } from './api'
import { getEmployeeAccessToken, withEmployeeAuth } from './employee-auth'

/**
 * Data layer for the corporate-relations CRM. Two employee surfaces share the
 * same shapes and most sub-resource endpoints; the `Surface` selects the base
 * path so the shared CompanyDetail component can drive either:
 *   - 'management' → placement manager (full CRUD)   `/…/management/companies`
 *   - 'companies'  → responsible officer (own only)  `/…/companies`
 */
export type Surface = 'management' | 'companies'

const ROOT: Record<Surface, string> = {
  management: '/employee/corporate-relations/management/companies',
  companies: '/employee/corporate-relations/companies',
}
const ATTR_ROOT = '/employee/corporate-relations/attributes'

// --- Shapes ---------------------------------------------------------------

export interface Chip {
  id: number
  name: string
}

export interface Branch {
  id: number
  name: string
  short_name: string
}

export interface CompanyListItem {
  id: number
  name: string
  short_name: string | null
  city: string | null
  relationship_status: string
  tier: string | null
  is_active: boolean
  last_engaged_on: string | null
  responsible_employee: { id: number; name: string } | null
  categories: Chip[]
  updated_at: string
}

export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  limit: number
}

export interface CompanyContact {
  id: number
  name: string
  designation: string | null
  email: string | null
  phone: string | null
  linkedin_url: string | null
  is_primary: boolean
  notes: string | null
}

export interface CompanyDetail {
  id: number
  name: string
  short_name: string | null
  website: string | null
  linkedin_url: string | null
  description: string | null
  logo_url: string | null
  founded_year: number | null
  glassdoor_rating: string | null
  general_email: string | null
  general_phone: string | null
  ownership_type: string | null
  tier: string | null
  gstin: string | null
  cin: string | null
  pan: string | null
  registration_number: string | null
  package_min: string | null
  package_max: string | null
  offers_internships: boolean
  offers_ppo: boolean
  last_engaged_on: string | null
  relationship_status: string
  partnership_since: string | null
  address_line1: string | null
  address_line2: string | null
  city: string | null
  state: string | null
  country: string | null
  pincode: string | null
  is_active: boolean
  responsible_employee: { id: number; emp_code: string; name: string } | null
  categories: Chip[]
  industries: Chip[]
  types: Chip[]
  sizes: Chip[]
  sources: Chip[]
  hiring_modes: Chip[]
  roles: Chip[]
  tags: Chip[]
  eligible_branches: Branch[]
  contacts: CompanyContact[]
  created_at: string
  updated_at: string
}

export interface CompanyInteraction {
  id: number
  type: string
  interaction_date: string
  summary: string
  follow_up_date: string | null
  outcome: string | null
  contact: { id: number; name: string } | null
  logged_by: { id: number; name: string } | null
  created_at: string
}

export interface CompanyMilestone {
  id: number
  milestone_date: string
  type: string
  title: string
  summary: string | null
  logged_by: { id: number; name: string } | null
  created_at: string
}

export interface FormOptions {
  categories: Chip[]
  industries: Chip[]
  types: Chip[]
  sizes: Chip[]
  sources: Chip[]
  hiring_modes: Chip[]
  roles: Chip[]
  tags: Chip[]
  departments: Branch[]
  ownership_types: string[]
  tiers: string[]
  relationship_statuses: string[]
  interaction_types: string[]
  milestone_types: string[]
}

export interface AssignableEmployee {
  id: number
  emp_code: string
  name: string
}

export interface LookupValue {
  id: number
  name: string
  is_active: boolean
  sort_order: number
}

export interface CompanyPayload {
  name: string
  short_name?: string | null
  website?: string | null
  linkedin_url?: string | null
  description?: string | null
  founded_year?: number | null
  glassdoor_rating?: number | null
  general_email?: string | null
  general_phone?: string | null
  ownership_type?: string | null
  tier?: string | null
  gstin?: string | null
  cin?: string | null
  pan?: string | null
  registration_number?: string | null
  package_min?: number | null
  package_max?: number | null
  offers_internships?: boolean
  offers_ppo?: boolean
  relationship_status?: string
  partnership_since?: string | null
  address_line1?: string | null
  address_line2?: string | null
  city?: string | null
  state?: string | null
  country?: string | null
  pincode?: string | null
  responsible_employee_id?: number | null
  category_ids?: number[]
  industry_ids?: number[]
  type_ids?: number[]
  size_ids?: number[]
  source_ids?: number[]
  hiring_mode_ids?: number[]
  role_ids?: number[]
  tag_ids?: number[]
  eligible_branch_ids?: number[]
}

export interface ContactPayload {
  name: string
  designation?: string | null
  email?: string | null
  phone?: string | null
  linkedin_url?: string | null
  is_primary?: boolean
  notes?: string | null
}

export interface InteractionPayload {
  type: string
  interaction_date: string
  contact_id?: number | null
  summary: string
  follow_up_date?: string | null
  outcome?: string | null
}

export interface MilestonePayload {
  milestone_date: string
  type: string
  title: string
  summary?: string | null
}

// --- Companies (shared reads / manager writes) ----------------------------

export interface CompanyListParams {
  search?: string
  status?: 'active' | 'inactive' | 'all'
  category_id?: number
  industry_id?: number
  responsible_employee_id?: number
  page?: number
  limit?: number
}

function qs(params: object): string {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') sp.set(k, String(v))
  }
  const s = sp.toString()
  return s ? `?${s}` : ''
}

export function listCompanies(
  surface: Surface,
  params: CompanyListParams = {},
): Promise<Paginated<CompanyListItem>> {
  return withEmployeeAuth((token) =>
    apiFetch(`${ROOT[surface]}${qs(params)}`, { token }),
  )
}

export function getCompany(
  surface: Surface,
  id: number,
): Promise<CompanyDetail> {
  return withEmployeeAuth((token) =>
    apiFetch(`${ROOT[surface]}/${id}`, { token }),
  )
}

export function getFormOptions(surface: Surface): Promise<FormOptions> {
  return withEmployeeAuth((token) =>
    apiFetch(`${ROOT[surface]}/form-options`, { token }),
  )
}

export function getAssignableEmployees(): Promise<AssignableEmployee[]> {
  return withEmployeeAuth((token) =>
    apiFetch(`${ROOT.management}/assignable-employees`, { token }),
  )
}

export function createCompany(body: CompanyPayload): Promise<CompanyDetail> {
  return withEmployeeAuth((token) =>
    apiFetch(ROOT.management, { method: 'POST', body, token }),
  )
}

export function updateCompany(
  id: number,
  body: Partial<CompanyPayload>,
): Promise<CompanyDetail> {
  return withEmployeeAuth((token) =>
    apiFetch(`${ROOT.management}/${id}`, { method: 'PATCH', body, token }),
  )
}

export function setCompanyStatus(
  id: number,
  isActive: boolean,
): Promise<CompanyDetail> {
  return withEmployeeAuth((token) =>
    apiFetch(`${ROOT.management}/${id}/status`, {
      method: 'PATCH',
      body: { is_active: isActive },
      token,
    }),
  )
}

export async function uploadCompanyLogo(
  id: number,
  file: File,
): Promise<{ logo_url: string }> {
  const token = getEmployeeAccessToken()
  if (!token) throw new Error('Not signed in.')
  const form = new FormData()
  form.append('file', file)
  return apiUpload(`${ROOT.management}/${id}/logo`, form, token)
}

// --- Contacts -------------------------------------------------------------

export function listContacts(
  surface: Surface,
  id: number,
): Promise<CompanyContact[]> {
  return withEmployeeAuth((token) =>
    apiFetch(`${ROOT[surface]}/${id}/contacts`, { token }),
  )
}

export function createContact(
  surface: Surface,
  id: number,
  body: ContactPayload,
): Promise<CompanyContact> {
  return withEmployeeAuth((token) =>
    apiFetch(`${ROOT[surface]}/${id}/contacts`, { method: 'POST', body, token }),
  )
}

export function updateContact(
  surface: Surface,
  id: number,
  contactId: number,
  body: Partial<ContactPayload>,
): Promise<CompanyContact> {
  return withEmployeeAuth((token) =>
    apiFetch(`${ROOT[surface]}/${id}/contacts/${contactId}`, {
      method: 'PATCH',
      body,
      token,
    }),
  )
}

export function deleteContact(
  surface: Surface,
  id: number,
  contactId: number,
): Promise<{ deleted: boolean }> {
  return withEmployeeAuth((token) =>
    apiFetch(`${ROOT[surface]}/${id}/contacts/${contactId}`, {
      method: 'DELETE',
      token,
    }),
  )
}

// --- Interactions ---------------------------------------------------------

export function listInteractions(
  surface: Surface,
  id: number,
  filter: { year?: number; month?: number } = {},
): Promise<CompanyInteraction[]> {
  return withEmployeeAuth((token) =>
    apiFetch(`${ROOT[surface]}/${id}/interactions${qs(filter)}`, { token }),
  )
}

export function createInteraction(
  surface: Surface,
  id: number,
  body: InteractionPayload,
): Promise<CompanyInteraction> {
  return withEmployeeAuth((token) =>
    apiFetch(`${ROOT[surface]}/${id}/interactions`, {
      method: 'POST',
      body,
      token,
    }),
  )
}

export function updateInteraction(
  surface: Surface,
  id: number,
  interactionId: number,
  body: Partial<InteractionPayload>,
): Promise<CompanyInteraction> {
  return withEmployeeAuth((token) =>
    apiFetch(`${ROOT[surface]}/${id}/interactions/${interactionId}`, {
      method: 'PATCH',
      body,
      token,
    }),
  )
}

export function deleteInteraction(
  surface: Surface,
  id: number,
  interactionId: number,
): Promise<{ deleted: boolean }> {
  return withEmployeeAuth((token) =>
    apiFetch(`${ROOT[surface]}/${id}/interactions/${interactionId}`, {
      method: 'DELETE',
      token,
    }),
  )
}

// --- Relationship milestones ----------------------------------------------

export function listMilestones(
  surface: Surface,
  id: number,
): Promise<CompanyMilestone[]> {
  return withEmployeeAuth((token) =>
    apiFetch(`${ROOT[surface]}/${id}/milestones`, { token }),
  )
}

export function createMilestone(
  surface: Surface,
  id: number,
  body: MilestonePayload,
): Promise<CompanyMilestone> {
  return withEmployeeAuth((token) =>
    apiFetch(`${ROOT[surface]}/${id}/milestones`, {
      method: 'POST',
      body,
      token,
    }),
  )
}

export function deleteMilestone(
  surface: Surface,
  id: number,
  milestoneId: number,
): Promise<{ deleted: boolean }> {
  return withEmployeeAuth((token) =>
    apiFetch(`${ROOT[surface]}/${id}/milestones/${milestoneId}`, {
      method: 'DELETE',
      token,
    }),
  )
}

// --- Company attributes (lookup config) -----------------------------------

export const LOOKUP_KINDS = [
  { key: 'categories', label: 'Categories' },
  { key: 'industries', label: 'Industries' },
  { key: 'types', label: 'Company types' },
  { key: 'sizes', label: 'Company sizes' },
  { key: 'sources', label: 'Sources' },
  { key: 'hiring-modes', label: 'Hiring modes' },
  { key: 'roles', label: 'Roles offered' },
  { key: 'tags', label: 'Tags' },
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
