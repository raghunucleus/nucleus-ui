import { apiFetch } from './api'
import { withEmployeeAuth } from './employee-auth'

/** One (programme × admission-year) batch the employee may upload marks for. */
export interface ExamMarksScopeItem {
  id: number
  programme_id: number
  programme_name: string
  programme_code: string
  admission_year_id: number
  admission_year_display: string
  /** Convenience "Programme / Year" string. */
  label: string
}

/** One parsed grade-sheet row, every cell a string (streamed for validation). */
export interface UploadMarksRow {
  examination: string
  exam_date: string
  roll_number: string
  subject_code: string
  subject_name: string
  credits: string
  grade: string
  grade_points: string
}

export type UploadMarksColumn = keyof UploadMarksRow

/** A per-cell validation problem. `row` is the index into the whole sheet. */
export interface RowError {
  row: number
  column: UploadMarksColumn | string
  value?: string
  reason: string
}

export interface AttemptDetail {
  exam_type: string
  exam_date: string
  credits: number
  grade: string
  grade_points: number
  grade_meaning: string
  is_best: boolean
}

export interface PreviewSubject {
  subject_code: string
  subject_name: string
  credits: number
  grade: string
  grade_points: number
  grade_meaning: string
  exam_type: string
  exam_date: string
  attempts: number
  attempts_detail: AttemptDetail[]
}

export interface PreviewSemester {
  semester: number
  sgpa: number
  total_credits: number
  credit_points: number
  subjects_count: number
  passed_count: number
  backlog_count: number
  passed: boolean
  subjects: PreviewSubject[]
}

/** Full server-computed detail for one student (preview drill-down). */
export interface PreviewStudent {
  student_id: number
  roll_number: string
  name: string
  cgpa: number
  total_credits: number
  backlog_count: number
  semesters_count: number
  semesters: PreviewSemester[]
}

/** Per-semester summary in the preview list (no subject detail). */
export interface SemesterSummary {
  semester: number
  sgpa: number
  total_credits: number
  subjects_count: number
  passed_count: number
  backlog_count: number
  passed: boolean
}

/** One student in the preview list — totals + per-semester SGPA. */
export interface StudentSummary {
  student_id: number
  roll_number: string
  name: string
  cgpa: number
  total_credits: number
  backlog_count: number
  semesters_count: number
  semesters: SemesterSummary[]
}

export interface ChunkResult {
  inserted: number
  errors: RowError[]
}

export interface PreviewResult {
  programme_admission_year_id: number
  valid: boolean
  total_rows: number
  error_count: number
  errors: RowError[]
  students: StudentSummary[]
}

export interface CommitResult {
  programme_admission_year_id: number
  valid: boolean
  persisted: boolean
  errors: RowError[]
  summary?: { students: number; results_stored: number; semesters: number }
}

/** Largest number of rows sent in one chunk (mirrors the server CHUNK_MAX_ROWS). */
export const CHUNK_ROWS = 10000

function qs(params: Record<string, string | number>): string {
  return Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join('&')
}

/** Batches the signed-in employee is scoped to — drives the batch filter. */
export function fetchExamMarksScope(): Promise<ExamMarksScopeItem[]> {
  return withEmployeeAuth((token) =>
    apiFetch<ExamMarksScopeItem[]>('/employee/exam-marks/scope', { token }),
  )
}

/** Open a chunked upload session for a batch. */
export function startUpload(
  programme_admission_year_id: number,
): Promise<{ upload_session: string }> {
  return withEmployeeAuth((token) =>
    apiFetch<{ upload_session: string }>('/employee/exam-marks/uploads/start', {
      method: 'POST',
      body: { programme_admission_year_id },
      token,
    }),
  )
}

/** Stream one chunk of rows into a session. */
export function uploadChunk(payload: {
  programme_admission_year_id: number
  upload_session: string
  offset: number
  rows: UploadMarksRow[]
}): Promise<ChunkResult> {
  return withEmployeeAuth((token) =>
    apiFetch<ChunkResult>('/employee/exam-marks/uploads/chunk', {
      method: 'POST',
      body: payload,
      token,
    }),
  )
}

/** Validate the staged session + get the student-wise summary (no write). */
export function previewUpload(
  programme_admission_year_id: number,
  upload_session: string,
): Promise<PreviewResult> {
  const query = qs({ programme_admission_year_id, upload_session })
  return withEmployeeAuth((token) =>
    apiFetch<PreviewResult>(`/employee/exam-marks/uploads/preview?${query}`, {
      token,
    }),
  )
}

/** One staged student's full detail (semesters → subjects → attempts). */
export function studentUploadDetail(
  programme_admission_year_id: number,
  upload_session: string,
  student_id: number,
): Promise<PreviewStudent> {
  const query = qs({ programme_admission_year_id, upload_session })
  return withEmployeeAuth((token) =>
    apiFetch<PreviewStudent>(
      `/employee/exam-marks/uploads/students/${student_id}/detail?${query}`,
      { token },
    ),
  )
}

/** Atomically replace the batch's stored results from the staged session. */
export function commitUpload(payload: {
  programme_admission_year_id: number
  upload_session: string
}): Promise<CommitResult> {
  return withEmployeeAuth((token) =>
    apiFetch<CommitResult>('/employee/exam-marks/uploads/commit', {
      method: 'POST',
      body: payload,
      token,
    }),
  )
}
