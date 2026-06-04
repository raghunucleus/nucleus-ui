import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Loader2,
  Search,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'
import { useScreenAccess } from '@/hooks/use-screen-access'
import {
  NoAccessEmptyState,
  NoScopeEmptyState,
} from '@/components/employee/empty-states'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  fetchBatchResults,
  fetchStudentByRoll,
  fetchStudentMarksScope,
  fetchStudentResults,
  type BatchResultRow,
  type ExamMarksScopeItem,
  type ResultSemester,
  type ResultSubject,
  type StudentResultsDetail,
} from '@/lib/exam-marks'
import { cn } from '@/lib/utils'

const SCREEN_KEY = 'examinations.marks.view'
const PAGE_SIZE = 10

type ViewMode = 'programme' | 'student'

interface Programme {
  id: number
  name: string
  code: string
}
interface YearOption {
  comboId: number
  display: string
}

/**
 * A `DropdownMenu` with a sticky search box that filters items client-side —
 * mirrors the picker on the marks-upload screen (radix ships no combobox and
 * the project has no cmdk). `onOpenAutoFocus` is prevented so the input takes
 * focus; typing keys are kept local so radix's type-ahead doesn't swallow them.
 */
function SearchableMenu<T>({
  items,
  trigger,
  disabled,
  searchPlaceholder,
  emptyText,
  toText,
  getKey,
  renderItem,
  onSelect,
}: {
  items: T[]
  trigger: ReactNode
  disabled?: boolean
  searchPlaceholder: string
  emptyText: string
  toText: (item: T) => string
  getKey: (item: T) => React.Key
  renderItem: (item: T) => ReactNode
  onSelect: (item: T) => void
}) {
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const filtered = q
    ? items.filter((it) => toText(it).toLowerCase().includes(q))
    : items

  return (
    <DropdownMenu onOpenChange={(open) => !open && setQuery('')}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className="w-full justify-between font-normal"
        >
          {trigger}
          <ChevronDown className="ml-2 size-4 shrink-0 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        onOpenAutoFocus={(e: Event) => e.preventDefault()}
        className="max-h-72 w-(--radix-dropdown-menu-trigger-width) overflow-y-auto p-0"
      >
        <div className="sticky top-0 z-10 border-b bg-popover p-1">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              placeholder={searchPlaceholder}
              className="h-9 pl-8"
            />
          </div>
        </div>
        <div className="p-1">
          {filtered.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">
              {emptyText}
            </p>
          ) : (
            filtered.map((it) => (
              <DropdownMenuItem key={getKey(it)} onSelect={() => onSelect(it)}>
                {renderItem(it)}
              </DropdownMenuItem>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * Read-only "Student marks" view for the exam cell. One screen serves both
 * needs: pick a programme + admission-year batch to see the whole roster with
 * cached CGPA + backlogs (branch-wise), search by HT number or name to find an
 * individual, and expand any row for that student's full per-semester /
 * per-subject grade breakdown (individual).
 */
export default function EmployeeMarksViewPage() {
  const access = useScreenAccess(SCREEN_KEY)
  const canView = !!access?.actions.includes('view')

  const [mode, setMode] = useState<ViewMode>('student')
  const [batches, setBatches] = useState<ExamMarksScopeItem[] | null>(null)
  const [programmeId, setProgrammeId] = useState<number | null>(null)
  const [batchId, setBatchId] = useState<number | null>(null)

  // Roster of the selected batch.
  const [roster, setRoster] = useState<BatchResultRow[] | null>(null)
  const [rosterError, setRosterError] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!canView) return
    let alive = true
    void (async () => {
      try {
        const data = await fetchStudentMarksScope()
        if (alive) setBatches(data)
      } catch (err) {
        if (!alive) return
        setBatches([])
        toast.error(
          err instanceof Error ? err.message : 'Failed to load your batches',
        )
      }
    })()
    return () => {
      alive = false
    }
  }, [canView])

  // Switch the selected batch and clear the previous roster up front (in the
  // event handler, not an effect, so we don't trigger cascading renders).
  function selectBatch(id: number | null) {
    setBatchId(id)
    setRoster(null)
    setRosterError(false)
    setSearch('')
  }

  // Load the roster whenever the selected batch changes. Only the async result
  // sets state here — the synchronous reset happens in selectBatch.
  useEffect(() => {
    if (batchId === null) return
    let alive = true
    void (async () => {
      try {
        const data = await fetchBatchResults(batchId)
        if (alive) setRoster(data)
      } catch (err) {
        if (!alive) return
        setRoster([])
        setRosterError(true)
        toast.error(
          err instanceof Error ? err.message : 'Failed to load results',
        )
      }
    })()
    return () => {
      alive = false
    }
  }, [batchId])

  const programmes = useMemo<Programme[]>(() => {
    const m = new Map<number, Programme>()
    for (const b of batches ?? []) {
      if (!m.has(b.programme_id)) {
        m.set(b.programme_id, {
          id: b.programme_id,
          name: b.programme_name,
          code: b.programme_code,
        })
      }
    }
    return [...m.values()]
  }, [batches])

  const years = useMemo<YearOption[]>(() => {
    if (programmeId === null) return []
    return (batches ?? [])
      .filter((b) => b.programme_id === programmeId)
      .map((b) => ({ comboId: b.id, display: b.admission_year_display }))
  }, [batches, programmeId])

  const selectedProgramme = programmes.find((p) => p.id === programmeId) ?? null
  const selectedBatch = (batches ?? []).find((b) => b.id === batchId) ?? null

  const filteredRoster = useMemo(() => {
    const list = roster ?? []
    const q = search.trim().toLowerCase()
    if (!q) return list
    return list.filter(
      (r) =>
        r.roll_number.toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q),
    )
  }, [roster, search])

  // ---- access gates ----------------------------------------------------
  if (!access) return <NoAccessEmptyState />
  if (!canView) return <NoScopeEmptyState attributeLabel="view permission" />
  if (batches !== null && batches.length === 0) {
    return (
      <NoScopeEmptyState attributeLabel="programme / admission-year batches" />
    )
  }

  const loadingBatches = batches === null

  return (
    <section className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <GraduationCap className="size-6 text-icon-blue" />
          Student marks
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Browse a whole programme batch, or look up a single student by their
          student ID.
        </p>
      </header>

      {/* Underline tabs: whole programme batch vs. a single student by ID. */}
      <div
        role="tablist"
        aria-label="Student marks view"
        className="flex gap-6 border-b"
      >
        {(
          [
            ['student', 'Student ID'],
            ['programme', 'Programme'],
          ] as const
        ).map(([value, label]) => {
          const selected = mode === value
          return (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setMode(value)}
              className={cn(
                '-mb-px border-b-2 px-1 pb-2.5 text-sm font-medium transition-colors',
                'focus-visible:outline-none',
                selected
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground',
              )}
            >
              {label}
            </button>
          )
        })}
      </div>

      {mode === 'student' ? (
        <IndividualLookup />
      ) : (
        <>
          <Card>
            <CardContent className="grid gap-5 pt-6 sm:grid-cols-2">
          {/* Programme */}
          <div className="space-y-1.5">
            <Label>Programme</Label>
            <SearchableMenu
              items={programmes}
              disabled={loadingBatches}
              searchPlaceholder="Search programmes…"
              emptyText="No programmes match your search."
              toText={(p) => `${p.name} ${p.code}`}
              getKey={(p) => p.id}
              onSelect={(p) => {
                setProgrammeId(p.id)
                selectBatch(null)
              }}
              trigger={
                <span
                  className={cn(!selectedProgramme && 'text-muted-foreground')}
                >
                  {loadingBatches
                    ? 'Loading…'
                    : selectedProgramme
                      ? `${selectedProgramme.name}${selectedProgramme.code ? ` (${selectedProgramme.code})` : ''}`
                      : 'Select a programme…'}
                </span>
              }
              renderItem={(p) => (
                <>
                  {p.name}
                  {p.code && (
                    <span className="ml-1 text-xs text-muted-foreground">
                      ({p.code})
                    </span>
                  )}
                </>
              )}
            />
          </div>

          {/* Admission year */}
          <div className="space-y-1.5">
            <Label className={cn(programmeId === null && 'text-muted-foreground')}>
              Admission year
            </Label>
            <SearchableMenu
              items={years}
              disabled={programmeId === null}
              searchPlaceholder="Search admission years…"
              emptyText="No admission years match your search."
              toText={(y) => y.display}
              getKey={(y) => y.comboId}
              onSelect={(y) => selectBatch(y.comboId)}
              trigger={
                <span
                  className={cn(
                    (programmeId === null || batchId === null) &&
                      'text-muted-foreground',
                  )}
                >
                  {programmeId === null
                    ? 'Select a programme first'
                    : selectedBatch
                      ? selectedBatch.admission_year_display
                      : 'Select an admission year…'}
                </span>
              }
              renderItem={(y) => y.display}
            />
          </div>
        </CardContent>
      </Card>

          {batchId !== null && (
            <RosterCard
              key={batchId}
              batchLabel={selectedBatch?.label ?? ''}
              batchId={batchId}
              roster={roster}
              rosterError={rosterError}
              filtered={filteredRoster}
              search={search}
              onSearch={setSearch}
            />
          )}
        </>
      )}
    </section>
  )
}

