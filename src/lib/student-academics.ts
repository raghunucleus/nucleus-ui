import { apiFetch } from './api'
import type { AcademicHoliday } from './holidays'
import { withAuth } from './student-auth'

// ---------------------------------------------------------------------------
// Types — mirror the nucleus-server student-academics responses.
// ---------------------------------------------------------------------------

export interface SubjectAttendanceRow {
  subject_id: number
  subject_code: string
  subject_name: string
  attended: number
  held: number
  pct: number
  last_session_at: string | null
}

export interface DashboardResult {
  programme_semester_id: number
  semester_number: number | null
  per_subject: SubjectAttendanceRow[]
  overall_attended: number
  overall_held: number
  overall_pct: number
}

export type ClassSessionStatus =
  | 'scheduled'
  | 'completed'
  | 'cancelled'
  | 'rescheduled'

export type AttendanceMarkStatus =
  | 'present'
  | 'absent'
  | 'late'
  | 'exempt'
  | 'od'
  /** Sanctioned absence — an approved leave covered the date. */
  | 'leave'

export interface WeekCell {
  date: string
  /** ISO weekday — 1=Mon … 7=Sun. */
  day_of_week: number
  timetable_period_id: number
  period_label: string
  /** 'HH:MM:SS' from PG `time`. */
  start_time: string
  end_time: string
  /** Number of consecutive periods this session covers (>1 for labs). */
  span: number
  session_id: number
  subject_id: number
  subject_code: string
  subject_name: string
  is_elective: boolean
  teacher_employee_id: number | null
  teacher_display_name: string | null
  status: ClassSessionStatus
  attendance_status: AttendanceMarkStatus | null
  /** An approved leave covers this date — an unmarked session renders as "Leave". */
  on_leave: boolean
  room: string | null
}

export interface WeekBreakRow {
  position: number
  label: string
  start_time: string
  end_time: string
}

export interface WeekResult {
  week_start: string
  week_end: string
  /** ISO weekdays the bell schedule runs (1=Mon … 7=Sun). */
  working_days: number[]
  breaks: WeekBreakRow[]
  cells: WeekCell[]
}

// ---------------------------------------------------------------------------
// API calls — all student-scoped via JWT; never accept a studentId from JS.
// ---------------------------------------------------------------------------

/**
 * Fetch the student's class sessions in a date window. When `dayOfWeek`
 * is supplied (1=Mon..7=Sun), the server filters to just that weekday —
 * used by the lazy per-day chip view so we don't pull a full week's
 * worth of sessions to render one day.
 */
export function fetchStudentWeek(
  weekStart: string,
  weekEnd: string,
  dayOfWeek?: number,
): Promise<WeekResult> {
  const params: Record<string, string> = {
    week_start: weekStart,
    week_end: weekEnd,
  }
  if (dayOfWeek !== undefined) {
    params.day_of_week = String(dayOfWeek)
  }
  const qs = new URLSearchParams(params).toString()
  return withAuth((token) =>
    apiFetch<WeekResult>(`/student/timetable/week?${qs}`, { token }),
  )
}

export function fetchStudentAttendanceDashboard(): Promise<DashboardResult> {
  return withAuth((token) =>
    apiFetch<DashboardResult>('/student/attendance/dashboard', { token }),
  )
}

// ---- Exam results -------------------------------------------------------

export interface ExamResultAttempt {
  exam_type: string
  exam_date: string
  grade: string
  grade_points: number
  grade_meaning: string
  is_best: boolean
}

export interface ExamResultSubject {
  subject_code: string
  subject_name: string
  credits: number
  grade: string
  grade_points: number
  grade_meaning: string
  exam_type: string
  attempts_count: number
  attempts: ExamResultAttempt[]
}

export interface ExamResultSemester {
  semester: number
  sgpa: number
  total_credits: number
  subjects_count: number
  passed_count: number
  backlog_count: number
  passed: boolean
  subjects: ExamResultSubject[]
}

export interface ExamResultsView {
  has_results: boolean
  context: { programme: string; admission_year: string }
  cgpa: number
  total_credits: number
  semesters_count: number
  subjects_count: number
  passed_count: number
  backlog_count: number
  semesters: ExamResultSemester[]
}

