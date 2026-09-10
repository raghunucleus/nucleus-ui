import { useParams } from '@tanstack/react-router'
import {
  CalendarRange,
  CheckCircle2,
  CircleAlert,
  Clock,
  GraduationCap,
  Loader2,
  Pencil,
  RefreshCw,
  Save,
  Settings,
  Star,
  Trash2,
  Users,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { NoAccessEmptyState } from '@/components/employee/empty-states'
import {
  CellEditorSheet,
  type CellEditorTarget,
} from '@/components/incharge/cell-editor-sheet'
import { CoursesManager } from '@/components/incharge/courses-manager'
import { PeriodEditorSheet } from '@/components/incharge/period-editor-sheet'
import { TimetableGrid } from '@/components/incharge/timetable-grid'
import { BackButton } from '@/components/ui/back-button'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { StickyHeader } from '@/components/ui/sticky-header'
import { useScreenAccess } from '@/hooks/use-screen-access'
import { ApiError } from '@/lib/api'
import {
  deleteInchargeTimetable,
  fetchInchargeTimetable,
  setInchargeTimetableDefault,
  updateInchargeTimetable,
  type IncharqeTimetable,
} from '@/lib/incharge-schedule'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function shortTime(t: string): string {
  return t.length >= 5 ? t.slice(0, 5) : t
}

function navigateTo(route: string) {
  window.history.pushState({}, '', route)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

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
 * Single-template view for the incharge. Two concerns:
 *   1. Metadata — name + working days (inline edit)
 *   2. Bell schedule + grid preview (with cell + period editors)
 *
 * Publishing weeks, cancelling classes, and assigning alternate teachers
 * live on the sibling [[incharge-schedule.tsx]] Schedule Management page.
 */
export default function EmployeeInchargeTemplateDetailPage() {
  const access = useScreenAccess('timetable.incharge.templates.manage')
  const { timetableId: rawId } = useParams({ strict: false }) as {
    timetableId?: string
  }
  const timetableId = rawId ? Number(rawId) : NaN

  const [data, setData] = useState<IncharqeTimetable | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Inline metadata edit state — seeded each time we load fresh data.
  const [editName, setEditName] = useState('')
  const [editWorkingDays, setEditWorkingDays] = useState<number[]>([])
  const [savingMeta, setSavingMeta] = useState(false)
  const [metaSavedAt, setMetaSavedAt] = useState<Date | null>(null)
  const [metaError, setMetaError] = useState<string | null>(null)

  // Sheet state — bell schedule editor + cell editor.
  const [periodEditorOpen, setPeriodEditorOpen] = useState(false)
  const [cellTarget, setCellTarget] = useState<CellEditorTarget | null>(null)

  // Delete state — shown via an inline confirm in the header.
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!Number.isFinite(timetableId)) {
      setError('Invalid timetable id.')
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetchInchargeTimetable(timetableId)
      setData(res)
      setEditName(res.name ?? '')
      setEditWorkingDays(Array.isArray(res.working_days) ? res.working_days : [])
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Could not load the timetable.',
      )
    } finally {
      setLoading(false)
    }
  }, [timetableId])

  useEffect(() => {
    void load()
  }, [load])

  if (!access) return <NoAccessEmptyState />
  if (!access.actions.includes('view')) {
    return <NoAccessEmptyState />
  }

  const canEdit = access.actions.includes('edit')
  // Surface which actions are missing so the user knows exactly what to ask
  // the admin to add to their role. Common case: the screen was extended
  // with `edit` after the role assignment was created.
  const missingActions: string[] = []
  if (!canEdit) missingActions.push('edit')

  const metaDirty =
    data !== null &&
    (editName.trim() !== data.name ||
      !sameDayList(editWorkingDays, data.working_days ?? []))

  async function saveMeta() {
    if (!data || !metaDirty) return
    setSavingMeta(true)
    setMetaError(null)
    try {
      const next = await updateInchargeTimetable(timetableId, {
        name: editName.trim() !== data.name ? editName.trim() : undefined,
        working_days: !sameDayList(editWorkingDays, data.working_days ?? [])
          ? [...editWorkingDays].sort((a, b) => a - b)
          : undefined,
      })
      setData(next)
      setEditName(next.name ?? '')
      setEditWorkingDays(Array.isArray(next.working_days) ? next.working_days : [])
      setMetaSavedAt(new Date())
    } catch (err) {
      setMetaError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Couldn't save changes.",
      )
    } finally {
      setSavingMeta(false)
    }
  }

  async function markDefault() {
    if (!data) return
    try {
      const next = await setInchargeTimetableDefault(timetableId)
      setData(next)
      setEditName(next.name ?? '')
      setEditWorkingDays(Array.isArray(next.working_days) ? next.working_days : [])
    } catch (err) {
      setMetaError(
        err instanceof Error ? err.message : "Couldn't set default.",
      )
    }
  }

  async function removeTimetable() {
    if (!data) return
    if (
      !confirm(
        `Delete "${data.name}"? Every period, course, grid cell and unpublished session for this template will be removed.`,
      )
    )
      return
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteInchargeTimetable(timetableId)
      // Bounce back to the list — the timetable no longer exists.
      navigateTo('/timetable/incharge/templates')
    } catch (err) {
      setDeleteError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Couldn't delete the timetable.",
      )
    } finally {
      setDeleting(false)
    }
  }

  return (
    <section className="space-y-5">
      <StickyHeader className="border-b pb-3">
        <BackButton
          label="Back to templates"
          onClick={() => navigateTo('/timetable/incharge/templates')}
        />
      </StickyHeader>

      {error ? (
        <Card className="flex items-start gap-3 border-destructive/30 bg-destructive/10 p-4">
          <CircleAlert className="mt-0.5 size-5 shrink-0 text-destructive" />
          <div className="flex-1 space-y-2">
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" size="sm" onClick={() => void load()}>
              <RefreshCw />
              Retry
            </Button>
          </div>
        </Card>
      ) : null}

      {missingActions.length > 0 ? (
        <Card className="flex items-start gap-3 border-warning/40 bg-warning/10 p-4">
          <CircleAlert className="mt-0.5 size-5 shrink-0 text-warning" />
          <div className="flex-1 space-y-1">
            <p className="text-sm font-medium text-warning">
              Read-only — your role is missing{' '}
              {missingActions.map((a, i) => (
                <span key={a}>
                  <code className="rounded bg-warning/20 px-1.5 py-0.5 font-mono text-xs">
                    {a}
                  </code>
                  {i < missingActions.length - 1 ? ', ' : ''}
                </span>
              ))}{' '}
              on this screen.
            </p>
            <p className="text-xs text-warning/80">
              Ask an admin to grant the{' '}
              {missingActions.join(' / ')} action
              {missingActions.length === 1 ? '' : 's'} on the{' '}
              <span className="font-mono">
                timetable.incharge.templates.manage
              </span>{' '}
              screen so you can edit this template.
            </p>
          </div>
        </Card>
      ) : null}

      {loading && !data ? (
        <LoadingState />
      ) : data ? (
        <>
          <HeaderCard
            data={data}
            canEdit={canEdit}
            onSetDefault={() => void markDefault()}
          />

          <MetadataEditor
            data={data}
            editName={editName}
            editWorkingDays={editWorkingDays}
            metaDirty={metaDirty}
            savingMeta={savingMeta}
            metaSavedAt={metaSavedAt}
            metaError={metaError}
            canEdit={canEdit}
            onNameChange={setEditName}
            onToggleDay={(day) =>
              setEditWorkingDays((prev) =>
                prev.includes(day)
                  ? prev.filter((d) => d !== day)
                  : [...prev, day].sort((a, b) => a - b),
              )
            }
            onSave={() => void saveMeta()}
            onReset={() => {
              setEditName(data.name)
              setEditWorkingDays(data.working_days)
              setMetaError(null)
            }}
          />

          <BellScheduleCard
            data={data}
            canEdit={canEdit}
            onEdit={() => setPeriodEditorOpen(true)}
          />

          <TimetableGrid
            data={data}
            canEdit={canEdit}
            onPickCell={(target) => setCellTarget(target)}
          />

          <CoursesManager
            timetable={data}
            canEdit={canEdit}
            onChange={(next) => setData(next)}
          />

          <Card className="flex flex-wrap items-center gap-3 border-icon-emerald/30 bg-icon-emerald/5 p-4 text-sm">
            <p className="flex-1 text-muted-foreground">
              Publishing weekly sessions, cancelling classes, and assigning
              alternate teachers lives on the Schedule Management screen.
            </p>
            <Button
              variant="outline"
              onClick={() => navigateTo('/timetable/incharge/schedule')}
            >
              Open Schedule
            </Button>
          </Card>

          {canEdit ? (
            <Card className="flex flex-wrap items-center gap-3 border-destructive/30 bg-destructive/5 p-4">
              <Trash2 className="size-5 text-destructive" />
              <div className="flex-1">
                <p className="text-sm font-medium text-destructive">
                  Delete this timetable
                </p>
                <p className="text-xs text-destructive/80">
                  Removes the template, its periods, courses and any
                  unpublished grid cells. Past published sessions stay put.
                </p>
                {deleteError ? (
                  <p className="mt-1 text-xs text-destructive">{deleteError}</p>
                ) : null}
              </div>
              <Button
                variant="outline"
                onClick={() => void removeTimetable()}
                disabled={deleting}
                className="border-destructive/30 text-destructive hover:bg-destructive/10"
              >
                {deleting ? <Loader2 className="animate-spin" /> : <Trash2 />}
                Delete
              </Button>
            </Card>
          ) : null}
        </>
      ) : null}

      <PeriodEditorSheet
        open={periodEditorOpen}
        timetableId={timetableId}
        initialPeriods={data?.periods ?? []}
        onClose={() => setPeriodEditorOpen(false)}
        onSaved={(next) => {
          setData(next)
          setPeriodEditorOpen(false)
        }}
      />

      <CellEditorSheet
        open={cellTarget !== null}
        timetable={data}
        target={cellTarget}
        onClose={() => setCellTarget(null)}
        onSaved={async () => {
          setCellTarget(null)
          // Refetch so the grid reflects the new/updated cell with joined
          // subject + teacher info.
          await load()
        }}
        onCleared={async () => {
          setCellTarget(null)
          await load()
        }}
      />
    </section>
  )
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

