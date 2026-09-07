import { apiFetch } from './api'
import { withEmployeeAuth } from './employee-auth'
import type { InchargeGroupSummary } from './incharge-attendance'

/**
 * Client for the `attendance.incharge.analytics.view` screen.
 *
 * Every read is pinned to one attendance group the caller is incharge of and
 * one programme semester of that group's batch. `from`/`to` are both-or-neither
 * and switch the server's `basis`:
 *
 *   - omitted  → `'rollup'`: the whole semester, read from the same rollup the
 *                student's own dashboard uses, so the numbers match exactly and
 *                OD / medical adjustments are included.
 *   - supplied → `'sessions'`: a live scan of the marked sessions in the window.
 *                Adjustments are excluded — a delta has no session to pin it to.
 *
 * Surface the basis in the UI whenever a range is active; the two are not
 * interchangeable and a defaulter list built on the wrong one is wrong.
 */

export type AnalyticsBasis = 'rollup' | 'sessions'

export interface AnalyticsRange {
  group_id: number
  programme_semester_id: number
  from?: string
  to?: string
}

export interface SemesterSummary {
  id: number
  programme_id: number
  admission_year_id: number
  semester_id: number
  status: string
  planned_start_date: string | null
  planned_end_date: string | null
  semester: { id: number; sem_number: number; code: string }
}

export interface AnalyticsGroup extends InchargeGroupSummary {
  programme_semesters: SemesterSummary[]
  default_programme_semester_id: number | null
}

export interface BandDef {
  key: string
  label: string
  min: number
  max: number
}

export interface BandTally {
  key: string
  label: string
  count: number
}

export interface PerSubject {
  student_id: number
  subject_id: number
  subject_code: string
  subject_name: string
  attended: number
  held: number
  pct: number
  band: string
  below_threshold: boolean
  below_condonation: boolean
}

export interface StudentRow {
  student_id: number
  roll_no: string
  display_name: string
  attended: number
  held: number
  pct: number
  band: string
  below_threshold: boolean
  below_condonation: boolean
  /** Null when even a perfect run can't reach the threshold. */
  sessions_needed: number | null
  max_achievable_pct: number
  current_absent_streak: number
  joined_group_estimate: string | null
  per_subject: PerSubject[]
}

export interface StudentsResult {
  basis: AnalyticsBasis
  sessions_remaining: number
  rows: StudentRow[]
}

export interface StudentSession {
  session_id: number
  session_date: string
  day_of_week: number
  period_position: number
  period_label: string
  start_time: string
  end_time: string
  span: number
  subject_id: number
  subject_code: string
  subject_name: string
  is_elective: boolean
  teacher_display_name: string | null
  is_substitute: boolean
  status: string
}

export interface StudentDetailResult {
  basis: AnalyticsBasis
  student: StudentRow
  sessions: StudentSession[]
}

export interface SubjectRow {
  subject_id: number
  subject_code: string
  subject_name: string
  attended: number
  held: number
  pct: number
  band: string
  bands: BandTally[]
  teachers: string[]
  sessions_marked: number
  sessions_overdue_unmarked: number
  sessions_upcoming: number
  sessions_cancelled: number
  worst_students: Array<{
    student_id: number
    roll_no: string
    display_name: string
    attended: number
    held: number
    pct: number
  }>
}

export interface TeacherRow {
  employee_id: number
  emp_code: string | null
  emp_display_name: string | null
  sessions: number
  marked: number
  overdue_unmarked: number
  upcoming: number
  cancelled: number
  substituted_in: number
  compliance_pct: number
}

export interface DailyRow {
  session_date: string
  day_of_week: number
  attended: number
  held: number
  sessions_marked: number
  overdue_unmarked: number
  upcoming: number
  cancelled: number
  pct: number
  band: string
}

export interface DailyResult {
  basis: AnalyticsBasis
  days: DailyRow[]
  /** A missing (student, date) cell means no marked session that day — render
   *  it as "no session", never as an absence. */
  matrix: {
    dates: string[]
    cells: Array<{
      student_id: number
      session_date: string
      attended: number
      held: number
      pct: number
    }>
  } | null
}

export interface DaySessionRow {
  session_id: number
  period_position: number
  period_label: string
  start_time: string
  end_time: string
  span: number
  subject_id: number
  subject_code: string
  subject_name: string
  is_elective: boolean
  is_cross_group: boolean
  teacher_display_name: string | null
  is_substitute: boolean
  status: string
  room: string | null
  attended: number
  marked: number
  pct: number
  students: Array<{
    session_id: number
    student_id: number
    roll_no: string
    display_name: string
    status: string
  }>
}

