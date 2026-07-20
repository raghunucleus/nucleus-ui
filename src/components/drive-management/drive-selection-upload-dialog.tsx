import { useMemo, useRef, useState } from 'react'
import { AlertTriangle, Download, FileSpreadsheet, Loader2, Upload, X } from 'lucide-react'
import * as XLSX from 'xlsx'
import { toast } from 'sonner'

import { Field, NativeSelect } from '@/components/corporate-relations/bits'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import { effectivePackage } from '@/components/drive-management/selection-fields'
import {
  commitSelectionUpload,
  DRIVE_STUDENT_STATUS_LABELS,
  listDriveStudents,
  previewSelectionUpload,
  type DriveDetail,
  type SelectionUploadCell,
  type SelectionUploadCommit,
  type SelectionUploadPreview,
} from '@/lib/drive-management'
import { cn } from '@/lib/utils'

/**
 * Bulk-record Selected students from the company's results sheet, one
 * designation at a time.
 *
 * The sheet is parsed in the browser and posted as raw string cells; the server
 * owns every semantic rule (does the roll exist, is it in this drive, is it at a
 * status that may be selected, does the offer type want a stipend or a CTC) and
 * answers with per-cell errors that this grid renders in place. Amounts left
 * blank come back filled from the drive's own package, so a sheet of bare roll
 * numbers is a valid upload.
 *
 * Amounts are editable here so a wrong figure never means a round-trip to Excel.
 * Roll numbers are not: a wrong roll is the wrong person, which belongs in the
 * file. Commit re-posts whatever is on screen and the server re-validates from
 * scratch — the preview's verdict is never load-bearing.
 */

type AmountKey = 'ctc' | 'ctc_min' | 'stipend' | 'stipend_min'

const AMOUNT_LABELS: Record<AmountKey, string> = {
  ctc: 'CTC (LPA)',
  ctc_min: 'Lower CTC (LPA)',
  stipend: 'Stipend (per month)',
  stipend_min: 'Lower Stipend (per month)',
}

/** Header text → canonical key. Placement cells receive these sheets from
 *  companies, so the spellings in the wild vary far more than our template's. */
const HEADER_ALIASES: Record<string, 'roll_number' | AmountKey> = {
  roll_number: 'roll_number',
  roll_no: 'roll_number',
  rollno: 'roll_number',
  roll: 'roll_number',
  ht_no: 'roll_number',
  htno: 'roll_number',
  hall_ticket_no: 'roll_number',
  hall_ticket_number: 'roll_number',
  student_id: 'roll_number',
  registration_number: 'roll_number',
  ctc: 'ctc',
  package: 'ctc',
  annual_ctc: 'ctc',
  ctc_min: 'ctc_min',
  lower_ctc: 'ctc_min',
  min_ctc: 'ctc_min',
  minimum_ctc: 'ctc_min',
  lower_package: 'ctc_min',
  stipend: 'stipend',
  internship: 'stipend',
  internship_stipend: 'stipend',
  internship_amount: 'stipend',
  stipend_per_month: 'stipend',
  stipend_min: 'stipend_min',
  lower_stipend: 'stipend_min',
  min_stipend: 'stipend_min',
  minimum_stipend: 'stipend_min',
  lower_internship_amount: 'stipend_min',
}

/** Drop any trailing "(LPA)"-style unit hint, then reduce to snake_case, so a
 *  template header round-trips back to the key it was generated from. */
