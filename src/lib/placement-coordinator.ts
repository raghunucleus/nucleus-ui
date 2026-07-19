import { apiFetch } from './api'
import { withEmployeeAuth } from './employee-auth'
import type {
  Chip,
  DriveDetail,
  DriveListQuery,
  DriveListResponse,
  DriveStudentsPage,
  EligibilitySummary,
} from './drive-management'

/**
 * Data layer for the Placement Coordinator's read-only drives surface. The
 * server scopes everything to the coordinator's RBAC programmes/passout years:
 * the list only returns drives whose eligibility overlaps both, out-of-scope
 * drive ids 404, and the student list is trimmed to in-scope students. All
 * shapes are shared with drive-management — same services underneath.
 */

const ROOT = '/employee/placement-coordinator/drives'

/** The coordinator list's filters — the manage set plus the two scope facets. */
export interface CoordinatorDriveListQuery extends DriveListQuery {
  /** Narrow within the accessible programmes; the server clamps to scope. */
  programme_ids?: number[]
  /** Narrow within the accessible passout years; the server clamps to scope. */
  passout_years?: number[]
}

/** The coordinator's accessible values, for filter options + empty states. */
export interface CoordinatorScope {
  programmes: Chip[]
  passout_years: number[]
}

export interface CoordinatorFilterOptions {
  companies: Chip[]
  company_categories: Chip[]
  offer_types: Chip[]
  placement_categories: Chip[]
}

export function listCoordinatorDrives(
  query: CoordinatorDriveListQuery,
): Promise<DriveListResponse> {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(query)) {
    if (Array.isArray(v)) {
      if (v.length) qs.set(k, v.join(','))
    } else if (v !== undefined && v !== null && v !== '') {
      qs.set(k, String(v))
    }
  }
  const suffix = qs.toString() ? `?${qs}` : ''
  return withEmployeeAuth((token) => apiFetch(`${ROOT}${suffix}`, { token }))
}

export function getCoordinatorScope(): Promise<CoordinatorScope> {
  return withEmployeeAuth((token) => apiFetch(`${ROOT}/scope`, { token }))
}

export function getCoordinatorFilterOptions(): Promise<CoordinatorFilterOptions> {
  return withEmployeeAuth((token) =>
    apiFetch(`${ROOT}/filter-options`, { token }),
  )
}

export function getCoordinatorDrive(id: number): Promise<DriveDetail> {
  return withEmployeeAuth((token) => apiFetch(`${ROOT}/${id}`, { token }))
}

export function getCoordinatorDriveEligibilitySummary(
  id: number,
): Promise<EligibilitySummary> {
  return withEmployeeAuth((token) =>
    apiFetch(`${ROOT}/${id}/eligibility/summary`, { token }),
  )
}

/** The drive's shortlist, limited server-side to in-scope students. */
export function listCoordinatorDriveStudents(
  driveId: number,
  opts: {
    page?: number
    pageSize?: number
    search?: string
    status?: number
  } = {},
): Promise<DriveStudentsPage> {
  const qs = new URLSearchParams()
  if (opts.page) qs.set('page', String(opts.page))
  if (opts.pageSize) qs.set('pageSize', String(opts.pageSize))
  if (opts.search?.trim()) qs.set('search', opts.search.trim())
  if (opts.status !== undefined) qs.set('status', String(opts.status))
  const suffix = qs.toString() ? `?${qs}` : ''
  return withEmployeeAuth((token) =>
    apiFetch(`${ROOT}/${driveId}/students${suffix}`, { token }),
  )
}