export interface DayDetailResult {
  date: string
  sessions: DaySessionRow[]
}

export type SessionState =
  | 'marked'
  | 'overdue_unmarked'
  | 'upcoming'
  | 'cancelled'

export interface SessionLogRow {
  session_id: number
  session_date: string
  day_of_week: number
  period_position: number
  period_label: string
  start_time: string
  span: number
  subject_id: number
  subject_code: string
  subject_name: string
  scheduled_teacher: string | null
  effective_teacher: string | null
  is_substitute: boolean
  is_adhoc: boolean
  is_elective: boolean
  is_cross_group: boolean
  status: string
  room: string | null
  cancel_reason: string | null
  attendance_marked_at: string | null
  marked: number
  attended: number
  pct: number
  state: SessionState
}

export interface ComplianceResult {
  marked: number
  overdue_unmarked: number
  upcoming: number
  cancelled: number
  marked_but_empty: number
  pct: number
  /** The semester is no longer `ongoing`, so the unmarked backlog can never be
   *  cleared — report it as history, not as a to-do. */
  is_locked: boolean
}

export interface BucketRow {
  bucket: number
  attended: number
  held: number
  sessions: number
  pct: number
}

export interface OverviewResult {
  basis: AnalyticsBasis
  thresholds: { threshold: number; condonation: number; bands: BandDef[] }
  kpi: {
    students: number
    attended: number
    held: number
    pct: number
    below_threshold: number
    below_condonation: number
    sessions_remaining: number
  }
  bands: BandTally[]
  compliance: ComplianceResult
  trend: DailyRow[]
  by_weekday: BucketRow[]
  /** Span-expanded so a lab counts against every period it occupies. Per-bar
   *  percentages are valid; the column total is not — never sum this axis. */
  by_period: BucketRow[]
  warnings: {
    duplicate_elective_sessions: number
    timetable_templates: number
  }
  top_defaulters: StudentRow[]
}

const BASE = '/employee/attendance-analytics'

function qs(range: AnalyticsRange, extra?: Record<string, string>): string {
  const p = new URLSearchParams({
    group_id: String(range.group_id),
    programme_semester_id: String(range.programme_semester_id),
  })
  // Both-or-neither: the server rejects a half-open range.
  if (range.from && range.to) {
    p.set('from', range.from)
    p.set('to', range.to)
  }
  for (const [k, v] of Object.entries(extra ?? {})) {
    if (v) p.set(k, v)
  }
  return p.toString()
}

function get<T>(path: string): Promise<T> {
  return withEmployeeAuth((token) => apiFetch<T>(path, { token }))
}

export function fetchAnalyticsScope(): Promise<{ groups: AnalyticsGroup[] }> {
  return get(`${BASE}/scope`)
}

export function fetchAnalyticsOverview(
  range: AnalyticsRange,
): Promise<OverviewResult> {
  return get(`${BASE}/overview?${qs(range)}`)
}

export function fetchAnalyticsStudents(
  range: AnalyticsRange,
): Promise<StudentsResult> {
  return get(`${BASE}/students?${qs(range)}`)
}

export function fetchAnalyticsStudent(
  range: AnalyticsRange,
  studentId: number,
): Promise<StudentDetailResult> {
  return get(`${BASE}/students/${studentId}?${qs(range)}`)
}

export function fetchAnalyticsSubjects(
  range: AnalyticsRange,
): Promise<{ basis: AnalyticsBasis; rows: SubjectRow[] }> {
  return get(`${BASE}/subjects?${qs(range)}`)
}

export function fetchAnalyticsTeachers(
  range: AnalyticsRange,
): Promise<TeacherRow[]> {
  return get(`${BASE}/teachers?${qs(range)}`)
}

export function fetchAnalyticsDaily(
  range: AnalyticsRange,
  matrix = false,
): Promise<DailyResult> {
  return get(
    `${BASE}/daily?${qs(range, matrix ? { matrix: 'true' } : undefined)}`,
  )
}

export function fetchAnalyticsDay(
  range: AnalyticsRange,
  date: string,
): Promise<DayDetailResult> {
  return get(`${BASE}/daily/${date}?${qs(range)}`)
}

export function fetchAnalyticsSessions(
  range: AnalyticsRange,
  filters?: { subject_id?: number; state?: string },
): Promise<{ rows: SessionLogRow[] }> {
  return get(
    `${BASE}/sessions?${qs(range, {
      subject_id: filters?.subject_id ? String(filters.subject_id) : '',
      state: filters?.state ?? '',
    })}`,
  )
}
