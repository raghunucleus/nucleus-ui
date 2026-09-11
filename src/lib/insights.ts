import { apiFetch } from './api'
import type {
  AnalyticsBasis,
  BandTally,
  OverviewResult as AttendanceOverviewResult,
  StudentDetailResult,
  StudentRow,
  SubjectRow,
} from './attendance-analytics'
import { withEmployeeAuth } from './employee-auth'

/**
 * Client for the six `insights.*` screens (`/employee/insights/*`).
 *
 * Every read carries the scope narrowing as a query string built by
 * `scopeQs`; the server intersects it with the caller's RBAC attributes, so
 * an id outside the grant simply drops out — the client never has to know
 * the grant to be safe, only to fill the pickers (`fetchInsightsScope`).
 */

export const INSIGHTS_KEYS = {
  overview: 'insights.overview.view',
  attendance: 'insights.attendance.view',
  results: 'insights.results.view',
  placements: 'insights.placements.view',
  students: 'insights.students.view',
  requests: 'insights.requests.view',
} as const

const BASE = '/employee/insights'

// --- scope ------------------------------------------------------------------

export interface ScopeDepartment {
  id: number
  code: string
  name: string
  short_name: string | null
}

export interface ScopeProgramme {
  id: number
  code: string
  name: string
  display_name: string
  department_id: number
}

export interface ScopeBatch {
  pay_id: number
  programme_id: number
  admission_year_id: number
  department_id: number
  regulation_id: number | null
  regulation_code: string | null
  admission_year: number
  display_year: string
  passout_year: number
  programme_code: string
  programme_name: string
  department_code: string
  ongoing_ps_id: number | null
  ongoing_sem_number: number | null
  ongoing_planned_start: string | null
  ongoing_planned_end: string | null
  student_count: number
}

export interface ScopeGroup {
  id: number
  name: string
  code: string
  programme_id: number
  admission_year_id: number
  pay_id: number
  member_count: number
}

export interface ScopeTree {
  has_access: boolean
  departments: ScopeDepartment[]
  programmes: ScopeProgramme[]
  batches: ScopeBatch[]
  groups: ScopeGroup[]
  today: string
  current_passout_year: number | null
}

/** What the scope bar holds — each list narrows; empty = the whole grant. */
export interface ScopeSelection {
  department_ids: number[]
  programme_ids: number[]
  programme_admission_year_ids: number[]
  attendance_group_ids: number[]
}

export const EMPTY_SELECTION: ScopeSelection = {
  department_ids: [],
  programme_ids: [],
  programme_admission_year_ids: [],
  attendance_group_ids: [],
}

export function scopeQs(
  sel: ScopeSelection,
  extra?: Record<string, string | number | undefined>,
): string {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(sel)) {
    if (Array.isArray(v) && v.length) p.set(k, v.join(','))
  }
  for (const [k, v] of Object.entries(extra ?? {})) {
    if (v !== undefined && v !== '') p.set(k, String(v))
  }
  return p.toString()
}

function get<T>(path: string): Promise<T> {
  return withEmployeeAuth((token) => apiFetch<T>(path, { token }))
}

export function fetchInsightsScope(screenKey: string): Promise<ScopeTree> {
  return get(`${BASE}/scope?screen=${encodeURIComponent(screenKey)}`)
}

// --- overview ---------------------------------------------------------------

export interface DomainLock {
  locked: true
}
export const isLocked = (v: unknown): v is DomainLock =>
  !!v && typeof v === 'object' && (v as DomainLock).locked === true

export interface OverviewAttendance {
  students: number
  pct: number
  below_threshold: number
  below_condonation: number
  compliance_pct: number
  overdue_unmarked: number
  basis_note: string
}

export interface OverviewResults {
  avg_cgpa: number | null
  with_current_backlogs: number
  with_backlog_history: number
  students_with_cgpa: number
}

export interface OverviewPlacements {
  passout_year: number | null
  cohort: number
  eligible: number
  placed: number
  placed_pct: number
  offers: number
}

export interface OverviewRequests {
  pending: number
  pending_over_7d: number
}

export interface DepartmentComparisonRow {
  department_id: number
  code: string
  name: string
  students: number
  attendance_pct: number | null
  below_threshold_pct: number | null
  compliance_pct: number | null
  avg_cgpa: number | null
  backlog_pct: number | null
  placed_pct: number | null
}

