import { apiFetch } from './api'
import { withEmployeeAuth } from './employee-auth'
import type { AcademicHoliday } from './holidays'

/**
 * The institution academic calendar — every declared holiday, optionally
 * within a from/to window. Visible to every authenticated employee (the
 * endpoint is not RBAC-scoped: holidays are broadcast, institution-wide
 * information).
 */
export function fetchEmployeeHolidays(range?: {
  from?: string
  to?: string
  scope?: 'upcoming' | 'past'
}): Promise<AcademicHoliday[]> {
  const qs = new URLSearchParams()
  if (range?.from) qs.set('from', range.from)
  if (range?.to) qs.set('to', range.to)
  if (range?.scope) qs.set('scope', range.scope)
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  return withEmployeeAuth((token) =>
    apiFetch<AcademicHoliday[]>(`/employee/academic-holidays${suffix}`, {
      token,
    }),
  )
}

/** One page of the institution holiday calendar — mirrors the server's
 *  `PaginatedHolidays`. */
export interface PaginatedHolidays {
  items: AcademicHoliday[]
  total: number
  page: number
  page_size: number
  has_more: boolean
}

/**
 * Page-windowed variant of {@link fetchEmployeeHolidays} for the holiday
 * browser. The calendar is institution-wide, so there is no per-employee
 * scoping; `scope` selects the upcoming or past slice relative to today.
 */
export function fetchEmployeeHolidaysPaged(params: {
  from?: string
  to?: string
  scope?: 'upcoming' | 'past'
  page?: number
  page_size?: number
}): Promise<PaginatedHolidays> {
  const qs = new URLSearchParams()
  if (params.from) qs.set('from', params.from)
  if (params.to) qs.set('to', params.to)
  if (params.scope) qs.set('scope', params.scope)
  if (params.page) qs.set('page', String(params.page))
  if (params.page_size) qs.set('page_size', String(params.page_size))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  return withEmployeeAuth((token) =>
    apiFetch<PaginatedHolidays>(`/employee/academic-holidays/paged${suffix}`, {
      token,
    }),
  )
}
