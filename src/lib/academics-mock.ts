/**
 * Static demo data for the student academic modules — Timetable, Attendance,
 * Exam marks and Fees. These pages are UI-only for now; swap this file for
 * real API calls once the corresponding endpoints exist.
 *
 * Pure TypeScript (no React imports) so it stays portable.
 */

// ---------------------------------------------------------------------------
// Student context — the demo student these pages describe.
// ---------------------------------------------------------------------------

export const ACADEMIC_CONTEXT = {
  programme: 'B.Tech — Computer Science & Engineering',
  currentSemester: 6,
  academicYear: '2025 – 26',
  section: 'CSE-A',
} as const

// ---------------------------------------------------------------------------
// Timetable — day-wise class schedule.
// ---------------------------------------------------------------------------

export type Weekday = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat'
export const WEEKDAYS: Weekday[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  Mon: 'Monday',
  Tue: 'Tuesday',
  Wed: 'Wednesday',
  Thu: 'Thursday',
  Fri: 'Friday',
  Sat: 'Saturday',
}

export type ClassKind = 'lecture' | 'lab' | 'tutorial' | 'break'

export interface ClassSlot {
  start: string
  end: string
  title: string
  code?: string
  faculty?: string
  room?: string
  kind: ClassKind
}

const BREAK: ClassSlot = {
  start: '10:40',
  end: '10:55',
  title: 'Short break',
  kind: 'break',
}
const LUNCH: ClassSlot = {
  start: '12:35',
  end: '13:20',
  title: 'Lunch break',
  kind: 'break',
}

export const TIMETABLE: Record<Weekday, ClassSlot[]> = {
  Mon: [
    { start: '09:00', end: '09:50', title: 'Compiler Design', code: 'CS601', faculty: 'Dr. Anil Kumar', room: 'A-204', kind: 'lecture' },
    { start: '09:50', end: '10:40', title: 'Computer Networks', code: 'CS602', faculty: 'Prof. Meena Rao', room: 'A-204', kind: 'lecture' },
    BREAK,
    { start: '10:55', end: '11:45', title: 'Machine Learning', code: 'CS603', faculty: 'Dr. S. Prasad', room: 'A-205', kind: 'lecture' },
    { start: '11:45', end: '12:35', title: 'Web Technologies', code: 'CS604', faculty: 'Prof. K. Lakshmi', room: 'A-205', kind: 'lecture' },
    LUNCH,
    { start: '13:20', end: '15:00', title: 'Machine Learning Lab', code: 'CS691', faculty: 'Dr. S. Prasad', room: 'Lab-3', kind: 'lab' },
  ],
  Tue: [
    { start: '09:00', end: '09:50', title: 'Cryptography & Network Security', code: 'CS605', faculty: 'Dr. Ravi Teja', room: 'A-204', kind: 'lecture' },
    { start: '09:50', end: '10:40', title: 'Cloud Computing', code: 'CS606', faculty: 'Prof. N. Devi', room: 'A-204', kind: 'lecture' },
    BREAK,
    { start: '10:55', end: '11:45', title: 'Compiler Design', code: 'CS601', faculty: 'Dr. Anil Kumar', room: 'A-205', kind: 'lecture' },
    { start: '11:45', end: '12:35', title: 'Computer Networks', code: 'CS602', faculty: 'Prof. Meena Rao', room: 'A-205', kind: 'tutorial' },
    LUNCH,
    { start: '13:20', end: '14:10', title: 'Machine Learning', code: 'CS603', faculty: 'Dr. S. Prasad', room: 'A-204', kind: 'lecture' },
    { start: '14:10', end: '15:00', title: 'Web Technologies', code: 'CS604', faculty: 'Prof. K. Lakshmi', room: 'A-204', kind: 'lecture' },
  ],
  Wed: [
    { start: '09:00', end: '09:50', title: 'Machine Learning', code: 'CS603', faculty: 'Dr. S. Prasad', room: 'A-205', kind: 'lecture' },
    { start: '09:50', end: '10:40', title: 'Web Technologies', code: 'CS604', faculty: 'Prof. K. Lakshmi', room: 'A-205', kind: 'lecture' },
    BREAK,
    { start: '10:55', end: '11:45', title: 'Cryptography & Network Security', code: 'CS605', faculty: 'Dr. Ravi Teja', room: 'A-204', kind: 'lecture' },
    { start: '11:45', end: '12:35', title: 'Cloud Computing', code: 'CS606', faculty: 'Prof. N. Devi', room: 'A-204', kind: 'lecture' },
    LUNCH,
    { start: '13:20', end: '15:00', title: 'Computer Networks Lab', code: 'CS692', faculty: 'Prof. Meena Rao', room: 'Lab-4', kind: 'lab' },
  ],
  Thu: [
    { start: '09:00', end: '09:50', title: 'Compiler Design', code: 'CS601', faculty: 'Dr. Anil Kumar', room: 'A-204', kind: 'lecture' },
    { start: '09:50', end: '10:40', title: 'Computer Networks', code: 'CS602', faculty: 'Prof. Meena Rao', room: 'A-204', kind: 'lecture' },
    BREAK,
    { start: '10:55', end: '11:45', title: 'Cloud Computing', code: 'CS606', faculty: 'Prof. N. Devi', room: 'A-205', kind: 'lecture' },
    { start: '11:45', end: '12:35', title: 'Cryptography & Network Security', code: 'CS605', faculty: 'Dr. Ravi Teja', room: 'A-205', kind: 'tutorial' },
    LUNCH,
    { start: '13:20', end: '14:10', title: 'Machine Learning', code: 'CS603', faculty: 'Dr. S. Prasad', room: 'A-204', kind: 'lecture' },
    { start: '14:10', end: '15:00', title: 'Web Technologies', code: 'CS604', faculty: 'Prof. K. Lakshmi', room: 'A-204', kind: 'lecture' },
  ],
  Fri: [
    { start: '09:00', end: '09:50', title: 'Web Technologies', code: 'CS604', faculty: 'Prof. K. Lakshmi', room: 'A-205', kind: 'lecture' },
    { start: '09:50', end: '10:40', title: 'Compiler Design', code: 'CS601', faculty: 'Dr. Anil Kumar', room: 'A-205', kind: 'lecture' },
    BREAK,
    { start: '10:55', end: '11:45', title: 'Machine Learning', code: 'CS603', faculty: 'Dr. S. Prasad', room: 'A-204', kind: 'lecture' },
    { start: '11:45', end: '12:35', title: 'Computer Networks', code: 'CS602', faculty: 'Prof. Meena Rao', room: 'A-204', kind: 'lecture' },
    LUNCH,
    { start: '13:20', end: '15:00', title: 'Web Technologies Lab', code: 'CS693', faculty: 'Prof. K. Lakshmi', room: 'Lab-3', kind: 'lab' },
  ],
  Sat: [
    { start: '09:00', end: '09:50', title: 'Cryptography & Network Security', code: 'CS605', faculty: 'Dr. Ravi Teja', room: 'A-204', kind: 'lecture' },
    { start: '09:50', end: '10:40', title: 'Cloud Computing', code: 'CS606', faculty: 'Prof. N. Devi', room: 'A-204', kind: 'lecture' },
    BREAK,
    { start: '10:55', end: '11:45', title: 'Compiler Design', code: 'CS601', faculty: 'Dr. Anil Kumar', room: 'A-205', kind: 'lecture' },
    { start: '11:45', end: '12:35', title: 'Machine Learning', code: 'CS603', faculty: 'Dr. S. Prasad', room: 'A-205', kind: 'lecture' },
  ],
}

