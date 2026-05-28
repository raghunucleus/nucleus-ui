import { apiFetch } from './api'
import { withEmployeeAuth } from './employee-auth'

// ---------------------------------------------------------------------------
// Types — mirror the nucleus-server teacher-attendance responses.
// ---------------------------------------------------------------------------

export type AttendanceStatus =
  | 'present'
  | 'absent'
  | 'late'
  | 'exempt'
  | 'od'

export type ClassSessionStatus =
  | 'scheduled'
  | 'completed'
  | 'cancelled'
  | 'rescheduled'

export interface TeacherSessionListItem {
  id: number
  session_date: string
  day_of_week: number
  status: ClassSessionStatus
  period: { id: number; label: string; start_time: string; end_time: string }
  span: number
  subject: { id: number; code: string; name: string }
  is_elective: boolean
  attendance_group: { id: number; name: string } | null
  programme_semester_id: number
  programme: {
    id: number
    code: string
    name: string
    display_name: string
  } | null
  semester: { id: number; sem_number: number; code: string } | null
  admission_year: { id: number; year: number; display_year: string } | null
  room: string | null
  scheduled_employee_id: number
  is_substitute: boolean
  attendance_marked_at: string | null
  roster_size: number | null
  attended_count: number | null
}

export interface RosterEntry {
  id: number
  student_id: string
  display_name: string
  current_status: AttendanceStatus | null
}

export interface TeacherRosterResult {
  session_id: number
  status: ClassSessionStatus
  attendance_marked_at: string | null
  students: RosterEntry[]
}

export interface MarkInput {
  entries: { student_id: number; status: AttendanceStatus }[]
  allow_amend?: boolean
}

export interface MarkResultLite {
  roster_size: number
}

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------

export function fetchTeacherDay(
  date: string,
): Promise<TeacherSessionListItem[]> {
  const qs = new URLSearchParams({ date }).toString()
  return withEmployeeAuth((token) =>
    apiFetch<TeacherSessionListItem[]>(
      `/employee/teacher/attendance/day?${qs}`,
      { token },
    ),
  )
}

export function fetchTeacherHistory(
  from: string,
  to: string,
): Promise<TeacherSessionListItem[]> {
  const qs = new URLSearchParams({ from, to }).toString()
  return withEmployeeAuth((token) =>
    apiFetch<TeacherSessionListItem[]>(
      `/employee/teacher/attendance/history?${qs}`,
      { token },
    ),
  )
}

export function fetchTeacherRoster(
  sessionId: number,
): Promise<TeacherRosterResult> {
  return withEmployeeAuth((token) =>
    apiFetch<TeacherRosterResult>(
      `/employee/teacher/attendance/sessions/${sessionId}/roster`,
      { token },
    ),
  )
}

export function markTeacherAttendance(
  sessionId: number,
  input: MarkInput,
): Promise<{ roster_size: number }> {
  return withEmployeeAuth((token) =>
    apiFetch<{ roster_size: number }>(
      `/employee/teacher/attendance/sessions/${sessionId}/mark`,
      { method: 'POST', body: input, token },
    ),
  )
}

/**
 * Sessions for the teacher across a week, sorted ASC by date. Same row shape
 * as the daily list — the timetable UI groups them by `day_of_week` itself.
 */
export function fetchTeacherTimetableWeek(
  weekStart: string,
  weekEnd: string,
): Promise<TeacherSessionListItem[]> {
  const qs = new URLSearchParams({ from: weekStart, to: weekEnd }).toString()
  return withEmployeeAuth((token) =>
    apiFetch<TeacherSessionListItem[]>(
      `/employee/teacher/timetable/week?${qs}`,
      { token },
    ),
  )
}

// ---------------------------------------------------------------------------
// Date / time helpers — local-time ISO date.
// ---------------------------------------------------------------------------

export function toIsoDate(date: Date): string {
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000)
}

/** Monday of the week containing `date` (local time). */
export function startOfWeek(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const dow = d.getDay() // 0 = Sunday
  const diff = dow === 0 ? -6 : 1 - dow
  d.setDate(d.getDate() + diff)
  return d
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

export function shortTime(t: string): string {
  return t.length >= 5 ? t.slice(0, 5) : t
}

export function formatHumanDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  return d.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}
