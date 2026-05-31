import { apiFetch } from './api'
import { withEmployeeAuth } from './employee-auth'

// Mirrors the nucleus-server `InchargeSchedule*` response shapes.

export interface IncharqeTimetableSummary {
  id: number
  programme_semester_id: number
  attendance_group_id: number
  name: string
  is_default: boolean
  working_days: number[]
  period_count: number
  teaching_period_count: number
  entry_count: number
  attendance_group?: { id: number; name: string }
  programme_semester?: unknown
}

/** Detailed timetable shape returned by GET /timetables/:id. Mirrors the
 *  TypeORM `Timetable` entity with relations eagerly loaded. */
export interface IncharqeTimetable {
  id: number
  programme_semester_id: number
  attendance_group_id: number
  name: string
  is_default: boolean
  working_days: number[]
  periods: TimetablePeriod[]
  courses: TimetableCourse[]
  entries: TimetableEntry[]
  attendance_group: { id: number; name: string; code: string }
  programme_semester: {
    id: number
    semester?: { id: number; sem_number: number; code: string }
    admission_year?: { id: number; year: number; display_year: string }
    programme?: { id: number; name: string; display_name: string; code: string }
  }
}

export interface TimetablePeriod {
  id: number
  timetable_id: number
  position: number
  label: string
  start_time: string
  end_time: string
  is_break: boolean
}

export interface TimetableCourseFaculty {
  id: number
  timetable_course_id: number
  employee_id: number
  employee?: { id: number; emp_display_name: string; emp_code?: string }
}

export interface TimetableCourse {
  id: number
  timetable_id: number
  subject_id: number | null
  custom_label: string | null
  subject?: { id: number; code: string; name: string } | null
  faculty?: TimetableCourseFaculty[]
}

export interface TimetableEntry {
  id: number
  timetable_id: number
  day_of_week: number
  timetable_period_id: number
  span: number
  programme_semester_subject_id: number | null
  timetable_course_id: number | null
  employee_id: number | null
  room: string | null
  note: string | null
  /** Eagerly joined when the server returns entries with a timetable. */
  programme_semester_subject?: {
    id: number
    subject_id: number | null
    placeholder_name: string | null
    subject?: { id: number; code: string; name: string } | null
  } | null
  timetable_course?: {
    id: number
    custom_label: string | null
    subject?: { id: number; code: string; name: string } | null
  } | null
  employee?: { id: number; emp_display_name: string; emp_code?: string } | null
}

export interface WeekSummary {
  week_start: string
  week_end: string
  scheduled: number
  completed: number
  cancelled: number
  rescheduled: number
  has_any: boolean
  templates: { id: number; name: string; session_count: number }[]
}

/** Mirrors the server-side `PreviewSession` in `session-seeder.service.ts`. */
export interface PreviewSession {
  session_date: string
  day_of_week: number
  timetable_period_id: number
  period_label: string | null
  period_start_time: string | null
  period_end_time: string | null
  span: number
  timetable_entry_id: number
  programme_semester_subject_id: number
  programme_semester_subject_option_id: number | null
  slot_placeholder_name: string | null
  subject_id: number
  subject_code: string | null
  subject_name: string | null
  scheduled_employee_id: number
  teacher_name: string | null
  teacher_emp_code: string | null
  room: string | null
  /** True when the session already exists — publish will be a no-op for this row. */
  already_exists: boolean
  /** True when this (date, period) slot already holds a marked (completed)
   *  class — publish keeps the held one and skips this row. */
  kept_marked: boolean
}

/** A completed/cancelled session a (re)publish leaves untouched (history). */
export interface KeptSession {
  session_date: string
  day_of_week: number
  timetable_period_id: number
  period_label: string | null
  start_time: string | null
  end_time: string | null
  subject_id: number
  subject_code: string | null
  subject_name: string | null
  teacher_name: string | null
  status: 'completed' | 'cancelled'
}

export interface PreviewResult {
  sessions: PreviewSession[]
  holidays: { date: string; name: string; end_date: string | null }[]
  /** Dates inside [from, to] producing zero sessions because of a holiday
   *  covering them entirely. */
  blocked_dates: string[]
  /** Completed/cancelled sessions in the window publish won't change. */
  kept_sessions: KeptSession[]
}

export interface PublishResult {
  /** Number of new class_session rows written. */
  inserted: number
  /** Holiday-covered days skipped. */
  skipped_holidays: number
  /** Stale scheduled rows from a previous publish replaced before re-seeding. */
  replaced: number
  /** Rows not seeded because their slot already held a marked class. */
  kept_marked: number
  /** Rows not seeded because the caller dropped them in the publish dialog. */
  excluded: number
}

/** Identifies a preview seed row the caller chose NOT to publish. */
export interface PublishExcludeKey {
  session_date: string
  timetable_period_id: number
  programme_semester_subject_id: number
  programme_semester_subject_option_id: number | null
}

