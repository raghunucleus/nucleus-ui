import {
  ChevronRight,
  CircleAlert,
  Copy,
  LayoutGrid,
  LayoutTemplate,
  Loader2,
  MoreVertical,
  Plus,
  RefreshCw,
  Settings,
  Star,
  Trash2,
  Users,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import {
  NoAccessEmptyState,
  NoScopeEmptyState,
} from '@/components/employee/empty-states'
import { CreateTimetableSheet } from '@/components/incharge/create-timetable-sheet'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { PageHeader } from '@/components/ui/page-header'
import { useScreenAccess } from '@/hooks/use-screen-access'
import { ApiError } from '@/lib/api'
import {
  fetchInchargeGroups,
  type InchargeGroupSummary,
} from '@/lib/incharge-attendance'
import {
  deleteInchargeTimetable,
  fetchInchargeProgrammeSemesters,
  fetchInchargeTimetables,
  setInchargeTimetableDefault,
  type IncharqeTimetableSummary,
  type LookupProgrammeSemester,
} from '@/lib/incharge-schedule'
import { cn } from '@/lib/utils'

function navigateTo(route: string) {
  window.history.pushState({}, '', route)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

const DAY_LABELS: Record<number, string> = {
  1: 'Mon',
  2: 'Tue',
  3: 'Wed',
  4: 'Thu',
  5: 'Fri',
  6: 'Sat',
  7: 'Sun',
}

/**
 * Timetable Management hub for the attendance incharge. Group picker on
 * top; for the selected group, lists the timetable templates and links
 * into the single-timetable editor. Sibling page
 * [[incharge-schedule.tsx]] owns the live week/day surface (publish a
 * week, cancel a class, assign an alternate teacher).
 */
export default function EmployeeInchargeTemplatesPage() {
  const access = useScreenAccess('timetable.incharge.templates.manage')

  const [groups, setGroups] = useState<InchargeGroupSummary[] | null>(null)
  const [groupsError, setGroupsError] = useState<string | null>(null)
  const [activeGroupId, setActiveGroupId] = useState<number | null>(null)

  // Semester filter — drives both the displayed PS context AND the timetable
  // query. `null` means "all semesters" (rare; mostly when no PS rows exist).
  const [programmeSemesters, setProgrammeSemesters] = useState<
    LookupProgrammeSemester[] | null
  >(null)
  const [psError, setPsError] = useState<string | null>(null)
  const [activePsId, setActivePsId] = useState<number | null>(null)

  const [timetables, setTimetables] = useState<
    IncharqeTimetableSummary[] | null
  >(null)
  const [timetablesLoading, setTimetablesLoading] = useState(false)
  const [timetablesError, setTimetablesError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchInchargeGroups()
      .then((res) => {
        if (cancelled) return
        setGroups(res)
        if (res.length > 0 && activeGroupId === null) {
          setActiveGroupId(res[0].id)
        }
      })
      .catch((err) => {
        if (cancelled) return
        setGroupsError(
          err instanceof Error
            ? err.message
            : 'Could not load your groups.',
        )
      })
    return () => {
      cancelled = true
    }
    // Run once on mount — re-running on activeGroupId change is intentionally
    // skipped (the initial group is seeded inside the success branch).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadTimetables = useCallback(
    async (groupId: number, psId: number | null) => {
      setTimetablesLoading(true)
      setTimetablesError(null)
      setTimetables(null)
      try {
        // Pass undefined when "all semesters" is selected so the server doesn't
        // filter — otherwise scope to the chosen PS, matching how the admin
        // panel slices the same list.
        const rows = await fetchInchargeTimetables(
          psId ?? undefined,
          groupId,
        )
        setTimetables(rows)
      } catch (err) {
        setTimetablesError(
          err instanceof ApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : 'Could not load timetables for this group.',
        )
      } finally {
        setTimetablesLoading(false)
      }
    },
    [],
  )

  // When the group changes, refetch its programme semesters and pre-select
  // the ongoing one (if any), falling back to the highest semester number.
  useEffect(() => {
    if (activeGroupId === null) {
      setProgrammeSemesters(null)
      setActivePsId(null)
      return
    }
    let cancelled = false
    setProgrammeSemesters(null)
    setActivePsId(null)
    setPsError(null)
    fetchInchargeProgrammeSemesters(activeGroupId)
      .then((rows) => {
        if (cancelled) return
        setProgrammeSemesters(rows)
        if (rows.length > 0) {
          const ongoing = rows.find((r) => r.status === 'ongoing')
          const seed =
            ongoing ??
            [...rows].sort(
              (a, b) => b.semester.sem_number - a.semester.sem_number,
            )[0]
          setActivePsId(seed.id)
        }
      })
      .catch((err) => {
        if (cancelled) return
        setPsError(
          err instanceof Error
            ? err.message
            : 'Could not load semesters for this group.',
        )
      })
    return () => {
      cancelled = true
    }
  }, [activeGroupId])

  // Refetch timetables whenever the group OR the selected PS changes.
  useEffect(() => {
    if (activeGroupId === null) return
    // Wait for the PS list to load before fetching timetables — otherwise we
    // briefly fetch the unfiltered list, only to immediately refetch with the
    // ongoing-semester filter applied.
    if (programmeSemesters === null) return
    void loadTimetables(activeGroupId, activePsId)
  }, [activeGroupId, activePsId, programmeSemesters, loadTimetables])

  // Sheet state for "Create timetable" — opened from per-group section header.
  const [createOpen, setCreateOpen] = useState(false)
  // When set, the create sheet opens in clone mode pre-pointed at this id.
  // Null means "open in default mode" (clone if any sources, else scratch).
  const [cloneSeedId, setCloneSeedId] = useState<number | null>(null)

  // Tracks the in-flight per-card action so the menu can show a spinner.
  const [busyAction, setBusyAction] = useState<{
    id: number
    kind: 'default' | 'delete'
  } | null>(null)
  const [cardError, setCardError] = useState<string | null>(null)

  // Per-card action handlers — call the server, then refetch the
  // timetable list so the cards reflect the new state.
  const makeDefault = useCallback(
    async (id: number) => {
      if (activeGroupId === null) return
      setBusyAction({ id, kind: 'default' })
      setCardError(null)
      try {
        await setInchargeTimetableDefault(id)
        await loadTimetables(activeGroupId, activePsId)
      } catch (err) {
        setCardError(
          err instanceof ApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Couldn't make this the default template.",
        )
      } finally {
        setBusyAction(null)
      }
    },
    [activeGroupId, activePsId, loadTimetables],
  )

  const deleteTimetable = useCallback(
    async (id: number, name: string) => {
      if (activeGroupId === null) return
      if (
        !confirm(
          `Delete "${name}"? Every period, course, grid cell and unpublished session for this template will be removed.`,
        )
      ) {
        return
      }
      setBusyAction({ id, kind: 'delete' })
      setCardError(null)
      try {
        await deleteInchargeTimetable(id)
        await loadTimetables(activeGroupId, activePsId)
      } catch (err) {
        setCardError(
          err instanceof ApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Couldn't delete the timetable.",
        )
      } finally {
        setBusyAction(null)
      }
    },
    [activeGroupId, activePsId, loadTimetables],
  )

  function openClone(id: number) {
    setCloneSeedId(id)
    setCreateOpen(true)
  }

  if (!access) return <NoAccessEmptyState />
  if (!access.actions.includes('view')) {
    return <NoScopeEmptyState attributeLabel="view permission" />
  }

  const canEdit = access.actions.includes('edit')
  const activeGroup =
    groups && activeGroupId !== null
      ? groups.find((g) => g.id === activeGroupId) ?? null
      : null

  return (
    <section className="space-y-5">
      <PageHeader title="Timetable management" icon={LayoutTemplate} />
      {!canEdit ? (
        <p className="text-xs text-warning">
          View-only — editing is disabled on your role.
        </p>
      ) : null}

      {/* Group picker */}
      {groupsError ? (
        <Card className="flex items-start gap-3 border-destructive/30 bg-destructive/10 p-4">
          <CircleAlert className="mt-0.5 size-5 shrink-0 text-destructive" />
          <p className="text-sm text-destructive">{groupsError}</p>
        </Card>
      ) : !groups ? (
        <div className="flex flex-wrap gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="shimmer h-12 w-44 rounded-lg bg-muted/60" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <NoGroupsState />
      ) : (
        <div className="flex flex-wrap gap-2">
          {groups.map((g) => {
            const selected = activeGroupId === g.id
            return (
              <button
                key={g.id}
                type="button"
                aria-pressed={selected}
                onClick={() => setActiveGroupId(g.id)}
                className={cn(
                  'flex min-w-[12rem] flex-col items-start gap-0.5 rounded-lg border px-3 py-2 text-left transition-colors',
                  selected
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'bg-card hover:bg-accent hover:text-accent-foreground',
                )}
              >
                <div className="flex w-full items-center gap-1.5">
                  <span className="truncate text-sm font-medium leading-tight">
                    {g.name}
                  </span>
                  <span
                    className={cn(
                      'rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                      selected
                        ? 'bg-primary-foreground/20 text-primary-foreground'
                        : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {g.code}
                  </span>
                </div>
                <span
                  className={cn(
                    'truncate text-[11px] leading-tight',
                    selected ? 'text-primary-foreground/80' : 'text-muted-foreground',
                  )}
                >
                  {g.programme.department?.code ? `${g.programme.department.code} · ` : ''}
                  {g.programme.code} · {g.admission_year.display_year}
                </span>
                <span
                  className={cn(
                    'text-[10px] tabular-nums leading-tight',
                    selected ? 'text-primary-foreground/70' : 'text-muted-foreground',
                  )}
                >
                  {g.member_count} student{g.member_count === 1 ? '' : 's'}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {/* Timetable list for the chosen group */}
      {activeGroup ? (
        <section className="space-y-3">
          <GroupHeader
            group={activeGroup}
            canEdit={canEdit}
            onCreate={() => setCreateOpen(true)}
          />

          <SemesterFilter
            programmeSemesters={programmeSemesters}
            psError={psError}
            activePsId={activePsId}
            onSelect={setActivePsId}
          />

          {timetablesError ? (
            <ErrorBanner
              message={timetablesError}
              onRetry={() => loadTimetables(activeGroup.id, activePsId)}
            />
          ) : null}

          {timetablesLoading && !timetables ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {[0, 1].map((i) => (
                <div key={i} className="shimmer h-40 rounded-xl bg-muted/60" />
              ))}
            </div>
          ) : timetables && timetables.length === 0 ? (
            <NoTimetablesState
              canEdit={canEdit}
              onCreate={() => setCreateOpen(true)}
            />
          ) : timetables ? (
            <>
              {cardError ? (
                <Card className="flex items-start gap-2 border-destructive/30 bg-destructive/10 p-3">
                  <CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
                  <p className="text-xs text-destructive">{cardError}</p>
                </Card>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-2">
                {timetables.map((t) => (
                  <TimetableCard
                    key={t.id}
                    timetable={t}
                    canEdit={canEdit}
                    busyAction={busyAction}
                    onOpen={() =>
                      navigateTo(`/timetable/incharge/templates/${t.id}`)
                    }
                    onMakeDefault={() => void makeDefault(t.id)}
                    onClone={() => openClone(t.id)}
                    onDelete={() => void deleteTimetable(t.id, t.name)}
                  />
                ))}
              </div>
            </>
          ) : null}
        </section>
      ) : null}

      <CreateTimetableSheet
        open={createOpen}
        group={activeGroup}
        existingTimetables={timetables ?? []}
        seedSourceId={cloneSeedId}
        onClose={() => {
          setCreateOpen(false)
          setCloneSeedId(null)
        }}
        onCreated={(id) => {
          setCreateOpen(false)
          setCloneSeedId(null)
          navigateTo(`/timetable/incharge/templates/${id}`)
        }}
      />
    </section>
  )
}

// ---------------------------------------------------------------------------
// Group header — richer identifier strip
// ---------------------------------------------------------------------------

function GroupHeader({
  group,
  canEdit,
  onCreate,
}: {
  group: InchargeGroupSummary
  canEdit: boolean
  onCreate: () => void
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3 rounded-lg border bg-card p-4">
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Group
        </p>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Users className="size-5 text-icon-cyan" />
          <span className="truncate">{group.name}</span>
          <Badge variant="secondary" className="ml-1">
            {group.code}
          </Badge>
        </h2>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {group.programme.department ? (
            <span>
              <span className="font-medium text-foreground">
                {group.programme.department.name}
              </span>{' '}
              · {group.programme.department.code}
            </span>
          ) : null}
          <span>{group.programme.display_name}</span>
          <span>Batch {group.admission_year.display_year}</span>
          <span className="tabular-nums">
            {group.member_count} student{group.member_count === 1 ? '' : 's'}
          </span>
        </div>
        {group.description ? (
          <p className="text-xs italic text-muted-foreground">
            {group.description}
          </p>
        ) : null}
      </div>
      {canEdit ? (
        <Button onClick={onCreate}>
          <Plus />
          New timetable
        </Button>
      ) : null}
    </header>
  )
}

// ---------------------------------------------------------------------------
// Semester filter — defaults to ongoing if present
// ---------------------------------------------------------------------------

function SemesterFilter({
  programmeSemesters,
  psError,
  activePsId,
  onSelect,
}: {
  programmeSemesters: LookupProgrammeSemester[] | null
  psError: string | null
  activePsId: number | null
  onSelect: (next: number | null) => void
}) {
  if (psError) {
    return (
      <Card className="flex items-start gap-2 border-destructive/30 bg-destructive/10 p-3">
        <CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
        <p className="text-xs text-destructive">{psError}</p>
      </Card>
    )
  }
  if (!programmeSemesters) {
    return (
      <div className="flex flex-wrap gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="shimmer h-9 w-32 rounded-lg bg-muted/60" />
        ))}
      </div>
    )
  }
  if (programmeSemesters.length === 0) {
    return (
      <Card className="px-4 py-3 text-xs text-muted-foreground">
        No active programme semesters for this group's batch yet. Ask an admin
        to activate one.
      </Card>
    )
  }

  // Most recent first so the active semester sits near the start of the row.
  const sorted = [...programmeSemesters].sort(
    (a, b) => b.semester.sem_number - a.semester.sem_number,
  )

  return (
    <div className="flex flex-wrap items-center gap-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Semester:
      </p>
      <button
        type="button"
        aria-pressed={activePsId === null}
        onClick={() => onSelect(null)}
        className={cn(
          'rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors',
          activePsId === null
            ? 'border-primary bg-primary text-primary-foreground'
            : 'bg-card hover:bg-accent hover:text-accent-foreground',
        )}
      >
        All
      </button>
      {sorted.map((ps) => {
        const selected = activePsId === ps.id
        const isOngoing = ps.status === 'ongoing'
        return (
          <button
            key={ps.id}
            type="button"
            aria-pressed={selected}
            onClick={() => onSelect(ps.id)}
            className={cn(
              'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors',
              selected
                ? 'border-primary bg-primary text-primary-foreground'
                : 'bg-card hover:bg-accent hover:text-accent-foreground',
            )}
          >
            <span>Semester {ps.semester.sem_number}</span>
            {isOngoing ? (
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                  selected
                    ? 'bg-primary-foreground/20 text-primary-foreground'
                    : 'bg-success/15 text-success',
                )}
              >
                Ongoing
              </span>
            ) : ps.status === 'completed' ? (
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                  selected
                    ? 'bg-primary-foreground/20 text-primary-foreground'
                    : 'bg-muted text-muted-foreground',
                )}
              >
                Completed
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Cards / empty states
// ---------------------------------------------------------------------------

function TimetableCard({
  timetable,
  canEdit,
  busyAction,
  onOpen,
  onMakeDefault,
  onClone,
  onDelete,
}: {
  timetable: IncharqeTimetableSummary
  canEdit: boolean
  /** id of the timetable whose row is currently being acted on (disables that row's menu). */
  busyAction: { id: number; kind: 'default' | 'delete' } | null
  onOpen: () => void
  onMakeDefault: () => void
  onClone: () => void
  onDelete: () => void
}) {
  const busy =
    busyAction !== null && busyAction.id === timetable.id
      ? busyAction.kind
      : null

  return (
    <Card className="flex flex-col gap-3 p-5 transition-all hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <button
          type="button"
          onClick={onOpen}
          className="min-w-0 flex-1 space-y-1 text-left"
        >
          <h3 className="truncate text-base font-semibold hover:text-primary">
            {timetable.name}
          </h3>
          <p className="text-xs text-muted-foreground">
            {timetable.teaching_period_count} teaching ·{' '}
            {timetable.period_count - timetable.teaching_period_count} break
            {' · '}
            {timetable.entry_count} classes placed
          </p>
        </button>
        <div className="flex shrink-0 items-center gap-1">
          {timetable.is_default ? (
            <Badge variant="success">
              <Star className="size-3" />
              Default
            </Badge>
          ) : null}
          {canEdit ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Timetable actions"
                  disabled={busy !== null}
                >
                  {busy !== null ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <MoreVertical />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault()
                    onMakeDefault()
                  }}
                  disabled={timetable.is_default}
                >
                  <Star />
                  {timetable.is_default ? 'Already default' : 'Make default'}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault()
                    onClone()
                  }}
                >
                  <Copy />
                  Clone…
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={(e) => {
                    e.preventDefault()
                    onDelete()
                  }}
                >
                  <Trash2 />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-1">
        {timetable.working_days.map((d) => (
          <Badge key={d} variant="secondary">
            {DAY_LABELS[d] ?? `D${d}`}
          </Badge>
        ))}
      </div>

      <button
        type="button"
        onClick={onOpen}
        className="flex items-center justify-between pt-1 text-left transition-colors hover:text-primary"
      >
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-primary">
          <Settings className="size-4" />
          View / edit
        </span>
        <ChevronRight className="size-4 text-muted-foreground" />
      </button>
    </Card>
  )
}

function NoGroupsState() {
  return (
    <Card className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <div className="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
        <Users className="size-5" />
      </div>
      <div className="space-y-1">
        <h3 className="text-sm font-medium">No groups assigned</h3>
        <p className="max-w-sm text-xs text-muted-foreground">
          You're not currently marked as the incharge of any attendance group.
          Ask an admin to assign you on the group's settings.
        </p>
      </div>
    </Card>
  )
}

function NoTimetablesState({
  canEdit,
  onCreate,
}: {
  canEdit: boolean
  onCreate: () => void
}) {
  return (
    <Card className="flex flex-col items-center gap-3 px-6 py-10 text-center">
      <div className="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
        <LayoutGrid className="size-5" />
      </div>
      <div className="space-y-1">
        <h3 className="text-sm font-medium">No timetables yet</h3>
        <p className="max-w-sm text-xs text-muted-foreground">
          {canEdit
            ? 'Create a timetable template to start scheduling classes for this group.'
            : 'An admin has not set up a timetable for this group yet.'}
        </p>
      </div>
      {canEdit ? (
        <Button onClick={onCreate}>
          <Plus />
          Create timetable
        </Button>
      ) : null}
    </Card>
  )
}

function ErrorBanner({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}) {
  return (
    <Card className="flex items-start gap-3 border-destructive/30 bg-destructive/10 p-4">
      <CircleAlert className="mt-0.5 size-5 shrink-0 text-destructive" />
      <div className="flex-1 space-y-2">
        <p className="text-sm text-destructive">{message}</p>
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw />
          Retry
        </Button>
      </div>
    </Card>
  )
}