export interface AttentionItem {
  kind: string
  severity: 'high' | 'medium' | 'low'
  label: string
  count: number
  route: string
  tab?: string
}

export type OverviewWindow = 7 | 30 | 90
export const OVERVIEW_WINDOWS: OverviewWindow[] = [7, 30, 90]

export interface AttendanceWindowStats {
  pct: number
  held: number
  below_threshold: number
  below_condonation: number
  compliance_pct: number
  overdue_unmarked: number
}

export interface SemesterStats {
  students: number
  avg_sgpa: number | null
  pass_pct: number
  with_backlogs: number
}

export interface OverviewDeltas {
  window_days: number
  attendance: {
    current: AttendanceWindowStats
    previous: AttendanceWindowStats
    delta: Record<
      | 'pct'
      | 'below_threshold'
      | 'below_condonation'
      | 'compliance_pct'
      | 'overdue_unmarked',
      number
    >
  } | null
  results: {
    latest_semester: number
    previous_semester: number
    current: SemesterStats
    previous: SemesterStats
    delta: Record<'avg_sgpa' | 'pass_pct' | 'with_backlogs', number | null>
  } | null
  placements: {
    current: { offers: number; placed_students: number }
    previous: { offers: number; placed_students: number }
    delta: Record<'offers' | 'placed_students', number>
  } | null
  requests: {
    current: { raised: number; decided: number }
    previous: { raised: number; decided: number }
    delta: Record<'raised' | 'decided', number>
  } | null
}

export interface InsightsOverview {
  deltas: OverviewDeltas
  scope: {
    departments: number
    programmes: number
    batches: number
    sections: number
    multi_department: boolean
    today: string
  }
  attendance: OverviewAttendance | DomainLock | null
  results: OverviewResults | DomainLock | null
  placements: OverviewPlacements | DomainLock | null
  requests: OverviewRequests | DomainLock | null
  by_department: DepartmentComparisonRow[] | null
  attention: AttentionItem[]
  weekly_attendance: Array<{ week: string; pct: number; held: number }>
  monthly_placements: Array<{
    month: string
    offers: number
    placed_students: number
  }>
  cached_at: string
}

export function fetchInsightsOverview(
  qs: string,
): Promise<InsightsOverview | null> {
  return get(`${BASE}/overview?${qs}`)
}

// --- attendance -------------------------------------------------------------

export interface RollupRow {
  key: string
  parent_key: string | null
  level: 'department' | 'programme' | 'batch' | 'section'
  id: number
  label: string
  sublabel: string | null
  students: number
  attended: number
  held: number
  pct: number
  band: string
  bands: BandTally[]
  below_threshold: number
  below_condonation: number
  marked: number
  overdue_unmarked: number
  upcoming: number
  cancelled: number
  compliance_pct: number
  sem_number: number | null
}

export interface RollupResult {
  basis: AnalyticsBasis
  locked: boolean
  thresholds: { threshold: number; condonation: number; bands: BandTally[] }
  rows: RollupRow[]
  totals: Omit<
    RollupRow,
    'key' | 'parent_key' | 'level' | 'id' | 'label' | 'sublabel' | 'sem_number'
  >
}

export interface InsightsStudentRow extends StudentRow {
  group_id: number | null
  group_name: string | null
  pay_id: number | null
  batch_label: string | null
  department_code: string | null
}

export interface FacultyRow {
  employee_id: number | null
  emp_code: string | null
  emp_display_name: string | null
  department_id: number | null
  department_code: string | null
  sessions: number
  marked: number
  overdue_unmarked: number
  upcoming: number
  cancelled: number
  substituted_in: number
  compliance_pct: number
  weeks: number
  sessions_per_week: number
  subjects: number
  sections: number
  attended: number
  held: number
  pct: number
}

export interface LeavesResult {
  window: { from: string; to: string }
  by_group: Array<{
    group_id: number
    leave_type_id: number
    leave_type: string
    approved: number
    pending: number
    rejected: number
    approved_days: number
  }>
  pending: { count: number; oldest_days: number | null }
  top_students: Array<{
    student_id: number
    roll_no: string
    display_name: string
    group_id: number
    leaves: number
    days: number
  }>
}