/** The signed-in student's own exam results (CGPA, per-semester SGPA, grades). */
export function fetchStudentExamResults(): Promise<ExamResultsView> {
  return withAuth((token) =>
    apiFetch<ExamResultsView>('/student/exam-results', { token }),
  )
}

export interface SubjectSessionRow {
  session_id: number
  date: string
  /** ISO weekday — 1=Mon … 7=Sun. */
  day_of_week: number
  period_label: string | null
  start_time: string | null
  end_time: string | null
  /** `cancelled` rows are kept so the student can see why a class went
   *  missing instead of it silently vanishing. */
  session_status: ClassSessionStatus
  cancel_reason: string | null
  /** The student's own mark for this session. `null` means the teacher
   *  hasn't marked it yet (or the session is still in the future). */
  attendance_status: AttendanceMarkStatus | null
  /** An approved leave covers this date — see WeekCell.on_leave. */
  on_leave: boolean
  is_substitute: boolean
  teacher_display_name: string | null
  room: string | null
}

export interface SubjectSessionsResult {
  subject: { id: number; code: string; name: string }
  sessions: SubjectSessionRow[]
}

/**
 * Drill-down for one subject: every class_session the student was on
 * the roster for, with their per-session mark. Powers the expandable
 * subject card on the attendance dashboard.
 */
export function fetchStudentSubjectSessions(
  subjectId: number,
): Promise<SubjectSessionsResult> {
  return withAuth((token) =>
    apiFetch<SubjectSessionsResult>(
      `/student/attendance/subject/${subjectId}/sessions`,
      { token },
    ),
  )
}

/**
 * Holidays that apply to the signed-in student — institution-wide ones plus
 * any scoped to their programme or attendance group. Scoped server-side from
 * the JWT; the optional window narrows the result.
 */
export function fetchStudentHolidays(range?: {
  from?: string
  to?: string
}): Promise<AcademicHoliday[]> {
  const qs = new URLSearchParams()
  if (range?.from) qs.set('from', range.from)
  if (range?.to) qs.set('to', range.to)
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  return withAuth((token) =>
    apiFetch<AcademicHoliday[]>(`/student/academic-holidays${suffix}`, { token }),
  )
}

/** One page of the student's scoped holiday calendar. Mirrors the server's
 *  `PaginatedHolidays`. */
export interface PaginatedHolidays {
  items: AcademicHoliday[]
  total: number
  page: number
  page_size: number
  has_more: boolean
}

/**
 * Page-windowed variant of {@link fetchStudentHolidays} for the holiday browser
 * with year/month/range filters. The window (from/to) and page are server-side
 * scoped to the signed-in student.
 */
export function fetchStudentHolidaysPaged(params: {
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
  return withAuth((token) =>
    apiFetch<PaginatedHolidays>(`/student/academic-holidays/paged${suffix}`, {
      token,
    }),
  )
}

// ---------------------------------------------------------------------------
// Date helpers — week-of-day in IST without pulling in a date library.
// ---------------------------------------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000

/** Local-time ISO date (YYYY-MM-DD) for the given Date. */
export function toIsoDate(date: Date): string {
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

/** Monday of the week containing `date` (local time). */
export function startOfWeek(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const dow = d.getDay() // 0=Sun
  const diff = dow === 0 ? -6 : 1 - dow
  d.setDate(d.getDate() + diff)
  return d
}

/** Date + n days, as a new Date at local midnight. */
export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS)
}

/** "HH:MM" from a "HH:MM:SS" or "HH:MM" string — drops seconds. */
export function shortTime(t: string): string {
  return t.length >= 5 ? t.slice(0, 5) : t
}

/** Pretty week range, e.g. "27 May – 02 Jun". */
export function formatWeekRange(weekStart: string, weekEnd: string): string {
  const fmt = new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
  })
  const start = new Date(`${weekStart}T00:00:00`)
  const end = new Date(`${weekEnd}T00:00:00`)
  return `${fmt.format(start)} – ${fmt.format(end)}`
}
