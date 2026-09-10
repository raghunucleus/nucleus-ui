import {
  CheckCircle2,
  CircleAlert,
  Copy,
  Loader2,
  Sparkles,
  Star,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

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
import { apiFetch, ApiError } from '@/lib/api'
import { withEmployeeAuth } from '@/lib/employee-auth'
import type { InchargeGroupSummary } from '@/lib/incharge-attendance'
import {
  createInchargeTimetable,
  fetchInchargeProgrammeSemesters,
  type IncharqeTimetable,
  type IncharqeTimetableSummary,
  type LookupProgrammeSemester,
} from '@/lib/incharge-schedule'
import { cn } from '@/lib/utils'

const DAY_LABELS: Record<number, { short: string; long: string }> = {
  1: { short: 'Mon', long: 'Monday' },
  2: { short: 'Tue', long: 'Tuesday' },
  3: { short: 'Wed', long: 'Wednesday' },
  4: { short: 'Thu', long: 'Thursday' },
  5: { short: 'Fri', long: 'Friday' },
  6: { short: 'Sat', long: 'Saturday' },
  7: { short: 'Sun', long: 'Sunday' },
}

/**
 * Sensible bell-schedule defaults used when starting from scratch. Two
 * breaks (short morning + lunch) and six teaching periods — typical for an
 * Indian undergraduate timetable.
 */
const DEFAULT_PERIODS = [
  { label: 'Period 1', start_time: '09:00', end_time: '09:50', is_break: false },
  { label: 'Period 2', start_time: '09:50', end_time: '10:40', is_break: false },
  { label: 'Short break', start_time: '10:40', end_time: '10:55', is_break: true },
  { label: 'Period 3', start_time: '10:55', end_time: '11:45', is_break: false },
  { label: 'Period 4', start_time: '11:45', end_time: '12:35', is_break: false },
  { label: 'Lunch', start_time: '12:35', end_time: '13:20', is_break: true },
  { label: 'Period 5', start_time: '13:20', end_time: '14:10', is_break: false },
  { label: 'Period 6', start_time: '14:10', end_time: '15:00', is_break: false },
]

type Mode = 'scratch' | 'clone'

export interface CreateTimetableSheetProps {
  open: boolean
  group: InchargeGroupSummary | null
  /** Existing timetables in this group — drives the clone-source picker. */
  existingTimetables: IncharqeTimetableSummary[]
  /**
   * When set, the sheet opens in clone mode with this source pre-selected.
   * Used by the per-card "Clone" action so the user lands one click away
   * from picking a name + saving.
   */
  seedSourceId?: number | null
  onClose: () => void
  onCreated: (timetableId: number) => void
}

/**
 * Create a new timetable for a group. Two modes:
 *   - **Scratch**: pick semester + working days + name → seeds the default
 *     bell schedule. Best for the first template in a fresh semester.
 *   - **Clone**:   pick an existing template in this group + new name →
 *     copies its periods, courses, and grid cells. Best for "Exam week"
 *     style variants of an already-set-up Regular week.
 */
export function CreateTimetableSheet({
  open,
  group,
  existingTimetables,
  seedSourceId,
  onClose,
  onCreated,
}: CreateTimetableSheetProps) {
  const [mode, setMode] = useState<Mode>('scratch')

  // Shared
  const [name, setName] = useState('Regular week')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Scratch mode
  const [workingDays, setWorkingDays] = useState<number[]>([1, 2, 3, 4, 5, 6])
  const [programmeSemesters, setProgrammeSemesters] = useState<
    LookupProgrammeSemester[] | null
  >(null)
  const [programmeSemesterId, setProgrammeSemesterId] = useState<number | null>(
    null,
  )
  const [loadingPs, setLoadingPs] = useState(false)
  const [psError, setPsError] = useState<string | null>(null)

  // Clone mode
  const [sourceId, setSourceId] = useState<number | null>(null)

  // Reset / refetch every time the sheet opens for a (potentially) different
  // group.
  useEffect(() => {
    if (!open || !group) return
    let cancelled = false
    // If the group has no templates yet, force "scratch" mode (nothing to
    // clone from); otherwise default to clone — that's the common case for
    // variant-week creation, and a fresh blank in a group that already has
    // templates is rarer.
    const hasSources = existingTimetables.length > 0
    // If a specific source was seeded (per-card Clone action), open in clone
    // mode pre-pointed at it; otherwise pick the default template or the
    // first available, falling back to scratch mode when there's nothing.
    const seeded =
      seedSourceId !== undefined && seedSourceId !== null
        ? existingTimetables.find((t) => t.id === seedSourceId) ?? null
        : null
    const initialMode: Mode = seeded ? 'clone' : hasSources ? 'clone' : 'scratch'
    setMode(initialMode)
    // Suggest a sensible default name for the clone — derived from the source.
    setName(
      seeded
        ? `${seeded.name} (copy)`
        : hasSources
          ? ''
          : 'Regular week',
    )
    setWorkingDays([1, 2, 3, 4, 5, 6])
    setProgrammeSemesters(null)
    setProgrammeSemesterId(null)
    setSubmitError(null)
    setPsError(null)
    setSourceId(
      seeded?.id ??
        existingTimetables.find((t) => t.is_default)?.id ??
        existingTimetables[0]?.id ??
        null,
    )

    setLoadingPs(true)
    fetchInchargeProgrammeSemesters(group.id)
      .then((rows) => {
        if (cancelled) return
        setProgrammeSemesters(rows)
        if (rows.length > 0) {
          // Prefer the ongoing semester for fresh-from-scratch creation.
          const ongoing = rows.find((r) => r.status === 'ongoing')
          const seed =
            ongoing ??
            [...rows].sort(
              (a, b) => b.semester.sem_number - a.semester.sem_number,
            )[0]
          setProgrammeSemesterId(seed.id)
        }
      })
      .catch((err) => {
        if (cancelled) return
        setPsError(
          err instanceof Error
            ? err.message
            : 'Could not load programme semesters for this group.',
        )
      })
      .finally(() => {
        if (!cancelled) setLoadingPs(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, group, existingTimetables, seedSourceId])

  const sourceTimetable = useMemo(
    () =>
      sourceId !== null
        ? existingTimetables.find((t) => t.id === sourceId) ?? null
        : null,
    [existingTimetables, sourceId],
  )

  const canSubmit = useMemo(() => {
    if (!group || submitting) return false
    if (name.trim().length === 0) return false
    if (mode === 'scratch') {
      return programmeSemesterId !== null && workingDays.length > 0
    }
    return sourceId !== null
  }, [
    group,
    submitting,
    name,
    mode,
    programmeSemesterId,
    workingDays.length,
    sourceId,
  ])

  async function submit() {
    if (!group || !canSubmit) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      if (mode === 'scratch' && programmeSemesterId !== null) {
        const created = await createInchargeTimetable({
          programme_semester_id: programmeSemesterId,
          attendance_group_id: group.id,
          name: name.trim(),
          working_days: [...workingDays].sort((a, b) => a - b),
          periods: DEFAULT_PERIODS,
        })
        onCreated(created.id)
        return
      }
      if (mode === 'clone' && sourceId !== null) {
        const created = await cloneInchargeTimetable(sourceId, name.trim())
        onCreated(created.id)
        return
      }
    } catch (err) {
      setSubmitError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Couldn't create the timetable.",
      )
    } finally {
      setSubmitting(false)
    }
  }

  const hasSources = existingTimetables.length > 0

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="flex w-full max-w-lg flex-col">
        <SheetHeader>
          <SheetTitle>Create timetable</SheetTitle>
          <SheetDescription>
            {group
              ? `New template for ${group.name} (${group.programme.code} · ${group.admission_year.display_year}).`
              : 'Pick a group from the list first.'}
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-3">
          {/* Mode selector — only meaningful when there's something to clone. */}
          {hasSources ? (
            <div className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/30 p-1">
              <ModeTab
                label="Clone existing"
                description="Start from an existing template"
                icon={Copy}
                active={mode === 'clone'}
                onClick={() => setMode('clone')}
              />
              <ModeTab
                label="From scratch"
                description="Blank template with default bell schedule"
                icon={Sparkles}
                active={mode === 'scratch'}
                onClick={() => setMode('scratch')}
              />
            </div>
          ) : null}

          {mode === 'clone' ? (
            <CloneFields
              existingTimetables={existingTimetables}
              sourceId={sourceId}
              onSelectSource={setSourceId}
              sourceTimetable={sourceTimetable}
            />
          ) : (
            <ScratchFields
              loadingPs={loadingPs}
              psError={psError}
              programmeSemesters={programmeSemesters}
              programmeSemesterId={programmeSemesterId}
              onSelectPs={setProgrammeSemesterId}
              workingDays={workingDays}
              onToggleDay={(day) =>
                setWorkingDays((prev) =>
                  prev.includes(day)
                    ? prev.filter((d) => d !== day)
                    : [...prev, day].sort((a, b) => a - b),
                )
              }
            />
          )}

          {/* Shared: name */}
          <div className="space-y-1.5">
            <Label htmlFor="tt-create-name">Name</Label>
            <Input
              id="tt-create-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {mode === 'clone'
                ? 'Give the copy a name distinct from the source.'
                : "Pick a short name. You can mark one template as the group's default later."}
            </p>
          </div>

          {submitError ? (
            <p className="flex items-center gap-1.5 text-sm text-destructive">
              <CircleAlert className="size-4" />
              {submitError}
            </p>
          ) : null}
        </div>

        <SheetFooter className="flex-row gap-2">
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
                {mode === 'clone' ? 'Cloning…' : 'Creating…'}
              </>
            ) : mode === 'clone' ? (
              <>
                <Copy />
                Clone timetable
              </>
            ) : (
              <>
                <CheckCircle2 />
                Create timetable
              </>
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

// ---------------------------------------------------------------------------
// Mode tab
// ---------------------------------------------------------------------------

function ModeTab({
  label,
  description,
  icon: Icon,
  active,
  onClick,
}: {
  label: string
  description: string
  icon: typeof Sparkles
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'flex flex-col items-start gap-0.5 rounded-md px-3 py-2 text-left transition-colors',
        active
          ? 'bg-primary text-primary-foreground shadow-sm'
          : 'hover:bg-card hover:text-foreground',
      )}
    >
      <span className="flex items-center gap-1.5 text-sm font-semibold">
        <Icon className="size-4" />
        {label}
      </span>
      <span
        className={cn(
          'text-[11px] leading-snug',
          active ? 'text-primary-foreground/85' : 'text-muted-foreground',
        )}
      >
        {description}
      </span>
    </button>
  )
}