// --- API calls ----------------------------------------------------------

export function fetchInchargeTimetables(
  programmeSemesterId?: number,
  attendanceGroupId?: number,
): Promise<IncharqeTimetableSummary[]> {
  const params = new URLSearchParams()
  if (programmeSemesterId !== undefined)
    params.set('programmeSemesterId', String(programmeSemesterId))
  if (attendanceGroupId !== undefined)
    params.set('attendanceGroupId', String(attendanceGroupId))
  const qs = params.toString()
  return withEmployeeAuth((token) =>
    apiFetch<IncharqeTimetableSummary[]>(
      `/employee/attendance-incharge/timetables${qs ? `?${qs}` : ''}`,
      { token },
    ),
  )
}

export function fetchInchargeTimetable(id: number): Promise<IncharqeTimetable> {
  return withEmployeeAuth((token) =>
    apiFetch<IncharqeTimetable>(
      `/employee/attendance-incharge/timetables/${id}`,
      { token },
    ),
  )
}

export function updateInchargeTimetable(
  id: number,
  patch: { name?: string; working_days?: number[] },
): Promise<IncharqeTimetable> {
  return withEmployeeAuth((token) =>
    apiFetch<IncharqeTimetable>(
      `/employee/attendance-incharge/timetables/${id}`,
      { method: 'PATCH', body: patch, token },
    ),
  )
}

export function fetchInchargeWeekSummaries(
  id: number,
  weekStarts: string[],
): Promise<WeekSummary[]> {
  return withEmployeeAuth((token) =>
    apiFetch<WeekSummary[]>(
      `/employee/attendance-incharge/timetables/${id}/week-summaries`,
      { method: 'POST', body: { week_starts: weekStarts }, token },
    ),
  )
}

/**
 * Window passed to preview / publish. `days_of_week` is optional — when
 * supplied (ISO weekday list, 1=Mon..7=Sun), preview only enumerates
 * those days and publish wipes + reseeds only those days. Omit for the
 * default full-window behavior.
 */
export interface InchargeWeekWindow {
  from: string
  to: string
  days_of_week?: number[]
  /** Preview rows to skip on publish (manual per-row "Don't add"). */
  exclude?: PublishExcludeKey[]
  /** Notify the group's students of the change (publish dialog default: true). */
  notify?: boolean
}

export function previewInchargeWeek(
  id: number,
  window: InchargeWeekWindow,
): Promise<PreviewResult> {
  return withEmployeeAuth((token) =>
    apiFetch<PreviewResult>(
      `/employee/attendance-incharge/timetables/${id}/preview-week`,
      { method: 'POST', body: window, token },
    ),
  )
}

export function publishInchargeWeek(
  id: number,
  window: InchargeWeekWindow,
): Promise<PublishResult> {
  return withEmployeeAuth((token) =>
    apiFetch<PublishResult>(
      `/employee/attendance-incharge/timetables/${id}/publish-week`,
      { method: 'POST', body: window, token },
    ),
  )
}

export function setInchargeTimetableDefault(
  id: number,
): Promise<IncharqeTimetable> {
  return withEmployeeAuth((token) =>
    apiFetch<IncharqeTimetable>(
      `/employee/attendance-incharge/timetables/${id}/set-default`,
      { method: 'POST', token },
    ),
  )
}

// --- create / structural edits -----------------------------------------

export interface CreateTimetableInput {
  programme_semester_id: number
  attendance_group_id: number
  name: string
  working_days: number[]
  periods: {
    label: string
    start_time: string
    end_time: string
    is_break: boolean
  }[]
}

export function createInchargeTimetable(
  input: CreateTimetableInput,
): Promise<IncharqeTimetable> {
  return withEmployeeAuth((token) =>
    apiFetch<IncharqeTimetable>('/employee/attendance-incharge/timetables', {
      method: 'POST',
      body: input,
      token,
    }),
  )
}

export function saveInchargePeriods(
  timetableId: number,
  periods: {
    id?: number
    label: string
    start_time: string
    end_time: string
    is_break: boolean
  }[],
): Promise<IncharqeTimetable> {
  return withEmployeeAuth((token) =>
    apiFetch<IncharqeTimetable>(
      `/employee/attendance-incharge/timetables/${timetableId}/periods`,
      { method: 'PUT', body: { periods }, token },
    ),
  )
}

export interface UpsertEntryInput {
  day_of_week: number
  timetable_period_id: number
  span: number
  programme_semester_subject_id?: number
  timetable_course_id?: number
  employee_id: number | null
  room: string | null
  note: string | null
}

export function upsertInchargeEntry(
  timetableId: number,
  input: UpsertEntryInput,
): Promise<TimetableEntry> {
  return withEmployeeAuth((token) =>
    apiFetch<TimetableEntry>(
      `/employee/attendance-incharge/timetables/${timetableId}/entries/cell`,
      { method: 'PUT', body: input, token },
    ),
  )
}