function HeaderCard({
  data,
  canEdit,
  onSetDefault,
}: {
  data: IncharqeTimetable
  canEdit: boolean
  onSetDefault: () => void
}) {
  const ps = data.programme_semester
  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
            <CalendarRange className="size-6 text-icon-blue" />
            {data.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <GraduationCap className="size-3.5 text-icon-blue" />
              {ps.programme?.display_name ?? ps.programme?.name ?? ''}
              {ps.semester
                ? ` · Semester ${ps.semester.sem_number}`
                : ''}
            </span>
            {' · '}
            <span className="inline-flex items-center gap-1.5">
              <Users className="size-3.5 text-icon-cyan" />
              {data.attendance_group.name}
            </span>
            {ps.admission_year ? (
              <>
                {' · '}
                <span className="text-foreground">
                  Batch {ps.admission_year.display_year}
                </span>
              </>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {data.is_default ? (
            <Badge variant="success">
              <Star className="size-3" />
              Default template
            </Badge>
          ) : canEdit ? (
            <Button variant="outline" size="sm" onClick={onSetDefault}>
              <Star />
              Make default
            </Button>
          ) : null}
        </div>
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Metadata editor — name + working days
// ---------------------------------------------------------------------------

function MetadataEditor({
  data,
  editName,
  editWorkingDays,
  metaDirty,
  savingMeta,
  metaSavedAt,
  metaError,
  canEdit,
  onNameChange,
  onToggleDay,
  onSave,
  onReset,
}: {
  data: IncharqeTimetable
  editName: string
  editWorkingDays: number[]
  metaDirty: boolean
  savingMeta: boolean
  metaSavedAt: Date | null
  metaError: string | null
  canEdit: boolean
  onNameChange: (next: string) => void
  onToggleDay: (day: number) => void
  onSave: () => void
  onReset: () => void
}) {
  return (
    <Card className="space-y-4 p-5 sm:p-6">
      <header className="flex items-center gap-2">
        <Settings className="size-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Template details
        </h2>
      </header>

      <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="space-y-1.5">
          <Label htmlFor="tt-name">Name</Label>
          <Input
            id="tt-name"
            value={editName}
            onChange={(e) => onNameChange(e.target.value)}
            disabled={!canEdit}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Working days</Label>
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5, 6, 7].map((day) => {
            const labels = DAY_LABELS[day]
            const selected = editWorkingDays.includes(day)
            return (
              <button
                key={day}
                type="button"
                aria-pressed={selected}
                disabled={!canEdit}
                onClick={() => onToggleDay(day)}
                className={cn(
                  'rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors',
                  selected
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'bg-card hover:bg-accent hover:text-accent-foreground',
                  !canEdit && 'cursor-not-allowed opacity-60',
                )}
              >
                <span className="sm:hidden">{labels.short}</span>
                <span className="hidden sm:inline">{labels.long}</span>
              </button>
            )
          })}
        </div>
        <p className="text-xs text-muted-foreground">
          Cells on a day you remove are pruned the moment you save.
        </p>
      </div>

      {metaError ? (
        <p className="flex items-center gap-1.5 text-sm text-destructive">
          <CircleAlert className="size-4" />
          {metaError}
        </p>
      ) : null}
      {metaSavedAt && !metaDirty ? (
        <p className="flex items-center gap-1.5 text-sm text-success">
          <CheckCircle2 className="size-4" />
          Saved at{' '}
          {metaSavedAt.toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      ) : null}

      {canEdit ? (
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={onSave}
            disabled={!metaDirty || savingMeta || editName.trim().length === 0}
          >
            {savingMeta ? (
              <>
                <Loader2 className="animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <Save />
                Save changes
              </>
            )}
          </Button>
          {metaDirty ? (
            <Button variant="outline" onClick={onReset}>
              Discard
            </Button>
          ) : null}
          {!metaDirty ? (
            <span className="self-center text-xs text-muted-foreground">
              {(data.entries ?? []).length} class
              {(data.entries ?? []).length === 1 ? '' : 'es'} placed across{' '}
              {(data.periods ?? []).filter((p) => !p.is_break).length} teaching
              periods.
            </span>
          ) : null}
        </div>
      ) : null}
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Bell schedule (read-only summary)
// ---------------------------------------------------------------------------

function BellScheduleCard({
  data,
  canEdit,
  onEdit,
}: {
  data: IncharqeTimetable
  canEdit: boolean
  onEdit: () => void
}) {
  const periods = useMemo(
    () => [...(data.periods ?? [])].sort((a, b) => a.position - b.position),
    [data.periods],
  )

  return (
    <Card className="overflow-hidden">
      <header className="flex items-center gap-2 border-b bg-muted/30 px-5 py-3">
        <Clock className="size-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Bell schedule
        </h2>
        <span className="ml-auto text-xs text-muted-foreground">
          {periods.length} period{periods.length === 1 ? '' : 's'}
        </span>
        {canEdit ? (
          <Button variant="outline" size="sm" onClick={onEdit}>
            <Pencil />
            Edit
          </Button>
        ) : null}
      </header>
      {periods.length === 0 ? (
        <div className="px-5 py-8 text-center text-sm text-muted-foreground">
          {canEdit
            ? 'No periods configured yet. Click Edit to set the bell schedule.'
            : 'No periods configured yet.'}
        </div>
      ) : (
        <ul className="divide-y">
          {periods.map((p) => (
            <li key={p.id} className="flex items-center gap-3 px-5 py-2.5">
              <span className="w-6 text-xs font-medium tabular-nums text-muted-foreground">
                {p.position}.
              </span>
              <span className="w-28 text-sm tabular-nums">
                {shortTime(p.start_time)} – {shortTime(p.end_time)}
              </span>
              <span
                className={cn(
                  'flex-1 text-sm',
                  p.is_break && 'italic text-muted-foreground',
                )}
              >
                {p.label}
              </span>
              {p.is_break ? <Badge variant="secondary">Break</Badge> : null}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sameDayList(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false
  const aSorted = [...a].sort((x, y) => x - y)
  const bSorted = [...b].sort((x, y) => x - y)
  return aSorted.every((v, i) => v === bSorted[i])
}

function LoadingState() {
  return (
    <>
      <Card className="p-5 sm:p-6">
        <div className="shimmer h-7 w-64 rounded bg-muted/60" />
        <div className="mt-2 shimmer h-4 w-48 rounded bg-muted/60" />
      </Card>
      <Card className="space-y-3 p-5 sm:p-6">
        <div className="shimmer h-4 w-32 rounded bg-muted/60" />
        <div className="shimmer h-10 w-full rounded bg-muted/60" />
        <div className="shimmer h-10 w-full rounded bg-muted/60" />
      </Card>
      <Card className="overflow-hidden">
        <div className="shimmer h-10 border-b bg-muted/40" />
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="shimmer h-10 border-b bg-muted/40" />
        ))}
      </Card>
    </>
  )
}
