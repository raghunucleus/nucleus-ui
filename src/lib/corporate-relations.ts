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
  /**
   * `current-statuses` only — absent on the other kinds. At most one value in
   * the list carries it; it is what CR View shows for a (role × year) with no
   * status recorded.
   */
  is_default?: boolean
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

/**
 * The three write verbs the company form needs, so the same form can post to
 * whichever screen is hosting it. Company Management and Roles or Designations
 * are separate RBAC screens with separate endpoints — the form doesn't care
 * which, it just calls what it was handed.
 */
export interface CompanyWriteApi {
  create: (body: CompanyPayload) => Promise<CompanyDetail>
  update: (id: number, body: Partial<CompanyPayload>) => Promise<CompanyDetail>
  uploadLogo: (
    id: number,
    file: File,
  ) => Promise<{ logo_key: string; logo_url: string; staged: boolean }>
}

/** The manager surface — the form's default. */
export const companyManagementApi: CompanyWriteApi = {
  create: createCompany,
  update: updateCompany,
  uploadLogo: uploadCompanyLogo,
}

// --- Roles or Designations ------------------------------------------------

/**
 * The desk-level surface: the job roles the SIGNED-IN employee is accountable
 * for. The scope comes from the token server-side — there is no employee id to
 * pass, and no way to ask for anyone else's.
 */
const JOB_ROLES_ROOT = '/employee/corporate-relations/job-roles'

/** The company a role belongs to, flattened onto every row. */
export interface JobRoleCompany {
  id: number
  name: string
  website: string | null
  logo_url: string | null
  approval_status: CompanyApprovalStatus
  is_active: boolean | null
  /** Present so the screen can offer "edit and resubmit" on your own draft. */
  created_by_employee_id: number | null
  categories: Chip[]
  open_request: CompanyOpenRequest | null
}

export interface MyJobRole {
  id: number
  role_name: string
  company: JobRoleCompany
  updated_at: string
}

/** Unpaginated — bounded to your own roles, and the screen groups by company. */
export function listMyJobRoles(
  params: { search?: string } = {},
): Promise<MyJobRole[]> {
  return withEmployeeAuth((token) =>
    apiFetch(`${JOB_ROLES_ROOT}${qs(params)}`, { token }),
  )
}

export function getJobRolesFormOptions(): Promise<FormOptions> {
  return withEmployeeAuth((token) =>
    apiFetch(`${JOB_ROLES_ROOT}/form-options`, { token }),
  )
}

/**
 * A company from the Roles screen. Reaches only the ones already on your list
 * (you own a role on it) or one you created yourself; anything else 404s.
 */
export function getJobRoleCompany(id: number): Promise<CompanyDetail> {
  return withEmployeeAuth((token) =>
    apiFetch(`${JOB_ROLES_ROOT}/companies/${id}`, { token }),
  )
}

/** Same as `getCompanyRequest`, authorised by the Roles screen instead. */
export function getJobRoleCompanyRequest(
  id: number,
): Promise<(ApprovalDetail & { can_act: boolean }) | null> {
  return withEmployeeAuth((token) =>
    apiFetch(`${JOB_ROLES_ROOT}/companies/${id}/request`, { token }),
  )
}

/**
 * Add-company from the Roles screen. Same service behind it as Company
 * Management's — creates a `pending` company and raises the approval request —
 * but authorised by `corporate_relations.job_roles.manage`. The by-id calls
 * only reach your OWN company while it is still awaiting approval; anything
 * else 404s.
 */
export const jobRolesCompanyApi: CompanyWriteApi = {
  create: (body) =>
    withEmployeeAuth((token) =>
      apiFetch(`${JOB_ROLES_ROOT}/companies`, { method: 'POST', body, token }),
    ),
  update: (id, body) =>
    withEmployeeAuth((token) =>
      apiFetch(`${JOB_ROLES_ROOT}/companies/${id}`, {
        method: 'PATCH',
        body,
        token,
      }),
    ),
  uploadLogo: async (id, file) => {
    const token = getEmployeeAccessToken()
    if (!token) throw new Error('Not signed in.')
    const form = new FormData()
    form.append('file', file)
    return apiUpload(`${JOB_ROLES_ROOT}/companies/${id}/logo`, form, token)
  },
}

// --- CR View --------------------------------------------------------------

/**
 * The same roles as the Roles or Designations surface, but PER PASSOUT YEAR:
 * whatever the signed-in employee recorded against each (role × year).
 *
 * Self-scoped server-side from the token like its sibling; the year is the one
 * thing the client picks, and it is validated against the active master.
 */
const CR_VIEW_ROOT = '/employee/corporate-relations/cr-view'

export interface CrViewYearOption {
  id: number
  passout_year: number
  /** Derived server-side, e.g. "2025-2026". */
  display_year: string
}

