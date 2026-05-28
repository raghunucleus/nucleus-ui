import { CheckCircle2, CircleAlert, Loader2, Plus, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { ApiError } from '@/lib/api'
import {
  saveInchargePeriods,
  type IncharqeTimetable,
  type TimetablePeriod,
} from '@/lib/incharge-schedule'
import { cn } from '@/lib/utils'

interface DraftPeriod {
  /** Local key — `id` if the row is from the server, `tmp-N` otherwise. */
  key: string
  /** Server id when this row was loaded from the server; undefined for new. */
  id?: number
  label: string
  start_time: string
  end_time: string
  is_break: boolean
}

export interface PeriodEditorSheetProps {
  open: boolean
  timetableId: number
  initialPeriods: TimetablePeriod[]
  onClose: () => void
  onSaved: (next: IncharqeTimetable) => void
}

/**
 * Bell schedule editor — replace the full set of periods in one save. Rows
 * carrying an id are kept (their grid cells survive); newly-added rows are
 * inserted; previously-existing rows the user removed are deleted along
 * with their cells.
 */
export function PeriodEditorSheet({
  open,
  timetableId,
  initialPeriods,
  onClose,
  onSaved,
}: PeriodEditorSheetProps) {
  const [drafts, setDrafts] = useState<DraftPeriod[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setSubmitError(null)
    setDrafts(
      [...initialPeriods]
        .sort((a, b) => a.position - b.position)
        .map((p) => ({
          key: String(p.id),
          id: p.id,
          label: p.label,
          start_time: shortTime(p.start_time),
          end_time: shortTime(p.end_time),
          is_break: p.is_break,
        })),
    )
  }, [open, initialPeriods])

  const validation = useMemo(
    () => validateDrafts(drafts),
    [drafts],
  )

  function addRow() {
    const last = drafts[drafts.length - 1]
    const nextStart = last?.end_time ?? '09:00'
    setDrafts((prev) => [
      ...prev,
      {
        key: `tmp-${Date.now()}-${prev.length}`,
        label: `Period ${prev.filter((p) => !p.is_break).length + 1}`,
        start_time: nextStart,
        end_time: addMinutes(nextStart, 50),
        is_break: false,
      },
    ])
  }

  function updateRow(key: string, patch: Partial<DraftPeriod>) {
    setDrafts((prev) =>
      prev.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    )
  }

  function removeRow(key: string) {
    setDrafts((prev) => prev.filter((row) => row.key !== key))
  }

  async function submit() {
    if (validation.firstError) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const next = await saveInchargePeriods(
        timetableId,
        drafts.map((d) => ({
          id: d.id,
          label: d.label.trim(),
          start_time: d.start_time,
          end_time: d.end_time,
          is_break: d.is_break,
        })),
      )
      onSaved(next)
    } catch (err) {
      setSubmitError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Couldn't save the bell schedule.",
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="flex w-full max-w-2xl flex-col">
        <SheetHeader>
          <SheetTitle>Edit bell schedule</SheetTitle>
          <SheetDescription>
            Add, edit or remove periods. Cells on a period you remove get
            deleted along with the period.
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
          <div className="grid grid-cols-[2.5rem_minmax(0,1fr)_5rem_5rem_4rem_2rem] items-center gap-2 px-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            <span>#</span>
            <span>Label</span>
            <span>Start</span>
            <span>End</span>
            <span>Break</span>
            <span></span>
          </div>

          {drafts.length === 0 ? (
            <p className="rounded-md border bg-muted/30 px-3 py-6 text-center text-sm text-muted-foreground">
              No periods. Add one to get started.
            </p>
          ) : null}

          {drafts.map((row, index) => {
            const issue = validation.byKey[row.key]
            return (
              <div
                key={row.key}
                className={cn(
                  'grid grid-cols-[2.5rem_minmax(0,1fr)_5rem_5rem_4rem_2rem] items-center gap-2 rounded-md border bg-card p-2',
                  issue && 'border-destructive/40 bg-destructive/5',
                )}
              >
                <span className="text-xs font-medium tabular-nums text-muted-foreground">
                  {index + 1}
                </span>
                <Input
                  value={row.label}
                  onChange={(e) => updateRow(row.key, { label: e.target.value })}
                  className="h-8"
                />
                <Input
                  type="time"
                  value={row.start_time}
                  onChange={(e) =>
                    updateRow(row.key, { start_time: e.target.value })
                  }
                  className="h-8 px-1.5 text-xs tabular-nums"
                />
                <Input
                  type="time"
                  value={row.end_time}
                  onChange={(e) =>
                    updateRow(row.key, { end_time: e.target.value })
                  }
                  className="h-8 px-1.5 text-xs tabular-nums"
                />
                <label className="flex h-8 items-center justify-center gap-1 rounded-md border bg-background px-1">
                  <input
                    type="checkbox"
                    checked={row.is_break}
                    onChange={(e) =>
                      updateRow(row.key, { is_break: e.target.checked })
                    }
                    className="size-3.5"
                  />
                  <span className="text-[10px] text-muted-foreground">
                    Break
                  </span>
                </label>
                <button
                  type="button"
                  aria-label="Remove period"
                  onClick={() => removeRow(row.key)}
                  className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                </button>
                {issue ? (
                  <p className="col-span-6 text-xs text-destructive">{issue}</p>
                ) : null}
              </div>
            )
          })}

          <Button variant="outline" onClick={addRow} className="w-full">
            <Plus />
            Add period
          </Button>

          {validation.overlap ? (
            <p className="flex items-center gap-1.5 text-sm text-destructive">
              <CircleAlert className="size-4" />
              {validation.overlap}
            </p>
          ) : null}

          {submitError ? (
            <p className="flex items-center gap-1.5 text-sm text-destructive">
              <CircleAlert className="size-4" />
              {submitError}
            </p>
          ) : null}

          <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-xs">
            <Badge variant="secondary">{drafts.length}</Badge>
            <span className="text-muted-foreground">total ·</span>
            <Badge variant="secondary">
              {drafts.filter((d) => !d.is_break).length} teaching
            </Badge>
            <Badge variant="secondary">
              {drafts.filter((d) => d.is_break).length} break
            </Badge>
          </div>
        </div>

        <SheetFooter className="flex-row gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => void submit()}
            disabled={
              submitting ||
              drafts.length === 0 ||
              !!validation.firstError ||
              !!validation.overlap
            }
            className="flex-1"
          >
            {submitting ? (
              <>
                <Loader2 className="animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <CheckCircle2 />
                Save bell schedule
              </>
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateDrafts(drafts: DraftPeriod[]): {
  byKey: Record<string, string>
  firstError: string | null
  overlap: string | null
} {
  const byKey: Record<string, string> = {}
  let firstError: string | null = null
  for (const row of drafts) {
    if (row.label.trim().length === 0) {
      byKey[row.key] = 'Label is required.'
    } else if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(row.start_time)) {
      byKey[row.key] = 'Start time must be HH:MM.'
    } else if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(row.end_time)) {
      byKey[row.key] = 'End time must be HH:MM.'
    } else if (row.start_time >= row.end_time) {
      byKey[row.key] = 'End must be after start.'
    }
    if (byKey[row.key] && !firstError) firstError = byKey[row.key]
  }

  // Overlap detection (HH:MM string compare is chronological).
  const sorted = [...drafts]
    .filter((d) => !byKey[d.key])
    .sort((a, b) =>
      a.start_time < b.start_time ? -1 : a.start_time > b.start_time ? 1 : 0,
    )
  let overlap: string | null = null
  for (let i = 1; i < sorted.length; i += 1) {
    if (sorted[i].start_time < sorted[i - 1].end_time) {
      overlap =
        `"${sorted[i - 1].label}" and "${sorted[i].label}" overlap. Adjust their start/end times.`
      break
    }
  }
  return { byKey, firstError, overlap }
}

function shortTime(t: string): string {
  return t.length >= 5 ? t.slice(0, 5) : t
}

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(':').map((p) => Number(p))
  const total = h * 60 + m + minutes
  const wrapped = ((total % (24 * 60)) + 24 * 60) % (24 * 60)
  const hh = Math.floor(wrapped / 60)
  const mm = wrapped % 60
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}
