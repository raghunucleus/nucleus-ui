import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from '@tanstack/react-router'
import {
  ArrowLeft,
  Bell,
  Check,
  ChevronDown,
  ChevronRight,
  Download,
  FileSpreadsheet,
  Upload,
  UploadCloud,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { useScreenAccess } from '@/hooks/use-screen-access'
import { loadXlsx } from '@/lib/xlsx'
import {
  NoAccessEmptyState,
  NoScopeEmptyState,
} from '@/components/employee/empty-states'
import { BackButton } from '@/components/ui/back-button'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import {
  CHUNK_ROWS,
  commitUpload,
  fetchExamMarksScope,
  previewUpload,
  startUpload,
  studentUploadDetail,
  uploadChunk,
  type ExamMarksScopeItem,
  type PreviewResult,
  type PreviewSemester,
  type PreviewStudent,
  type PreviewSubject,
  type RowError,
  type StudentSummary,
  type UploadMarksColumn,
  type UploadMarksRow,
} from '@/lib/exam-marks'

const SCREEN_KEY = 'examinations.marks.upload'

/** Canonical column order, also used for the downloadable template. */
const COLUMNS: { key: UploadMarksColumn; header: string }[] = [
  { key: 'examination', header: 'Examination' },
  { key: 'exam_date', header: 'Month & Year of Exam' },
  { key: 'roll_number', header: 'HT No' },
  { key: 'subject_code', header: 'Sub Code' },
  { key: 'subject_name', header: 'Sub Name' },
  { key: 'credits', header: 'Credits' },
  { key: 'grade', header: 'Grade' },
  { key: 'grade_points', header: 'Grade Points' },
]

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

/** Render a YYYY-MM-DD exam date as "Mon YYYY" — the day is not meaningful. */
function formatMonthYear(iso: string): string {
  const m = /^(\d{4})-(\d{2})-\d{2}$/.exec((iso ?? '').trim())
  if (!m) return iso
  const mon = MONTHS[Number(m[2]) - 1]
  return mon ? `${mon} ${m[1]}` : iso
}

/** Map many possible normalized header spellings to a canonical column key. */
const HEADER_ALIASES: Record<string, UploadMarksColumn> = {
  examination: 'examination',
  exam: 'examination',
  'month_&_year_of_exam': 'exam_date',
  month_year_of_exam: 'exam_date',
  'month_&_year': 'exam_date',
  exam_date: 'exam_date',
  date: 'exam_date',
  ht_no: 'roll_number',
  htno: 'roll_number',
  hall_ticket_no: 'roll_number',
  roll_number: 'roll_number',
  roll_no: 'roll_number',
  sub_code: 'subject_code',
  subject_code: 'subject_code',
  sub_name: 'subject_name',
  subject_name: 'subject_name',
  credits: 'credits',
  credit: 'credits',
  grade: 'grade',
  grade_points: 'grade_points',
  grade_point: 'grade_points',
  gradepoints: 'grade_points',
}

function navigateTo(path: string) {
  window.history.pushState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

function normalizeKey(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, '_')
}

/** Convert an Excel date cell (serial number, Date, or string) to YYYY-MM-DD. */
function toIsoDate(value: unknown): string {
  if (value === null || value === undefined || value === '') return ''
  if (typeof value === 'number' && Number.isFinite(value)) {
    const ms = Math.round((value - 25569) * 86400000)
    return new Date(ms).toISOString().slice(0, 10)
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10)
  }
  const s = String(value).trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? s : d.toISOString().slice(0, 10)
}