const ATT = `${BASE}/attendance`

export const fetchInsightsRollup = (qs: string) =>
  get<RollupResult | null>(`${ATT}/rollup?${qs}`)
export const fetchInsightsAttendanceStudents = (qs: string) =>
  get<{
    basis: AnalyticsBasis
    sessions_remaining: number
    rows: InsightsStudentRow[]
  }>(`${ATT}/students?${qs}`)
export const fetchInsightsAttendanceStudent = (qs: string, studentId: number) =>
  get<StudentDetailResult>(`${ATT}/students/${studentId}?${qs}`)
export const fetchInsightsSubjects = (qs: string) =>
  get<{ basis: AnalyticsBasis; rows: SubjectRow[] }>(`${ATT}/subjects?${qs}`)
export const fetchInsightsFaculty = (qs: string) =>
  get<FacultyRow[]>(`${ATT}/faculty?${qs}`)
export const fetchInsightsAttendanceOverview = (qs: string) =>
  get<AttendanceOverviewResult | null>(`${ATT}/overview?${qs}`)
export const fetchInsightsLeaves = (qs: string) =>
  get<LeavesResult | null>(`${ATT}/leaves?${qs}`)

// --- results ----------------------------------------------------------------

export interface GpaBand {
  key: string
  label: string
  min: number
  max: number
}

export interface BatchSemesterRow {
  pay_id: number
  semester: number
  students: number
  passed: number
  pass_pct: number
  avg_sgpa: number | null
  bands: Record<string, number>
  backlogs: { none: number; one: number; two: number; three_plus: number }
  computed_at: string | null
}

export interface SubjectResultRow {
  pay_id: number
  semester: number
  subject_code: string
  subject_name: string
  appeared: number
  passed: number
  fail_pct: number
  first_attempt_failed: number
  avg_grade_points: number | null
  grades: Record<string, number>
}

export interface CgpaResult {
  bands: GpaBand[]
  by_batch: Array<{
    pay_id: number
    students: number
    with_cgpa: number
    avg_cgpa: number | null
    median_cgpa: number | null
    max_cgpa: number | null
    with_current_backlogs: number
    with_backlog_history: number
    bands: Record<string, number>
  }>
  top_performers: Array<{
    student_id: number
    roll_no: string
    display_name: string
    pay_id: number
    cgpa: number
    semesters_count: number
    backlog_count: number
  }>
}

export interface BacklogsResult {
  min_backlogs: number
  total: number
  rows: Array<{
    student_id: number
    roll_no: string
    display_name: string
    pay_id: number
    cgpa: number | null
    current_backlogs: number
    backlog_history: boolean
    semesters_count: number
    worst_semester: number | null
  }>
}

export interface CoverageRow {
  pay_id: number
  sem_number: number
  status: string
  planned_end_date: string | null
  students: number
  students_with_results: number
  computed_at: string | null
  gap: boolean
}

export interface CorrelationResult {
  gpa_bands: GpaBand[]
  bands: Array<{ band: string; students: number; avg_sgpa: number | null }>
  cells: Array<{ band: string; gpa_band: string; students: number }>
  points: Array<{ pct: number; sgpa: number }>
}

const RES = `${BASE}/results`

export const fetchResultsBatches = (qs: string) =>
  get<{ bands: GpaBand[]; rows: BatchSemesterRow[] }>(`${RES}/batches?${qs}`)
export const fetchResultsSubjects = (qs: string) =>
  get<{ rows: SubjectResultRow[] }>(`${RES}/subjects?${qs}`)
export const fetchResultsCgpa = (qs: string) =>
  get<CgpaResult>(`${RES}/cgpa?${qs}`)
export const fetchResultsBacklogs = (qs: string) =>
  get<BacklogsResult>(`${RES}/backlogs?${qs}`)
export const fetchResultsCoverage = (qs: string) =>
  get<{ rows: CoverageRow[] }>(`${RES}/coverage?${qs}`)
export const fetchResultsCorrelation = (qs: string) =>
  get<CorrelationResult>(`${RES}/attendance-correlation?${qs}`)

// --- placements -------------------------------------------------------------

