import { CheckCircle2, CircleAlert, Loader2, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  clearInchargeEntry,
  fetchInchargePssLookup,
  upsertInchargeEntry,
  type IncharqeTimetable,
  type LookupPss,
  type TimetableEntry,
} from '@/lib/incharge-schedule'
import { cn } from '@/lib/utils'

const DAY_LABELS: Record<number, string> = {
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
  7: 'Sunday',
}

export interface CellEditorTarget {
  day_of_week: number
  /** The period the cell anchors to. */
  period: { id: number; label: string; start_time: string; end_time: string }
  /** Existing entry on this cell, or null when placing fresh. */
  existing: TimetableEntry | null
  /** How many *teaching* periods remain at and after `period`, including it. */
  maxSpan: number
}

export interface CellEditorSheetProps {
  open: boolean
  timetable: IncharqeTimetable | null
  target: CellEditorTarget | null
  onClose: () => void
  onSaved: (next: { entry?: TimetableEntry }) => void
  onCleared: () => void
}

/**
 * Cell editor for the timetable grid. Pick a subject (either from the
 * programme-semester master list, or from this timetable's exclusive
 * courses), pick a teacher, set span/room/note, save → calls upsertEntry.
 * For a filled cell, also offers "Clear cell" which calls clearEntry.
 */