/** Counts only the real teaching slots for a day (excludes breaks). */
export function teachingCount(slots: ClassSlot[]): number {
  return slots.filter((slot) => slot.kind !== 'break').length
}

// ---------------------------------------------------------------------------
// Attendance — classes held vs. attended, per subject.
// ---------------------------------------------------------------------------

export const ATTENDANCE_THRESHOLD = 75

export interface SubjectAttendance {
  code: string
  subject: string
  faculty: string
  held: number
  attended: number
}

export const ATTENDANCE: SubjectAttendance[] = [
  { code: 'CS601', subject: 'Compiler Design', faculty: 'Dr. Anil Kumar', held: 48, attended: 44 },
  { code: 'CS602', subject: 'Computer Networks', faculty: 'Prof. Meena Rao', held: 46, attended: 39 },
  { code: 'CS603', subject: 'Machine Learning', faculty: 'Dr. S. Prasad', held: 50, attended: 47 },
  { code: 'CS604', subject: 'Web Technologies', faculty: 'Prof. K. Lakshmi', held: 44, attended: 32 },
  { code: 'CS605', subject: 'Cryptography & Network Security', faculty: 'Dr. Ravi Teja', held: 42, attended: 38 },
  { code: 'CS606', subject: 'Cloud Computing', faculty: 'Prof. N. Devi', held: 40, attended: 35 },
  { code: 'CS691', subject: 'Machine Learning Lab', faculty: 'Dr. S. Prasad', held: 24, attended: 23 },
  { code: 'CS692', subject: 'Computer Networks Lab', faculty: 'Prof. Meena Rao', held: 22, attended: 20 },
]