function cellToString(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

/**
 * STRUCTURAL validation only — required fields, looks-numeric, date format. All
 * grading/semantic rules (legal grade, grade→points, examination→semester,
 * roster) are enforced server-side and returned as per-cell errors. No grading
 * logic lives on the client.
 */
function validateClient(rows: UploadMarksRow[]): RowError[] {
  const errors: RowError[] = []
  rows.forEach((row, i) => {
    const push = (column: UploadMarksColumn, reason: string) =>
      errors.push({ row: i, column, reason })

    if (!row.examination.trim()) push('examination', 'Examination is required')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.exam_date.trim())) {
      push('exam_date', 'Date must be YYYY-MM-DD')
    }
    if (!row.roll_number.trim()) push('roll_number', 'HT No is required')
    if (!row.subject_code.trim()) push('subject_code', 'Sub Code is required')
    if (!row.subject_name.trim()) push('subject_name', 'Sub Name is required')
    if (!row.grade.trim()) push('grade', 'Grade is required')

    const credits = Number(row.credits)
    if (row.credits.trim() === '' || !Number.isFinite(credits) || credits < 0) {
      push('credits', 'Credits must be a number ≥ 0')
    }
    const gp = Number(row.grade_points)
    if (row.grade_points.trim() === '' || !Number.isFinite(gp)) {
      push('grade_points', 'Grade Points must be a number')
    }
  })
  return errors
}

/** Group errors into row → column → reason for fast cell lookups. */
function indexErrors(errors: RowError[]): Map<number, Map<string, string>> {
  const byRow = new Map<number, Map<string, string>>()
  for (const e of errors) {
    const cols = byRow.get(e.row) ?? new Map<string, string>()
    if (!cols.has(e.column)) cols.set(e.column, e.reason)
    byRow.set(e.row, cols)
  }
  return byRow
}

/**
 * Upload screen for a single batch. Parse → fix flagged cells → preview
 * student-wise → confirm. Rows are streamed to the server in chunks (scales to
 * lakhs); the server validates, computes SGPA/CGPA, and does the atomic
 * full-replace on commit.
 */