export function clearInchargeEntry(
  timetableId: number,
  dayOfWeek: number,
  periodId: number,
): Promise<void> {
  const qs = new URLSearchParams({
    dayOfWeek: String(dayOfWeek),
    periodId: String(periodId),
  }).toString()
  return withEmployeeAuth((token) =>
    apiFetch<void>(
      `/employee/attendance-incharge/timetables/${timetableId}/entries/cell?${qs}`,
      { method: 'DELETE', token },
    ),
  )
}

export function deleteInchargeTimetable(timetableId: number): Promise<void> {
  return withEmployeeAuth((token) =>
    apiFetch<void>(
      `/employee/attendance-incharge/timetables/${timetableId}`,
      { method: 'DELETE', token },
    ),
  )
}

// --- timetable-exclusive courses ---------------------------------------

export interface CreateCourseInput {
  subject_id?: number
  custom_label?: string
  employee_ids: number[]
}

export function createInchargeCourse(
  timetableId: number,
  input: CreateCourseInput,
): Promise<IncharqeTimetable> {
  return withEmployeeAuth((token) =>
    apiFetch<IncharqeTimetable>(
      `/employee/attendance-incharge/timetables/${timetableId}/courses`,
      { method: 'POST', body: input, token },
    ),
  )
}

export function removeInchargeCourse(
  courseId: number,
): Promise<IncharqeTimetable> {
  return withEmployeeAuth((token) =>
    apiFetch<IncharqeTimetable>(
      `/employee/attendance-incharge/timetables/courses/${courseId}`,
      { method: 'DELETE', token },
    ),
  )
}

export function setInchargeCourseFaculty(
  courseId: number,
  employeeIds: number[],
): Promise<IncharqeTimetable> {
  return withEmployeeAuth((token) =>
    apiFetch<IncharqeTimetable>(
      `/employee/attendance-incharge/timetables/courses/${courseId}/faculty`,
      { method: 'PUT', body: { employee_ids: employeeIds }, token },
    ),
  )
}

// --- lookups for the editor pickers ------------------------------------

export interface LookupProgrammeSemester {
  id: number
  programme_id: number
  admission_year_id: number
  semester_id: number
  is_active: boolean
  status: string
  programme: { id: number; name: string; display_name: string; code: string }
  semester: { id: number; sem_number: number; code: string }
  admission_year: { id: number; year: number; display_year: string }
}

export function fetchInchargeProgrammeSemesters(
  attendanceGroupId?: number,
): Promise<LookupProgrammeSemester[]> {
  const params = new URLSearchParams()
  if (attendanceGroupId !== undefined)
    params.set('attendance_group_id', String(attendanceGroupId))
  const qs = params.toString()
  return withEmployeeAuth((token) =>
    apiFetch<LookupProgrammeSemester[]>(
      `/employee/attendance-incharge/timetables/lookups/programme-semesters${qs ? `?${qs}` : ''}`,
      { token },
    ),
  )
}

export interface LookupPssFaculty {
  employee_id: number
  attendance_group_id?: number
  /** Group the allocation belongs to — present on `alternate_faculty` rows so
   *  the editor can label "borrow from <group>". */
  attendance_group?: { id: number; name: string; code?: string }
  employee: { id: number; emp_display_name: string; emp_code: string }
}

export interface LookupPssOption {
  id: number
  subject_id: number
  subject: { id: number; code: string; name: string }
  faculty: LookupPssFaculty[]
}

export interface LookupPss {
  id: number
  programme_semester_id: number
  subject_id: number | null
  placeholder_name: string | null
  slot_type: 'open_elective' | 'honors' | 'minors' | null
  cohort_scope: 'group' | 'programme_semester'
  credits: string
  is_active: boolean
  subject: { id: number; code: string; name: string } | null
  /** The single faculty allocation for the queried group (0 or 1 row). */
  faculty?: LookupPssFaculty[]
  /** Faculty allocated to this subject in OTHER groups of the same PS. */
  alternate_faculty?: LookupPssFaculty[]
  options?: LookupPssOption[]
}

export function fetchInchargePssLookup(
  programmeSemesterId: number,
  attendanceGroupId: number,
): Promise<LookupPss[]> {
  const qs = new URLSearchParams({
    programme_semester_id: String(programmeSemesterId),
    attendance_group_id: String(attendanceGroupId),
  }).toString()
  return withEmployeeAuth((token) =>
    apiFetch<LookupPss[]>(
      `/employee/attendance-incharge/timetables/lookups/programme-semester-subjects?${qs}`,
      { token },
    ),
  )
}

export interface LookupEmployee {
  id: number
  emp_code: string
  emp_display_name: string
}

export function fetchInchargeEmployees(): Promise<LookupEmployee[]> {
  return withEmployeeAuth((token) =>
    apiFetch<LookupEmployee[]>(
      '/employee/attendance-incharge/timetables/lookups/employees',
      { token },
    ),
  )
}
