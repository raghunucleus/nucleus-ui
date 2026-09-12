import { apiFetch } from './api'
import { fetchWholeCohort } from './birthday-months'
import { withEmployeeAuth } from './employee-auth'
import type { ModuleColor } from './modules'

/** One colleague birthday — mirrors the nucleus-server GET /employee/birthdays row. */
export interface BirthdayPerson {
  id: number
  display_name: string
  /** Employee code — searchable alongside the name. */
  emp_code: string
  /** The department shared with the caller. */
  department: string | null
  /** Days from today until the next occurrence; 0 = today. */
  days_until: number
  /** ISO date of the next occurrence (no birth year is ever returned). */
  date: string
}

/** One page of colleague birthdays — mirrors the server response. */
export interface BirthdayPage {
  /** Total matching colleagues ignoring limit/offset — drives "has more". */
  total: number
  items: BirthdayPerson[]
}

export interface BirthdayQuery {
  limit?: number
  offset?: number
  /** Search over display name OR employee code (server-side). */
  q?: string
}

/**
 * A page of colleagues (same department), ordered by how soon their next
 * birthday falls — today first, then the rest of the year. Paginated so the UI
 * can load on scroll; search spans the whole department. Always scoped to the
 * signed-in employee's own department server-side.
 */
export function employeeBirthdays(
  params: BirthdayQuery = {},
): Promise<BirthdayPage> {
  const qs = new URLSearchParams()
  if (params.limit != null) qs.set('limit', String(params.limit))
  if (params.offset != null) qs.set('offset', String(params.offset))
  if (params.q) qs.set('q', params.q)
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  return withEmployeeAuth((token) =>
    apiFetch<BirthdayPage>(`/employee/birthdays${suffix}`, { token }),
  )
}

/**
 * The whole department in one go. Departments are small, so the birthdays
 * screen holds every colleague and does its month browsing and searching
 * locally instead of paging.
 */
export function fetchAllEmployeeBirthdays(): Promise<BirthdayPerson[]> {
  return fetchWholeCohort((params) => employeeBirthdays(params))
}

const AVATAR_COLORS: ModuleColor[] = [
  'violet',
  'blue',
  'emerald',
  'amber',
  'rose',
  'cyan',
  'orange',
]

/** Deterministic accent hue per person, so a name always maps to one colour. */
export function avatarColorFor(name: string): ModuleColor {
  let hash = 0
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}