export default function EmployeeMarksUploadBatchPage() {
  const access = useScreenAccess(SCREEN_KEY)
  const canUpload = !!access?.actions.includes('upload')

  const { batchId: rawBatchId } = useParams({ strict: false }) as {
    batchId?: string
  }
  const batchId = Number(rawBatchId)

  const [batch, setBatch] = useState<ExamMarksScopeItem | null | undefined>(
    undefined,
  )
  const [rows, setRows] = useState<UploadMarksRow[]>([])
  const [fileName, setFileName] = useState<string | null>(null)
  const [serverErrors, setServerErrors] = useState<RowError[]>([])
  const [session, setSession] = useState<string | null>(null)
  const [preview, setPreview] = useState<PreviewResult | null>(null)
  const [busy, setBusy] = useState<false | 'uploading' | 'committing'>(false)
  const [progress, setProgress] = useState<{ sent: number; total: number }>({
    sent: 0,
    total: 0,
  })
  const [committed, setCommitted] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [notifyStudents, setNotifyStudents] = useState(true)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!canUpload) return
    let alive = true
    void (async () => {
      try {
        const data = await fetchExamMarksScope()
        if (!alive) return
        setBatch(data.find((b) => b.id === batchId) ?? null)
      } catch (err) {
        if (!alive) return
        setBatch(null)
        toast.error(
          err instanceof Error ? err.message : 'Failed to load the batch',
        )
      }
    })()
    return () => {
      alive = false
    }
  }, [canUpload, batchId])

  const clientErrors = useMemo(() => validateClient(rows), [rows])
  const errorsByRow = useMemo(
    () => indexErrors([...clientErrors, ...serverErrors]),
    [clientErrors, serverErrors],
  )
  const issueRowIndexes = useMemo(
    () => [...errorsByRow.keys()].sort((a, b) => a - b),
    [errorsByRow],
  )

  function invalidateStaged() {
    setSession(null)
    setPreview(null)
    setCommitted(false)
  }

  function resetParsed() {
    setRows([])
    setServerErrors([])
    invalidateStaged()
    if (fileRef.current) fileRef.current.value = ''
    setFileName(null)
  }

  async function handleFile(file: File) {
    resetParsed()
    setFileName(file.name)
    try {
      const [XLSX, buf] = await Promise.all([loadXlsx(), file.arrayBuffer()])
      const wb = XLSX.read(buf, { type: 'array' })
      const sheetName =
        wb.SheetNames.find((n) => n.toLowerCase() === 'sheet4') ??
        wb.SheetNames[0]
      const sheet = sheetName ? wb.Sheets[sheetName] : undefined
      if (!sheet) {
        toast.error('The file has no sheets')
        return
      }
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        defval: '',
        raw: true,
      })
      const parsed: UploadMarksRow[] = raw.map((rawRow) => {
        const mapped: Partial<Record<UploadMarksColumn, unknown>> = {}
        for (const [k, v] of Object.entries(rawRow)) {
          const col = HEADER_ALIASES[normalizeKey(k)]
          if (col) mapped[col] = v
        }
        return {
          examination: cellToString(mapped.examination),
          exam_date: toIsoDate(mapped.exam_date),
          roll_number: cellToString(mapped.roll_number),
          subject_code: cellToString(mapped.subject_code),
          subject_name: cellToString(mapped.subject_name),
          credits: cellToString(mapped.credits),
          grade: cellToString(mapped.grade).toUpperCase(),
          grade_points: cellToString(mapped.grade_points),
        }
      })
      if (parsed.length === 0) {
        toast.error('No data rows found in the sheet')
        return
      }
      setRows(parsed)
      toast.success(`Parsed ${parsed.length.toLocaleString()} row(s)`)
    } catch {
      toast.error('Could not read the file. Use a .xlsx or .csv export.')
    }
  }

  function editCell(row: number, column: UploadMarksColumn, value: string) {
    setRows((prev) => {
      const next = prev.slice()
      next[row] = { ...next[row], [column]: value }
      return next
    })
    setServerErrors((prev) =>
      prev.filter((e) => !(e.row === row && e.column === column)),
    )
    invalidateStaged()
  }

  /** Stream all rows to the server in chunks, then fetch the preview. */
  async function handlePreview() {
    if (!batch || rows.length === 0) return
    if (clientErrors.length > 0) {
      toast.error(
        `Fix the ${clientErrors.length} highlighted issue(s) before previewing`,
      )
      return
    }
    setBusy('uploading')
    setPreview(null)
    setServerErrors([])
    setCommitted(false)
    setProgress({ sent: 0, total: rows.length })
    try {
      const { upload_session } = await startUpload(batch.id)
      for (let i = 0; i < rows.length; i += CHUNK_ROWS) {
        const slice = rows.slice(i, i + CHUNK_ROWS)
        await uploadChunk({
          programme_admission_year_id: batch.id,
          upload_session,
          offset: i,
          rows: slice,
        })
        setProgress({ sent: Math.min(i + slice.length, rows.length), total: rows.length })
      }
      setSession(upload_session)
      const result = await previewUpload(batch.id, upload_session)
      if (result.valid) {
        setPreview(result)
        toast.success(`Previewing ${result.students.length.toLocaleString()} student(s)`)
      } else {
        setServerErrors(result.errors)
        toast.error(
          `${result.error_count} issue(s) found — see highlights` +
            (result.error_count > result.errors.length
              ? ` (showing first ${result.errors.length})`
              : ''),
        )
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed')
      invalidateStaged()
    } finally {
      setBusy(false)
    }
  }

  async function handleCommit(notify: boolean) {
    if (!batch || !session || !preview?.valid) return
    setConfirmOpen(false)
    setBusy('committing')
    try {
      const result = await commitUpload({
        programme_admission_year_id: batch.id,
        upload_session: session,
        notify,
      })
      if (result.valid && result.persisted) {
        const stored = result.summary?.students ?? 0
        invalidateStaged()
        setCommitted(true)
        toast.success(
          `Stored ${result.summary?.results_stored?.toLocaleString() ?? 0} result(s) for ` +
            `${stored.toLocaleString()} student(s)` +
            (notify ? ` · ${stored.toLocaleString()} student(s) notified` : ''),
        )
      } else {
        toast.error('Validation changed — please preview again')
        invalidateStaged()
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Store failed')
    } finally {
      setBusy(false)
    }
  }

  async function downloadTemplate() {
    const XLSX = await loadXlsx()
    const ws = XLSX.utils.aoa_to_sheet([
      COLUMNS.map((c) => c.header),
      [
        'I YEAR I SEMESTER Regular',
        '2023-02-01',
        '22981A0101',
        '20MA1001',
        'Calculus',
        '3',
        'S',
        '9',
      ],
    ])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet4')
    XLSX.writeFile(wb, 'marks-template.xlsx')
  }

  if (!access) return <NoAccessEmptyState />
  if (!canUpload) return <NoScopeEmptyState attributeLabel="upload permission" />

  const totalErrors = clientErrors.length + serverErrors.length

  return (
    <section className="space-y-4">
      <PageHeader
        leading={
          <BackButton
            iconOnly
            label="Back to marks upload"
            onClick={() => navigateTo('/marks/upload')}
          />
        }
        title="Upload marks"
      />
      <p className="text-sm text-muted-foreground">
        {batch === undefined
          ? 'Loading batch…'
          : batch === null
            ? 'This batch is not available to you.'
            : batch.label}
      </p>

      {batch === null ? (
        <div className="rounded-md border border-dashed bg-muted/20 px-6 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            That batch isn’t in your assigned scope.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => navigateTo('/marks/upload')}
          >
            <ArrowLeft className="mr-2 size-4" />
            Choose a batch
          </Button>
        </div>
      ) : batch === undefined ? (
        <div className="h-40 animate-pulse rounded-lg bg-muted/60" />
      ) : (
        <>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="size-5 text-icon-blue" />
                <CardTitle className="text-base">Grade sheet</CardTitle>
              </div>
              <Button variant="ghost" size="sm" onClick={downloadTemplate}>
                <Download className="mr-2 h-4 w-4" />
                Template
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.csv"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) void handleFile(f)
                  // allow re-selecting the same file name
                  e.target.value = ''
                }}
              />

              {!fileName ? (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault()
                    setDragOver(true)
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault()
                    setDragOver(false)
                    const f = e.dataTransfer.files?.[0]
                    if (f) void handleFile(f)
                  }}
                  className={cn(
                    'flex w-full flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors',
                    dragOver
                      ? 'border-primary bg-primary/5'
                      : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/40',
                  )}
                >
                  <span className="flex size-12 items-center justify-center rounded-full bg-primary/10">
                    <UploadCloud className="size-6 text-primary" />
                  </span>
                  <span className="space-y-0.5">
                    <span className="block text-sm font-medium">
                      <span className="text-primary">Click to upload</span> or
                      drag and drop
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      XLSX or CSV — reads sheet “Sheet4”
                    </span>
                  </span>
                </button>
              ) : (
                <div
                  className={cn(
                    'flex items-center gap-3 rounded-lg border px-3 py-3',
                    totalErrors > 0
                      ? 'border-destructive/40 bg-destructive/5'
                      : rows.length > 0
                        ? 'border-success/30 bg-success/5'
                        : 'bg-muted/30',
                  )}
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-background">
                    <FileSpreadsheet className="size-5 text-icon-blue" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{fileName}</p>
                    <p className="text-xs text-muted-foreground">
                      {rows.length > 0
                        ? `${rows.length.toLocaleString()} row(s) parsed`
                        : 'No rows parsed'}
                      {totalErrors > 0 && (
                        <span className="text-destructive">
                          {' '}
                          · {totalErrors} issue(s) to fix
                        </span>
                      )}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy !== false}
                    onClick={() => fileRef.current?.click()}
                  >
                    Replace
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Remove file"
                    disabled={busy !== false}
                    onClick={resetParsed}
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                Columns: {COLUMNS.map((c) => c.header).join(', ')}.
              </p>

              {busy === 'uploading' && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Uploading rows…</span>
                    <span className="tabular-nums">
                      {progress.sent.toLocaleString()} /{' '}
                      {progress.total.toLocaleString()}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{
                        width: `${
                          progress.total > 0
                            ? Math.round((progress.sent / progress.total) * 100)
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {issueRowIndexes.length > 0 && (
            <IssuesCard
              rows={rows}
              issueRowIndexes={issueRowIndexes}
              errorsByRow={errorsByRow}
              onEdit={editCell}
            />
          )}

          {rows.length > 0 && (
            <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card/80 px-4 py-3 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/70">
              <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
                <FileSpreadsheet className="size-4 shrink-0 text-icon-blue" />
                <span className="truncate">
                  <span className="font-medium text-foreground tabular-nums">
                    {rows.length.toLocaleString()}
                  </span>{' '}
                  row(s) →{' '}
                  <span className="font-medium text-foreground">
                    {batch.label}
                  </span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => void handlePreview()}
                  disabled={rows.length === 0 || busy !== false}
                  variant={preview?.valid ? 'outline' : 'default'}
                >
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  {busy === 'uploading'
                    ? 'Validating…'
                    : preview?.valid
                      ? 'Re-preview'
                      : 'Preview'}
                </Button>
                {preview?.valid && session && (
                  <Button
                    onClick={() => {
                      setNotifyStudents(true)
                      setConfirmOpen(true)
                    }}
                    disabled={busy !== false || committed}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    {busy === 'committing'
                      ? 'Storing…'
                      : committed
                        ? 'Stored'
                        : 'Confirm & store'}
                  </Button>
                )}
              </div>
            </div>
          )}

          {committed && (
            <div className="rounded-md border border-success/30 bg-success/5 px-4 py-3 text-sm">
              Stored successfully. All previously stored results for this batch
              were overwritten with this sheet.
            </div>
          )}

          {preview?.valid && session && !committed && (
            <PreviewCard
              preview={preview}
              batchId={batch.id}
              session={session}
            />
          )}

          <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Confirm & store results</DialogTitle>
                <DialogDescription>
                  This stores results for{' '}
                  <span className="font-medium text-foreground">
                    {(preview?.students.length ?? 0).toLocaleString()}
                  </span>{' '}
                  student(s) in{' '}
                  <span className="font-medium text-foreground">
                    {batch.label}
                  </span>{' '}
                  and overwrites everything previously stored for this batch.
                </DialogDescription>
              </DialogHeader>

              <button
                type="button"
                role="checkbox"
                aria-checked={notifyStudents}
                onClick={() => setNotifyStudents((v) => !v)}
                className="flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted/40"
              >
                <span
                  className={cn(
                    'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-[5px] border transition-colors',
                    notifyStudents
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-input',
                  )}
                >
                  {notifyStudents && <Check className="size-3.5" />}
                </span>
                <span className="space-y-0.5">
                  <span className="flex items-center gap-1.5 text-sm font-medium">
                    <Bell className="size-3.5 text-muted-foreground" />
                    Notify students
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    Send an in-app & push notification so students know their
                    results are published.
                  </span>
                </span>
              </button>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setConfirmOpen(false)}
                  disabled={busy === 'committing'}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => void handleCommit(notifyStudents)}
                  disabled={busy === 'committing'}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  {notifyStudents ? 'Store & notify' : 'Store'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </section>
  )
}

/** Editable table of only the rows that have problems, with cell highlights. */
function IssuesCard({
  rows,
  issueRowIndexes,
  errorsByRow,
  onEdit,
}: {
  rows: UploadMarksRow[]
  issueRowIndexes: number[]
  errorsByRow: Map<number, Map<string, string>>
  onEdit: (row: number, column: UploadMarksColumn, value: string) => void
}) {
  const shown = issueRowIndexes.slice(0, 200)
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base text-destructive">
          Issues to fix
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            {issueRowIndexes.length} row(s) — edit cells to correct them
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="max-h-[28rem] overflow-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">Row</TableHead>
                {COLUMNS.map((c) => (
                  <TableHead key={c.key}>{c.header}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((rowIdx) => {
                const cols = errorsByRow.get(rowIdx)
                return (
                  <TableRow key={rowIdx}>
                    <TableCell className="text-xs text-muted-foreground tabular-nums">
                      {rowIdx + 2}
                    </TableCell>
                    {COLUMNS.map((c) => {
                      const reason = cols?.get(c.key)
                      return (
                        <TableCell key={c.key} className="align-top">
                          <Input
                            value={rows[rowIdx][c.key]}
                            onChange={(e) =>
                              onEdit(rowIdx, c.key, e.target.value)
                            }
                            className={cn(
                              'h-8 min-w-28 text-sm',
                              reason &&
                                'border-destructive ring-1 ring-destructive',
                            )}
                          />
                          {reason && (
                            <p className="mt-1 max-w-40 text-[11px] leading-tight text-destructive">
                              {reason}
                            </p>
                          )}
                        </TableCell>
                      )
                    })}
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
        {issueRowIndexes.length > shown.length && (
          <p className="mt-2 text-xs text-muted-foreground">
            Showing first {shown.length} of {issueRowIndexes.length} rows with
            issues.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

/** Student-wise summary of exactly what will be stored. */
function PreviewCard({
  preview,
  batchId,
  session,
}: {
  preview: PreviewResult
  batchId: number
  session: string
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Preview — what will be stored
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            {preview.students.length.toLocaleString()} student(s) ·{' '}
            {preview.total_rows.toLocaleString()} row(s)
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-xs text-muted-foreground">
          SGPA/CGPA use the best attempt per subject. Expand a student for the
          per-subject breakdown and attempt history. Nothing is stored until you
          confirm.
        </p>
        {preview.students.map((s) => (
          <StudentSummaryRow
            key={s.student_id}
            summary={s}
            batchId={batchId}
            session={session}
          />
        ))}
      </CardContent>
    </Card>
  )
}

function StudentSummaryRow({
  summary,
  batchId,
  session,
}: {
  summary: StudentSummary
  batchId: number
  session: string
}) {
  const [open, setOpen] = useState(false)
  const [detail, setDetail] = useState<PreviewStudent | null>(null)
  const [loading, setLoading] = useState(false)

  async function toggle() {
    const next = !open
    setOpen(next)
    if (next && !detail && !loading) {
      setLoading(true)
      try {
        const d = await studentUploadDetail(batchId, session, summary.student_id)
        setDetail(d)
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : 'Failed to load detail',
        )
        setOpen(false)
      } finally {
        setLoading(false)
      }
    }
  }

  return (
    <div className="rounded-md border">
      <button
        type="button"
        onClick={() => void toggle()}
        className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-muted/40"
      >
        {open ? (
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        )}
        <span className="font-mono text-sm">{summary.roll_number}</span>
        <span className="flex-1 truncate text-sm">{summary.name}</span>
        <Badge variant="default">CGPA {summary.cgpa.toFixed(2)}</Badge>
        <Badge variant="muted">{summary.semesters_count} sem</Badge>
        {summary.backlog_count > 0 ? (
          <Badge variant="destructive">{summary.backlog_count} backlog</Badge>
        ) : (
          <Badge variant="success">No backlogs</Badge>
        )}
      </button>

      {open && (
        <div className="space-y-4 border-t px-3 py-3">
          {loading && (
            <div className="h-20 animate-pulse rounded-md bg-muted/60" />
          )}
          {detail?.semesters.map((sem) => (
            <SemesterBlock key={sem.semester} sem={sem} />
          ))}
        </div>
      )}
    </div>
  )
}

/** One semester, collapsible — header (Pass/Fail + SGPA) toggles the subjects. */
function SemesterBlock({ sem }: { sem: PreviewSemester }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-md border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full flex-wrap items-center gap-2 px-3 py-2 text-left hover:bg-muted/40"
      >
        {open ? (
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        )}
        <span className="text-sm font-medium">Semester {sem.semester}</span>
        <Badge variant={sem.passed ? 'success' : 'destructive'}>
          {sem.passed ? 'Pass' : 'Fail'}
        </Badge>
        <Badge variant="secondary">SGPA {sem.sgpa.toFixed(2)}</Badge>
        <span className="text-xs text-muted-foreground">
          {sem.total_credits} credits · {sem.subjects_count} subjects
          {sem.backlog_count > 0 && ` · ${sem.backlog_count} backlog`}
        </span>
      </button>
      {open && (
        <div className="border-t p-2">
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead className="text-right">Credits</TableHead>
                  <TableHead>Grade</TableHead>
                  <TableHead className="text-right">Points</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Attempts</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sem.subjects.map((sub) => (
                  <SubjectRow key={sub.subject_code} sub={sub} />
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * One subject's best attempt, expandable to reveal every prior sitting
 * (the failed attempts before a pass) when more than one exists.
 */
function SubjectRow({ sub }: { sub: PreviewSubject }) {
  const [open, setOpen] = useState(false)
  const hasHistory = sub.attempts > 1
  return (
    <>
      <TableRow>
        <TableCell className="font-mono text-xs">{sub.subject_code}</TableCell>
        <TableCell className="text-sm">{sub.subject_name}</TableCell>
        <TableCell className="text-right tabular-nums">{sub.credits}</TableCell>
        <TableCell>
          <Badge
            variant={sub.grade === 'F' ? 'destructive' : 'muted'}
            title={sub.grade_meaning}
          >
            {sub.grade}
          </Badge>
        </TableCell>
        <TableCell className="text-right tabular-nums">
          {sub.grade_points}
        </TableCell>
        <TableCell className="text-xs capitalize text-muted-foreground">
          {sub.exam_type}
        </TableCell>
        <TableCell className="text-right tabular-nums">
          {hasHistory ? (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="inline-flex items-center gap-1 rounded px-1 text-primary hover:underline"
            >
              {sub.attempts}
              {open ? (
                <ChevronDown className="size-3" />
              ) : (
                <ChevronRight className="size-3" />
              )}
            </button>
          ) : (
            sub.attempts
          )}
        </TableCell>
      </TableRow>
      {hasHistory && open && (
        <TableRow>
          <TableCell colSpan={7} className="bg-muted/30 p-0">
            <div className="px-4 py-2">
              <p className="mb-1 text-[11px] font-medium uppercase text-muted-foreground">
                All attempts (oldest → newest)
              </p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Month &amp; Year</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Credits</TableHead>
                    <TableHead>Grade</TableHead>
                    <TableHead className="text-right">Points</TableHead>
                    <TableHead>Used</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sub.attempts_detail.map((a, i) => (
                    <TableRow
                      key={i}
                      className={cn(
                        a.is_best && a.grade !== 'F' && 'bg-success/5',
                      )}
                    >
                      <TableCell className="text-xs">
                        {formatMonthYear(a.exam_date)}
                      </TableCell>
                      <TableCell className="text-xs capitalize text-muted-foreground">
                        {a.exam_type}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {a.credits}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={a.grade === 'F' ? 'destructive' : 'muted'}
                          title={a.grade_meaning}
                        >
                          {a.grade}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {a.grade_points}
                      </TableCell>
                      <TableCell>
                        {a.is_best && a.grade !== 'F' ? (
                          <Badge variant="success">Best</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  )
}