/** Attendance percentage for a single subject (0–100, rounded to 1 decimal). */
export function attendancePercent(row: { held: number; attended: number }): number {
  if (row.held === 0) return 0
  return Math.round((row.attended / row.held) * 1000) / 10
}

export interface AttendanceTotals {
  held: number
  attended: number
  percent: number
}

/** Aggregate attendance across every subject. */
export function attendanceTotals(rows: SubjectAttendance[] = ATTENDANCE): AttendanceTotals {
  const held = rows.reduce((sum, row) => sum + row.held, 0)
  const attended = rows.reduce((sum, row) => sum + row.attended, 0)
  return { held, attended, percent: attendancePercent({ held, attended }) }
}

export type AttendanceStanding = 'good' | 'warning' | 'low'

/** Buckets a percentage relative to the 75% minimum requirement. */
export function attendanceStanding(percent: number): AttendanceStanding {
  if (percent >= 85) return 'good'
  if (percent >= ATTENDANCE_THRESHOLD) return 'warning'
  return 'low'
}

// ---------------------------------------------------------------------------
// Exam marks — semester-wise results with SGPA / CGPA.
// ---------------------------------------------------------------------------

export type Grade = 'O' | 'A+' | 'A' | 'B+' | 'B' | 'C' | 'P' | 'F'

/** 10-point grade-point scale. */
export const GRADE_POINTS: Record<Grade, number> = {
  O: 10,
  'A+': 9,
  A: 8,
  'B+': 7,
  B: 6,
  C: 5,
  P: 4,
  F: 0,
}

export interface CourseResult {
  code: string
  title: string
  credits: number
  /** `null` while results are awaited. */
  grade: Grade | null
}

export interface SemesterResult {
  semester: number
  status: 'completed' | 'in-progress'
  courses: CourseResult[]
}

export const SEMESTERS: SemesterResult[] = [
  {
    semester: 1,
    status: 'completed',
    courses: [
      { code: 'MA101', title: 'Calculus & Linear Algebra', credits: 4, grade: 'A+' },
      { code: 'PH102', title: 'Engineering Physics', credits: 3, grade: 'A' },
      { code: 'CS103', title: 'Problem Solving with C', credits: 4, grade: 'O' },
      { code: 'CH104', title: 'Engineering Chemistry', credits: 3, grade: 'B+' },
      { code: 'EE105', title: 'Basic Electrical Engineering', credits: 3, grade: 'A' },
      { code: 'HS106', title: 'English Communication', credits: 2, grade: 'A+' },
    ],
  },
  {
    semester: 2,
    status: 'completed',
    courses: [
      { code: 'MA201', title: 'Differential Equations', credits: 4, grade: 'A' },
      { code: 'PH202', title: 'Semiconductor Physics', credits: 3, grade: 'B+' },
      { code: 'CS203', title: 'Object-Oriented Programming', credits: 4, grade: 'O' },
      { code: 'ME204', title: 'Engineering Graphics', credits: 3, grade: 'A' },
      { code: 'EC205', title: 'Basic Electronics', credits: 3, grade: 'A+' },
      { code: 'HS206', title: 'Environmental Science', credits: 2, grade: 'A' },
    ],
  },
  {
    semester: 3,
    status: 'completed',
    courses: [
      { code: 'MA301', title: 'Discrete Mathematics', credits: 4, grade: 'A+' },
      { code: 'CS302', title: 'Data Structures', credits: 4, grade: 'O' },
      { code: 'CS303', title: 'Digital Logic Design', credits: 3, grade: 'A' },
      { code: 'CS304', title: 'Computer Organization', credits: 3, grade: 'B+' },
      { code: 'CS305', title: 'Java Programming', credits: 3, grade: 'A+' },
      { code: 'CS306', title: 'Data Structures Lab', credits: 2, grade: 'O' },
    ],
  },
  {
    semester: 4,
    status: 'completed',
    courses: [
      { code: 'MA401', title: 'Probability & Statistics', credits: 4, grade: 'A' },
      { code: 'CS402', title: 'Design & Analysis of Algorithms', credits: 4, grade: 'A+' },
      { code: 'CS403', title: 'Operating Systems', credits: 4, grade: 'O' },
      { code: 'CS404', title: 'Database Management Systems', credits: 4, grade: 'A+' },
      { code: 'CS405', title: 'Theory of Computation', credits: 3, grade: 'B+' },
      { code: 'CS406', title: 'DBMS Lab', credits: 2, grade: 'O' },
    ],
  },
  {
    semester: 5,
    status: 'completed',
    courses: [
      { code: 'CS501', title: 'Software Engineering', credits: 3, grade: 'A+' },
      { code: 'CS502', title: 'Microprocessors & Interfacing', credits: 3, grade: 'A' },
      { code: 'CS503', title: 'Formal Languages & Automata', credits: 3, grade: 'A' },
      { code: 'CS504', title: 'Artificial Intelligence', credits: 4, grade: 'O' },
      { code: 'CS505', title: 'Computer Graphics', credits: 3, grade: 'B+' },
      { code: 'CS506', title: 'Artificial Intelligence Lab', credits: 2, grade: 'A+' },
    ],
  },
  {
    semester: 6,
    status: 'in-progress',
    courses: [
      { code: 'CS601', title: 'Compiler Design', credits: 4, grade: null },
      { code: 'CS602', title: 'Computer Networks', credits: 4, grade: null },
      { code: 'CS603', title: 'Machine Learning', credits: 4, grade: null },
      { code: 'CS604', title: 'Web Technologies', credits: 3, grade: null },
      { code: 'CS605', title: 'Cryptography & Network Security', credits: 3, grade: null },
      { code: 'CS606', title: 'Cloud Computing', credits: 3, grade: null },
      { code: 'CS691', title: 'Machine Learning Lab', credits: 2, grade: null },
      { code: 'CS692', title: 'Computer Networks Lab', credits: 2, grade: null },
    ],
  },
]