// ---------------------------------------------------------------------------
// Scratch fields — programme semester + working days
// ---------------------------------------------------------------------------

function ScratchFields({
  loadingPs,
  psError,
  programmeSemesters,
  programmeSemesterId,
  onSelectPs,
  workingDays,
  onToggleDay,
}: {
  loadingPs: boolean
  psError: string | null
  programmeSemesters: LookupProgrammeSemester[] | null
  programmeSemesterId: number | null
  onSelectPs: (id: number | null) => void
  workingDays: number[]
  onToggleDay: (day: number) => void
}) {
  return (
    <>
      <div className="space-y-1.5">
        <Label>Programme semester</Label>
        {loadingPs ? (
          <div className="shimmer h-9 w-full rounded-md bg-muted/60" />
        ) : psError ? (
          <p className="flex items-center gap-1.5 text-sm text-destructive">
            <CircleAlert className="size-4" />
            {psError}
          </p>
        ) : programmeSemesters && programmeSemesters.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No active programme semesters for this batch. Ask an admin to
            set one up.
          </p>
        ) : programmeSemesters ? (
          <select
            value={programmeSemesterId ?? ''}
            onChange={(e) =>
              onSelectPs(e.target.value ? Number(e.target.value) : null)
            }
            className="h-9 w-full rounded-md border bg-card px-2 text-sm"
          >
            <option value="" disabled>
              Select a semester…
            </option>
            {programmeSemesters.map((ps) => (
              <option key={ps.id} value={ps.id}>
                {ps.programme.display_name} · Sem {ps.semester.sem_number} ·{' '}
                {ps.admission_year.display_year}
                {ps.status === 'ongoing' ? ' · ongoing' : ''}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label>Working days</Label>
        <div className="flex flex-wrap gap-1.5">
          {[1, 2, 3, 4, 5, 6, 7].map((day) => {
            const selected = workingDays.includes(day)
            const labels = DAY_LABELS[day]
            return (
              <button
                key={day}
                type="button"
                aria-pressed={selected}
                onClick={() => onToggleDay(day)}
                className={cn(
                  'rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors',
                  selected
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'bg-card hover:bg-accent hover:text-accent-foreground',
                )}
              >
                <span className="sm:hidden">{labels.short}</span>
                <span className="hidden sm:inline">{labels.long}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="rounded-md border bg-muted/30 p-3 text-xs">
        <p className="font-semibold text-foreground">Default bell schedule</p>
        <p className="mt-0.5 text-muted-foreground">
          We'll start you with a six-period day (two breaks). You can edit
          the bell schedule from the timetable's detail page afterwards.
        </p>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Clone fields — source picker
// ---------------------------------------------------------------------------

function CloneFields({
  existingTimetables,
  sourceId,
  onSelectSource,
  sourceTimetable,
}: {
  existingTimetables: IncharqeTimetableSummary[]
  sourceId: number | null
  onSelectSource: (id: number | null) => void
  sourceTimetable: IncharqeTimetableSummary | null
}) {
  return (
    <>
      <div className="space-y-1.5">
        <Label>Clone from</Label>
        <div className="space-y-2">
          {existingTimetables.map((t) => {
            const selected = sourceId === t.id
            return (
              <button
                key={t.id}
                type="button"
                aria-pressed={selected}
                onClick={() => onSelectSource(t.id)}
                className={cn(
                  'flex w-full flex-col gap-1 rounded-lg border bg-card px-3 py-2 text-left transition-colors',
                  selected
                    ? 'border-primary ring-2 ring-primary/40'
                    : 'hover:bg-accent hover:text-accent-foreground',
                )}
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold">{t.name}</span>
                  {t.is_default ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-1.5 py-0.5 text-[10px] font-semibold text-success">
                      <Star className="size-2.5" />
                      Default
                    </span>
                  ) : null}
                </div>
                <span className="text-[11px] text-muted-foreground">
                  {t.teaching_period_count} teaching periods ·{' '}
                  {t.entry_count} classes placed
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {sourceTimetable ? (
        <div className="rounded-md border bg-muted/30 p-3 text-xs">
          <p className="font-semibold text-foreground">What's copied</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-muted-foreground">
            <li>Periods (bell schedule)</li>
            <li>Timetable-exclusive courses + their faculty</li>
            <li>Every placed grid cell (subject, teacher, room, span)</li>
          </ul>
          <p className="mt-1.5 text-muted-foreground">
            The copy lands in the same group + semester. It's never marked
            as default — the source keeps its default status.
          </p>
        </div>
      ) : null}
    </>
  )
}

// ---------------------------------------------------------------------------
// Server call for clone
// ---------------------------------------------------------------------------

/**
 * Calls `POST /employee/attendance-incharge/timetables/:id/clone`. The
 * server delegates to the admin TimetablesService.clone after verifying
 * the source belongs to one of the caller's owned groups.
 */
function cloneInchargeTimetable(
  sourceId: number,
  name: string,
): Promise<IncharqeTimetable> {
  return withEmployeeAuth((token) =>
    apiFetch<IncharqeTimetable>(
      `/employee/attendance-incharge/timetables/${sourceId}/clone`,
      { method: 'POST', body: { name }, token },
    ),
  )
}
