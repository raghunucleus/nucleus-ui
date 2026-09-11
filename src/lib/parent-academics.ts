import { ApiError, apiFetch } from './api'
import type { AcademicHoliday } from './holidays'
import { getSelectedStudentId, withParentAuth } from './parent-auth'

// ---------------------------------------------------------------------------
// Child-scoped academics for the parent portal. The guardian endpoints reuse
// the server's StudentPortalService, so their responses are identical to the
// student ones — we re-export the shapes + date helpers from student-academics
// rather than redefining them. Every call targets /guardian/students/:id/... ,
// where :id is the child the guardian has selected (read from localStorage to
// avoid a store import cycle); the server's GuardianLinkGuard re-checks the
// link on every request.
// ---------------------------------------------------------------------------

export type {
  AllSessionRow,
  AllSessionsResult,
  AttendanceMarkStatus,
  ClassSessionStatus,
  DashboardResult,
  ExamResultAttempt,
  ExamResultSemester,
  ExamResultSubject,
  ExamResultsView,
  PaginatedHolidays,
  SessionSubject,
  SubjectAttendanceRow,
  SubjectSessionRow,
  SubjectSessionsResult,
  WeekBreakRow,
  WeekCell,
  WeekResult,
} from './student-academics'
export {
  addDays,
  formatWeekRange,
  shortTime,
  startOfWeek,
  toIsoDate,
} from './student-academics'

import type {
  AllSessionsResult,
  DashboardResult,
  ExamResultsView,
  PaginatedHolidays,
  SubjectSessionsResult,
  WeekResult,
} from './student-academics'

/** The selected child's id, or throw a 400 — pages only mount with one set. */
function requireSelectedStudent(): number {
  const id = getSelectedStudentId()
  if (id == null) {
    throw new ApiError(400, 'No child selected. Pick a student to continue.')
  }
  return id
}

export function fetchChildWeek(
  weekStart: string,
  weekEnd: string,
  dayOfWeek?: number,
): Promise<WeekResult> {
  const id = requireSelectedStudent()
  const params: Record<string, string> = {
    week_start: weekStart,
    week_end: weekEnd,
  }
  if (dayOfWeek !== undefined) params.day_of_week = String(dayOfWeek)
  const qs = new URLSearchParams(params).toString()
  return withParentAuth((token) =>
    apiFetch<WeekResult>(`/guardian/students/${id}/timetable/week?${qs}`, {
      token,
    }),
  )
}

export function fetchChildAttendanceDashboard(): Promise<DashboardResult> {
  const id = requireSelectedStudent()
  return withParentAuth((token) =>
    apiFetch<DashboardResult>(
      `/guardian/students/${id}/attendance/dashboard`,
      { token },
    ),
  )
}

export function fetchChildSubjectSessions(
  subjectId: number,
): Promise<SubjectSessionsResult> {
  const id = requireSelectedStudent()
  return withParentAuth((token) =>
    apiFetch<SubjectSessionsResult>(
      `/guardian/students/${id}/attendance/subject/${subjectId}/sessions`,
      { token },
    ),
  )
}

export function fetchChildAllSessions(): Promise<AllSessionsResult> {
  const id = requireSelectedStudent()
  return withParentAuth((token) =>
    apiFetch<AllSessionsResult>(
      `/guardian/students/${id}/attendance/sessions`,
      { token },
    ),
  )
}

export function fetchChildExamResults(): Promise<ExamResultsView> {
  const id = requireSelectedStudent()
  return withParentAuth((token) =>
    apiFetch<ExamResultsView>(`/guardian/students/${id}/exam-results`, {
      token,
    }),
  )
}

export function fetchChildHolidaysPaged(params: {
  from?: string
  to?: string
  scope?: 'upcoming' | 'past'
  page?: number
  page_size?: number
}): Promise<PaginatedHolidays> {
  const id = requireSelectedStudent()
  const qs = new URLSearchParams()
  if (params.from) qs.set('from', params.from)
  if (params.to) qs.set('to', params.to)
  if (params.scope) qs.set('scope', params.scope)
  if (params.page) qs.set('page', String(params.page))
  if (params.page_size) qs.set('page_size', String(params.page_size))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  return withParentAuth((token) =>
    apiFetch<PaginatedHolidays>(
      `/guardian/students/${id}/academic-holidays/paged${suffix}`,
      { token },
    ),
  )
}

// Holidays come back without the `scope` field for guardians (institution-wide
// only), but HolidayList never reads scope — so PaginatedHolidays.items are
// safe to render as AcademicHoliday[].
export type { AcademicHoliday }