/** Total credits registered for a semester. */
export function semesterCredits(sem: SemesterResult): number {
  return sem.courses.reduce((sum, course) => sum + course.credits, 0)
}

/** Credits that have a published grade (drives SGPA). */
export function gradedCredits(sem: SemesterResult): number {
  return sem.courses
    .filter((course) => course.grade !== null)
    .reduce((sum, course) => sum + course.credits, 0)
}

/** SGPA for a semester, or `null` when no result has been published yet. */
export function sgpa(sem: SemesterResult): number | null {
  const graded = sem.courses.filter((course) => course.grade !== null)
  const credits = graded.reduce((sum, course) => sum + course.credits, 0)
  if (credits === 0) return null
  const points = graded.reduce(
    (sum, course) => sum + course.credits * GRADE_POINTS[course.grade as Grade],
    0,
  )
  return Math.round((points / credits) * 100) / 100
}

/** CGPA across every published result so far, or `null` when there are none. */
export function cgpa(sems: SemesterResult[] = SEMESTERS): number | null {
  let credits = 0
  let points = 0
  for (const sem of sems) {
    for (const course of sem.courses) {
      if (course.grade === null) continue
      credits += course.credits
      points += course.credits * GRADE_POINTS[course.grade]
    }
  }
  if (credits === 0) return null
  return Math.round((points / credits) * 100) / 100
}

// ---------------------------------------------------------------------------
// Fees — structure, payments and pending dues.
// ---------------------------------------------------------------------------

export interface FeeComponent {
  label: string
  amount: number
}

export interface FeePayment {
  date: string
  description: string
  amount: number
  receiptNo: string
  mode: string
}

export interface FeeDue {
  label: string
  amount: number
  dueDate: string
}

/** Fee structure for the current academic year. */
export const FEE_STRUCTURE: FeeComponent[] = [
  { label: 'Tuition Fee', amount: 85000 },
  { label: 'Laboratory Fee', amount: 6000 },
  { label: 'Development Fee', amount: 8000 },
  { label: 'Examination Fee', amount: 4500 },
  { label: 'Library Fee', amount: 2000 },
  { label: 'Student Welfare Fee', amount: 1500 },
]

export const FEE_PAYMENTS: FeePayment[] = [
  { date: '2025-07-18', description: 'Installment I', amount: 60000, receiptNo: 'RGE-2025-1042', mode: 'Net Banking' },
  { date: '2025-08-22', description: 'Installment II', amount: 35000, receiptNo: 'RGE-2025-1518', mode: 'UPI' },
]

export const FEE_DUES: FeeDue[] = [
  { label: 'Installment III (Final)', amount: 12000, dueDate: '2026-06-15' },
]

export interface FeeTotals {
  total: number
  paid: number
  pending: number
}

export function feeTotals(): FeeTotals {
  const total = FEE_STRUCTURE.reduce((sum, item) => sum + item.amount, 0)
  const paid = FEE_PAYMENTS.reduce((sum, item) => sum + item.amount, 0)
  const pending = FEE_DUES.reduce((sum, item) => sum + item.amount, 0)
  return { total, paid, pending }
}

/** Indian-grouped rupee amount, e.g. 107000 -> "₹1,07,000". */
export function formatINR(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`
}

/** Human date, e.g. "2026-06-15" -> "15 Jun 2026". */
export function formatDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00`)
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}