export function CellEditorSheet({
  open,
  timetable,
  target,
  onClose,
  onSaved,
  onCleared,
}: CellEditorSheetProps) {
  const [pssList, setPssList] = useState<LookupPss[] | null>(null)
  const [pssLoading, setPssLoading] = useState(false)
  const [pssError, setPssError] = useState<string | null>(null)

  // Source selection
  const [sourceKind, setSourceKind] = useState<'pss' | 'course' | null>(null)
  const [pssId, setPssId] = useState<number | null>(null)
  const [courseId, setCourseId] = useState<number | null>(null)
  const [employeeId, setEmployeeId] = useState<number | null>(null)
  const [span, setSpan] = useState(1)
  const [room, setRoom] = useState('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load the PSS list once when opened — keyed on (PS, group).
  useEffect(() => {
    if (!open || !timetable) return
    let cancelled = false
    setPssError(null)
    setPssList(null)
    setPssLoading(true)
    fetchInchargePssLookup(
      timetable.programme_semester_id,
      timetable.attendance_group_id,
    )
      .then((rows) => {
        if (!cancelled) setPssList(rows)
      })
      .catch((err) => {
        if (!cancelled) {
          setPssError(
            err instanceof Error
              ? err.message
              : 'Could not load subjects for this group.',
          )
        }
      })
      .finally(() => {
        if (!cancelled) setPssLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, timetable])

  // Seed the form when the sheet opens for a new target.
  useEffect(() => {
    if (!open || !target) return
    setError(null)
    if (target.existing) {
      const e = target.existing
      if (e.programme_semester_subject_id) {
        setSourceKind('pss')
        setPssId(e.programme_semester_subject_id)
        setCourseId(null)
      } else if (e.timetable_course_id) {
        setSourceKind('course')
        setCourseId(e.timetable_course_id)
        setPssId(null)
      } else {
        setSourceKind(null)
      }
      setEmployeeId(e.employee_id)
      setSpan(e.span)
      setRoom(e.room ?? '')
      setNote(e.note ?? '')
    } else {
      setSourceKind(null)
      setPssId(null)
      setCourseId(null)
      setEmployeeId(null)
      setSpan(1)
      setRoom('')
      setNote('')
    }
  }, [open, target])

  const selectedPss = useMemo(
    () => (pssList && pssId ? pssList.find((p) => p.id === pssId) ?? null : null),
    [pssList, pssId],
  )
  const selectedCourse = useMemo(
    () =>
      timetable && courseId
        ? timetable.courses?.find((c) => c.id === courseId) ?? null
        : null,
    [timetable, courseId],
  )

  // Available teachers depend on the source.
  const teacherOptions = useMemo<
    { id: number; emp_display_name: string; emp_code?: string; tag?: string }[]
  >(() => {
    if (sourceKind === 'pss' && selectedPss) {
      // Primary faculty for this group + alternate group faculty as fallback.
      const primary = (selectedPss.faculty ?? []).map((f) => ({
        id: f.employee_id,
        emp_display_name: f.employee.emp_display_name,
        emp_code: f.employee.emp_code,
        tag: 'primary',
      }))
      const alternates = (selectedPss.alternate_faculty ?? [])
        .filter((f) => !primary.some((p) => p.id === f.employee_id))
        .map((f) => ({
          id: f.employee_id,
          emp_display_name: f.employee.emp_display_name,
          emp_code: f.employee.emp_code,
          tag: 'other-group',
        }))
      return [...primary, ...alternates]
    }
    if (sourceKind === 'course' && selectedCourse) {
      // Course faculty isn't included in the IncharqeTimetable shape today.
      // The course list eagerly returns subject + custom_label; faculty
      // needs to come from the courses-manager flow. For now, prompt the
      // user to use the Courses section to set the course's faculty.
      // We return an empty list here so the picker shows a hint.
      return []
    }
    return []
  }, [sourceKind, selectedPss, selectedCourse])

  // Auto-pick the only teacher when there's exactly one for the chosen subject.
  useEffect(() => {
    if (teacherOptions.length === 1) {
      setEmployeeId(teacherOptions[0].id)
    }
  }, [teacherOptions])

  if (!timetable || !target) return null

  const isSlot = selectedPss && selectedPss.subject_id === null
  const canSubmit =
    sourceKind !== null &&
    (sourceKind === 'pss' ? pssId !== null : courseId !== null) &&
    // Slots store no teacher on the entry — the option's faculty drives it
    // at session-seed time. Real subjects + exclusive courses need a teacher.
    (isSlot || employeeId !== null) &&
    span >= 1 &&
    span <= target.maxSpan &&
    !submitting

  async function submit() {
    if (!target || !timetable) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await upsertInchargeEntry(timetable.id, {
        day_of_week: target.day_of_week,
        timetable_period_id: target.period.id,
        span,
        programme_semester_subject_id:
          sourceKind === 'pss' && pssId !== null ? pssId : undefined,
        timetable_course_id:
          sourceKind === 'course' && courseId !== null ? courseId : undefined,
        employee_id: isSlot ? null : employeeId,
        room: room.trim() ? room.trim() : null,
        note: note.trim() ? note.trim() : null,
      })
      onSaved({ entry: res })
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Couldn't save this cell.",
      )
    } finally {
      setSubmitting(false)
    }
  }

  async function clearCell() {
    if (!target || !timetable) return
    setClearing(true)
    setError(null)
    try {
      await clearInchargeEntry(
        timetable.id,
        target.day_of_week,
        target.period.id,
      )
      onCleared()
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Couldn't clear this cell.",
      )
    } finally {
      setClearing(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="flex w-full max-w-lg flex-col">
        <SheetHeader>
          <SheetTitle>
            {target.existing ? 'Edit class' : 'Place a class'}
          </SheetTitle>
          <SheetDescription>
            {DAY_LABELS[target.day_of_week]} ·{' '}
            <span className="font-medium text-foreground">
              {target.period.label}
            </span>{' '}
            ({shortTime(target.period.start_time)}–
            {shortTime(target.period.end_time)})
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-3">
          {/* Source toggle */}
          <div className="space-y-1.5">
            <Label>Subject source</Label>
            <div className="flex gap-2">
              <SourceTab
                label="From semester"
                active={sourceKind === 'pss'}
                onClick={() => {
                  setSourceKind('pss')
                  setCourseId(null)
                  setEmployeeId(null)
                }}
              />
              <SourceTab
                label="Timetable course"
                active={sourceKind === 'course'}
                onClick={() => {
                  setSourceKind('course')
                  setPssId(null)
                  setEmployeeId(null)
                }}
              />
            </div>
          </div>

          {/* PSS picker */}
          {sourceKind === 'pss' ? (
            <div className="space-y-1.5">
              <Label>Subject</Label>
              {pssLoading ? (
                <div className="shimmer h-9 rounded-md bg-muted/60" />
              ) : pssError ? (
                <p className="flex items-center gap-1.5 text-sm text-destructive">
                  <CircleAlert className="size-4" />
                  {pssError}
                </p>
              ) : pssList && pssList.length === 0 ? (
                <p className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                  No subjects allocated to this programme semester yet. Ask an
                  admin to configure subjects + group faculty.
                </p>
              ) : pssList ? (
                <select
                  value={pssId ?? ''}
                  onChange={(e) =>
                    setPssId(e.target.value ? Number(e.target.value) : null)
                  }
                  className="h-9 w-full rounded-md border bg-card px-2 text-sm"
                >
                  <option value="" disabled>
                    Select a subject…
                  </option>
                  {pssList.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.subject
                        ? `${p.subject.code} · ${p.subject.name}`
                        : `${p.placeholder_name} (${p.slot_type ?? 'slot'})`}
                    </option>
                  ))}
                </select>
              ) : null}
            </div>
          ) : null}

          {/* Course picker */}
          {sourceKind === 'course' ? (
            <div className="space-y-1.5">
              <Label>Exclusive course</Label>
              {!timetable.courses || timetable.courses.length === 0 ? (
                <p className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                  No timetable-exclusive courses yet. Add one from the
                  Courses section, then come back here to place it.
                </p>
              ) : (
                <select
                  value={courseId ?? ''}
                  onChange={(e) =>
                    setCourseId(e.target.value ? Number(e.target.value) : null)
                  }
                  className="h-9 w-full rounded-md border bg-card px-2 text-sm"
                >
                  <option value="" disabled>
                    Select a course…
                  </option>
                  {timetable.courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.subject
                        ? `${c.subject.code} · ${c.subject.name}`
                        : c.custom_label ?? `Course #${c.id}`}
                    </option>
                  ))}
                </select>
              )}
            </div>
          ) : null}

          {/* Teacher picker — slot rows skip this */}
          {sourceKind !== null && !isSlot ? (
            <div className="space-y-1.5">
              <Label>Teacher</Label>
              {teacherOptions.length === 0 ? (
                <p className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                  {sourceKind === 'pss' && selectedPss
                    ? "No faculty allocated for this subject in this group yet. Ask an admin to set it on the Programme Semester Subjects page (or pick a different subject)."
                    : 'Set the course faculty from the Courses section first.'}
                </p>
              ) : (
                <select
                  value={employeeId ?? ''}
                  onChange={(e) =>
                    setEmployeeId(
                      e.target.value ? Number(e.target.value) : null,
                    )
                  }
                  className="h-9 w-full rounded-md border bg-card px-2 text-sm"
                >
                  <option value="" disabled>
                    Select a teacher…
                  </option>
                  {teacherOptions.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.emp_display_name}
                      {t.emp_code ? ` · ${t.emp_code}` : ''}
                      {t.tag === 'other-group' ? ' (other group)' : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>
          ) : null}

          {isSlot ? (
            <div className="rounded-md border bg-icon-blue/10 px-3 py-2 text-xs text-icon-blue">
              This is an elective slot — the teacher is taken from each
              student's chosen option at session time. No teacher to pick
              here.
            </div>
          ) : null}

          {/* Span / room / note */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cell-span">Span (periods)</Label>
              <Input
                id="cell-span"
                type="number"
                min={1}
                max={target.maxSpan}
                value={span}
                onChange={(e) =>
                  setSpan(Math.max(1, Math.min(target.maxSpan, Number(e.target.value) || 1)))
                }
              />
              <p className="text-[11px] text-muted-foreground">
                Up to {target.maxSpan} period{target.maxSpan === 1 ? '' : 's'}{' '}
                free.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cell-room">Room</Label>
              <Input
                id="cell-room"
                value={room}
                onChange={(e) => setRoom(e.target.value)}
                placeholder="e.g. A-204"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cell-note">Note</Label>
            <Input
              id="cell-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional"
            />
          </div>

          {error ? (
            <p className="flex items-center gap-1.5 text-sm text-destructive">
              <CircleAlert className="size-4" />
              {error}
            </p>
          ) : null}

          {/* Read-only context badges. */}
          <div className="flex flex-wrap gap-2 border-t pt-3">
            {target.existing ? (
              <Badge variant="warning">Editing existing cell</Badge>
            ) : (
              <Badge variant="secondary">New cell</Badge>
            )}
          </div>
        </div>

        <SheetFooter className="flex-row gap-2">
          {target.existing ? (
            <Button
              variant="outline"
              onClick={() => void clearCell()}
              disabled={clearing}
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              {clearing ? <Loader2 className="animate-spin" /> : <Trash2 />}
              Clear cell
            </Button>
          ) : null}
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => void submit()}
            disabled={!canSubmit}
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
                {target.existing ? 'Save changes' : 'Place class'}
              </>
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

function SourceTab({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'flex-1 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors',
        active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'bg-card hover:bg-accent hover:text-accent-foreground',
      )}
    >
      {label}
    </button>
  )
}

function shortTime(t: string): string {
  return t.length >= 5 ? t.slice(0, 5) : t
}