function normalizeHeader(raw: string): string {
  return raw
    .replace(/\([^)]*\)/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function cellToString(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

export function DriveSelectionUploadDialog({
  open,
  onOpenChange,
  drive,
  onCommitted,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  drive: DriveDetail
  /** Fired after a successful commit so the roster can refresh. */
  onCommitted: () => void
}) {
  // A single-designation drive has nothing to pick, so it skips straight to the
  // upload step rather than showing a select with one option.
  const soleProfileId = drive.profiles.length === 1 ? drive.profiles[0].id : null
  const [profileId, setProfileId] = useState<number | null>(soleProfileId)
  const [cells, setCells] = useState<SelectionUploadCell[]>([])
  const [preview, setPreview] = useState<SelectionUploadPreview | null>(null)
  const [stale, setStale] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [busy, setBusy] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  // Set once the sheet is applied — the dialog then shows the receipt instead
  // of the grid, and stays open until the employee closes it.
  const [result, setResult] = useState<SelectionUploadCommit | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const profile = drive.profiles.find((p) => p.id === profileId)
  const pkg = effectivePackage(drive, profile)

  /** Template columns come from the drive's advertised package (the drive form
   *  keeps that in step with the offer type). The grid below instead trusts the
   *  preview's offer-type flags, so a column the template omitted can still be
   *  filled in on screen.
   *
   *  A `Lower …` column exists only against a `range`: a fixed drive has one
   *  figure, so offering a bound would invite a band nobody configured. */
  const templateAmounts = useMemo<AmountKey[]>(() => {
    const keys: AmountKey[] = []
    if (pkg.ctc) {
      keys.push('ctc')
      if (pkg.ctc.mode === 'range') keys.push('ctc_min')
    }
    if (pkg.stipend) {
      keys.push('stipend')
      if (pkg.stipend.mode === 'range') keys.push('stipend_min')
    }
    return keys
  }, [pkg.ctc, pkg.stipend])

  const gridAmounts = useMemo<AmountKey[]>(() => {
    if (!preview) return templateAmounts
    const keys: AmountKey[] = []
    if (preview.offer_type.is_full_time) {
      keys.push('ctc')
      if (preview.package.ctc_mode === 'range') keys.push('ctc_min')
    }
    if (preview.offer_type.is_internship) {
      keys.push('stipend')
      if (preview.package.stipend_mode === 'range') keys.push('stipend_min')
    }
    return keys
  }, [preview, templateAmounts])

  /** Per-cell error lookup, keyed `row:column`. */
  const errorAt = useMemo(() => {
    const map = new Map<string, string>()
    for (const e of preview?.errors ?? []) map.set(`${e.row}:${e.column}`, e.reason)
    return map
  }, [preview])

  /**
   * Errors on columns the grid doesn't render — a `Lower CTC` value in a sheet
   * uploaded against a fixed-amount drive, say. Without this they'd be invisible
   * and the commit would stay blocked for no apparent reason.
   */
  const orphanErrors = useMemo(() => {
    const shown = new Set<string>(['roll_number', ...gridAmounts])
    const map = new Map<number, string[]>()
    for (const e of preview?.errors ?? []) {
      if (shown.has(e.column)) continue
      map.set(e.row, [...(map.get(e.row) ?? []), e.reason])
    }
    return map
  }, [preview, gridAmounts])

  function reset() {
    setCells([])
    setPreview(null)
    setStale(false)
    setFileName(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  function close(next: boolean) {
    if (!next) {
      reset()
      setProfileId(soleProfileId)
      setResult(null)
      setConfirmOpen(false)
    }
    onOpenChange(next)
  }

  async function downloadTemplate() {
    if (!profile) return
    let rolls: string[] = []
    try {
      // Pre-fill the Accepted roster so the placement cell only types amounts —
      // and so an untouched template is itself a valid "everyone on the drive's
      // package" upload.
      const page = await listDriveStudents(drive.id, { status: 30, all: true })
      rolls = page.rows.map((r) => r.roll_no)
    } catch {
      toast.info('Could not load the Accepted roster — the template is empty.')
    }

    const headers = ['Roll Number', ...templateAmounts.map((k) => AMOUNT_LABELS[k])]
    const body = rolls.map((roll) => [roll, ...templateAmounts.map(() => '')])
    const ws = XLSX.utils.aoa_to_sheet([headers, ...body])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Selections')
    const tag = `${drive.drive_name}-${profile.designation.name}`
      .replace(/[^a-z0-9]+/gi, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase()
    XLSX.writeFile(wb, `${tag || 'drive'}-selections-template.xlsx`)
  }

  async function handleFile(file: File) {
    if (!profileId) return
    reset()
    setFileName(file.name)
    setBusy(true)
    try {
      const buf = await file.arrayBuffer()
      // Let the "Reading…" state paint before the synchronous parse blocks.
      await new Promise((r) => setTimeout(r, 0))
      const wb = XLSX.read(buf, { type: 'array' })
      const sheet = wb.Sheets[wb.SheetNames[0]]
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        defval: '',
        raw: true,
      })

      const parsed: SelectionUploadCell[] = raw.map((rawRow) => {
        const mapped: Partial<Record<'roll_number' | AmountKey, unknown>> = {}
        for (const [k, v] of Object.entries(rawRow)) {
          const col = HEADER_ALIASES[normalizeHeader(k)]
          if (col) mapped[col] = v
        }
        return {
          roll_number: cellToString(mapped.roll_number),
          ctc: cellToString(mapped.ctc),
          ctc_min: cellToString(mapped.ctc_min),
          stipend: cellToString(mapped.stipend),
          stipend_min: cellToString(mapped.stipend_min),
        }
      })

      if (parsed.length === 0) {
        toast.error('That sheet has no rows.')
        reset()
        return
      }
      setCells(parsed)
      await runPreview(parsed)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not read that file')
      reset()
    } finally {
      setBusy(false)
    }
  }

  async function runPreview(rows: SelectionUploadCell[]) {
    if (!profileId) return
    setBusy(true)
    try {
      const result = await previewSelectionUpload(drive.id, profileId, rows)
      setPreview(result)
      setStale(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not check that sheet')
    } finally {
      setBusy(false)
    }
  }

  function editCell(row: number, column: AmountKey, value: string) {
    setCells((prev) =>
      prev.map((c, i) => (i === row ? { ...c, [column]: value } : c)),
    )
    // Drop the stale error on the cell being fixed so the red clears as it's
    // typed; the real verdict comes back on the next re-check.
    setPreview((prev) =>
      prev
        ? {
            ...prev,
            errors: prev.errors.filter(
              (e) => !(e.row === row && e.column === column),
            ),
          }
        : prev,
    )
    setStale(true)
  }

  /**
   * Drop a row from this upload. Local only — nothing is written to the student
   * and the roster is untouched.
   *
   * The surviving rows are re-indexed in place rather than re-previewed, so
   * several deletes in a row stay cheap and `cells[row.row]` (the grid's value
   * lookup) keeps pointing at the right cell throughout. The preview goes stale
   * either way, so the server has the last word before commit.
   */
  function deleteRow(index: number) {
    const next = cells.filter((_, i) => i !== index)
    if (next.length === 0) {
      // The DTO requires at least one row, so an empty post would 400 — send
      // the user back to the dropzone instead.
      reset()
      return
    }
    setCells(next)
    setPreview((prev) => {
      if (!prev) return prev
      const rows = prev.rows
        .filter((r) => r.row !== index)
        .map((r) => (r.row > index ? { ...r, row: r.row - 1 } : r))
      const errors = prev.errors
        .filter((e) => e.row !== index)
        .map((e) => (e.row > index ? { ...e, row: e.row - 1 } : e))
      return {
        ...prev,
        rows,
        errors,
        total_rows: rows.length,
        error_count: errors.length,
        new_selections: rows.filter((r) => !r.will_update).length,
        updates: rows.filter((r) => r.will_update).length,
      }
    })
    setStale(true)
  }

  async function commit() {
    if (!profileId) return
    setBusy(true)
    try {
      const committed = await commitSelectionUpload(drive.id, profileId, cells)
      toast.success(
        `${committed.selected} student(s) selected` +
          (committed.updated ? ` · ${committed.updated} selection(s) updated` : '') +
          (committed.notified ? ` · ${committed.notified} notified` : ''),
      )
      setConfirmOpen(false)
      // Refresh the roster behind immediately, but leave the dialog on the
      // receipt — the employee decides when they're done reading it.
      setResult(committed)
      onCommitted()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save the sheet')
      setConfirmOpen(false)
      // The server rejected it — whatever we're showing is out of date.
      setStale(true)
    } finally {
      setBusy(false)
    }
  }

  const blocked = !preview || preview.error_count > 0 || stale

  return (
    <>
      <Dialog open={open} onOpenChange={close}>
        <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>
              {result ? 'Selections recorded' : 'Upload selections'}
            </DialogTitle>
            <DialogDescription>
              {result
                ? `Applied to ${result.designation}.`
                : "Record the company's selected students in bulk. Amounts left blank use the drive's package."}
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
            {result && <CommitSummary result={result} />}

            {!result && drive.profiles.length > 1 && (
              <Field
                label="Designation"
                htmlFor="selection-upload-designation"
                hint="One sheet per designation — the columns and the default amounts differ."
              >
                <NativeSelect
                  id="selection-upload-designation"
                  value={profileId ?? ''}
                  onChange={(e) => {
                    reset()
                    setProfileId(e.target.value === '' ? null : Number(e.target.value))
                  }}
                >
                  <option value="">Select…</option>
                  {drive.profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.designation.name}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            )}

            {!result && profileId && (
              <>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) void handleFile(f)
                    e.target.value = ''
                  }}
                />

                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" variant="outline" onClick={() => void downloadTemplate()}>
                    <Download /> Download template
                  </Button>
                  {fileName && (
                    <span className="flex items-center gap-2 rounded-md border px-2 py-1 text-sm">
                      <FileSpreadsheet className="size-4 text-muted-foreground" />
                      {fileName}
                      <button
                        type="button"
                        aria-label="Remove file"
                        onClick={reset}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <X className="size-4" />
                      </button>
                    </span>
                  )}
                </div>

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
                      dragOver ? 'border-primary bg-primary/5' : 'border-input',
                    )}
                  >
                    <Upload className="size-6 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      Drop the filled sheet here, or click to pick a .xlsx
                    </span>
                  </button>
                ) : null}

                {busy && !preview && (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" /> Reading the sheet…
                  </p>
                )}

                {preview && (
                  <>
                    <SummaryBar preview={preview} stale={stale} />
                    <div className="overflow-x-auto rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-10">#</TableHead>
                            <TableHead>Roll number</TableHead>
                            <TableHead>Student</TableHead>
                            <TableHead>Status</TableHead>
                            {gridAmounts.map((k) => (
                              <TableHead key={k}>{AMOUNT_LABELS[k]}</TableHead>
                            ))}
                            <TableHead className="w-10">
                              <span className="sr-only">Remove</span>
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {preview.rows.map((row) => {
                            const rollError = errorAt.get(`${row.row}:roll_number`)
                            return (
                              <TableRow key={row.row}>
                                <TableCell className="text-muted-foreground">
                                  {row.row + 1}
                                </TableCell>
                                <TableCell>
                                  <span className="font-medium">
                                    {row.roll_number || '—'}
                                  </span>
                                  {rollError && (
                                    <p className="text-[10px] leading-tight text-destructive">
                                      {rollError}
                                    </p>
                                  )}
                                  {/* Problems on columns this grid doesn't show
                                      (e.g. a lower bound on a fixed drive) —
                                      otherwise they'd block commit invisibly. */}
                                  {orphanErrors.get(row.row)?.map((reason) => (
                                    <p
                                      key={reason}
                                      className="text-[10px] leading-tight text-destructive"
                                    >
                                      {reason}
                                    </p>
                                  ))}
                                </TableCell>
                                <TableCell>{row.display_name ?? '—'}</TableCell>
                                <TableCell>
                                  {row.current_status == null ? (
                                    <span className="text-muted-foreground">—</span>
                                  ) : (
                                    <div className="space-y-0.5">
                                      <Badge variant="secondary">
                                        {DRIVE_STUDENT_STATUS_LABELS[row.current_status] ??
                                          row.current_status}
                                      </Badge>
                                      {row.will_update && (
                                        <p className="text-[10px] leading-tight text-amber-600 dark:text-amber-500">
                                          Already selected — will be replaced
                                        </p>
                                      )}
                                    </div>
                                  )}
                                </TableCell>
                                {gridAmounts.map((k) => (
                                  <AmountCell
                                    key={k}
                                    value={cells[row.row]?.[k] ?? ''}
                                    resolved={row[k]}
                                    defaulted={row.defaulted.includes(k)}
                                    error={errorAt.get(`${row.row}:${k}`)}
                                    onChange={(v) => editCell(row.row, k, v)}
                                  />
                                ))}
                                <TableCell className="align-top">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    aria-label={`Remove ${row.roll_number || 'row'}`}
                                    title="Remove this row from the upload"
                                    onClick={() => deleteRow(row.row)}
                                  >
                                    <X className="size-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </>
                )}
              </>
            )}
          </div>

          <DialogFooter>
            {result ? (
              <Button onClick={() => close(false)}>Close</Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => close(false)} disabled={busy}>
                  Cancel
                </Button>
                {stale && preview && (
                  <Button
                    variant="secondary"
                    onClick={() => void runPreview(cells)}
                    disabled={busy}
                  >
                    {busy && <Loader2 className="animate-spin" />} Re-check
                  </Button>
                )}
                <Button onClick={() => setConfirmOpen(true)} disabled={blocked || busy}>
                  Commit
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Record these selections?</DialogTitle>
            <DialogDescription>
              {preview?.new_selections ?? 0} student(s) will be marked Selected for{' '}
              {preview?.designation}
              {preview?.updates
                ? `, and ${preview.updates} existing selection(s) will be replaced`
                : ''}
              . Only the newly selected students are notified.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={() => void commit()} disabled={busy}>
              {busy && <Loader2 className="animate-spin" />} Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

/**
 * The receipt: what was actually written, straight from the commit response.
 * Counts are the server's, and each line's package string is the very one
 * stored on the audit event — so this screen and the student's drive activity
 * can never tell different stories.
 */
function CommitSummary({ result }: { result: SelectionUploadCommit }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md border border-input bg-muted/30 px-3 py-2 text-sm">
        <span className="font-medium">{result.selected} newly selected</span>
        <span className="text-muted-foreground">{result.updated} updated</span>
        <span className="text-muted-foreground">{result.notified} notified</span>
        {result.skipped > 0 && (
          <span className="flex items-center gap-1 text-amber-600 dark:text-amber-500">
            <AlertTriangle className="size-4" />
            {result.skipped} skipped — their status changed before this was saved
          </span>
        )}
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Roll number</TableHead>
              <TableHead>Student</TableHead>
              <TableHead>Recorded</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.rows.map((r) => (
              <TableRow key={r.student_id}>
                <TableCell className="font-medium">{r.roll_number}</TableCell>
                <TableCell>{r.display_name ?? '—'}</TableCell>
                <TableCell>
                  <span>{r.summary}</span>
                  {r.action === 'updated' && (
                    <Badge variant="secondary" className="ml-2">
                      updated
                    </Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

/** Row counts plus the one thing that blocks the commit button. */
function SummaryBar({
  preview,
  stale,
}: {
  preview: SelectionUploadPreview
  stale: boolean
}) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md border px-3 py-2 text-sm',
        preview.error_count > 0
          ? 'border-destructive/40 bg-destructive/5'
          : 'border-input',
      )}
    >
      <span className="font-medium">{preview.total_rows} row(s)</span>
      <span className="text-muted-foreground">
        {preview.new_selections} new · {preview.updates} update(s)
      </span>
      {preview.error_count > 0 ? (
        <span className="flex items-center gap-1 text-destructive">
          <AlertTriangle className="size-4" />
          {preview.error_count} error(s) — fix these before committing
        </span>
      ) : stale ? (
        <span className="text-muted-foreground">Edited — re-check to commit</span>
      ) : (
        <span className="text-muted-foreground">Ready to commit</span>
      )}
    </div>
  )
}

/** An editable amount, showing the server's resolved figure when the sheet left
 *  it blank so a defaulted value is visible rather than merely implied. */
function AmountCell({
  value,
  resolved,
  defaulted,
  error,
  onChange,
}: {
  value: string
  resolved: number | null
  defaulted: boolean
  error?: string
  onChange: (value: string) => void
}) {
  return (
    <TableCell className="align-top">
      <Input
        type="number"
        min={0}
        step="any"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={defaulted && resolved != null ? String(resolved) : 'Optional'}
        aria-invalid={error ? true : undefined}
        title={error}
        className={cn(
          'w-32',
          error && 'border-2 border-destructive ring-1 ring-destructive/40',
        )}
      />
      {defaulted && !error && (
        <p className="mt-0.5 text-[10px] leading-tight text-muted-foreground">
          from drive default
        </p>
      )}
      {error && (
        <p className="mt-0.5 text-[10px] leading-tight text-destructive">{error}</p>
      )}
    </TableCell>
  )
}
