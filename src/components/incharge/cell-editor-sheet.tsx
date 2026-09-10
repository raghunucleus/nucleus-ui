import {
  AlertTriangle,
  Check,
  CircleAlert,
  Loader2,
  Trash2,
  Users,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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

// Subject dot palette — shares the grid's `icon-*` tokens and is keyed by the
// same color key, so a subject's dot here matches its cell tint in the grid.
const DOT_COLORS = [
  'bg-icon-blue',
  'bg-icon-emerald',
  'bg-icon-violet',
  'bg-icon-amber',
  'bg-icon-rose',
  'bg-icon-cyan',
  'bg-icon-orange',
]

// Avatar tints for faculty cards — picked by employee id for stable variety.
const AVATAR_COLORS = [
  'bg-icon-blue/20',
  'bg-icon-emerald/20',
  'bg-icon-violet/20',
  'bg-icon-amber/20',
  'bg-icon-rose/20',
  'bg-icon-cyan/20',
]

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

interface PaletteFaculty {
  employee_id: number
  emp_display_name: string
  emp_code?: string
  group_name?: string | null
}

interface PaletteItem {
  key: string
  kind: 'pss' | 'course'
  refId: number
  name: string
  code: string | null
  isElective: boolean
  faculty: PaletteFaculty[]
  alternateFaculty: PaletteFaculty[]
  colorKey: string
}

/**
 * Cell editor for the timetable grid, shown as a centered modal. Pick a
 * subject (from the programme-semester master list or this timetable's
 * exclusive courses), pick a teacher (the group's own, or borrow one from
 * another group that teaches the same subject), set room/note/span, save →
 * calls upsertEntry. For a filled cell, also offers "Clear cell".
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

  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [employeeId, setEmployeeId] = useState<number | null>(null)
  const [span, setSpan] = useState(1)
  const [room, setRoom] = useState('')
  const [note, setNote] = useState('')
  const [search, setSearch] = useState('')
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

  // Seed the form when the modal opens for a target.
  useEffect(() => {
    if (!open || !target) return
    setError(null)
    setSearch('')
    if (target.existing) {
      const e = target.existing
      if (e.programme_semester_subject_id) {
        setSelectedKey(`pss-${e.programme_semester_subject_id}`)
      } else if (e.timetable_course_id) {
        setSelectedKey(`crs-${e.timetable_course_id}`)
      } else {
        setSelectedKey(null)
      }
      setEmployeeId(e.employee_id)
      setSpan(e.span)
      setRoom(e.room ?? '')
      setNote(e.note ?? '')
    } else {
      setSelectedKey(null)
      setEmployeeId(null)
      setSpan(1)
      setRoom('')
      setNote('')
    }
  }, [open, target])

  // Esc to close.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const palette = useMemo<PaletteItem[]>(
    () => buildPalette(pssList, timetable),
    [pssList, timetable],
  )

  const selected = useMemo(
    () => (selectedKey ? palette.find((p) => p.key === selectedKey) ?? null : null),
    [palette, selectedKey],
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return palette
    return palette.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.code ?? '').toLowerCase().includes(q),
    )
  }, [palette, search])

  if (!open || !timetable || !target) return null

  const isSlot = selected?.isElective ?? false

  // Picking a subject: keep a still-valid teacher, auto-pick the single
  // primary if there's exactly one, otherwise clear for an explicit choice.
  const pickCourse = (key: string) => {
    setSelectedKey(key)
    const item = palette.find((p) => p.key === key)
    if (!item) return
    if (item.isElective) {
      setEmployeeId(null)
      return
    }
    const validIds = new Set<number>([
      ...item.faculty.map((f) => f.employee_id),
      ...item.alternateFaculty.map((f) => f.employee_id),
    ])
    setEmployeeId((prev) =>
      prev !== null && validIds.has(prev)
        ? prev
        : item.faculty.length === 1
          ? item.faculty[0].employee_id
          : null,
    )
  }

  const canSubmit =
    selected !== null &&
    (isSlot || employeeId !== null) &&
    span >= 1 &&
    span <= target.maxSpan &&
    !submitting

  async function submit() {
    if (!target || !timetable || !selected) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await upsertInchargeEntry(timetable.id, {
        day_of_week: target.day_of_week,
        timetable_period_id: target.period.id,
        span,
        programme_semester_subject_id:
          selected.kind === 'pss' ? selected.refId : undefined,
        timetable_course_id:
          selected.kind === 'course' ? selected.refId : undefined,
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
      // Always clear the loading state — otherwise, when the editor is reused
      // for the next cell, the Save button stays disabled with the spinner.
      setSubmitting(false)
    }
  }

  async function clearCell() {
    if (!target || !timetable) return
    setClearing(true)
    setError(null)
    try {
      await clearInchargeEntry(timetable.id, target.day_of_week, target.period.id)
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative z-10 flex max-h-[88vh] w-full max-w-2xl flex-col rounded-lg border bg-card text-card-foreground shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b px-5 py-3">
          <h2 className="text-sm font-semibold">
            {DAY_LABELS[target.day_of_week]} · {target.period.label}{' '}
            <span className="font-normal text-muted-foreground">
              {shortTime(target.period.start_time)}–
              {shortTime(target.period.end_time)}
            </span>
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4 scrollbar-themed">
          {/* 1 — Subject -------------------------------------------------- */}
          <section>
            <SectionHeading step={1} label="Subject" tone="required" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search subjects by name or code…"
              className="h-9"
            />
            {pssLoading ? (
              <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="shimmer h-12 rounded-lg bg-muted/60"
                  />
                ))}
              </div>
            ) : pssError ? (
              <p className="mt-2 flex items-center gap-1.5 text-sm text-destructive">
                <CircleAlert className="size-4" />
                {pssError}
              </p>
            ) : filtered.length === 0 ? (
              <p className="mt-2 rounded-lg border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
                {palette.length === 0
                  ? 'No subjects allocated to this programme semester yet. Ask an admin to configure subjects + group faculty.'
                  : 'No subjects match your search.'}
              </p>
            ) : (
              <div className="mt-2 grid max-h-52 grid-cols-1 gap-1.5 overflow-y-auto pr-0.5 scrollbar-themed sm:grid-cols-2">
                {filtered.map((p) => {
                  const active = p.key === selectedKey
                  return (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => pickCourse(p.key)}
                      className={cn(
                        'flex items-center gap-2 rounded-lg border p-2 text-left transition-colors',
                        active
                          ? 'border-primary/50 bg-primary/5 ring-1 ring-primary/30'
                          : 'border-input hover:bg-accent',
                      )}
                    >
                      <span
                        className={cn(
                          'size-2.5 shrink-0 rounded-full',
                          dotFor(p.colorKey),
                        )}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-semibold">
                          {p.name}
                        </span>
                        <span className="block truncate font-mono text-[10px] text-muted-foreground">
                          {p.code ?? (p.kind === 'course' ? 'Timetable-only' : '—')}
                        </span>
                      </span>
                      {p.isElective ? (
                        <span className="shrink-0 rounded-sm bg-muted px-1 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
                          Elective
                        </span>
                      ) : p.kind === 'course' ? (
                        <span className="shrink-0 rounded-sm bg-muted px-1 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
                          Extra
                        </span>
                      ) : null}
                      {active ? (
                        <Check className="size-4 shrink-0 text-primary" />
                      ) : null}
                    </button>
                  )
                })}
              </div>
            )}
          </section>

          {/* 2 — Teacher -------------------------------------------------- */}
          <section>
            <SectionHeading
              step={2}
              label="Teacher"
              tone={isSlot ? undefined : 'required'}
            />
            {!selected ? (
              <div className="rounded-lg border border-dashed bg-muted/20 px-3 py-4 text-center text-xs text-muted-foreground">
                Choose a subject above to pick its teacher.
              </div>
            ) : isSlot ? (
              <div className="flex items-start gap-2 rounded-lg border border-dashed bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground">
                <Users className="mt-0.5 size-4 shrink-0" />
                <span>
                  Elective slot — students attend their own chosen subject, so
                  no single teacher is assigned here.
                </span>
              </div>
            ) : selected.faculty.length === 0 &&
              selected.alternateFaculty.length === 0 ? (
              <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2.5 text-xs">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
                <span>
                  No faculty allocated to{' '}
                  <span className="font-medium">{selected.name}</span> yet.{' '}
                  {selected.kind === 'pss'
                    ? 'Ask an admin to set group faculty on the Programme Semester Subjects page'
                    : 'Set the course faculty from the Courses section'}{' '}
                  before scheduling it.
                </span>
              </div>
            ) : (
              <div className="space-y-3">
                {selected.faculty.length > 0 ? (
                  <div>
                    <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      This group's teacher
                    </div>
                    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                      {selected.faculty.map((f) => (
                        <TeacherCard
                          key={f.employee_id}
                          faculty={f}
                          active={employeeId === f.employee_id}
                          onClick={() => setEmployeeId(f.employee_id)}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}
                {selected.alternateFaculty.length > 0 ? (
                  <div>
                    <div className="mb-1 flex flex-wrap items-center justify-between gap-x-3">
                      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        Borrow from another group
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        Teaches the same subject for another group — use only if
                        the primary is unavailable.
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                      {selected.alternateFaculty.map((f) => (
                        <TeacherCard
                          key={f.employee_id}
                          faculty={f}
                          active={employeeId === f.employee_id}
                          alternate
                          onClick={() => setEmployeeId(f.employee_id)}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </section>

          {/* 3 — Room, note & span --------------------------------------- */}
          <section>
            <SectionHeading step={3} label="Room & note" tone="optional" />
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cell-room">Room</Label>
                <Input
                  id="cell-room"
                  value={room}
                  onChange={(e) => setRoom(e.target.value)}
                  maxLength={48}
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cell-note">Note</Label>
                <Input
                  id="cell-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={160}
                  className="h-9"
                />
              </div>
            </div>
            {target.maxSpan > 1 ? (
              <div className="mt-3 space-y-1.5">
                <Label htmlFor="cell-span">Span (periods)</Label>
                {/* A dropdown, not a number field — typing into a number input
                    concatenates digits (1 → "12") and then clamps to maxSpan,
                    so "press 2" looked like it jumped to the cap. */}
                <select
                  id="cell-span"
                  value={span}
                  onChange={(e) => setSpan(Number(e.target.value))}
                  className="h-9 w-28 rounded-md border border-input bg-background px-2 text-sm"
                >
                  {Array.from({ length: target.maxSpan }, (_, i) => i + 1).map(
                    (n) => (
                      <option key={n} value={n}>
                        {n} period{n === 1 ? '' : 's'}
                      </option>
                    ),
                  )}
                </select>
                <p className="text-[11px] text-muted-foreground">
                  Merge up to {target.maxSpan} consecutive periods (e.g. a lab).
                </p>
              </div>
            ) : null}
          </section>

        </div>

        {/* Error bar — kept outside the scrollable body so a save/clear error
            is always visible, not stranded below the fold the user can't see. */}
        {error ? (
          <div className="flex items-center gap-1.5 border-t bg-destructive/5 px-5 py-2.5 text-sm text-destructive">
            <CircleAlert className="size-4 shrink-0" />
            {error}
          </div>
        ) : null}

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t px-5 py-3">
          {target.existing ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => void clearCell()}
              disabled={clearing || submitting}
              className="mr-auto text-muted-foreground hover:text-destructive"
            >
              {clearing ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Trash2 />
              )}
              Clear cell
            </Button>
          ) : null}
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button size="sm" onClick={() => void submit()} disabled={!canSubmit}>
            {submitting ? (
              <>
                <Loader2 className="animate-spin" />
                Saving…
              </>
            ) : (
              'Save class'
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

function TeacherCard({
  faculty,
  active,
  alternate,
  onClick,
}: {
  faculty: PaletteFaculty
  active: boolean
  alternate?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-2.5 rounded-lg border p-2 text-left transition-colors',
        active
          ? alternate
            ? 'border-icon-amber/50 bg-icon-amber/5 ring-1 ring-icon-amber/30'
            : 'border-primary/50 bg-primary/5 ring-1 ring-primary/30'
          : alternate
            ? 'border-dashed border-input hover:bg-accent'
            : 'border-input hover:bg-accent',
      )}
    >
      <span
        className={cn(
          'grid size-9 shrink-0 place-items-center rounded-full text-xs font-bold text-foreground',
          avatarColor(faculty.employee_id),
        )}
      >
        {initials(faculty.emp_display_name)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">
          {faculty.emp_display_name}
        </span>
        <span className="block truncate font-mono text-[11px] text-muted-foreground">
          {faculty.emp_code}
          {faculty.group_name ? (
            <>
              {' · '}
              <span className="italic">from {faculty.group_name}</span>
            </>
          ) : null}
        </span>
      </span>
      {active ? (
        <Check
          className={cn(
            'size-4 shrink-0',
            alternate ? 'text-icon-amber' : 'text-primary',
          )}
        />
      ) : null}
    </button>
  )
}

function SectionHeading({
  step,
  label,
  tone,
}: {
  step: number
  label: string
  tone?: 'required' | 'optional'
}) {
  return (
    <div className="mb-2 flex items-center gap-2">
      <span className="grid size-5 shrink-0 place-items-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
        {step}
      </span>
      <span className="text-xs font-semibold uppercase tracking-wide">
        {label}
      </span>
      {tone ? (
        <span
          className={cn(
            'rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide',
            tone === 'required'
              ? 'bg-destructive/10 text-destructive'
              : 'bg-muted text-muted-foreground',
          )}
        >
          {tone}
        </span>
      ) : null}
    </div>
  )
}

function buildPalette(
  pssList: LookupPss[] | null,
  timetable: IncharqeTimetable | null,
): PaletteItem[] {
  const items: PaletteItem[] = []
  for (const p of pssList ?? []) {
    const name = p.subject?.name ?? p.placeholder_name ?? '(unnamed)'
    const code = p.subject?.code ?? null
    items.push({
      key: `pss-${p.id}`,
      kind: 'pss',
      refId: p.id,
      name,
      code,
      isElective: p.subject_id === null,
      faculty: (p.faculty ?? []).map((f) => ({
        employee_id: f.employee_id,
        emp_display_name: f.employee.emp_display_name,
        emp_code: f.employee.emp_code,
      })),
      alternateFaculty: (p.alternate_faculty ?? []).map((f) => ({
        employee_id: f.employee_id,
        emp_display_name: f.employee.emp_display_name,
        emp_code: f.employee.emp_code,
        group_name: f.attendance_group?.name ?? null,
      })),
      colorKey: code ?? `slot:${name}`,
    })
  }
  for (const c of timetable?.courses ?? []) {
    const name = c.subject?.name ?? c.custom_label ?? '(unnamed)'
    const code = c.subject?.code ?? null
    items.push({
      key: `crs-${c.id}`,
      kind: 'course',
      refId: c.id,
      name,
      code,
      isElective: false,
      faculty: (c.faculty ?? []).map((f) => ({
        employee_id: f.employee_id,
        emp_display_name: f.employee?.emp_display_name ?? 'Faculty',
        emp_code: f.employee?.emp_code,
      })),
      alternateFaculty: [],
      colorKey: code ?? `course:${name}`,
    })
  }
  return items
}

/** Deterministic hash → palette index, matching the grid's tone mapping. */
function hashIndex(key: string, mod: number): number {
  let h = 0
  for (let i = 0; i < key.length; i += 1) {
    h = (h * 31 + key.charCodeAt(i)) >>> 0
  }
  return h % mod
}

function dotFor(key: string): string {
  return DOT_COLORS[hashIndex(key, DOT_COLORS.length)]
}

function avatarColor(id: number): string {
  return AVATAR_COLORS[id % AVATAR_COLORS.length]
}

function initials(name: string): string {
  return (
    name
      .replace(/[^A-Za-z0-9 ]/g, '')
      .split(/\s+/)
      .filter(Boolean)
      .map((p) => p[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?'
  )
}

function shortTime(t: string): string {
  return t.length >= 5 ? t.slice(0, 5) : t
}