/**
 * Everything the screen needs before it can render a row: the active years and
 * which one to open on (the year whose window contains today, else the nearest
 * upcoming, else the latest — `null` only when no year is active at all), plus
 * the two pickers.
 *
 * Separate from `listAttributes()` / `listPassoutYears()` on purpose: those
 * endpoints are guarded by the Company Attributes screen, which a CR-View-only
 * holder does not have.
 */
export interface CrViewScope {
  years: CrViewYearOption[]
  default_year_id: number | null
  relationship_types: Chip[]
  current_statuses: Chip[]
  /**
   * What a record with no status of its own shows — the option flagged as the
   * default on Company Attributes. Never written to a record, which is why a
   * new passout year reads as this again with nothing to reset.
   */
  default_status: Chip | null
  /**
   * The Drive Attributes and academics masters, served from here because a
   * CR-View-only holder cannot reach those screens' own endpoints.
   */
  designations: Chip[]
  programmes: Chip[]
  job_locations: Chip[]
}

/** One HR contact on a record. All channels optional; only the name is not. */
export interface CrViewContact {
  id: number
  hr_name: string
  hr_designation: string | null
  hr_mobile: string | null
  hr_landline: string | null
  hr_email: string | null
}

/** What the contacts dialog submits — `id` present means update in place. */
export interface CrViewContactWrite {
  id?: number
  hr_name: string
  hr_designation: string | null
  hr_mobile: string | null
  hr_landline: string | null
  hr_email: string | null
}

/** Roles aren't editable from this screen, so there is no "your own draft" rule. */
export type CrViewCompany = Omit<JobRoleCompany, 'created_by_employee_id'>

/** What was saved for this (role × year). */
export interface CrViewRecord {
  id: number
  /**
   * Human-readable reference key, `CR-<passout year>-<5 digits>` — stable and
   * unique; shown only in the full edit sheet. `null` never happens for a
   * persisted record in practice.
   */
  record_code: string | null
  relationship_types: Chip[]
  /** `null` = not chosen; render `CrViewScope.default_status` instead. */
  current_status: Chip | null
  designations: Chip[]
  programmes: Chip[]
  job_locations: Chip[]
  contacts: CrViewContact[]
  /** 'YYYY-MM-DD' or `null`. */
  next_follow_up_date: string | null
  remarks: string | null
  updated_at: string
  updated_by_employee_id: number | null
}

/**
 * PATCH semantics — an absent key leaves that field alone, which is what lets
 * each inline cell save exactly its own field. `contacts`, when present, is
 * the COMPLETE desired set (the server deletes rows absent from it).
 */
export interface CrViewRecordPayload {
  relationship_type_ids?: number[]
  /** `null` clears it, returning the row to showing the default. */
  current_status_id?: number | null
  designation_ids?: number[]
  programme_ids?: number[]
  job_location_ids?: number[]
  next_follow_up_date?: string | null
  remarks?: string | null
  contacts?: CrViewContactWrite[]
}

export interface CrViewRow {
  job_role_id: number
  role_name: string
  company: CrViewCompany
  /** `null` = nothing recorded for the selected year yet. */
  record: CrViewRecord | null
}

export interface CrViewList {
  /** Echoed by the server — the year it actually resolved the list against. */
  passout_year: CrViewYearOption
  items: CrViewRow[]
}

export function getCrViewScope(): Promise<CrViewScope> {
  return withEmployeeAuth((token) =>
    apiFetch(`${CR_VIEW_ROOT}/scope`, { token }),
  )
}

/** Unpaginated — bounded to your own roles, same as the Roles screen. */
export function listCrView(params: {
  passout_year_id: number
  search?: string
}): Promise<CrViewList> {
  return withEmployeeAuth((token) =>
    apiFetch(`${CR_VIEW_ROOT}${qs(params)}`, { token }),
  )
}

/** One status transition on a record, newest first from the endpoint. */
export interface CrViewStatusLogEntry {
  id: number
  /** `null` = the status was cleared back to the default. */
  status: Chip | null
  changed_at: string
  changed_by: { id: number; name: string } | null
}

/** The status history of one (role × year); `[]` when nothing recorded yet. */
export function getCrViewStatusHistory(
  jobRoleId: number,
  passoutYearId: number,
): Promise<CrViewStatusLogEntry[]> {
  return withEmployeeAuth((token) =>
    apiFetch(
      `${CR_VIEW_ROOT}/records/${jobRoleId}/${passoutYearId}/status-history`,
      { token },
    ),
  )
}

/**
 * One fresh row. Inline cells never call this (the list already holds every
 * row) — it exists for the full-row edit sheet, which refetches on open: the
 * list can be minutes stale, and a whole-form save is exactly the case where
 * writing over somebody's newer edit matters.
 */
