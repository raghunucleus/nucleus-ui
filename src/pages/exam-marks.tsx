import { useCallback, useEffect, useState } from 'react'
import {
  Award,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  RefreshCw,
} from 'lucide-react'

import { PageHeader } from '@/components/portal-layout'
import { ResultsEmpty } from '@/components/results-empty'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ApiError } from '@/lib/api'
import {
  fetchStudentExamResults,
  type ExamResultSemester,
  type ExamResultSubject,
  type ExamResultsView,
} from '@/lib/student-academics'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'

type GradeVariant = 'success' | 'default' | 'warning' | 'destructive' | 'muted'

function gradeVariant(grade: string): GradeVariant {
  if (grade === 'O' || grade === 'S') return 'success'
  if (grade === 'A' || grade === 'B') return 'default'
  if (grade === 'C' || grade === 'D') return 'warning'
  if (grade === 'F') return 'destructive'
  return 'muted'
}

export default function ExamMarks() {
  const signOut = useAuthStore((state) => state.signOut)
  const [data, setData] = useState<ExamResultsView | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Which semester's detail is shown. `null` means "fall back to the latest",
  // so the student lands on their most recent results without picking anything.
  const [selected, setSelected] = useState<number | null>(null)

  useEffect(() => {
    document.title = 'Exam results — Nucleus'
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await fetchStudentExamResults())
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        signOut()
        return
      }
      setError(err instanceof Error ? err.message : 'Could not load results.')
    } finally {
      setLoading(false)
    }
  }, [signOut])

  useEffect(() => {
    void load()
  }, [load])

  const subtitle = data?.context.programme
    ? `${data.context.programme}${data.context.admission_year ? ` · ${data.context.admission_year}` : ''}`
    : 'Your academic results'

  if (loading) return <ResultsSkeleton />
  if (error) return <ErrorState message={error} onRetry={() => void load()} />
  if (!data) return null

  const hasResults = data.has_results && data.semesters.length > 0

  return (
    <>
      <PageHeader
        title="Exam results"
        subtitle={subtitle}
        icon={Award}
        accent="amber"
      />

      {!hasResults ? (
        <ResultsEmpty />
      ) : (
        <Results data={data} selected={selected} onSelect={setSelected} />
      )}
    </>
  )
}

function Results({
  data,
  selected,
  onSelect,
}: {
  data: ExamResultsView
  selected: number | null
  onSelect: (semester: number) => void
}) {
  const semesters = data.semesters
  const latest = semesters[semesters.length - 1].semester
  const active =
    semesters.find((s) => s.semester === (selected ?? latest)) ??
    semesters[semesters.length - 1]

  return (
    // Two columns on wider screens: a narrow semester rail + the detail. On a
    // short (720p) landscape screen this uses the spare width instead of
    // stacking everything vertically, so the whole thing fits without scroll.
    <div className="grid gap-4 md:grid-cols-[15rem_1fr] md:items-start">
      <aside className="space-y-3">
        <CgpaSummary data={data} />
        <div className="space-y-1.5">
          {semesters.map((sem) => (
            <SemesterRow
              key={sem.semester}
              semester={sem}
              active={sem.semester === active.semester}
              onSelect={() => onSelect(sem.semester)}
            />
          ))}
        </div>
      </aside>

      <SemesterDetail semester={active} />
    </div>
  )
}

function CgpaSummary({ data }: { data: ExamResultsView }) {
  return (
    <Card className="p-4">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Cumulative GPA
      </p>
      <p className="text-3xl font-bold tracking-tight tabular-nums">
        {data.cgpa.toFixed(2)}
        <span className="ml-1 text-base font-medium text-muted-foreground">
          /10
        </span>
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {data.semesters_count} semester
        {data.semesters_count === 1 ? '' : 's'} · {data.total_credits} credits
      </p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">
        Graded on a 10-point scale
      </p>
      {data.backlog_count > 0 && (
        <Badge variant="destructive" className="mt-2">
          {data.backlog_count} active backlog
          {data.backlog_count === 1 ? '' : 's'}
        </Badge>
      )}
    </Card>
  )
}

function SemesterRow({
  semester,
  active,
  onSelect,
}: {
  semester: ExamResultSemester
  active: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={cn(
        'flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left transition-colors',
        'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30',
        active
          ? 'border-primary bg-primary/10 ring-1 ring-primary'
          : 'border-border bg-card hover:bg-muted/40',
      )}
    >
      <span className="flex items-center gap-2">
        <span
          aria-hidden
          className={cn(
            'size-2 shrink-0 rounded-full',
            semester.passed ? 'bg-icon-emerald' : 'bg-destructive',
          )}
        />
        <span className="text-sm font-medium">
          Semester {semester.semester}
        </span>
      </span>
      <span className="flex items-baseline gap-1">
        <span className="text-sm font-bold tabular-nums text-primary">
          {semester.sgpa.toFixed(2)}
        </span>
        <span className="text-[10px] uppercase text-muted-foreground">SGPA</span>
      </span>
    </button>
  )
}

