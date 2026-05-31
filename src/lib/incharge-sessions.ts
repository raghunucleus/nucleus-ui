import { apiFetch } from './api'
import { withEmployeeAuth } from './employee-auth'

// Mirrors the nucleus-server `InchargeSessions*` shapes — see
// incharge-sessions.controller.ts on the server.

export type SessionStatus =
  | 'scheduled'
  | 'completed'
  | 'cancelled'
  | 'rescheduled'

export interface InchargeSessionEmployee {
  id: number
  emp_code: string
  emp_display_name: string
}

export interface InchargeSessionSubject {
  id: number
  code: string
  name: string
}

export interface InchargeSessionPeriod {
  id: number
  position: number
  label: string
  start_time: string
  end_time: string
  is_break: boolean
}

/**
 * Shape returned by the incharge sessions endpoints — the ClassSession
 * entity with the relations the UI renders. Optional fields are left
 * optional to match the server's `leftJoinAndSelect` semantics.
 */
export interface InchargeSession {
  id: number
  session_date: string
  day_of_week: number
  programme_semester_id: number
  attendance_group_id: number | null
  timetable_period_id: number
  span: number
  timetable_entry_id: number | null
  programme_semester_subject_id: number | null
  programme_semester_subject_option_id: number | null
  subject_id: number | null
  scheduled_employee_id: number | null
  effective_employee_id: number | null
  status: SessionStatus
  cancel_reason: string | null
  room: string | null
  note: string | null

  attendance_group?: { id: number; name: string; code: string } | null
  timetable_period?: InchargeSessionPeriod | null
  programme_semester_subject?: {
    id: number
    placeholder_name: string | null
    subject?: InchargeSessionSubject | null
  } | null
  programme_semester_subject_option?: {
    id: number
    subject?: InchargeSessionSubject | null
  } | null
  subject?: InchargeSessionSubject | null
  scheduled_employee?: InchargeSessionEmployee | null
  effective_employee?: InchargeSessionEmployee | null
}

export interface ListSessionsParams {
  attendance_group_id: number
  from: string
  to: string
  effective_employee_id?: number
  status?: SessionStatus | SessionStatus[]
}

export function fetchInchargeSessions(
  params: ListSessionsParams,
): Promise<InchargeSession[]> {
  const qs = new URLSearchParams()
  qs.set('attendance_group_id', String(params.attendance_group_id))
  qs.set('from', params.from)
  qs.set('to', params.to)
  if (params.effective_employee_id !== undefined) {
    qs.set('effective_employee_id', String(params.effective_employee_id))
  }
  if (params.status !== undefined) {
    if (Array.isArray(params.status)) {
      for (const s of params.status) qs.append('status', s)
    } else {
      qs.set('status', params.status)
    }
  }
  return withEmployeeAuth((token) =>
    apiFetch<InchargeSession[]>(
      `/employee/attendance-incharge/sessions?${qs.toString()}`,
      { token },
    ),
  )
}

export function cancelInchargeSession(
  sessionId: number,
  body: { reason: string },
): Promise<InchargeSession> {
  return withEmployeeAuth((token) =>
    apiFetch<InchargeSession>(
      `/employee/attendance-incharge/sessions/${sessionId}/cancel`,
      { method: 'POST', body, token },
    ),
  )
}

export function uncancelInchargeSession(
  sessionId: number,
  body: { reason?: string } = {},
): Promise<InchargeSession> {
  return withEmployeeAuth((token) =>
    apiFetch<InchargeSession>(
      `/employee/attendance-incharge/sessions/${sessionId}/uncancel`,
      { method: 'POST', body, token },
    ),
  )
}

export function substituteInchargeSession(
  sessionId: number,
  body: { new_effective_employee_id: number; reason?: string },
): Promise<InchargeSession> {
  return withEmployeeAuth((token) =>
    apiFetch<InchargeSession>(
      `/employee/attendance-incharge/sessions/${sessionId}/substitute`,
      { method: 'POST', body, token },
    ),
  )
}

export function moveInchargeSession(
  sessionId: number,
  body: {
    new_timetable_period_id?: number
    new_session_date?: string
    allow_conflict?: boolean
    allow_holiday?: boolean
    reason?: string
  },
): Promise<InchargeSession> {
  return withEmployeeAuth((token) =>
    apiFetch<InchargeSession>(
      `/employee/attendance-incharge/sessions/${sessionId}/move`,
      { method: 'POST', body, token },
    ),
  )
}

/** Move several sessions to the same destination atomically (all or none) —
 *  used to reschedule an elective slot's option children together. */
export function moveInchargeSessionsBatch(
  sessionIds: number[],
  body: {
    new_timetable_period_id?: number
    new_session_date?: string
    allow_conflict?: boolean
    allow_holiday?: boolean
    reason?: string
  },
): Promise<InchargeSession[]> {
  return withEmployeeAuth((token) =>
    apiFetch<InchargeSession[]>(
      `/employee/attendance-incharge/sessions/move-batch`,
      { method: 'POST', body: { session_ids: sessionIds, ...body }, token },
    ),
  )
}

/** In-place edit of a session's content. Date/period are NOT here — use
 *  moveInchargeSession for those. Send only the fields that change. */
export interface EditSessionInput {
  programme_semester_subject_id?: number
  programme_semester_subject_option_id?: number | null
  scheduled_employee_id?: number
  room?: string | null
  note?: string | null
  reason?: string
}

export function editInchargeSession(
  sessionId: number,
  body: EditSessionInput,
): Promise<InchargeSession> {
  return withEmployeeAuth((token) =>
    apiFetch<InchargeSession>(
      `/employee/attendance-incharge/sessions/${sessionId}`,
      { method: 'PATCH', body, token },
    ),
  )
}

/** Push a one-off / makeup class for a single day, not tied to a template
 *  cell. Survives later week-republishes (timetable_entry_id is NULL). */
export interface CreateAdHocSessionInput {
  session_date: string
  programme_semester_id: number
  attendance_group_id: number
  timetable_period_id: number
  programme_semester_subject_id: number
  programme_semester_subject_option_id?: number | null
  scheduled_employee_id: number
  room?: string | null
  note?: string | null
  allow_holiday?: boolean
  reason?: string
}

export function createInchargeAdHoc(
  body: CreateAdHocSessionInput,
): Promise<InchargeSession> {
  return withEmployeeAuth((token) =>
    apiFetch<InchargeSession>(
      `/employee/attendance-incharge/sessions/ad-hoc`,
      { method: 'POST', body, token },
    ),
  )
}

export interface InchargeHoliday {
  id: number
  date: string
  end_date: string | null
  name: string
  scope: 'institution' | 'programme' | 'group'
  type: 'public' | 'institutional' | 'unplanned' | 'half_day'
}

/** Declared holidays overlapping [from, to] for a group — used to warn before
 *  scheduling on a no-class day. */
export function fetchInchargeHolidays(params: {
  attendance_group_id: number
  from: string
  to: string
}): Promise<InchargeHoliday[]> {
  const qs = new URLSearchParams({
    attendance_group_id: String(params.attendance_group_id),
    from: params.from,
    to: params.to,
  }).toString()
  return withEmployeeAuth((token) =>
    apiFetch<InchargeHoliday[]>(
      `/employee/attendance-incharge/sessions/holidays?${qs}`,
      { token },
    ),
  )
}