export function getCrViewRecord(
  jobRoleId: number,
  passoutYearId: number,
): Promise<CrViewRow & { passout_year: CrViewYearOption }> {
  return withEmployeeAuth((token) =>
    apiFetch(`${CR_VIEW_ROOT}/records/${jobRoleId}/${passoutYearId}`, { token }),
  )
}

/**
 * Save the record for one (role × year), creating it on first save.
 *
 * The inline cells each carry only the field that changed — the server leaves
 * an absent key alone; the full-row sheet sends every key at once.
 */
export function upsertCrViewRecord(
  jobRoleId: number,
  passoutYearId: number,
  body: CrViewRecordPayload = {},
): Promise<CrViewRow & { passout_year: CrViewYearOption }> {
  return withEmployeeAuth((token) =>
    apiFetch(`${CR_VIEW_ROOT}/records/${jobRoleId}/${passoutYearId}`, {
      method: 'PATCH',
      body,
      token,
    }),
  )
}

// --- CR View grouping -------------------------------------------------------
// Same shape as the drive-management grouped Students view: pure functions
// over the in-memory row set, a flattened header-sentinel display list, and
// collapsed groups contributing only their header.

export type CrViewGroupBy = 'none' | 'status' | 'follow_up' | 'company'

export interface CrViewGroup {
  key: string
  label: string
  rows: CrViewRow[]
}

/** What the status dimension needs from scope: master order + the default. */
export interface CrViewGroupContext {
  /** `scope.current_statuses` — already in master sort order. */
  statuses: Chip[]
  /** `scope.default_status` — what a row with nothing recorded renders as. */
  defaultStatus: Chip | null
}

/** A grouped table body: header sentinels + the rows of every open group. */
export type CrViewDisplayItem =
  | { kind: 'header'; key: string; label: string; count: number; open: boolean }
  | { kind: 'row'; row: CrViewRow }

/** Local calendar date as 'YYYY-MM-DD' — the format records store. */
function crIsoDate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

const FOLLOW_UP_BUCKETS = [
  { key: 'overdue', label: 'Overdue' },
  { key: 'today', label: 'Today' },
  { key: 'this_week', label: 'This week' },
  { key: 'this_month', label: 'This month' },
  { key: 'later', label: 'Later' },
  { key: 'not_set', label: 'Not set' },
] as const

/**
 * Which follow-up bucket a date lands in — first match wins, so unlike the
 * filter presets (which deliberately overlap: "this week" includes today) a
 * row appears in exactly one group. Boundaries are computed once per grouping
 * pass; 'YYYY-MM-DD' strings compare lexicographically.
 */
function followUpBucketKey(
  date: string | null,
  b: { today: string; weekEnd: string; monthEnd: string },
): (typeof FOLLOW_UP_BUCKETS)[number]['key'] {
  if (date === null) return 'not_set'
  if (date < b.today) return 'overdue'
  if (date === b.today) return 'today'
  if (date <= b.weekEnd) return 'this_week'
  if (date <= b.monthEnd) return 'this_month'
  return 'later'
}

/**
 * Bucket the visible (already searched/filtered/sorted) rows into labeled
 * groups. Incoming order is preserved within each group, so the active column
 * sort keeps working inside buckets; only the group order is fixed per
 * dimension.
 */