/**
 * "By student ID" mode — look up a single student's full breakdown directly,
 * without picking a programme/year. The server resolves the id across the
 * employee's assigned batches and rejects anything outside their scope.
 */
function IndividualLookup() {
  const [roll, setRoll] = useState('')
  const [detail, setDetail] = useState<StudentResultsDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lookedUp, setLookedUp] = useState<string | null>(null)

  function lookup() {
    const q = roll.trim()
    if (!q || loading) return
    setLoading(true)
    setError(null)
    setDetail(null)
    setLookedUp(q)
    void (async () => {
      try {
        setDetail(await fetchStudentByRoll(q))
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Could not load the student.',
        )
      } finally {
        setLoading(false)
      }
    })()
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-1.5 pt-6">
          <Label>Student ID</Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={roll}
                onChange={(e) => setRoll(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && lookup()}
                placeholder="Enter a student's ID…"
                className="pl-8 font-mono"
                autoFocus
              />
            </div>
            <Button onClick={lookup} disabled={!roll.trim() || loading}>
              View marks
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Looks up the student across your assigned programme batches.
          </p>
        </CardContent>
      </Card>

      {loading && (
        <Card>
          <CardContent className="pt-6">
            <SemesterMarksSkeleton />
          </CardContent>
        </Card>
      )}

      {!loading && error && (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-sm font-medium">{error}</p>
            {lookedUp && (
              <p className="mt-1 text-xs text-muted-foreground">
                Student ID <span className="font-mono">{lookedUp}</span>
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {!loading && detail && (
        <Card>
          <CardContent className="space-y-3 pt-6">
            <div className="flex flex-wrap items-center gap-3 border-b pb-3">
              <span className="font-mono text-sm">
                {detail.student.roll_number}
              </span>
              <span className="flex-1 truncate text-sm font-medium">
                {detail.student.name}
              </span>
              <Badge variant="default">CGPA {detail.cgpa.toFixed(2)}</Badge>
              <Badge variant="muted">{detail.semesters_count} sem</Badge>
              {detail.backlog_count > 0 ? (
                <Badge variant="destructive">
                  {detail.backlog_count} backlog
                </Badge>
              ) : (
                <Badge variant="success">No backlogs</Badge>
              )}
            </div>
            {detail.semesters.map((sem) => (
              <SemesterCard key={sem.semester} semester={sem} />
            ))}
            {detail.semesters.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No subjects recorded.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function RosterCard({
  batchLabel,
  batchId,
  roster,
  rosterError,
  filtered,
  search,
  onSearch,
}: {
  batchLabel: string
  batchId: number
  roster: BatchResultRow[] | null
  rosterError: boolean
  filtered: BatchResultRow[]
  search: string
  onSearch: (v: string) => void
}) {
  const loading = roster === null
  const total = roster?.length ?? 0

  // Accordion: only one student's breakdown is open at a time, to save space.
  const [openId, setOpenId] = useState<number | null>(null)

  // Client-side pagination over the (already filtered) roster. `safePage`
  // clamps a stale page if the filter shrank the list — no effect needed.
  const [page, setPage] = useState(1)
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const start = (safePage - 1) * PAGE_SIZE
  const pageRows = filtered.slice(start, start + PAGE_SIZE)

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Users className="size-4 text-muted-foreground" />
            <span className="text-sm font-medium">{batchLabel}</span>
            {!loading && (
              <Badge variant="muted">
                {total.toLocaleString()} student{total === 1 ? '' : 's'}
              </Badge>
            )}
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => {
                onSearch(e.target.value)
                setPage(1)
              }}
              placeholder="Search by student ID or name…"
              className="h-9 pl-8"
            />
          </div>
        </div>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-11 animate-pulse rounded-md bg-muted/60" />
            ))}
          </div>
        ) : rosterError ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Could not load results for this batch.
          </p>
        ) : total === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No marks have been committed for this batch yet.
          </p>
        ) : filtered.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No students match “{search}”.
          </p>
        ) : (
          <>
            <div className="space-y-2">
              {pageRows.map((r) => (
                <StudentRow
                  key={r.student_id}
                  row={r}
                  batchId={batchId}
                  open={openId === r.student_id}
                  onToggle={() =>
                    setOpenId((cur) =>
                      cur === r.student_id ? null : r.student_id,
                    )
                  }
                />
              ))}
            </div>

            {pageCount > 1 && (
              <div className="flex items-center justify-between gap-3 pt-1">
                <p className="text-xs text-muted-foreground">
                  Showing {start + 1}–{start + pageRows.length} of{' '}
                  {filtered.length.toLocaleString()}
                  {search.trim() && ` (filtered from ${total.toLocaleString()})`}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={safePage <= 1}
                    onClick={() => setPage(Math.max(1, safePage - 1))}
                  >
                    <ChevronLeft className="size-4" /> Prev
                  </Button>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {safePage} / {pageCount}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={safePage >= pageCount}
                    onClick={() => setPage(Math.min(pageCount, safePage + 1))}
                  >
                    Next <ChevronRight className="size-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * One roster row, expandable to the student's full semester breakdown. Open
 * state is controlled by the parent (accordion — only one row open at a time);
 * the fetched detail is cached locally so re-opening is instant.
 */
function StudentRow({
  row,
  batchId,
  open,
  onToggle,
}: {
  row: BatchResultRow
  batchId: number
  open: boolean
  onToggle: () => void
}) {
  const [detail, setDetail] = useState<StudentResultsDetail | null>(null)
  const [loading, setLoading] = useState(false)

  function toggle() {
    const willOpen = !open
    onToggle()
    if (willOpen && !detail && !loading) {
      setLoading(true)
      void (async () => {
        try {
          const d = await fetchStudentResults(batchId, row.student_id)
          setDetail(d)
        } catch (err) {
          toast.error(
            err instanceof Error ? err.message : 'Failed to load detail',
          )
          onToggle() // close again on failure
        } finally {
          setLoading(false)
        }
      })()
    }
  }

  return (
    <div className="rounded-md border">
      <button
        type="button"
        onClick={toggle}
        className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-muted/40"
      >
        {open ? (
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        )}
        <span className="font-mono text-sm">{row.roll_number}</span>
        <span className="flex-1 truncate text-sm">{row.name}</span>
        <Badge variant="default">CGPA {row.cgpa.toFixed(2)}</Badge>
        <Badge variant="muted">{row.semesters_count} sem</Badge>
        {row.backlog_count > 0 ? (
          <Badge variant="destructive">{row.backlog_count} backlog</Badge>
        ) : (
          <Badge variant="success">No backlogs</Badge>
        )}
      </button>

      {open && (
        <div className="space-y-3 border-t bg-muted/10 px-3 py-3">
          {loading && <SemesterMarksSkeleton />}
          {!loading &&
            detail?.semesters.map((sem) => (
              <SemesterCard key={sem.semester} semester={sem} />
            ))}
          {!loading && detail && detail.semesters.length === 0 && (
            <p className="text-sm text-muted-foreground">No subjects recorded.</p>
          )}
        </div>
      )}
    </div>
  )
}

/** Shimmer that mimics the collapsed semester cards while marks load. */
function SemesterMarksSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-live="polite">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-md border bg-background px-4 py-3"
        >
          <div className="size-4 shrink-0 animate-pulse rounded bg-muted/70" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-28 animate-pulse rounded bg-muted/70" />
            <div className="h-3 w-44 animate-pulse rounded bg-muted/50" />
          </div>
          <div className="h-7 w-12 animate-pulse rounded bg-muted/70" />
        </div>
      ))}
      <p className="flex items-center justify-center gap-2 py-1 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" />
        Loading semester marks…
      </p>
    </div>
  )
}

