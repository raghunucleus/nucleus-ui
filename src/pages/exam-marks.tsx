import { useEffect, useMemo, useState } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { Award, Hourglass, TrendingUp } from 'lucide-react'

import { PageHeader } from '@/components/portal-layout'
import { DataTable } from '@/components/data-table'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import {
  ACADEMIC_CONTEXT,
  GRADE_POINTS,
  SEMESTERS,
  cgpa,
  semesterCredits,
  sgpa,
  type CourseResult,
  type Grade,
  type SemesterResult,
} from '@/lib/academics-mock'

type GradeVariant = 'success' | 'default' | 'warning' | 'destructive'

function gradeVariant(grade: Grade): GradeVariant {
  if (grade === 'O' || grade === 'A+') return 'success'
  if (grade === 'A' || grade === 'B+') return 'default'
  if (grade === 'F') return 'destructive'
  return 'warning'
}

/** Sum of credit × grade-point across graded courses in a semester. */
function semesterPoints(sem: SemesterResult): number {
  return sem.courses.reduce(
    (sum, course) =>
      course.grade ? sum + course.credits * GRADE_POINTS[course.grade] : sum,
    0,
  )
}

/** Latest completed semester — the most useful default selection. */
function defaultSemester(): number {
  const completed = SEMESTERS.filter((sem) => sem.status === 'completed')
  return completed.at(-1)?.semester ?? SEMESTERS[0].semester
}

export default function ExamMarks() {
  const [selected, setSelected] = useState<number>(defaultSemester())

  useEffect(() => {
    document.title = 'Exam marks — Nucleus'
  }, [])

  const semester =
    SEMESTERS.find((sem) => sem.semester === selected) ?? SEMESTERS[0]

  const completed = useMemo(
    () => SEMESTERS.filter((sem) => sem.status === 'completed'),
    [],
  )
  const overallCgpa = cgpa()
  const totalCredits = completed.reduce(
    (sum, sem) => sum + semesterCredits(sem),
    0,
  )
  const totalPoints = completed.reduce(
    (sum, sem) => sum + semesterPoints(sem),
    0,
  )

  const breakdownColumns = useMemo(() => {
    const col = createColumnHelper<SemesterResult>()
    return [
      col.display({
        id: 'semester',
        header: 'Semester',
        cell: (ctx) => (
          <span className="font-medium text-foreground">
            Semester {ctx.row.original.semester}
          </span>
        ),
        footer: () => (
          <span className="font-semibold text-foreground">Cumulative</span>
        ),
      }),
      col.display({
        id: 'credits',
        header: () => <span className="block text-right">Credits</span>,
        cell: (ctx) => (
          <span className="block text-right tabular-nums text-muted-foreground">
            {semesterCredits(ctx.row.original)}
          </span>
        ),
        footer: () => (
          <span className="block text-right font-medium tabular-nums">
            {totalCredits}
          </span>
        ),
      }),
      col.display({
        id: 'sgpa',
        header: () => <span className="block text-right">SGPA</span>,
        cell: (ctx) => (
          <span className="block text-right font-semibold tabular-nums text-foreground">
            {sgpa(ctx.row.original)?.toFixed(2)}
          </span>
        ),
        footer: () => (
          <span className="block text-right text-lg font-bold tabular-nums text-primary">
            {overallCgpa?.toFixed(2)}
          </span>
        ),
      }),
    ]
  }, [totalCredits, overallCgpa])

  return (
    <>
      <PageHeader
        title="Exam marks"
        subtitle={`${ACADEMIC_CONTEXT.programme} · ${ACADEMIC_CONTEXT.academicYear}`}
        icon={Award}
        accent="amber"
      />

      <Card className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Cumulative GPA
            </p>
            <p className="text-5xl font-bold tracking-tight tabular-nums">
              {overallCgpa?.toFixed(2) ?? '—'}
            </p>
            <p className="text-sm text-muted-foreground">
              Across {completed.length} completed semester
              {completed.length === 1 ? '' : 's'} · {totalCredits} credits ·
              10-point scale
            </p>
          </div>
          <div className="grid size-12 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
            <TrendingUp className="size-6" />
          </div>
        </div>
      </Card>

      <div className="flex flex-wrap gap-2">
        {SEMESTERS.map((sem) => {
          const isSelected = sem.semester === selected
          return (
            <button
              key={sem.semester}
              type="button"
              aria-pressed={isSelected}
              onClick={() => setSelected(sem.semester)}
              className={
                isSelected
                  ? 'rounded-lg border border-primary bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors'
                  : 'rounded-lg border bg-card px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground'
              }
            >
              Sem {sem.semester}
            </button>
          )
        })}
      </div>

      <SemesterPanel semester={semester} />

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground">
            CGPA breakdown
          </h2>
          <p className="text-xs text-muted-foreground">
            Credit-weighted across all published results.
          </p>
        </div>
        <Card className="overflow-hidden">
          <DataTable columns={breakdownColumns} data={completed} showFooter />
        </Card>
        <p className="text-xs text-muted-foreground">
          CGPA = {totalPoints} total grade points ÷ {totalCredits} credits ={' '}
          <span className="font-semibold text-foreground">
            {overallCgpa?.toFixed(2)}
          </span>
          . In-progress semesters are excluded until results are published.
        </p>
      </section>
    </>
  )
}

