import { useCallback, useEffect, useState } from 'react'
import {
  Award,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  RefreshCw,
  Search,
  TrendingUp,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { PageHeader } from '@/components/portal-layout'
import { StateView } from '@/components/state-view'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
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
  fetchChildExamResults,
  type ExamResultSemester,
  type ExamResultSubject,
  type ExamResultsView,
} from '@/lib/parent-academics'
import { useParentAuthStore } from '@/stores/parent-auth-store'

type GradeVariant = 'success' | 'default' | 'warning' | 'destructive' | 'muted'

function gradeVariant(grade: string): GradeVariant {
  if (grade === 'O' || grade === 'S') return 'success'
  if (grade === 'A' || grade === 'B') return 'default'
  if (grade === 'C' || grade === 'D') return 'warning'
  if (grade === 'F') return 'destructive'
  return 'muted'
}

export default function ParentExamResults() {
  const { t } = useTranslation()
  const signOut = useParentAuthStore((s) => s.signOut)
  const [data, setData] = useState<ExamResultsView | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    document.title = 'Exam results — Nucleus'
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await fetchChildExamResults())
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
    : t('exam.subtitleFallback')

  if (loading) return <ResultsSkeleton />
  if (error) return <ErrorState message={error} onRetry={() => void load()} />
  if (!data) return null

  const hasResults = data.has_results && data.semesters.length > 0
  const latest = hasResults
    ? data.semesters[data.semesters.length - 1].semester
    : null

  const q = query.trim().toLowerCase()
  const filtered = data.semesters
    .map((sem) => ({
      sem,
      subjects: q
        ? sem.subjects.filter(
            (s) =>
              s.subject_name.toLowerCase().includes(q) ||
              s.subject_code.toLowerCase().includes(q),
          )
        : sem.subjects,
    }))
    .filter((x) => !q || x.subjects.length > 0)

  return (
    <>
      <PageHeader
        title={t('exam.title')}
        subtitle={subtitle}
        icon={Award}
        accent="amber"
      />

      {!hasResults ? (
        <StateView
          icon={Award}
          title={t('exam.emptyTitle')}
          description={t('exam.emptyDesc')}
        />
      ) : (
        <>
          <CgpaHero data={data} />

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-muted-foreground">
                  {t('exam.semesterResults')}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {t('exam.tapHint')}
                </p>
              </div>
            </div>

            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('exam.search')}
                className="pl-9"
                aria-label={t('exam.search')}
              />
            </div>

            {filtered.length === 0 ? (
              <div className="rounded-xl border border-dashed bg-muted/20 px-6 py-10 text-center text-sm text-muted-foreground">
                {t('exam.noMatch', { q: query })}
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map(({ sem, subjects }) => (
                  <SemesterCard
                    key={sem.semester}
                    semester={sem}
                    subjects={subjects}
                    forceOpen={!!q}
                    defaultOpen={sem.semester === latest}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </>
  )
}

function CgpaHero({ data }: { data: ExamResultsView }) {
  const { t } = useTranslation()
  return (
    <Card className="p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t('exam.cgpaLabel')}
          </p>
          <p className="text-5xl font-bold tracking-tight tabular-nums">
            {data.cgpa.toFixed(2)}
          </p>
          <p className="text-sm text-muted-foreground">
            {t('exam.summary', {
              n: data.semesters_count,
              credits: data.total_credits,
            })}
          </p>
        </div>
        <div className="grid size-12 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
          <TrendingUp className="size-6" />
        </div>
      </div>
      {data.backlog_count > 0 && (
        <div className="mt-4 flex items-center gap-2 border-t pt-4">
          <Badge variant="destructive">
            {t('exam.backlogs', { count: data.backlog_count })}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {t('exam.backlogNote')}
          </span>
        </div>
      )}
    </Card>
  )
}

function SemesterCard({
  semester,
  subjects,
  defaultOpen,
  forceOpen,
}: {
  semester: ExamResultSemester
  subjects: ExamResultSubject[]
  defaultOpen: boolean
  forceOpen?: boolean
}) {
  const { t } = useTranslation()
  const [internalOpen, setInternalOpen] = useState(defaultOpen)
  const open = forceOpen || internalOpen
  const setOpen = setInternalOpen
  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-muted/40"
      >
        {open ? (
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        )}
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold">
              {t('attendance.semester', { n: semester.semester })}
            </span>
            <Badge variant={semester.passed ? 'success' : 'destructive'}>
              {semester.passed ? t('exam.pass') : t('exam.fail')}
            </Badge>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t('exam.semMeta', {
              subjects: semester.subjects_count,
              credits: semester.total_credits,
            })}
            {semester.backlog_count > 0 &&
              ` · ${t('exam.semBacklog', { n: semester.backlog_count })}`}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xl font-bold tabular-nums text-primary">
            {semester.sgpa.toFixed(2)}
          </p>
          <p className="text-[11px] text-muted-foreground">{t('exam.sgpa')}</p>
        </div>
      </button>

      {open && (
        <div className="border-t">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('exam.colCourse')}</TableHead>
                <TableHead className="text-right">{t('exam.colCredits')}</TableHead>
                <TableHead className="text-right">{t('exam.colGrade')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subjects.map((sub) => (
                <SubjectRow key={sub.subject_code} subject={sub} />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </Card>
  )
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function formatMonthYear(iso: string): string {
  const m = /^(\d{4})-(\d{2})-\d{2}$/.exec((iso ?? '').trim())
  if (!m) return iso
  return `${MONTHS[Number(m[2]) - 1] ?? ''} ${m[1]}`.trim()
}

function GradePoints({
  grade,
  points,
  meaning,
}: {
  grade: string
  points: number
  meaning?: string
}) {
  const { t } = useTranslation()
  return (
    <span className="inline-flex items-center gap-2" title={meaning}>
      <Badge variant={gradeVariant(grade)} className="min-w-9 justify-center">
        {grade}
      </Badge>
      {/* Intrinsic width + no-wrap: the word for "points" is long in hi/te
          ("अंक" / "పాయింట్లు") and a fixed width forces it onto two lines. */}
      <span className="whitespace-nowrap tabular-nums text-xs text-muted-foreground">
        {t('exam.pts', { n: points })}
      </span>
    </span>
  )
}

function SubjectRow({ subject }: { subject: ExamResultSubject }) {
  const { t } = useTranslation()
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
                · {t('exam.attempts', { n: subject.attempts_count })}
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
              {t('exam.allAttempts')}
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
                    <Badge variant="success">{t('exam.best')}</Badge>
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
    <div className="space-y-6">
      <div className="h-16 animate-pulse rounded-2xl bg-muted" />
      <div className="h-36 animate-pulse rounded-2xl bg-muted" />
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-2xl bg-muted" />
        ))}
      </div>
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
  const { t } = useTranslation()
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border bg-card p-10 text-center text-card-foreground">
      <div className="grid size-12 place-items-center rounded-full bg-destructive/10 text-destructive">
        <CircleAlert className="size-6" />
      </div>
      <div className="space-y-1">
        <h2 className="text-sm font-semibold">{t('exam.errTitle')}</h2>
        <p className="max-w-sm text-xs text-muted-foreground">{message}</p>
      </div>
      <Button size="sm" onClick={onRetry}>
        <RefreshCw className="size-4" /> {t('common.tryAgain')}
      </Button>
    </div>
  )
}