export function groupCrViewRows(
  rows: CrViewRow[],
  groupBy: Exclude<CrViewGroupBy, 'none'>,
  ctx: CrViewGroupContext,
): CrViewGroup[] {
  const buckets = new Map<string, CrViewGroup>()
  const push = (key: string, label: string, row: CrViewRow) => {
    const bucket = buckets.get(key)
    if (bucket) bucket.rows.push(row)
    else buckets.set(key, { key, label, rows: [row] })
  }

  if (groupBy === 'company') {
    for (const r of rows) push(String(r.company.id), r.company.name, r)
    return [...buckets.values()].sort((a, b) => a.label.localeCompare(b.label))
  }

  if (groupBy === 'status') {
    // Group by the EFFECTIVE status — what the cell renders: the recorded one,
    // else the master default. "No status" only exists when there is no
    // default either.
    for (const r of rows) {
      const status = r.record?.current_status ?? ctx.defaultStatus
      if (status) push(String(status.id), status.name, r)
      else push('null', 'No status', r)
    }
    const order = new Map(ctx.statuses.map((s, i) => [String(s.id), i]))
    return [...buckets.values()].sort((a, b) => {
      if (a.key === 'null') return 1
      if (b.key === 'null') return -1
      const ai = order.get(a.key) ?? Number.MAX_SAFE_INTEGER
      const bi = order.get(b.key) ?? Number.MAX_SAFE_INTEGER
      return ai !== bi ? ai - bi : a.label.localeCompare(b.label)
    })
  }

  // follow_up — fixed urgency-first bucket order, empty buckets skipped.
  const now = new Date()
  const weekEnd = new Date(now)
  // Monday-based week: the window runs today → the coming Sunday.
  weekEnd.setDate(now.getDate() + ((7 - now.getDay()) % 7))
  const bounds = {
    today: crIsoDate(now),
    weekEnd: crIsoDate(weekEnd),
    monthEnd: crIsoDate(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  }
  const labels = new Map<string, string>(
    FOLLOW_UP_BUCKETS.map((b) => [b.key, b.label]),
  )
  for (const r of rows) {
    const key = followUpBucketKey(r.record?.next_follow_up_date ?? null, bounds)
    push(key, labels.get(key)!, r)
  }
  return FOLLOW_UP_BUCKETS.flatMap((b) => buckets.get(b.key) ?? [])
}

export function buildCrViewDisplayItems(
  rows: CrViewRow[],
  groupBy: CrViewGroupBy,
  collapsed: ReadonlySet<string>,
  ctx: CrViewGroupContext,
): CrViewDisplayItem[] {
  if (groupBy === 'none') {
    return rows.map((row) => ({ kind: 'row' as const, row }))
  }
  const items: CrViewDisplayItem[] = []
  for (const g of groupCrViewRows(rows, groupBy, ctx)) {
    const open = !collapsed.has(g.key)
    items.push({
      kind: 'header',
      key: g.key,
      label: g.label,
      count: g.rows.length,
      open,
    })
    if (open) {
      items.push(...g.rows.map((row) => ({ kind: 'row' as const, row })))
    }
  }
  return items
}

// --- Company attributes (lookup config) -----------------------------------

/**
 * The configurable classifiers, in the order the screen lists them. These calls
 * stay parameterised by kind, so adding another is a single entry here plus the
 * matching entity server-side.
 *
 * Categories classify the COMPANY; relationship types and current statuses
 * classify what CR View records for one (role × year) — only the option lists
 * are configured here.
 */
export const LOOKUP_KINDS = [
  { key: 'categories', label: 'Categories' },
  { key: 'relationship-types', label: 'Relationship Type' },
  { key: 'current-statuses', label: 'Current Status' },
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

/**
 * Make this value its type's default — current statuses only; the other kinds
 * 400. Exclusive server-side (the previous default is cleared in the same
 * transaction) and there is no unset, so reload the list rather than patching
 * the one row locally.
 */
export function setAttributeDefault(
  kind: LookupKind,
  id: number,
): Promise<LookupValue> {
  return withEmployeeAuth((token) =>
    apiFetch(`${ATTR_ROOT}/${kind}/${id}/default`, { method: 'PATCH', token }),
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

// --- Passout years --------------------------------------------------------

/**
 * The passout-year master, configured from the same screen but on its own
 * endpoints: these rows carry no free-text name (the label is derived from the
 * year server-side) and hold an academic date window.
 */
export interface PassoutYearValue {
  id: number
  passout_year: number
  /** Derived server-side, e.g. "2025-2026". Never sent up. */
  display_year: string
  /** 'YYYY-MM-DD'. */
  start_date: string
  end_date: string
  is_active: boolean
}

/** The dates a year carries; omit one and the server fills its default. */
export interface PassoutYearWindow {
  start_date?: string
  end_date?: string
}

const PASSOUT_ROOT = '/employee/corporate-relations/passout-years'

export function listPassoutYears(): Promise<PassoutYearValue[]> {
  return withEmployeeAuth((token) => apiFetch(PASSOUT_ROOT, { token }))
}

export function createPassoutYear(
  body: { passout_year: number } & PassoutYearWindow,
): Promise<PassoutYearValue> {
  return withEmployeeAuth((token) =>
    apiFetch(PASSOUT_ROOT, { method: 'POST', body, token }),
  )
}

/** An edit moves the window only — the year is fixed once the row exists. */
export function updatePassoutYear(
  id: number,
  body: PassoutYearWindow,
): Promise<PassoutYearValue> {
  return withEmployeeAuth((token) =>
    apiFetch(`${PASSOUT_ROOT}/${id}`, { method: 'PATCH', body, token }),
  )
}

export function setPassoutYearStatus(
  id: number,
  isActive: boolean,
): Promise<PassoutYearValue> {
  return withEmployeeAuth((token) =>
    apiFetch(`${PASSOUT_ROOT}/${id}/status`, {
      method: 'PATCH',
      body: { is_active: isActive },
      token,
    }),
  )
}

/** Absolute URL for an API path (rarely needed; kept for parity with peers). */
export const apiUrl = (path: string) => `${API_BASE_URL}${path}`