function SemesterPanel({ semester }: { semester: SemesterResult }) {
  const inProgress = semester.status === 'in-progress'
  const semSgpa = sgpa(semester)
  const credits = semesterCredits(semester)
  const points = semesterPoints(semester)

  const courseColumns = useMemo(() => {
    const col = createColumnHelper<CourseResult>()
    return [
      col.accessor('title', {
        header: 'Course',
        cell: (ctx) => (
          <div>
            <p className="font-medium text-foreground">{ctx.getValue()}</p>
            <p className="text-xs text-muted-foreground">
              {ctx.row.original.code}
            </p>
          </div>
        ),
      }),
      col.accessor('credits', {
        header: () => <span className="block text-right">Credits</span>,
        cell: (ctx) => (
          <span className="block text-right tabular-nums">
            {ctx.getValue()}
          </span>
        ),
      }),
      col.accessor('grade', {
        header: () => <span className="block text-center">Grade</span>,
        cell: (ctx) => {
          const grade = ctx.getValue()
          return (
            <div className="text-center">
              {grade ? (
                <Badge variant={gradeVariant(grade)}>{grade}</Badge>
              ) : (
                <Badge variant="muted">Awaited</Badge>
              )}
            </div>
          )
        },
      }),
      col.display({
        id: 'points',
        header: () => <span className="block text-right">Points</span>,
        cell: (ctx) => {
          const course = ctx.row.original
          return (
            <span className="block text-right tabular-nums text-muted-foreground">
              {course.grade
                ? course.credits * GRADE_POINTS[course.grade]
                : '—'}
            </span>
          )
        },
      }),
    ]
  }, [])

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-4 border-b bg-muted/40 px-5 py-4">
        <div>
          <h2 className="font-semibold">Semester {semester.semester}</h2>
          <p className="text-xs text-muted-foreground">
            {semester.courses.length} courses · {credits} credits
          </p>
        </div>
        {inProgress ? (
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-warning">
            <Hourglass className="size-4" />
            Results awaited
          </span>
        ) : (
          <div className="text-right">
            <p className="text-2xl font-bold tabular-nums text-primary">
              {semSgpa?.toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground">SGPA</p>
          </div>
        )}
      </div>

      <DataTable columns={courseColumns} data={semester.courses} />

      {!inProgress ? (
        <div className="border-t bg-muted/40 px-5 py-3 text-xs text-muted-foreground">
          SGPA = {points} grade points ÷ {credits} credits ={' '}
          <span className="font-semibold text-foreground">
            {semSgpa?.toFixed(2)}
          </span>
        </div>
      ) : null}
    </Card>
  )
}