function SemesterDetail({ semester }: { semester: ExamResultSemester }) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold">Semester {semester.semester}</span>
            <Badge variant={semester.passed ? 'success' : 'destructive'}>
              {semester.passed ? 'Pass' : 'Fail'}
            </Badge>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {semester.subjects_count} subjects · {semester.total_credits} credits
            {semester.backlog_count > 0 &&
              ` · ${semester.backlog_count} backlog`}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xl font-bold tabular-nums text-primary">
            {semester.sgpa.toFixed(2)}
            <span className="ml-0.5 text-xs font-medium text-muted-foreground">
              /10
            </span>
          </p>
          <p className="text-[11px] text-muted-foreground">SGPA</p>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Course</TableHead>
            <TableHead className="text-right">Credits</TableHead>
            <TableHead className="text-right">Grade</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {semester.subjects.map((sub) => (
            <SubjectRow key={sub.subject_code} subject={sub} />
          ))}
        </TableBody>
      </Table>
    </Card>
  )
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

/** "Mon YYYY" from a YYYY-MM-DD exam date — the day isn't meaningful. */
function formatMonthYear(iso: string): string {
  const m = /^(\d{4})-(\d{2})-\d{2}$/.exec((iso ?? '').trim())
  if (!m) return iso
  return `${MONTHS[Number(m[2]) - 1] ?? ''} ${m[1]}`.trim()
}

/** A compact grade pill + its points. */
function GradePoints({
  grade,
  points,
  meaning,
}: {
  grade: string
  points: number
  meaning?: string
}) {
  return (
    <span className="inline-flex items-center gap-2" title={meaning}>
      <Badge variant={gradeVariant(grade)} className="min-w-9 justify-center">
        {grade}
      </Badge>
      <span className="whitespace-nowrap tabular-nums text-xs text-muted-foreground">
        {points} pts
      </span>
    </span>
  )
}

/** One subject row — expandable to its sitting history when attempted >1. */
function SubjectRow({ subject }: { subject: ExamResultSubject }) {
  const [open, setOpen] = useState(false)
  const hasHistory = subject.attempts_count > 1
  return (
    <>
      <TableRow
        className={hasHistory ? 'cursor-pointer' : undefined}
        onClick={hasHistory ? () => setOpen((v) => !v) : undefined}
      >
        <TableCell>
          <p className="font-medium text-foreground">{subject.subject_name}</p>
          <p className="text-xs text-muted-foreground">
            {subject.subject_code}
            {hasHistory && (
              <span className="text-primary">
                {' '}
                · {subject.attempts_count} attempts
              </span>
            )}
          </p>
        </TableCell>
        <TableCell className="text-right tabular-nums">
          {subject.credits}
        </TableCell>
        <TableCell className="text-right">
          <div className="flex items-center justify-end gap-2">
            <GradePoints
              grade={subject.grade}
              points={subject.grade_points}
              meaning={subject.grade_meaning}
            />
            <span className="flex w-4 justify-center text-muted-foreground">
              {hasHistory &&
                (open ? (
                  <ChevronDown className="size-4" />
                ) : (
                  <ChevronRight className="size-4" />
                ))}
            </span>
          </div>
        </TableCell>
      </TableRow>
      {hasHistory && open && (
        <TableRow>
          <TableCell colSpan={3} className="bg-muted/30">
            <p className="mb-1.5 text-[11px] font-medium uppercase text-muted-foreground">
              All attempts (newest → oldest)
            </p>
            <div className="space-y-1.5">
              {subject.attempts.slice().reverse().map((a, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded-md bg-background px-3 py-1.5"
                >
                  <span className="w-20 text-xs text-muted-foreground">
                    {formatMonthYear(a.exam_date)}
                  </span>
                  <span className="w-16 text-xs capitalize text-muted-foreground">
                    {a.exam_type}
                  </span>
                  <div className="flex-1">
                    <GradePoints
                      grade={a.grade}
                      points={a.grade_points}
                      meaning={a.grade_meaning}
                    />
                  </div>
                  {a.is_best && a.grade !== 'F' && (
                    <Badge variant="success">Best</Badge>
                  )}
                </div>
              ))}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  )
}

function ResultsSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-[15rem_1fr]">
      <div className="space-y-3">
        <div className="h-28 animate-pulse rounded-2xl bg-muted" />
        <div className="space-y-1.5">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      </div>
      <div className="h-80 animate-pulse rounded-2xl bg-muted" />
    </div>
  )
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border bg-card p-10 text-center text-card-foreground">
      <div className="grid size-12 place-items-center rounded-full bg-destructive/10 text-destructive">
        <CircleAlert className="size-6" />
      </div>
      <div className="space-y-1">
        <h2 className="text-sm font-semibold">Couldn’t load your results</h2>
        <p className="max-w-sm text-xs text-muted-foreground">{message}</p>
      </div>
      <Button size="sm" onClick={onRetry}>
        <RefreshCw className="size-4" /> Try again
      </Button>
    </div>
  )
}
