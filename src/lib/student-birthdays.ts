import { ApiError, apiFetch } from './api'
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  storeTokens,
  type AuthTokens,
} from './student-auth'
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

/** A calendar-month bucket of upcoming birthdays, in chronological order. */
export interface BirthdayMonth {
  /** e.g. "June 2026" — unambiguous when the list wraps into next year. */
  label: string
  people: BirthdayPerson[]
}

/**
 * Group people by the month of their next birthday, preserving the incoming
 * (days_until) order so months come out chronologically from now forward.
 */
export function groupByMonth(people: BirthdayPerson[]): BirthdayMonth[] {
  const months: BirthdayMonth[] = []
  for (const person of people) {
    const d = new Date(`${person.date}T00:00:00`)
    const label = Number.isNaN(d.getTime())
      ? 'Later'
      : d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
    const bucket = months.find((m) => m.label === label)
    if (bucket) bucket.people.push(person)
    else months.push({ label, people: [person] })
  }
  return months
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

// Local mirror of student-auth's (non-exported) withAuth: run an authenticated
// call, refresh once on 401, otherwise clear the session and surface a 401.
async function withAuth<T>(call: (token: string) => Promise<T>): Promise<T> {
  const token = getAccessToken()
  if (!token) {
    throw new ApiError(401, 'Your session has ended. Please sign in again.')
  }
  try {
    return await call(token)
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      const refreshed = await tryRefresh()
      if (refreshed) return call(refreshed)
      clearTokens()
      throw new ApiError(401, 'Your session has expired. Please sign in again.')
    }
    throw err
  }
}

async function tryRefresh(): Promise<string | null> {
  const refreshToken = getRefreshToken()
  if (!refreshToken) return null
  try {
    const tokens = await apiFetch<AuthTokens>('/student/auth/refresh', {
      method: 'POST',
      body: { refreshToken },
    })
    storeTokens(tokens)
    return tokens.accessToken
  } catch {
    return null
  }
}