type GradeVariant = 'success' | 'default' | 'warning' | 'destructive' | 'muted'

function gradeVariant(grade: string): GradeVariant {
  if (grade === 'O' || grade === 'S') return 'success'
  if (grade === 'A' || grade === 'B') return 'default'
  if (grade === 'C' || grade === 'D') return 'warning'
  if (grade === 'F') return 'destructive'
  return 'muted'
}

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

/** "Mon YYYY" from a YYYY-MM-DD exam date — the day isn't meaningful. */
function formatMonthYear(iso: string): string {
  const m = /^(\d{4})-(\d{2})-\d{2}$/.exec((iso ?? '').trim())
  if (!m) return iso
  return `${MONTHS[Number(m[2]) - 1] ?? ''} ${m[1]}`.trim()
}

/** Fixed-width grade pill + its points — handles 1- and 2-digit points. */
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
      <span className="w-10 text-right tabular-nums text-xs text-muted-foreground">
        {points} pt{points === 1 ? '' : 's'}
      </span>
    </span>
  )
}

/** One semester, collapsible (closed by default) — header toggles the subjects. */
function SemesterCard({ semester }: { semester: ResultSemester }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="overflow-hidden rounded-md border bg-background">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40"
      >
        {open ? (
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        )}
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold">Semester {semester.semester}</span>
            <Badge variant={semester.passed ? 'success' : 'destructive'}>
              {semester.passed ? 'Pass' : 'Fail'}
            </Badge>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {semester.subjects_count} subjects · {semester.total_credits} credits
            {semester.backlog_count > 0 && ` · ${semester.backlog_count} backlog`}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xl font-bold tabular-nums text-primary">
            {semester.sgpa.toFixed(2)}
          </p>
          <p className="text-[11px] text-muted-foreground">SGPA</p>
        </div>
      </button>

      {open && (
        <div className="border-t">
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
        </div>
      )}
    </div>
  )
}

/** One subject row — expandable to its sitting history when attempted >1. */
function SubjectRow({ subject }: { subject: ResultSubject }) {
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
              <span className="text-primary"> · {subject.attempts_count} attempts</span>
            )}
          </p>
        </TableCell>
        <TableCell className="text-right tabular-nums">{subject.credits}</TableCell>
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
              {subject.attempts
                .slice()
                .reverse()
                .map((a, i) => (
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
                    {a.is_best && <Badge variant="success">Best</Badge>}
                  </div>
                ))}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  )
}
