import { apiFetch } from './api'
import { fetchWholeCohort } from './birthday-months'
import { withAuth } from './student-auth'
import type { ModuleColor } from './modules'

/** One classmate birthday — mirrors the nucleus-server GET /student/birthdays row. */
export interface BirthdayPerson {
  id: number
  display_name: string
  /** Roll number — searchable alongside the name. */
  student_id: string
  /** The section (attendance-group code) shared with the caller. */
  section: string | null
  /** Days from today until the next occurrence; 0 = today. */
  days_until: number
  /** ISO date of the next occurrence (no birth year is ever returned). */
  date: string
  /** Stable (~12h) photo URL; null when unset or hidden by privacy. */
  photo_url: string | null
}

/** One page of classmate birthdays — mirrors the server response. */
export interface BirthdayPage {
  /** Total matching classmates ignoring limit/offset — drives "has more". */
  total: number
  items: BirthdayPerson[]
}

export interface BirthdayQuery {
  limit?: number
  offset?: number
  /** Search over display name OR roll number (server-side). */
  q?: string
}

/**
 * A page of classmates (same attendance group), ordered by how soon their next
 * birthday falls — today first, then the rest of the year. Paginated so the UI
 * can load on scroll; search spans the whole roster. Always scoped to the
 * signed-in student server-side.
 */
export function studentBirthdays(
  params: BirthdayQuery = {},
): Promise<BirthdayPage> {
  const qs = new URLSearchParams()
  if (params.limit != null) qs.set('limit', String(params.limit))
  if (params.offset != null) qs.set('offset', String(params.offset))
  if (params.q) qs.set('q', params.q)
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  return withAuth((token) =>
    apiFetch<BirthdayPage>(`/student/birthdays${suffix}`, { token }),
  )
}

/**
 * The whole class group in one go. A section is at most a few hundred people,
 * so the birthdays screen holds all of them and does its month browsing and
 * searching locally instead of paging.
 */
export function fetchAllStudentBirthdays(): Promise<BirthdayPerson[]> {
  return fetchWholeCohort((params) => studentBirthdays(params))
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