export interface PlacementSummaryRow {
  pay_id: number
  passout_year: number | null
  cohort: number
  eligible: number
  placed: number
  placed_full_time: number
  placed_pct_cohort: number
  placed_pct_eligible: number
  offers: number
  full_time_offers: number
  internship_offers: number
  multi_offer_students: number
  avg_ctc: number | null
  median_ctc: number | null
  highest_ctc: number | null
}

export interface FunnelResult {
  drives: number
  totals: Record<string, number>
  stages: Array<{ key: string; label: string; count: number }>
  rates: {
    invite_rate: number
    response_rate: number
    acceptance_rate: number
    no_show_rate: number
    selection_rate: number
    offer_yield: number
  }
}

export interface CompanyRow {
  company_id: number
  company_name: string
  students_placed: number
  offers: number
  max_ctc: number | null
  avg_ctc: number | null
}

export interface PlacementTrendRow {
  passout_year: number | null
  month: string
  offers: number
  placed_students: number
}

export interface UnplacedResult {
  total: number
  rows: Array<{
    student_id: number
    roll_no: string
    display_name: string
    pay_id: number
    passout_year: number | null
    cgpa: number | null
    current_backlogs: number
    backlog_history: boolean
    drives_invited: number
    drives_attended: number
    last_activity: string | null
  }>
}

const PL = `${BASE}/placements`

export const fetchPlacementsSummary = (qs: string) =>
  get<{ rows: PlacementSummaryRow[] }>(`${PL}/summary?${qs}`)
export const fetchPlacementsFunnel = (qs: string) =>
  get<FunnelResult>(`${PL}/funnel?${qs}`)
export const fetchPlacementsCompanies = (qs: string) =>
  get<{ rows: CompanyRow[] }>(`${PL}/companies?${qs}`)
export const fetchPlacementsTrend = (qs: string) =>
  get<{ rows: PlacementTrendRow[] }>(`${PL}/trend?${qs}`)
export const fetchPlacementsUnplaced = (qs: string) =>
  get<UnplacedResult>(`${PL}/unplaced?${qs}`)

// --- students ---------------------------------------------------------------

export interface DemographicsRow {
  pay_id: number
  total: number
  inactive: number
  male: number
  female: number
  other: number
  regular: number
  lateral: number
  with_guardian: number
  with_photo: number
  with_aadhaar: number
  with_resume: number
  with_abc_id: number
  with_personal_email: number
}

export interface DemographicsResult {
  by_batch: DemographicsRow[]
  districts: Array<{ district: string; state: string; students: number }>
}

export const fetchDemographics = (qs: string) =>
  get<DemographicsResult>(`${BASE}/students/demographics?${qs}`)

// --- requests ---------------------------------------------------------------

export interface PendingRow {
  request_type: string
  pending: number
  sent_back: number
  under_3d: number
  d3_to_7: number
  over_7d: number
  oldest_days: number | null
}

export interface TurnaroundRow {
  request_type: string
  decided: number
  approved: number
  rejected: number
  median_hours: number | null
  p90_hours: number | null
}

export interface ApproverRow {
  employee_id: number
  emp_code: string | null
  emp_display_name: string | null
  pending: number
  oldest_days: number | null
  decided: number
  median_hours: number | null
}

export interface RequestsTrendRow {
  month: string
  raised: number
  decided: number
  approved: number
  rejected: number
}

export interface RequestsSummary {
  window: { from: string; to: string } | null
  pending: PendingRow[]
  turnaround: TurnaroundRow[]
  approvers: ApproverRow[]
  trend: RequestsTrendRow[]
}

export interface LeaveVolumeResult {
  window: { from: string; to: string } | null
  rows: Array<{
    pay_id: number
    group_id: number | null
    leave_type: string
    month: string
    applied: number
    approved: number
    rejected: number
    days: number
  }>
  approval_rate: number
}

export const fetchRequestsSummary = (qs: string) =>
  get<RequestsSummary>(`${BASE}/requests/summary?${qs}`)
export const fetchRequestsLeaves = (qs: string) =>
  get<LeaveVolumeResult>(`${BASE}/requests/leaves?${qs}`)

export const REQUEST_TYPE_LABEL: Record<string, string> = {
  profile_update: 'Profile update',
  leave_apply: 'Leave application',
  leave_cancel: 'Leave cancellation',
  company_approval: 'Company approval',
}
