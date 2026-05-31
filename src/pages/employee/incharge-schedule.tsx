import {
  AlertTriangle,
  ArrowLeftRight,
  Ban,
  CalendarCheck,
  CalendarPlus,
  CalendarRange,
  CalendarX,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  CircleAlert,
  Eye,
  Loader2,
  MoreVertical,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  UserCog,
  Users,
} from 'lucide-react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import {
  NoAccessEmptyState,
  NoScopeEmptyState,
} from '@/components/employee/empty-states'
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useScreenAccess } from '@/hooks/use-screen-access'
import { ApiError } from '@/lib/api'
import {
  fetchInchargeGroups,
  type InchargeGroupSummary,
} from '@/lib/incharge-attendance'
import {
  fetchInchargeEmployees,
  fetchInchargePssLookup,
  fetchInchargeProgrammeSemesters,
  fetchInchargeTimetable,
  fetchInchargeTimetables,
  fetchInchargeWeekSummaries,
  previewInchargeWeek,
  publishInchargeWeek,
  type IncharqeTimetableSummary,
  type LookupEmployee,
  type LookupPss,
  type LookupProgrammeSemester,
  type PreviewResult,
  type PublishExcludeKey,
  type TimetablePeriod,
  type WeekSummary,
} from '@/lib/incharge-schedule'
import {
  cancelInchargeSession,
  createInchargeAdHoc,
  editInchargeSession,
  fetchInchargeHolidays,
  fetchInchargeSessions,
  moveInchargeSession,
  moveInchargeSessionsBatch,
  substituteInchargeSession,
  uncancelInchargeSession,
  type InchargeHoliday,
  type InchargeSession,
} from '@/lib/incharge-sessions'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

const DAY_LABELS: Record<number, { short: string; long: string }> = {
  1: { short: 'Mon', long: 'Monday' },
  2: { short: 'Tue', long: 'Tuesday' },
  3: { short: 'Wed', long: 'Wednesday' },
  4: { short: 'Thu', long: 'Thursday' },
  5: { short: 'Fri', long: 'Friday' },
  6: { short: 'Sat', long: 'Saturday' },
  7: { short: 'Sun', long: 'Sunday' },
}

const WEEKS_IN_STRIP = 6

function toIsoDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000)
}

function startOfWeek(date: Date): Date {
  // ISO weeks start on Monday.
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const dow = d.getDay()
  const diff = dow === 0 ? -6 : 1 - dow
  d.setDate(d.getDate() + diff)
  return d
}

function shortTime(t: string | null | undefined): string {
  if (!t) return ''
  return t.length >= 5 ? t.slice(0, 5) : t
}

// 'HH:MM(:SS)' → minutes-since-midnight, for placing period blocks on a
// proportional clock axis. Returns 0 for empty input.
function toMinutes(t: string | null | undefined): number {
  if (!t) return 0
  const [h, m] = t.slice(0, 5).split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

function formatWeekRange(weekStart: string, weekEnd: string): string {
  const dayMonth = new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
  })
  const dayMonthYear = new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
  const startDate = new Date(`${weekStart}T00:00:00`)
  const endDate = new Date(`${weekEnd}T00:00:00`)
  // When the week crosses a year boundary (rare, Dec→Jan), spell out the
  // year on both ends so the difference is obvious. Otherwise the year
  // only needs to appear once, on the end, to keep the range compact.
  if (startDate.getFullYear() !== endDate.getFullYear()) {
    return `${dayMonthYear.format(startDate)} – ${dayMonthYear.format(endDate)}`
  }
  return `${dayMonth.format(startDate)} – ${dayMonthYear.format(endDate)}`
}

function sessionSubjectLabel(s: InchargeSession): string {
  // Prefer the (denormalized) class_sessions.subject when present, then
  // fall back to the PSS subject, then the option subject, then the
  // placeholder slot name. Mirrors the admin's session listings.
  const sub =
    s.subject ??
    s.programme_semester_subject_option?.subject ??
    s.programme_semester_subject?.subject ??
    null
  if (sub) return `${sub.code} · ${sub.name}`
  return s.programme_semester_subject?.placeholder_name ?? '—'
}

function sessionTeacherLabel(s: InchargeSession): string {
  const eff = s.effective_employee
  if (!eff) return '—'
  return eff.emp_display_name
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

/**
 * Schedule Management for the attendance incharge. Week/day-of operations:
 * pick a group + week, see the day-by-day sessions, cancel a class or
 * assign an alternate teacher, and publish the chosen week from a template.
 *
 * Sibling page [[incharge-templates.tsx]] owns template configuration
 * (bell schedule, courses, grid cells).
 */
export default function EmployeeInchargeSchedulePage() {
  const access = useScreenAccess('timetable.incharge.schedule.manage')

  const [groups, setGroups] = useState<InchargeGroupSummary[] | null>(null)
  const [groupsError, setGroupsError] = useState<string | null>(null)
  const [activeGroupId, setActiveGroupId] = useState<number | null>(null)

  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()))
  const [anchor, setAnchor] = useState<Date>(() => startOfWeek(new Date()))
  // Bumped after a successful publish so the SessionsBlock below refetches
  // its rows to surface the just-seeded sessions.
  const [refreshKey, setRefreshKey] = useState(0)

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
          err instanceof Error ? err.message : 'Could not load your groups.',
        )
      })
    return () => {
      cancelled = true
    }
    // Run once on mount — initial group is seeded inside the success branch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!access) return <NoAccessEmptyState />
  if (!access.actions.includes('view')) {
    return <NoScopeEmptyState attributeLabel="view permission" />
  }

  const canEdit = access.actions.includes('edit')
  const canPublish = access.actions.includes('publish')
  const activeGroup =
    groups && activeGroupId !== null
      ? groups.find((g) => g.id === activeGroupId) ?? null
      : null

  return (
    <section className="space-y-5">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <CalendarRange className="size-6 text-icon-blue" />
          Schedule management
        </h1>
        <p className="text-sm text-muted-foreground">
          Pick a group and a week — publish sessions, cancel a class, or
          assign an alternate teacher. Template configuration lives on the
          Timetable Management screen.
        </p>
        {!canEdit && !canPublish ? (
          <p className="text-xs text-warning">
            View-only — editing and publishing are disabled on your role.
          </p>
        ) : null}
      </header>

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
        <GroupChips
          groups={groups}
          activeGroupId={activeGroupId}
          onSelect={setActiveGroupId}
        />
      )}

      {activeGroup ? (
        <>
          <GroupHeader group={activeGroup} />

          <WeekCard
            group={activeGroup}
            anchor={anchor}
            weekStart={weekStart}
            canPublish={canPublish}
            onPrev={() => setAnchor(addDays(anchor, -7 * WEEKS_IN_STRIP))}
            onNext={() => setAnchor(addDays(anchor, 7 * WEEKS_IN_STRIP))}
            onThisWeek={() => {
              const w = startOfWeek(new Date())
              setAnchor(w)
              setWeekStart(w)
            }}
            onSelectWeek={(d) => setWeekStart(d)}
            onPublished={() => setRefreshKey((k) => k + 1)}
          />

          <SessionsBlock
            group={activeGroup}
            weekStart={weekStart}
            canEdit={canEdit}
            refreshKey={refreshKey}
          />
        </>
      ) : null}
    </section>
  )
}

// ---------------------------------------------------------------------------
// Group picker + header
// ---------------------------------------------------------------------------

function GroupChips({
  groups,
  activeGroupId,
  onSelect,
}: {
  groups: InchargeGroupSummary[]
  activeGroupId: number | null
  onSelect: (id: number) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {groups.map((g) => {
        const selected = activeGroupId === g.id
        return (
          <button
            key={g.id}
            type="button"
            aria-pressed={selected}
            onClick={() => onSelect(g.id)}
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
              {g.programme.department?.code
                ? `${g.programme.department.code} · `
                : ''}
              {g.programme.code} · {g.admission_year.display_year}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function GroupHeader({ group }: { group: InchargeGroupSummary }) {
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
      </div>
    </header>
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

// ---------------------------------------------------------------------------
// Week card — strip of weeks PLUS the actions for the selected week
// (preview, publish, template picker). Combining both in one card means
// the strip's per-week summary chips and the publish controls share the
// same template fetch, and the action buttons stay visually anchored to
// the week they apply to.
// ---------------------------------------------------------------------------

function WeekCard({
  group,
  anchor,
  weekStart,
  canPublish,
  onPrev,
  onNext,
  onThisWeek,
  onSelectWeek,
  onPublished,
}: {
  group: InchargeGroupSummary
  anchor: Date
  weekStart: Date
  canPublish: boolean
  onPrev: () => void
  onNext: () => void
  onThisWeek: () => void
  onSelectWeek: (d: Date) => void
  /** Called after a successful publish so the parent can refetch the
   *  session list with the newly seeded rows. */
  onPublished: () => void
}) {
  const groupId = group.id

  const stripWeeks = useMemo(() => {
    const weeks: { start: Date; key: string }[] = []
    for (let i = 0; i < WEEKS_IN_STRIP; i += 1) {
      const start = addDays(anchor, i * 7)
      weeks.push({ start, key: toIsoDate(start) })
    }
    return weeks
  }, [anchor])

  // Scope templates to the group's ongoing programme semester — a group
  // accrues templates across semesters, but publishing from a past sem's
  // template would seed sessions tied to that past PS, which is almost
  // always wrong. We resolve the ongoing PS first, then fetch templates
  // filtered by it. Fallback when no PS is ongoing (between batches): the
  // most recent semester.
  const [activePs, setActivePs] = useState<LookupProgrammeSemester | null>(null)
  const [psError, setPsError] = useState<string | null>(null)
  const [templates, setTemplates] = useState<
    IncharqeTimetableSummary[] | null
  >(null)
  const [templatesError, setTemplatesError] = useState<string | null>(null)
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(
    null,
  )

  const [summaries, setSummaries] = useState<WeekSummary[] | null>(null)
  const [summariesError, setSummariesError] = useState<string | null>(null)

  // Bumped to force a templates + summaries refetch after a publish
  // (which can change has_any / counts on the strip chips).
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    setActivePs(null)
    setPsError(null)
    setTemplates(null)
    setTemplatesError(null)
    setSelectedTemplateId(null)
    void (async () => {
      try {
        const psList = await fetchInchargeProgrammeSemesters(groupId)
        if (cancelled) return
        if (psList.length === 0) {
          setActivePs(null)
          setTemplates([])
          return
        }
        const ongoing = psList.find((p) => p.status === 'ongoing')
        const ps =
          ongoing ??
          [...psList].sort(
            (a, b) => b.semester.sem_number - a.semester.sem_number,
          )[0]
        setActivePs(ps)
        const rows = await fetchInchargeTimetables(ps.id, groupId)
        if (cancelled) return
        setTemplates(rows)
        const def = rows.find((t) => t.is_default) ?? rows[0] ?? null
        setSelectedTemplateId(def?.id ?? null)
      } catch (err) {
        if (cancelled) return
        const msg =
          err instanceof ApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Couldn't load templates for this group."
        // Distinguish between PS-list failure and templates failure so
        // the UI banner is useful — we can't tell from the catch which
        // step failed, so attribute it to whichever state is still empty.
        if (activePs === null) setPsError(msg)
        else setTemplatesError(msg)
      }
    })()
    return () => {
      cancelled = true
    }
    // activePs is intentionally NOT in deps — it's set inside this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, reloadKey])

  // Strip summaries are pulled from whichever template is currently
  // selected (defaults to group default). If the user switches templates,
  // the strip re-summarises against that one — matching what publishing
  // from that template would surface.
  useEffect(() => {
    let cancelled = false
    setSummaries(null)
    setSummariesError(null)
    if (selectedTemplateId === null) {
      setSummaries([])
      return () => {
        cancelled = true
      }
    }
    fetchInchargeWeekSummaries(
      selectedTemplateId,
      stripWeeks.map((w) => w.key),
    )
      .then((rows) => {
        if (cancelled) return
        setSummaries(rows)
      })
      .catch((err) => {
        if (cancelled) return
        setSummariesError(
          err instanceof ApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Couldn't load week summaries.",
        )
      })
    return () => {
      cancelled = true
    }
  }, [selectedTemplateId, stripWeeks, reloadKey])

  // Per-chip Publish opens a modal targeting one specific week — see
  // [[PublishWeekDialog]]. The week being published is tracked here so
  // the dialog can be opened from any chip without losing state.
  const [publishWeekStart, setPublishWeekStart] = useState<Date | null>(null)

  const hasPublishableTemplates =
    templates !== null && templates.length > 0 && canPublish

  // Strip is "loading" whenever templates exist but per-week summaries
  // are still in flight — which includes the initial fetch AND every
  // Prev/Next/This-week click (the effect resets summaries to null on
  // anchor change). When there are no templates at all, there's nothing
  // to summarise, so don't shimmer.
  const stripLoading =
    templates !== null && templates.length > 0 && summaries === null

  return (
    <Card className="space-y-4 p-5 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CalendarRange className="size-5 text-icon-blue" />
          <h2 className="text-base font-semibold">Week</h2>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            aria-label="Earlier weeks"
            onClick={onPrev}
            disabled={stripLoading}
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onThisWeek}
            disabled={stripLoading}
          >
            This week
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label="Later weeks"
            onClick={onNext}
            disabled={stripLoading}
          >
            <ChevronRight />
          </Button>
        </div>
      </header>

      {psError ? (
        <p className="flex items-center gap-1.5 text-sm text-destructive">
          <CircleAlert className="size-4" />
          {psError}
        </p>
      ) : null}
      {templatesError ? (
        <p className="flex items-center gap-1.5 text-sm text-destructive">
          <CircleAlert className="size-4" />
          {templatesError}
        </p>
      ) : null}
      {summariesError ? (
        <p className="flex items-center gap-1.5 text-xs text-destructive">
          <CircleAlert className="size-3.5" />
          {summariesError}
        </p>
      ) : null}
      {activePs ? (
        <p className="text-xs text-muted-foreground">
          Showing templates for{' '}
          <span className="font-medium text-foreground">
            Semester {activePs.semester.sem_number}
          </span>
          {activePs.status === 'ongoing' ? (
            <span className="ml-1 rounded-full bg-success/15 px-1.5 py-0.5 text-[10px] font-semibold text-success">
              Ongoing
            </span>
          ) : (
            <span className="ml-1 text-[11px] italic">
              (no semester is currently ongoing for this batch — showing the
              most recent)
            </span>
          )}
          .
        </p>
      ) : null}
      {activePs === null && templates !== null && templates.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No active programme semesters for this group's batch yet — ask an
          admin to activate one.
        </p>
      ) : null}
      {activePs !== null && templates !== null && templates.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No templates yet for this semester — create one on Timetable
          Management before publishing a week.
        </p>
      ) : null}

      {/* Strip of week chips. While summaries are loading (initial fetch
       *  OR after a Prev/Next/This-week click), render shimmer chips so
       *  the navigation reads as "fetching the new window" instead of
       *  flashing stale-then-empty counts. */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {stripLoading
          ? stripWeeks.map((w) => <WeekChipSkeleton key={w.key} />)
          : stripWeeks.map((w) => {
              const summary = summaries?.find((s) => s.week_start === w.key)
              const selected = toIsoDate(weekStart) === w.key
              const isCurrentWeek =
                w.key === toIsoDate(startOfWeek(new Date()))
              const totalSessions = summary
                ? summary.scheduled +
                  summary.completed +
                  summary.cancelled +
                  summary.rescheduled
                : 0
              return (
                <div
                  key={w.key}
                  role="button"
                  tabIndex={0}
                  aria-pressed={selected}
                  onClick={() => onSelectWeek(w.start)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onSelectWeek(w.start)
                    }
                  }}
                  className={cn(
                    'flex flex-col gap-2 rounded-lg border px-3 py-2 text-left transition-colors',
                    'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    selected
                      ? 'border-primary bg-primary/10'
                      : 'bg-card hover:bg-accent',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium tabular-nums">
                          {formatWeekRange(
                            w.key,
                            toIsoDate(addDays(w.start, 6)),
                          )}
                        </span>
                        {isCurrentWeek ? (
                          <Badge variant="secondary">Now</Badge>
                        ) : null}
                      </div>
                      {summary?.has_any ? (
                        <p className="text-[11px] tabular-nums text-muted-foreground">
                          {totalSessions} session
                          {totalSessions === 1 ? '' : 's'}
                          {summary.cancelled > 0
                            ? ` · ${summary.cancelled} cancelled`
                            : ''}
                        </p>
                      ) : (
                        <p className="text-[11px] text-muted-foreground">
                          Not published
                        </p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant={summary?.has_any ? 'outline' : 'default'}
                      disabled={!hasPublishableTemplates}
                      onClick={(e) => {
                        e.stopPropagation()
                        setPublishWeekStart(w.start)
                      }}
                      // Stop space/enter on the button from bubbling up to
                      // the chip's keydown handler (which fires a select).
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      <CalendarCheck />
                      {summary?.has_any ? 'Republish' : 'Publish'}
                    </Button>
                  </div>
                </div>
              )
            })}
      </div>

      <PublishWeekDialog
        open={publishWeekStart !== null}
        group={group}
        weekStart={publishWeekStart}
        activePs={activePs}
        templates={templates}
        canPublish={canPublish}
        onClose={() => setPublishWeekStart(null)}
        onPublished={() => {
          // Refresh strip summaries + tell the page to refetch sessions.
          setReloadKey((k) => k + 1)
          onPublished()
        }}
      />
    </Card>
  )
}

/**
 * Placeholder chip matching the real chip's layout (week-range line,
 * sub-line, action button on the right) so a strip refresh reads as one
 * coherent loading state instead of mismatched columns.
 */
function WeekChipSkeleton() {
  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-card px-3 py-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="shimmer h-4 w-28 rounded bg-muted/60" />
          <div className="shimmer h-3 w-20 rounded bg-muted/60" />
        </div>
        <div className="shimmer h-8 w-20 rounded bg-muted/60" />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Publish-week dialog — opened from a per-chip Publish button. Shows the
// group + semester context, runs a preview against the chosen template,
// then lets the user publish. Auto-runs preview on open / template
// switch so the user can read what's about to happen without an extra
// click.
// ---------------------------------------------------------------------------

function PublishWeekDialog({
  open,
  group,
  weekStart,
  activePs,
  templates,
  canPublish,
  onClose,
  onPublished,
}: {
  open: boolean
  group: InchargeGroupSummary
  /** Null when the modal is closed — we still keep the component mounted
   *  so the closing transition reads as a slide-out instead of a pop. */
  weekStart: Date | null
  activePs: LookupProgrammeSemester | null
  templates: IncharqeTimetableSummary[] | null
  canPublish: boolean
  onClose: () => void
  onPublished: () => void
}) {
  // Seed the template selection from the templates list whenever the
  // dialog (re)opens — defaulting to the group default, falling back to
  // the first one. Reset on close so a stale id never leaks between
  // weeks.
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(
    null,
  )
  // Days the user wants to publish, as ISO weekday numbers (1=Mon..7=Sun).
  // Smart-preseeded from the chosen template's `working_days` so the
  // default "Publish" still does the natural thing for a Mon–Fri template
  // (selects Mon–Fri only) without requiring the user to deselect
  // weekends. Empty set blocks the publish button.
  const [selectedDays, setSelectedDays] = useState<Set<number>>(
    () => new Set(),
  )
  const [preview, setPreview] = useState<PreviewResult | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [publishing, setPublishing] = useState(false)
  const [publishError, setPublishError] = useState<string | null>(null)
  // Publish-confirm modal + whether to notify the group's students (default on).
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [notify, setNotify] = useState(true)
  // Change totals reported by the diff — lets us skip the notification when a
  // (re)publish wouldn't actually change anything.
  const [diffTotals, setDiffTotals] = useState<DiffTotals | null>(null)
  const reportTotals = useCallback((t: DiffTotals) => setDiffTotals(t), [])
  const hasChanges =
    diffTotals === null
      ? true
      : diffTotals.added + diffTotals.removed + diffTotals.changed > 0
  // Preview rows the user chose not to publish ("Don't add"), keyed by slot.
  const [excluded, setExcluded] = useState<Map<string, PublishExcludeKey>>(
    () => new Map(),
  )
  const excludedKeys = useMemo(() => new Set(excluded.keys()), [excluded])
  const toggleExclude = useCallback((n: PreviewSessionT) => {
    const key = previewExcludeKey(n)
    const id = excludeKeyStr(key)
    setExcluded((prev) => {
      const next = new Map(prev)
      if (next.has(id)) next.delete(id)
      else next.set(id, key)
      return next
    })
  }, [])
  // Current (pre-publish) sessions for the window — drives the diff's
  // "what exists now / will be removed" side. Refetched on every change.
  const [currentSessions, setCurrentSessions] = useState<
    InchargeSession[] | null
  >(null)
  // Ongoing semester + bell schedule + subject lookup, for the inline edit form.
  const [ctx, setCtx] = useState<OngoingContext | null>(null)
  const [rescheduleSession, setRescheduleSession] =
    useState<InchargeSession | null>(null)
  // Bumped after any inline action / publish to re-run preview + current fetch.
  const [refreshTick, setRefreshTick] = useState(0)
  const refreshDiff = useCallback(() => setRefreshTick((t) => t + 1), [])

  useEffect(() => {
    if (!open) return
    setPublishError(null)
    setPreview(null)
    setPreviewError(null)
    setCurrentSessions(null)
    if (templates && templates.length > 0) {
      const def = templates.find((t) => t.is_default) ?? templates[0]
      setSelectedTemplateId(def.id)
    } else {
      setSelectedTemplateId(null)
    }
  }, [open, templates])

  // Ongoing context (for the diff's edit form) — loaded once per open.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    setCtx(null)
    resolveOngoingContext(group.id)
      .then((c) => {
        if (!cancelled) setCtx(c)
      })
      .catch(() => {
        if (!cancelled) setCtx(null)
      })
    return () => {
      cancelled = true
    }
  }, [open, group.id])

  // Whenever the chosen template changes (or the dialog opens), reseed
  // the day selection from THAT template's working_days. This way
  // switching from a Mon–Sat template to a Mon–Fri one auto-drops Sat
  // — the user can still re-add it manually, but the default tracks
  // what the template actually defines.
  const selectedTemplate = useMemo(
    () =>
      templates?.find((t) => t.id === selectedTemplateId) ?? null,
    [templates, selectedTemplateId],
  )
  const templateWorkingDays = useMemo(
    () => new Set(selectedTemplate?.working_days ?? []),
    [selectedTemplate],
  )
  useEffect(() => {
    if (!open) return
    setSelectedDays(new Set(selectedTemplate?.working_days ?? []))
  }, [open, selectedTemplate])

  const from = weekStart ? toIsoDate(weekStart) : null
  const to = weekStart ? toIsoDate(addDays(weekStart, 6)) : null

  // Serialise the day selection to a stable, sorted array — both for the
  // API payload and for use as a useEffect dependency (a Set instance
  // would change identity every render, retriggering the preview every
  // time React re-runs the parent).
  const daysPayload = useMemo(
    () => Array.from(selectedDays).sort((a, b) => a - b),
    [selectedDays],
  )
  const daysKey = daysPayload.join(',')

  // Auto-run preview when the dialog opens (and on template / day-set
  // switch). The preview endpoint is read-only and pretty cheap; saving
  // the user a click means the modal reads as "here's what'll happen"
  // by default. When no days are selected we skip the network round-trip
  // and just clear the preview — there's nothing useful to show.
  useEffect(() => {
    if (!open || selectedTemplateId === null || from === null || to === null) {
      return
    }
    if (daysPayload.length === 0) {
      setPreview(null)
      setPreviewLoading(false)
      return
    }
    let cancelled = false
    setPreviewLoading(true)
    setPreviewError(null)
    setPreview(null)
    // A fresh preview invalidates prior "don't add" choices + change totals.
    setExcluded(new Map())
    setDiffTotals(null)
    previewInchargeWeek(selectedTemplateId, {
      from,
      to,
      days_of_week: daysPayload,
    })
      .then((res) => {
        if (cancelled) return
        setPreview(res)
      })
      .catch((err) => {
        if (cancelled) return
        setPreviewError(
          err instanceof ApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Couldn't preview the week.",
        )
      })
      .finally(() => {
        if (cancelled) return
        setPreviewLoading(false)
      })
    return () => {
      cancelled = true
    }
    // daysKey stands in for daysPayload — same data, primitive identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, selectedTemplateId, from, to, daysKey, refreshTick])

  // Current sessions for the window (filtered to the selected weekdays) — the
  // "now" side of the diff. Refetched alongside the preview.
  useEffect(() => {
    if (!open || from === null || to === null) return
    let cancelled = false
    setCurrentSessions(null)
    fetchInchargeSessions({ attendance_group_id: group.id, from, to })
      .then((rows) => {
        if (cancelled) return
        const dows = new Set(daysPayload)
        setCurrentSessions(
          dows.size === 0
            ? rows
            : rows.filter((r) => dows.has(r.day_of_week)),
        )
      })
      .catch(() => {
        if (!cancelled) setCurrentSessions([])
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, from, to, daysKey, refreshTick, group.id])

  async function runPublish() {
    if (selectedTemplateId === null || from === null || to === null) return
    if (daysPayload.length === 0) return
    setPublishing(true)
    setPublishError(null)
    try {
      await publishInchargeWeek(selectedTemplateId, {
        from,
        to,
        days_of_week: daysPayload,
        exclude: excluded.size > 0 ? Array.from(excluded.values()) : undefined,
        // Don't ping students if the (re)publish changes nothing, even if the
        // box is ticked.
        notify: notify && hasChanges,
      })
      // Done — refresh the parent strip + sessions and close. Fine-tuning of
      // individual classes happens in the week view / day editor.
      setConfirmOpen(false)
      onPublished()
      onClose()
    } catch (err) {
      setPublishError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Couldn't publish the week.",
      )
    } finally {
      setPublishing(false)
    }
  }

  function toggleDay(dow: number) {
    setSelectedDays((prev) => {
      const next = new Set(prev)
      if (next.has(dow)) next.delete(dow)
      else next.add(dow)
      return next
    })
  }

  const hasTemplates = (templates ?? []).length > 0
  const weekLabel =
    from !== null && to !== null ? formatWeekRange(from, to) : ''
  const isPartialWeek =
    templateWorkingDays.size > 0 &&
    selectedDays.size > 0 &&
    selectedDays.size < templateWorkingDays.size

  return (
    <>
    <Sheet open={open} onOpenChange={(v) => (!v ? onClose() : null)}>
      <SheetContent
        side="right"
        // Fill the viewport minus a small gutter so the preview matrix
        // never needs horizontal scroll — the matrix is the whole point
        // of this modal.
        className="w-full !max-w-none sm:w-[calc(100vw-2rem)]"
      >
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <CalendarCheck className="size-5 text-icon-emerald" />
            Publish week
          </SheetTitle>
          <SheetDescription>{weekLabel}</SheetDescription>
        </SheetHeader>

        <div className="scrollbar-themed flex-1 overflow-y-auto px-4 py-2">
          {/* Group + semester context */}
          <Card className="space-y-1 p-3 text-xs">
            <div className="flex flex-wrap items-center gap-1.5">
              <Users className="size-4 text-icon-cyan" />
              <span className="font-medium">{group.name}</span>
              <Badge variant="secondary">{group.code}</Badge>
            </div>
            <p className="text-muted-foreground">
              {group.programme.display_name} · Batch{' '}
              {group.admission_year.display_year}
            </p>
            {activePs ? (
              <p className="text-muted-foreground">
                Semester {activePs.semester.sem_number}
                {activePs.status === 'ongoing' ? (
                  <span className="ml-1 rounded-full bg-success/15 px-1.5 py-0.5 text-[10px] font-semibold text-success">
                    Ongoing
                  </span>
                ) : null}
              </p>
            ) : null}
          </Card>

          {/* Template picker */}
          {!hasTemplates ? (
            <Card className="mt-3 p-3 text-sm text-muted-foreground">
              No templates for this semester. Create one on Timetable
              Management before publishing.
            </Card>
          ) : templates!.length > 1 ? (
            <div className="mt-3 space-y-1.5">
              <Label>Template</Label>
              <div className="flex flex-wrap gap-2">
                {templates!.map((t) => {
                  const selected = selectedTemplateId === t.id
                  return (
                    <button
                      key={t.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setSelectedTemplateId(t.id)}
                      className={cn(
                        'flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors',
                        selected
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'bg-card hover:bg-accent hover:text-accent-foreground',
                      )}
                    >
                      <span>{t.name}</span>
                      {t.is_default ? (
                        <span
                          className={cn(
                            'rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                            selected
                              ? 'bg-primary-foreground/20 text-primary-foreground'
                              : 'bg-success/15 text-success',
                          )}
                        >
                          Default
                        </span>
                      ) : null}
                    </button>
                  )
                })}
              </div>
            </div>
          ) : (
            <p className="mt-3 text-xs text-muted-foreground">
              Publishing from{' '}
              <span className="font-medium text-foreground">
                {templates![0].name}
              </span>
              {templates![0].is_default ? ' (default)' : ''}.
            </p>
          )}

          {/* Day picker — defaults to the template's working_days. Days
           *  the template doesn't define are shown as disabled chips so
           *  the user understands why nothing would happen there. */}
          {hasTemplates ? (
            <div className="mt-3 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label>Days to publish</Label>
                <div className="flex items-center gap-1 text-[11px]">
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedDays(
                        new Set(selectedTemplate?.working_days ?? []),
                      )
                    }
                    className="rounded-md px-1.5 py-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    All working days
                  </button>
                  <span className="text-muted-foreground">·</span>
                  <button
                    type="button"
                    onClick={() => setSelectedDays(new Set())}
                    className="rounded-md px-1.5 py-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    None
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[1, 2, 3, 4, 5, 6, 7].map((dow) => {
                  const inTemplate = templateWorkingDays.has(dow)
                  const selected = selectedDays.has(dow)
                  return (
                    <button
                      key={dow}
                      type="button"
                      aria-pressed={selected}
                      disabled={!inTemplate}
                      onClick={() => toggleDay(dow)}
                      title={
                        inTemplate
                          ? DAY_LABELS[dow].long
                          : `Template has no classes on ${DAY_LABELS[dow].long}`
                      }
                      className={cn(
                        'min-w-[3rem] rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors',
                        !inTemplate &&
                          'cursor-not-allowed opacity-40 hover:bg-card',
                        inTemplate && selected
                          ? 'border-primary bg-primary text-primary-foreground'
                          : inTemplate
                            ? 'bg-card hover:bg-accent hover:text-accent-foreground'
                            : 'bg-card',
                      )}
                    >
                      {DAY_LABELS[dow].short}
                    </button>
                  )
                })}
              </div>
              {selectedDays.size === 0 ? (
                <p className="text-[11px] text-warning">
                  Pick at least one day to publish.
                </p>
              ) : isPartialWeek ? (
                <p className="text-[11px] text-muted-foreground">
                  Partial publish — only{' '}
                  <span className="font-medium text-foreground">
                    {selectedDays.size}
                  </span>{' '}
                  of {templateWorkingDays.size} working days will be
                  (re)seeded. The other days stay as they are.
                </p>
              ) : null}
            </div>
          ) : null}

          {/* Preview */}
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label className="flex items-center gap-1.5">
                <Eye className="size-3.5 text-muted-foreground" />
                Preview
              </Label>
              {previewLoading ? (
                <span className="text-[11px] text-muted-foreground">
                  <Loader2 className="mr-1 inline size-3 animate-spin" />
                  Loading…
                </span>
              ) : null}
            </div>
            {previewError ? (
              <p className="flex items-center gap-1.5 text-sm text-destructive">
                <CircleAlert className="size-4" />
                {previewError}
              </p>
            ) : preview && weekStart ? (
              <RepublishDiff
                group={group}
                preview={preview}
                current={currentSessions}
                ctx={ctx}
                weekStart={weekStart}
                selectedDays={selectedDays}
                excluded={excludedKeys}
                onToggleExclude={toggleExclude}
                onChanged={refreshDiff}
                onReschedule={(s) => setRescheduleSession(s)}
                onTotals={reportTotals}
              />
            ) : !hasTemplates ? null : !previewLoading ? (
              <p className="text-xs text-muted-foreground">
                Pick a template above to see what would be published.
              </p>
            ) : null}
          </div>

          {/* Publish error — success closes the modal so there's no
           *  inline success card; the strip below reflects the new
           *  counts. */}
          {publishError ? (
            <p className="mt-3 flex items-center gap-1.5 text-sm text-destructive">
              <CircleAlert className="size-4" />
              {publishError}
            </p>
          ) : null}
        </div>

        <SheetFooter>
          <Button
            onClick={() => {
              setPublishError(null)
              setConfirmOpen(true)
            }}
            disabled={
              !canPublish ||
              !hasTemplates ||
              selectedTemplateId === null ||
              selectedDays.size === 0 ||
              publishing ||
              previewLoading
            }
          >
            <CalendarCheck />
            {isPartialWeek
              ? `Publish ${selectedDays.size} day${selectedDays.size === 1 ? '' : 's'}`
              : 'Publish week'}
          </Button>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={publishing}
          >
            Cancel
          </Button>
        </SheetFooter>
      </SheetContent>

      {/* Publish confirm — final step where the incharge chooses whether to
          notify students (on by default). */}
      <DialogPrimitive.Root
        open={confirmOpen}
        onOpenChange={(v) => {
          if (!publishing) setConfirmOpen(v)
        }}
      >
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-[60] bg-background/80 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-[60] w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background p-5 shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95">
            <DialogPrimitive.Title className="flex items-center gap-2 text-base font-semibold">
              <CalendarCheck className="size-5 text-icon-emerald" />
              {isPartialWeek
                ? `Publish ${selectedDays.size} day${selectedDays.size === 1 ? '' : 's'}?`
                : 'Publish this week?'}
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="mt-1 text-sm text-muted-foreground">
              {weekLabel} will be published to {group.name}
              {group.member_count > 0
                ? ` · ${group.member_count} student${group.member_count === 1 ? '' : 's'}`
                : ''}
              .
            </DialogPrimitive.Description>

            <label
              className={cn(
                'mt-4 flex items-start gap-2.5 rounded-md border p-3',
                hasChanges
                  ? 'cursor-pointer hover:bg-accent/40'
                  : 'cursor-not-allowed opacity-60',
              )}
            >
              <input
                type="checkbox"
                checked={notify && hasChanges}
                disabled={!hasChanges}
                onChange={(e) => setNotify(e.target.checked)}
                className="mt-0.5 size-4"
              />
              <span className="text-sm">
                <span className="font-medium">Notify students of the change</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {hasChanges
                    ? 'Sends an in-app + push alert that opens this week directly. Uncheck to publish silently.'
                    : "Nothing changes for students this time, so there's nothing to notify about."}
                </span>
              </span>
            </label>

            {publishError ? (
              <p className="mt-3 flex items-center gap-1.5 text-sm text-destructive">
                <CircleAlert className="size-4 shrink-0" />
                {publishError}
              </p>
            ) : null}

            <div className="mt-5 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setConfirmOpen(false)}
                disabled={publishing}
              >
                Cancel
              </Button>
              <Button onClick={() => void runPublish()} disabled={publishing}>
                {publishing ? (
                  <>
                    <Loader2 className="animate-spin" />
                    Publishing…
                  </>
                ) : notify ? (
                  'Publish & notify'
                ) : (
                  'Publish'
                )}
              </Button>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </Sheet>

    <RescheduleSheet
      open={rescheduleSession !== null}
      group={group}
      session={rescheduleSession}
      onClose={() => setRescheduleSession(null)}
      onMoved={() => {
        setRescheduleSession(null)
        refreshDiff()
      }}
    />
    </>
  )
}

// ---------------------------------------------------------------------------
// Sessions in the selected week — periods × days matrix so the entire
// week stays visible at once. Each cell is a click target: single
// sessions open a dropdown of actions in place; slot cohorts open a
// side sheet listing every option with its own per-option actions.
// ---------------------------------------------------------------------------

function SessionsBlock({
  group,
  weekStart,
  canEdit,
  refreshKey,
}: {
  group: InchargeGroupSummary
  weekStart: Date
  canEdit: boolean
  /** Bumped by the parent after a publish so we refetch the seeded sessions. */
  refreshKey: number
}) {
  const from = toIsoDate(weekStart)
  const to = toIsoDate(addDays(weekStart, 6))

  const [sessions, setSessions] = useState<InchargeSession[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actionRow, setActionRow] = useState<
    | { kind: 'cancel' | 'substitute'; session: InchargeSession }
    | null
  >(null)
  // Slot detail sheet — opened when a slot cohort cell is clicked.
  // Holds a snapshot of the rows so optimistic updates can re-render the
  // sheet without remounting it.
  const [slotDetail, setSlotDetail] = useState<SlotDetail | null>(null)
  // Day editor / reschedule surfaces.
  const [dayEditorDate, setDayEditorDate] = useState<string | null>(null)
  const [rescheduleSession, setRescheduleSession] =
    useState<InchargeSession | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const rows = await fetchInchargeSessions({
        attendance_group_id: group.id,
        from,
        to,
      })
      setSessions(rows)
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Couldn't load sessions for this week.",
      )
    } finally {
      setLoading(false)
    }
  }, [group.id, from, to])

  useEffect(() => {
    void load()
  }, [load, refreshKey])

  // Build the per-day column plan once per session-list change. Slot
  // cohorts (same date + period + parent PSS, multiple option children)
  // fold into a single cell that hosts N options.
  const week = useMemo(
    () => buildWeek(sessions ?? [], weekStart),
    [sessions, weekStart],
  )

  // Locally update a session row — also patches the slot sheet's
  // snapshot so the per-option status flips immediately without closing
  // the sheet.
  function applyUpdate(next: InchargeSession) {
    setSessions((prev) =>
      prev ? prev.map((r) => (r.id === next.id ? next : r)) : prev,
    )
    setSlotDetail((prev) =>
      prev
        ? { ...prev, rows: prev.rows.map((r) => (r.id === next.id ? next : r)) }
        : prev,
    )
  }

  async function uncancel(s: InchargeSession) {
    try {
      const next = await uncancelInchargeSession(s.id)
      applyUpdate(next)
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Couldn't re-open the session.",
      )
    }
  }

  const showEmptyState = sessions !== null && sessions.length === 0

  return (
    <Card className="overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/30 px-5 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          <CalendarRange className="size-4 text-muted-foreground" />
          Sessions · {formatWeekRange(from, to)}
        </h2>
        <div className="flex items-center gap-2">
          {canEdit ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const today = toIsoDate(new Date())
                setDayEditorDate(today >= from && today <= to ? today : from)
              }}
            >
              <CalendarPlus />
              Edit a day
            </Button>
          ) : null}
          <Button
            variant="outline"
            size="sm"
            onClick={() => void load()}
            disabled={loading}
          >
            {loading ? <Loader2 className="animate-spin" /> : <RefreshCw />}
            Refresh
          </Button>
        </div>
      </header>

      {error ? (
        <div className="border-b bg-destructive/10 px-5 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {loading && sessions === null ? (
        <div className="space-y-2 p-5">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="shimmer h-14 rounded bg-muted/60" />
          ))}
        </div>
      ) : showEmptyState ? (
        <EmptyWeekState />
      ) : (
        <SessionsWeek
          week={week}
          canEdit={canEdit}
          onCancel={(s) => setActionRow({ kind: 'cancel', session: s })}
          onSubstitute={(s) => setActionRow({ kind: 'substitute', session: s })}
          onUncancel={(s) => void uncancel(s)}
          onReschedule={(s) => setRescheduleSession(s)}
          onEditDay={(iso) => setDayEditorDate(iso)}
          onOpenSlot={(detail) => setSlotDetail(detail)}
        />
      )}

      <CancelSessionSheet
        open={actionRow?.kind === 'cancel'}
        session={
          actionRow?.kind === 'cancel' ? actionRow.session : null
        }
        onClose={() => setActionRow(null)}
        onCancelled={(next) => {
          applyUpdate(next)
          setActionRow(null)
        }}
      />
      <SubstituteSessionSheet
        open={actionRow?.kind === 'substitute'}
        session={
          actionRow?.kind === 'substitute' ? actionRow.session : null
        }
        onClose={() => setActionRow(null)}
        onSubstituted={(next) => {
          applyUpdate(next)
          setActionRow(null)
        }}
      />
      <SlotDetailSheet
        open={slotDetail !== null}
        detail={slotDetail}
        canEdit={canEdit}
        onClose={() => setSlotDetail(null)}
        onCancel={(s) => setActionRow({ kind: 'cancel', session: s })}
        onSubstitute={(s) => setActionRow({ kind: 'substitute', session: s })}
        onUncancel={(s) => void uncancel(s)}
        onReschedule={(s) => {
          setSlotDetail(null)
          setRescheduleSession(s)
        }}
      />
      <DayEditorSheet
        open={dayEditorDate !== null}
        group={group}
        date={dayEditorDate}
        onClose={() => setDayEditorDate(null)}
        onChanged={() => void load()}
        onReschedule={(s) => setRescheduleSession(s)}
      />
      <RescheduleSheet
        open={rescheduleSession !== null}
        group={group}
        session={rescheduleSession}
        onClose={() => setRescheduleSession(null)}
        onMoved={() => {
          setRescheduleSession(null)
          void load()
        }}
      />
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Shared session-editing helpers (day editor, reschedule, compare)
// ---------------------------------------------------------------------------

interface OngoingContext {
  ps: LookupProgrammeSemester
  /** All periods of the ongoing default template, sorted by position. */
  periods: TimetablePeriod[]
  pssLookup: LookupPss[]
}

// Resolve the group's ONGOING semester and its default bell schedule + subject
// lookup. Sessions are only writable in an ongoing semester, and a group may
// carry templates from past (completed) semesters — so scope to the ongoing
// one explicitly. Throws a user-facing Error when there's no ongoing semester
// or no template yet.
async function resolveOngoingContext(groupId: number): Promise<OngoingContext> {
  const psList = await fetchInchargeProgrammeSemesters(groupId)
  const ongoing = psList.find((p) => p.status === 'ongoing')
  if (!ongoing) {
    throw new Error(
      'This group has no ongoing semester — classes can only be added or edited while a semester is ongoing.',
    )
  }
  const templates = await fetchInchargeTimetables(ongoing.id, groupId)
  if (templates.length === 0) {
    throw new Error(
      'This semester has no timetable template yet — create one first so the day has a bell schedule.',
    )
  }
  const def = templates.find((t) => t.is_default) ?? templates[0]
  const [full, pssLookup] = await Promise.all([
    fetchInchargeTimetable(def.id),
    fetchInchargePssLookup(ongoing.id, groupId),
  ])
  const periods = [...full.periods].sort((a, b) => a.position - b.position)
  return { ps: ongoing, periods, pssLookup }
}

// Regular (non-elective), active subjects — what a one-off add/edit can target.
// Elective slot rows (subject_id null) are cohort-allocated, not single classes.
function regularSubjects(pssLookup: LookupPss[]): LookupPss[] {
  return pssLookup.filter((s) => s.subject_id !== null && s.is_active)
}

// Primary faculty first, then borrowable alternates — deduped by employee.
function facultyForPss(
  pss: LookupPss | null,
): { id: number; label: string }[] {
  if (!pss) return []
  const seen = new Map<number, { id: number; label: string }>()
  for (const f of pss.faculty ?? []) {
    seen.set(f.employee_id, {
      id: f.employee_id,
      label: f.employee.emp_display_name,
    })
  }
  for (const f of pss.alternate_faculty ?? []) {
    if (!seen.has(f.employee_id)) {
      seen.set(f.employee_id, {
        id: f.employee_id,
        label: `${f.employee.emp_display_name}${
          f.attendance_group
            ? ` (${f.attendance_group.code ?? f.attendance_group.name})`
            : ''
        }`,
      })
    }
  }
  return Array.from(seen.values())
}

type AxisPeriodLike = {
  start_time: string
  end_time: string
  label: string
  is_break: boolean
}

interface AxisRow {
  key: string // HH:MM
  start: string
  end: string
  label: string
}

// Merge several period lists onto one clock-time axis so days/weeks built from
// different templates (different period times) line up by actual start time.
// A period present on only one side leaves the other side blank on that row.
function mergeTimeAxis(lists: AxisPeriodLike[][]): AxisRow[] {
  const byKey = new Map<string, AxisRow>()
  for (const list of lists) {
    for (const p of list) {
      if (p.is_break) continue
      const key = p.start_time.slice(0, 5)
      if (!byKey.has(key)) {
        byKey.set(key, {
          key,
          start: p.start_time,
          end: p.end_time,
          label: p.label,
        })
      }
    }
  }
  return Array.from(byKey.values()).sort((a, b) =>
    a.start.localeCompare(b.start),
  )
}

function isoDow(iso: string): number {
  const d = new Date(`${iso}T00:00:00`).getDay()
  return d === 0 ? 7 : d
}

// Two HH:MM(:SS) ranges overlap if each starts before the other ends. String
// comparison works because the times are zero-padded.
function timeOverlaps(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  return aStart < bEnd && bStart < aEnd
}

// ---------------------------------------------------------------------------
// Day editor — edit a whole day at once: every teaching period of the group's
// ongoing bell schedule, with the class on it (add / edit / move / cancel) or
// an empty slot to fill. Replaces the one-at-a-time "Add a class" flow.
// ---------------------------------------------------------------------------

function DayEditorSheet({
  open,
  group,
  date,
  onClose,
  onChanged,
  onReschedule,
}: {
  open: boolean
  group: InchargeGroupSummary
  date: string | null
  onClose: () => void
  onChanged: () => void
  onReschedule: (s: InchargeSession) => void
}) {
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [ctx, setCtx] = useState<OngoingContext | null>(null)
  // This day's sessions — fetched directly (not from the parent's week list)
  // so the ids are always current and survive a republish that re-seeds them.
  const [daySessions, setDaySessions] = useState<InchargeSession[] | null>(null)
  const [tick, setTick] = useState(0)
  const refresh = useCallback(() => setTick((t) => t + 1), [])
  const [busyId, setBusyId] = useState<number | 'new' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editor, setEditor] = useState<
    { periodId: number; sessionId: number | null } | null
  >(null)
  const [fPss, setFPss] = useState<number | null>(null)
  const [fTeacher, setFTeacher] = useState<number | null>(null)
  const [fRoom, setFRoom] = useState('')
  const [fNote, setFNote] = useState('')
  const [cancelId, setCancelId] = useState<number | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  // Holiday on this day (null = not a holiday) + the per-form acknowledgement
  // that unlocks saving when there are warnings (holiday / timing conflict).
  const [holiday, setHoliday] = useState<InchargeHoliday | null>(null)
  const [ackForm, setAckForm] = useState(false)

  useEffect(() => {
    if (!open || !date) return
    setEditor(null)
    setError(null)
    setCancelId(null)
    let cancelled = false
    setLoading(true)
    setLoadError(null)
    setCtx(null)
    resolveOngoingContext(group.id)
      .then((c) => {
        if (!cancelled) setCtx(c)
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadError(
            err instanceof Error ? err.message : 'Could not load the day.',
          )
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, date, group.id])

  // Fetch this day's sessions on open and after every action.
  useEffect(() => {
    if (!open || !date) return
    let cancelled = false
    setDaySessions(null)
    fetchInchargeSessions({ attendance_group_id: group.id, from: date, to: date })
      .then((rows) => {
        if (!cancelled) setDaySessions(rows)
      })
      .catch(() => {
        if (!cancelled) setDaySessions([])
      })
    return () => {
      cancelled = true
    }
  }, [open, date, group.id, tick])

  // Is this day a holiday? (loaded once per open)
  useEffect(() => {
    if (!open || !date) return
    let cancelled = false
    setHoliday(null)
    fetchInchargeHolidays({ attendance_group_id: group.id, from: date, to: date })
      .then((hs) => {
        if (!cancelled) setHoliday(hs[0] ?? null)
      })
      .catch(() => {
        if (!cancelled) setHoliday(null)
      })
    return () => {
      cancelled = true
    }
  }, [open, date, group.id])

  const subjects = useMemo(
    () => (ctx ? regularSubjects(ctx.pssLookup) : []),
    [ctx],
  )
  const selectedPss = useMemo(
    () => subjects.find((s) => s.id === fPss) ?? null,
    [subjects, fPss],
  )
  const faculty = useMemo(() => facultyForPss(selectedPss), [selectedPss])
  // Row periods = the template's teaching periods UNION the periods actually
  // used by this day's sessions — so a class published from a non-default
  // template still shows on its own row instead of vanishing.
  const teachingPeriods = useMemo(() => {
    const m = new Map<number, TimetablePeriod>()
    for (const p of ctx?.periods ?? []) if (!p.is_break) m.set(p.id, p)
    for (const s of daySessions ?? []) {
      const tp = s.timetable_period
      if (tp && !tp.is_break && !m.has(tp.id)) {
        m.set(tp.id, tp as unknown as TimetablePeriod)
      }
    }
    return Array.from(m.values()).sort((a, b) =>
      a.start_time.localeCompare(b.start_time),
    )
  }, [ctx, daySessions])

  const singleByPeriod = useMemo(() => {
    const m = new Map<number, InchargeSession>()
    for (const s of daySessions ?? []) {
      if (s.programme_semester_subject_option_id !== null) continue
      const cur = m.get(s.timetable_period_id)
      if (!cur || (cur.status === 'cancelled' && s.status !== 'cancelled')) {
        m.set(s.timetable_period_id, s)
      }
    }
    return m
  }, [daySessions])
  const slotCountByPeriod = useMemo(() => {
    const m = new Map<number, number>()
    for (const s of daySessions ?? []) {
      if (s.programme_semester_subject_option_id === null) continue
      m.set(s.timetable_period_id, (m.get(s.timetable_period_id) ?? 0) + 1)
    }
    return m
  }, [daySessions])

  function openAdd(periodId: number) {
    setEditor({ periodId, sessionId: null })
    setFPss(null)
    setFTeacher(null)
    setFRoom('')
    setFNote('')
    setError(null)
    setAckForm(false)
  }
  function openEdit(s: InchargeSession) {
    setEditor({ periodId: s.timetable_period_id, sessionId: s.id })
    setFPss(s.programme_semester_subject_id ?? null)
    setFTeacher(s.effective_employee?.id ?? s.scheduled_employee?.id ?? null)
    setFRoom(s.room ?? '')
    setFNote(s.note ?? '')
    setError(null)
    setAckForm(false)
  }

  // Auto-pick the only teacher when a subject is chosen.
  useEffect(() => {
    if (editor) {
      setFTeacher((prev) => (faculty.length === 1 ? faculty[0].id : prev))
    }
  }, [faculty, editor])

  // Warnings for the open add/edit form: the day's holiday plus timing
  // conflicts with other classes in this period's clock-time window. Only a
  // brand-new class (Add) is blocked by a holiday — editing one that's already
  // here isn't re-scheduling it.
  const editorPeriod = useMemo(
    () => teachingPeriods.find((p) => p.id === editor?.periodId) ?? null,
    [teachingPeriods, editor],
  )
  const formConflicts = useMemo(() => {
    if (!editorPeriod) return [] as string[]
    const others = (daySessions ?? []).filter(
      (s) =>
        s.status !== 'cancelled' &&
        s.programme_semester_subject_option_id === null &&
        s.id !== editor?.sessionId,
    )
    const out: string[] = []
    for (const s of others) {
      const name = s.subject?.name ?? s.subject?.code ?? 'a class'
      if (s.timetable_period_id === editorPeriod.id) {
        out.push(`${name} is already in this period`)
        continue
      }
      const sp = s.timetable_period
      if (!sp) continue
      if (
        timeOverlaps(
          editorPeriod.start_time,
          editorPeriod.end_time,
          sp.start_time,
          sp.end_time,
        )
      ) {
        out.push(
          `Overlaps ${name} (${shortTime(sp.start_time)}–${shortTime(sp.end_time)})`,
        )
        if (fTeacher !== null && s.effective_employee?.id === fTeacher) {
          out.push('That teacher already teaches then')
        }
      }
    }
    return Array.from(new Set(out))
  }, [editorPeriod, daySessions, editor, fTeacher])
  const isAdd = editor?.sessionId === null
  const formWarnings = useMemo(() => {
    const w: string[] = []
    if (holiday && isAdd) w.push(`This day is a holiday — ${holiday.name}`)
    w.push(...formConflicts)
    return w
  }, [holiday, isAdd, formConflicts])

  const canSaveForm =
    !!ctx &&
    editor !== null &&
    fPss !== null &&
    fTeacher !== null &&
    busyId === null &&
    (formWarnings.length === 0 || ackForm)

  async function saveForm() {
    if (!ctx || !editor || fPss === null || fTeacher === null || !date) return
    setBusyId(editor.sessionId ?? 'new')
    setError(null)
    try {
      if (editor.sessionId === null) {
        await createInchargeAdHoc({
          session_date: date,
          programme_semester_id: ctx.ps.id,
          attendance_group_id: group.id,
          timetable_period_id: editor.periodId,
          programme_semester_subject_id: fPss,
          scheduled_employee_id: fTeacher,
          room: fRoom.trim() ? fRoom.trim() : null,
          note: fNote.trim() ? fNote.trim() : null,
          allow_holiday: holiday ? true : undefined,
        })
      } else {
        await editInchargeSession(editor.sessionId, {
          programme_semester_subject_id: fPss,
          scheduled_employee_id: fTeacher,
          room: fRoom.trim() ? fRoom.trim() : null,
          note: fNote.trim() ? fNote.trim() : null,
        })
      }
      setEditor(null)
      refresh()
      onChanged()
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Couldn't save the class.",
      )
    } finally {
      setBusyId(null)
    }
  }

  async function doCancel() {
    if (cancelId === null) return
    setBusyId(cancelId)
    setError(null)
    try {
      await cancelInchargeSession(cancelId, {
        reason: cancelReason.trim() || 'Cancelled by incharge',
      })
      setCancelId(null)
      setCancelReason('')
      refresh()
      onChanged()
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Couldn't cancel.",
      )
    } finally {
      setBusyId(null)
    }
  }

  async function doReopen(s: InchargeSession) {
    setBusyId(s.id)
    setError(null)
    try {
      await uncancelInchargeSession(s.id)
      refresh()
      onChanged()
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Couldn't re-open.",
      )
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => (!v ? onClose() : null)}>
      <SheetContent
        side="right"
        className="w-full !max-w-none sm:w-[calc(100vw-2rem)]"
      >
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Pencil className="size-5 text-icon-emerald" />
            Edit day
            {date
              ? ` · ${DAY_LABELS[isoDow(date)]?.long ?? ''} ${date}`
              : ''}
          </SheetTitle>
          <SheetDescription>
            Add, edit, reschedule or cancel {group.name}'s classes for this day.
            Changes apply only to this date and survive a week republish.
          </SheetDescription>
        </SheetHeader>

        {loading || daySessions === null ? (
          <div className="space-y-3 px-4 py-3">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="shimmer h-14 rounded bg-muted/60" />
            ))}
          </div>
        ) : loadError ? (
          <div className="mx-4 my-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {loadError}
          </div>
        ) : (
          <div className="mx-auto w-full max-w-3xl space-y-2 px-4 py-3">
            {holiday ? (
              <p className="flex items-center gap-1.5 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
                <CalendarX className="size-4 shrink-0" />
                This day is a holiday — {holiday.name}. Adding a class is blocked
                unless you confirm it on the form.
              </p>
            ) : null}
            {error ? (
              <p className="flex items-center gap-1.5 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <CircleAlert className="size-4 shrink-0" />
                {error}
              </p>
            ) : null}
            {teachingPeriods.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                This day's template has no teaching periods.
              </p>
            ) : (
              teachingPeriods.map((p) => {
                const session = singleByPeriod.get(p.id) ?? null
                const slotCount = slotCountByPeriod.get(p.id) ?? 0
                const isEditing = editor?.periodId === p.id
                const isCancelling =
                  session !== null && cancelId === session.id
                return (
                  <div key={p.id} className="rounded-lg border bg-card">
                    <div className="flex items-start gap-3 px-3 py-2.5">
                      <div className="w-24 shrink-0">
                        <div className="text-sm font-semibold tabular-nums">
                          {shortTime(p.start_time)}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {shortTime(p.end_time)} · {p.label}
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        {slotCount > 0 ? (
                          <div className="text-sm text-muted-foreground">
                            Elective slot · {slotCount} option
                            {slotCount === 1 ? '' : 's'} — manage from the week
                            view.
                          </div>
                        ) : session ? (
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-medium">
                                {session.subject?.name ??
                                  session.subject?.code ??
                                  '—'}
                              </span>
                              {session.status === 'cancelled' ? (
                                <Badge variant="destructive">Cancelled</Badge>
                              ) : session.status === 'completed' ? (
                                <Badge variant="secondary">Marked</Badge>
                              ) : null}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {session.effective_employee?.emp_display_name ??
                                '—'}
                              {session.room ? ` · ${session.room}` : ''}
                            </div>
                          </div>
                        ) : (
                          <div className="text-sm text-muted-foreground">
                            Free
                          </div>
                        )}
                      </div>
                      {slotCount === 0 && !isEditing && !isCancelling ? (
                        <div className="flex shrink-0 items-center gap-1">
                          {!session ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openAdd(p.id)}
                            >
                              <Plus /> Add
                            </Button>
                          ) : session.status === 'cancelled' ? (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busyId === session.id}
                              onClick={() => void doReopen(session)}
                            >
                              {busyId === session.id ? (
                                <Loader2 className="animate-spin" />
                              ) : (
                                <RotateCcw />
                              )}
                              Re-open
                            </Button>
                          ) : session.status === 'completed' ? null : (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => openEdit(session)}
                              >
                                <Pencil /> Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => onReschedule(session)}
                              >
                                <ArrowLeftRight /> Move
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-muted-foreground hover:text-destructive"
                                onClick={() => {
                                  setCancelId(session.id)
                                  setCancelReason('')
                                }}
                              >
                                <Ban /> Cancel
                              </Button>
                            </>
                          )}
                        </div>
                      ) : null}
                    </div>

                    {isEditing ? (
                      <div className="space-y-3 border-t bg-muted/20 px-3 py-3">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-1.5">
                            <Label>Subject</Label>
                            <select
                              value={fPss ?? ''}
                              onChange={(e) =>
                                setFPss(
                                  e.target.value
                                    ? Number(e.target.value)
                                    : null,
                                )
                              }
                              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                            >
                              <option value="">Select a subject…</option>
                              {subjects.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.subject
                                    ? `${s.subject.code} · ${s.subject.name}`
                                    : `Subject #${s.id}`}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-1.5">
                            <Label>Teacher</Label>
                            <select
                              value={fTeacher ?? ''}
                              onChange={(e) =>
                                setFTeacher(
                                  e.target.value
                                    ? Number(e.target.value)
                                    : null,
                                )
                              }
                              disabled={!selectedPss}
                              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm disabled:opacity-50"
                            >
                              <option value="">
                                {selectedPss
                                  ? faculty.length === 0
                                    ? 'No faculty allocated'
                                    : 'Select a teacher…'
                                  : 'Pick a subject first'}
                              </option>
                              {faculty.map((f) => (
                                <option key={f.id} value={f.id}>
                                  {f.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-1.5">
                            <Label>Room</Label>
                            <Input
                              value={fRoom}
                              onChange={(e) => setFRoom(e.target.value)}
                              placeholder="e.g. A-204"
                              maxLength={48}
                              className="h-9"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label>Note</Label>
                            <Input
                              value={fNote}
                              onChange={(e) => setFNote(e.target.value)}
                              placeholder="optional"
                              maxLength={160}
                              className="h-9"
                            />
                          </div>
                        </div>
                        {formWarnings.length > 0 ? (
                          <div className="space-y-1.5 rounded-md border border-warning/40 bg-warning/10 px-2.5 py-2 text-xs text-warning">
                            <div className="flex items-start gap-1.5">
                              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                              <ul className="list-disc pl-4">
                                {formWarnings.map((w, i) => (
                                  <li key={i}>{w}</li>
                                ))}
                              </ul>
                            </div>
                            <label className="flex cursor-pointer items-center gap-2 font-medium text-foreground">
                              <input
                                type="checkbox"
                                checked={ackForm}
                                onChange={(e) => setAckForm(e.target.checked)}
                                className="size-3.5"
                              />
                              {holiday && isAdd
                                ? 'Schedule on this holiday anyway'
                                : 'Schedule anyway'}
                            </label>
                          </div>
                        ) : null}
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditor(null)}
                            disabled={busyId !== null}
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => void saveForm()}
                            disabled={!canSaveForm}
                          >
                            {busyId !== null ? (
                              <>
                                <Loader2 className="animate-spin" />
                                Saving…
                              </>
                            ) : editor.sessionId === null ? (
                              'Add class'
                            ) : (
                              'Save'
                            )}
                          </Button>
                        </div>
                      </div>
                    ) : null}

                    {isCancelling ? (
                      <div className="space-y-2 border-t bg-muted/20 px-3 py-3">
                        <Label>Reason (optional)</Label>
                        <Input
                          value={cancelReason}
                          onChange={(e) => setCancelReason(e.target.value)}
                          placeholder="e.g. Faculty on leave"
                          maxLength={256}
                          className="h-9"
                        />
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setCancelId(null)}
                            disabled={busyId !== null}
                          >
                            Keep
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => void doCancel()}
                            disabled={busyId !== null}
                          >
                            {busyId !== null ? (
                              <>
                                <Loader2 className="animate-spin" />
                                Cancelling…
                              </>
                            ) : (
                              'Cancel class'
                            )}
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                )
              })
            )}
          </div>
        )}

        <SheetFooter>
          <Button variant="outline" onClick={onClose}>
            Done
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

// ---------------------------------------------------------------------------
// Reschedule — move a class to another day/period. Shows a clear "Currently →
// After move" comparison with the full start/end times on both sides (period
// timings can differ between templates), plus a target-slot picker.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Reschedule timeline — before / after the move, drawn on a *shared* clock
// axis so a source day and a target day built from different bell schedules
// (different period durations) still line up by actual start/end time. Beats a
// strict period-to-period comparison, which silently mismatches when the two
// days don't share a template.
// ---------------------------------------------------------------------------

type StripVariant = 'moving' | 'class' | 'elective' | 'break' | 'empty'

interface StripBlock {
  key: string
  startMin: number
  endMin: number
  title: string
  timeLabel: string
  variant: StripVariant
}

const STRIP_VARIANT: Record<StripVariant, string> = {
  moving:
    'border-primary bg-primary/15 text-primary ring-1 ring-inset ring-primary/50',
  class: 'border-input bg-card text-foreground',
  elective: 'border-icon-cyan/40 bg-icon-cyan/10 text-icon-cyan',
  break: 'border-dashed border-input/60 bg-muted/40 text-muted-foreground',
  empty: 'border-dashed border-input/50 bg-transparent text-muted-foreground/70',
}

// Short, single-line subject label for a timeline block — prefer the code.
function blockSubjectTitle(s: InchargeSession): string {
  const sub =
    s.subject ??
    s.programme_semester_subject_option?.subject ??
    s.programme_semester_subject?.subject ??
    null
  return (
    sub?.code ??
    sub?.name ??
    s.programme_semester_subject?.placeholder_name ??
    'Class'
  )
}

// Fold one day's sessions into timeline blocks. Option children that share a
// placeholder PSS + period collapse into a single "elective" block (the slot),
// so an open elective reads as one bar instead of N overlapping ones.
// `movingIds` flags the block(s) being rescheduled.
function sessionsToStripBlocks(
  sessions: InchargeSession[],
  movingIds: Set<number>,
): StripBlock[] {
  const groups = new Map<string, InchargeSession[]>()
  for (const s of sessions) {
    if (s.status === 'cancelled' || !s.timetable_period) continue
    const elective = s.programme_semester_subject_option_id != null
    const key = elective
      ? `slot:${s.timetable_period_id}:${s.programme_semester_subject_id ?? 'x'}`
      : `one:${s.id}`
    const list = groups.get(key) ?? []
    list.push(s)
    groups.set(key, list)
  }
  const blocks: StripBlock[] = []
  for (const [key, list] of groups) {
    const head = list[0]
    const p = head.timetable_period!
    const elective = head.programme_semester_subject_option_id != null
    const moving = list.some((s) => movingIds.has(s.id))
    blocks.push({
      key,
      startMin: toMinutes(p.start_time),
      endMin: toMinutes(p.end_time),
      title: elective
        ? `${head.programme_semester_subject?.placeholder_name ?? 'Elective'} · ${list.length}`
        : blockSubjectTitle(head),
      timeLabel: `${shortTime(p.start_time)}–${shortTime(p.end_time)}`,
      variant: moving ? 'moving' : elective ? 'elective' : 'class',
    })
  }
  return blocks.sort((a, b) => a.startMin - b.startMin)
}

// 'HH:MM' label for a minutes-since-midnight value.
function minutesLabel(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
}

// Truncated text that reveals its full content in a styled tooltip on hover —
// nicer than the OS's plain black `title` bubble. Needs a TooltipProvider
// ancestor (the comparison containers add one).
function CellText({
  tip,
  className,
  children,
}: {
  tip: string
  className?: string
  children: ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn('block truncate', className)}>{children}</span>
      </TooltipTrigger>
      <TooltipContent className="max-w-sm break-words">{tip}</TooltipContent>
    </Tooltip>
  )
}

// A single Before/After cell in the comparison grid — one class block, or a
// dashed placeholder when that day has nothing at this clock time.
function CmpCell({ block }: { block: StripBlock | null }) {
  if (!block) {
    return (
      <div className="flex min-h-[2.25rem] items-center justify-center rounded-md border border-dashed border-input/40 px-2 py-1 text-[11px] text-muted-foreground/50">
        —
      </div>
    )
  }
  return (
    <div
      className={cn(
        'min-h-[2.25rem] rounded-md border px-2 py-1 leading-tight',
        STRIP_VARIANT[block.variant],
      )}
    >
      <CellText tip={block.title} className="text-[11px] font-medium">
        {block.title}
      </CellText>
      <div className="truncate font-mono text-[9px] tabular-nums opacity-80">
        {block.timeLabel}
      </div>
    </div>
  )
}

function RescheduleSheet({
  open,
  group,
  session,
  onClose,
  onMoved,
}: {
  open: boolean
  group: InchargeGroupSummary
  session: InchargeSession | null
  onClose: () => void
  onMoved: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [ctx, setCtx] = useState<OngoingContext | null>(null)
  const [targetDate, setTargetDate] = useState('')
  // The source day's sessions — drives the "Before" strip and lets us gather
  // an elective slot's sibling options into one cohort move.
  const [sourceSessions, setSourceSessions] = useState<
    InchargeSession[] | null
  >(null)
  const [targetSessions, setTargetSessions] = useState<
    InchargeSession[] | null
  >(null)
  const [targetPeriodId, setTargetPeriodId] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Holiday on the target date (null = not a holiday).
  const [targetHoliday, setTargetHoliday] = useState<InchargeHoliday | null>(
    null,
  )
  // The single "I understand, schedule anyway" acknowledgement that unlocks
  // submit when there are warnings (holiday and/or timing conflict).
  const [acknowledge, setAcknowledge] = useState(false)

  // A class can never land in the past — block target dates before today
  // (mirrored server-side in InchargeSessionsService.move).
  const todayIso = useMemo(() => toIsoDate(new Date()), [])

  useEffect(() => {
    if (!open || !session) return
    // If the class's own date has already passed (rescheduling a missed
    // class), start the picker on today rather than an un-selectable past day.
    setTargetDate(
      session.session_date < todayIso ? todayIso : session.session_date,
    )
    setTargetPeriodId(null)
    setError(null)
    let cancelled = false
    setLoading(true)
    setLoadError(null)
    setCtx(null)
    // Load the source day's sessions for the "Before" strip + cohort detection.
    setSourceSessions(null)
    fetchInchargeSessions({
      attendance_group_id: group.id,
      from: session.session_date,
      to: session.session_date,
    })
      .then((rows) => {
        if (!cancelled) setSourceSessions(rows)
      })
      .catch(() => {
        if (!cancelled) setSourceSessions([])
      })
    resolveOngoingContext(group.id)
      .then((c) => {
        if (!cancelled) setCtx(c)
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Could not load.')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, session, group.id, todayIso])

  useEffect(() => {
    if (!open || !targetDate) return
    let cancelled = false
    setTargetSessions(null)
    fetchInchargeSessions({
      attendance_group_id: group.id,
      from: targetDate,
      to: targetDate,
    })
      .then((rows) => {
        if (!cancelled) setTargetSessions(rows)
      })
      .catch(() => {
        if (!cancelled) setTargetSessions([])
      })
    setTargetHoliday(null)
    setAcknowledge(false)
    fetchInchargeHolidays({
      attendance_group_id: group.id,
      from: targetDate,
      to: targetDate,
    })
      .then((hs) => {
        if (!cancelled) setTargetHoliday(hs[0] ?? null)
      })
      .catch(() => {
        if (!cancelled) setTargetHoliday(null)
      })
    return () => {
      cancelled = true
    }
  }, [open, targetDate, group.id])

  const targetPeriods = useMemo(
    () => (ctx ? ctx.periods.filter((p) => !p.is_break) : []),
    [ctx],
  )
  const sourcePeriod = session?.timetable_period ?? null

  // An open-elective slot is several option children sharing one placeholder
  // PSS + period. Moving it must move the whole cohort together, so we gather
  // the siblings from the source day. A regular class is a cohort of one.
  const isElective = session?.programme_semester_subject_option_id != null
  const cohort = useMemo<InchargeSession[]>(() => {
    if (!session) return []
    if (!isElective) return [session]
    const pool = sourceSessions ?? [session]
    const siblings = pool.filter(
      (s) =>
        s.session_date === session.session_date &&
        s.timetable_period_id === session.timetable_period_id &&
        s.programme_semester_subject_id ===
          session.programme_semester_subject_id &&
        s.programme_semester_subject_option_id != null &&
        s.status !== 'cancelled',
    )
    return siblings.length ? siblings : [session]
  }, [session, isElective, sourceSessions])
  const movingIds = useMemo(
    () => new Set(cohort.map((c) => c.id)),
    [cohort],
  )

  const occupiedByPeriod = useMemo(() => {
    const m = new Map<number, InchargeSession>()
    for (const s of targetSessions ?? []) {
      if (s.status === 'cancelled') continue
      if (movingIds.has(s.id)) continue
      m.set(s.timetable_period_id, s)
    }
    return m
  }, [targetSessions, movingIds])

  // Timing conflicts for a candidate target period: another class already in
  // that period, a class whose clock-time overlaps it, or this class's teacher
  // already busy at that time on the target day.
  const conflictsForPeriod = useCallback(
    (tp: TimetablePeriod): string[] => {
      const others = (targetSessions ?? []).filter(
        (s) => s.status !== 'cancelled' && !movingIds.has(s.id),
      )
      const teacherId =
        session?.effective_employee?.id ??
        session?.scheduled_employee?.id ??
        null
      const out: string[] = []
      for (const s of others) {
        const name = s.subject?.name ?? s.subject?.code ?? 'a class'
        if (s.timetable_period_id === tp.id) {
          out.push(`${name} is already in this period`)
          continue
        }
        const sp = s.timetable_period
        if (!sp) continue
        if (
          timeOverlaps(tp.start_time, tp.end_time, sp.start_time, sp.end_time)
        ) {
          out.push(
            `Overlaps ${name} (${shortTime(sp.start_time)}–${shortTime(sp.end_time)})`,
          )
          const sTeacher = s.effective_employee?.id ?? null
          if (teacherId !== null && sTeacher === teacherId) {
            out.push(
              `${session?.effective_employee?.emp_display_name ?? 'The teacher'} already teaches then`,
            )
          }
        }
      }
      return Array.from(new Set(out))
    },
    [targetSessions, session, movingIds],
  )

  const selectedPeriod = useMemo(
    () => targetPeriods.find((p) => p.id === targetPeriodId) ?? null,
    [targetPeriods, targetPeriodId],
  )
  const selectedConflicts = useMemo(
    () => (selectedPeriod ? conflictsForPeriod(selectedPeriod) : []),
    [selectedPeriod, conflictsForPeriod],
  )
  // Unified warning list: holiday first (the hard one), then timing conflicts.
  const warnings = useMemo(() => {
    const w: string[] = []
    if (targetHoliday) {
      w.push(`This date is a holiday — ${targetHoliday.name}`)
    }
    if (selectedPeriod) w.push(...selectedConflicts)
    return w
  }, [targetHoliday, selectedPeriod, selectedConflicts])

  const isPast = targetDate !== '' && targetDate < todayIso
  const sameSlot =
    session !== null &&
    targetDate === session.session_date &&
    targetPeriodId === session.timetable_period_id
  const canMove =
    session !== null &&
    targetPeriodId !== null &&
    !sameSlot &&
    !isPast &&
    !submitting &&
    (warnings.length === 0 || acknowledge)

  function pickTarget(id: number) {
    setTargetPeriodId(id)
    setAcknowledge(false)
  }

  // What changes, for the textual summary under the strips.
  const dateChanged =
    session !== null && targetDate !== session.session_date
  const srcStart = sourcePeriod ? shortTime(sourcePeriod.start_time) : ''
  const srcEnd = sourcePeriod ? shortTime(sourcePeriod.end_time) : ''
  const tgtStart = selectedPeriod ? shortTime(selectedPeriod.start_time) : ''
  const tgtEnd = selectedPeriod ? shortTime(selectedPeriod.end_time) : ''
  const timeChanged =
    selectedPeriod !== null && (srcStart !== tgtStart || srcEnd !== tgtEnd)

  // Label for the moving bar — the placeholder + option count for an elective
  // cohort, otherwise the single subject.
  const movingTitle = useMemo(() => {
    if (!session) return 'Class'
    if (cohort.length > 1)
      return `${session.programme_semester_subject?.placeholder_name ?? 'Elective'} · ${cohort.length}`
    return blockSubjectTitle(session)
  }, [session, cohort])

  // "Before" strip: the source day as it stands, with the moving class/cohort
  // highlighted.
  const beforeBlocks = useMemo(
    () => sessionsToStripBlocks(sourceSessions ?? cohort, movingIds),
    [sourceSessions, cohort, movingIds],
  )

  // "After" strip: the target day's bell schedule (breaks, occupied + free
  // teaching slots), with the moving class/cohort dropped onto the chosen slot.
  const afterBlocks = useMemo<StripBlock[]>(() => {
    if (!ctx) return []
    const occupied = (targetSessions ?? []).filter(
      (s) => s.status !== 'cancelled' && !movingIds.has(s.id),
    )
    const occBlocks = sessionsToStripBlocks(occupied, new Set<number>())
    const blocks: StripBlock[] = []
    for (const p of ctx.periods) {
      const startMin = toMinutes(p.start_time)
      const endMin = toMinutes(p.end_time)
      // The moving cohort's destination is drawn separately, on top.
      if (selectedPeriod && p.id === selectedPeriod.id) continue
      if (p.is_break) {
        blocks.push({
          key: `brk:${p.id}`,
          startMin,
          endMin,
          title: p.label || 'Break',
          timeLabel: `${shortTime(p.start_time)}–${shortTime(p.end_time)}`,
          variant: 'break',
        })
        continue
      }
      const here = occBlocks.filter((b) => b.startMin === startMin)
      if (here.length) {
        blocks.push(...here)
        continue
      }
      blocks.push({
        key: `free:${p.id}`,
        startMin,
        endMin,
        title: 'Free',
        timeLabel: `${shortTime(p.start_time)}–${shortTime(p.end_time)}`,
        variant: 'empty',
      })
    }
    if (selectedPeriod) {
      blocks.push({
        key: 'moving',
        startMin: toMinutes(selectedPeriod.start_time),
        endMin: toMinutes(selectedPeriod.end_time),
        title: movingTitle,
        timeLabel: `${shortTime(selectedPeriod.start_time)}–${shortTime(selectedPeriod.end_time)}`,
        variant: 'moving',
      })
    }
    return blocks.sort((a, b) => a.startMin - b.startMin)
  }, [ctx, targetSessions, movingIds, selectedPeriod, movingTitle])

  // Merge both days onto one vertical clock axis: one row per distinct start
  // time, with the Before and After block (if any) for that time. A period
  // present on only one side leaves the other cell blank — so two days with
  // different period lengths still line up row-for-row by the clock.
  const cmpRows = useMemo(() => {
    const starts = new Set<number>()
    for (const b of beforeBlocks) starts.add(b.startMin)
    for (const b of afterBlocks) starts.add(b.startMin)
    return Array.from(starts)
      .sort((a, b) => a - b)
      .map((startMin) => {
        const before = beforeBlocks.find((b) => b.startMin === startMin) ?? null
        const after = afterBlocks.find((b) => b.startMin === startMin) ?? null
        // The row's end — the later of the two sides, so the range covers both
        // when the two days' periods at this time have different lengths.
        const endMin = Math.max(before?.endMin ?? 0, after?.endMin ?? 0)
        return { startMin, endMin, before, after }
      })
  }, [beforeBlocks, afterBlocks])

  async function submit() {
    if (!session || targetPeriodId === null) return
    if (isPast) {
      setError("Can't reschedule into the past — pick today or a later date.")
      return
    }
    setSubmitting(true)
    setError(null)
    const cohortMove = cohort.length > 1
    // Cohort members all share the source date + period, so one payload moves
    // them all to the chosen destination.
    const body = {
      new_session_date:
        targetDate !== session.session_date ? targetDate : undefined,
      new_timetable_period_id:
        targetPeriodId !== session.timetable_period_id
          ? targetPeriodId
          : undefined,
      // Cohort siblings legitimately share the destination slot, so the
      // server's cell-collision guard must be suppressed for them. Clashes
      // against *other* classes were surfaced above and acknowledged.
      allow_conflict:
        cohortMove || selectedConflicts.length > 0 ? true : undefined,
      allow_holiday: targetHoliday ? true : undefined,
    }
    try {
      if (cohortMove) {
        // Atomic — all options relocate together or none do.
        await moveInchargeSessionsBatch(
          cohort.map((c) => c.id),
          body,
        )
      } else {
        await moveInchargeSession(session.id, body)
      }
      onMoved()
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Couldn't reschedule.",
      )
      setSubmitting(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => (!v ? onClose() : null)}>
      <SheetContent
        side="right"
        className="w-full !max-w-none sm:w-[calc(100vw-2rem)]"
      >
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ArrowLeftRight className="size-5 text-icon-emerald" />
            {cohort.length > 1 ? 'Reschedule elective slot' : 'Reschedule class'}
          </SheetTitle>
          <SheetDescription>
            {session
              ? cohort.length > 1
                ? `${session.programme_semester_subject?.placeholder_name ?? 'Elective slot'} — all ${cohort.length} options move together. Before and after are drawn on one clock axis so the slots line up.`
                : `${session.subject?.name ?? session.subject?.code ?? 'Class'} — pick where it should go. Before and after are drawn on one clock axis so the slots line up even when the two days use different period lengths.`
              : ''}
          </SheetDescription>
        </SheetHeader>

        {loading || !session ? (
          <div className="space-y-3 px-4 py-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="shimmer h-12 rounded bg-muted/60" />
            ))}
          </div>
        ) : loadError ? (
          <div className="mx-4 my-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {loadError}
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-3">
            <div className="space-y-1.5">
              <Label htmlFor="resched-date">Move to date</Label>
              <Input
                id="resched-date"
                type="date"
                value={targetDate}
                min={todayIso}
                onChange={(e) => {
                  setTargetDate(e.target.value)
                  setTargetPeriodId(null)
                }}
                className="h-9 w-44"
              />
              {session && session.session_date < todayIso ? (
                <p className="text-[11px] text-muted-foreground">
                  This class's original date ({session.session_date}) has
                  passed — pick today or a later date.
                </p>
              ) : null}
            </div>
            {isPast ? (
              <p className="flex items-center gap-1.5 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                <CircleAlert className="size-4 shrink-0" />
                Past dates can't be scheduled — pick today or a later date.
              </p>
            ) : null}
            {targetHoliday ? (
              <p className="flex items-center gap-1.5 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
                <CalendarX className="size-4 shrink-0" />
                {targetHoliday.name} is a holiday on this date — scheduling is
                blocked unless you confirm below.
              </p>
            ) : null}
            {error ? (
              <p className="flex items-center gap-1.5 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <CircleAlert className="size-4 shrink-0" />
                {error}
              </p>
            ) : null}

            <div className="grid gap-4 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
              {/* Preview pane — sits to the right on wide screens, below on
                  narrow ones (the slot picker is ordered first). */}
              <div className="order-2 min-w-0 space-y-2">
            {/* Before / after as two columns sharing a vertical clock axis.
                Each row is a clock time; a period present on only one day
                leaves the other cell blank, so two days built from different
                bell schedules (different period lengths) still line up. */}
            <TooltipProvider>
            <div className="rounded-lg border bg-muted/10 p-3">
              <div
                className="grid items-center gap-x-2"
                style={{ gridTemplateColumns: '4.5rem 1fr 1fr' }}
              >
                <div />
                <div className="pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Before ·{' '}
                  <span className="text-foreground">
                    {DAY_LABELS[isoDow(session.session_date)]?.short}{' '}
                    {session.session_date.slice(5)}
                  </span>
                </div>
                <div className="pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  After ·{' '}
                  <span className="text-foreground">
                    {DAY_LABELS[isoDow(targetDate)]?.short}{' '}
                    {targetDate.slice(5)}
                  </span>
                </div>
              </div>
              {sourceSessions === null ? (
                <div className="space-y-1.5">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="shimmer h-9 rounded bg-muted/60" />
                  ))}
                </div>
              ) : cmpRows.length === 0 ? (
                <p className="py-2 text-center text-xs text-muted-foreground">
                  {selectedPeriod
                    ? 'Nothing scheduled on either day.'
                    : 'Pick a slot below to see where it lands.'}
                </p>
              ) : (
                <div className="space-y-1.5">
                  {cmpRows.map((row) => (
                    <div
                      key={row.startMin}
                      className="grid items-stretch gap-x-2"
                      style={{ gridTemplateColumns: '4.5rem 1fr 1fr' }}
                    >
                      <div className="self-center font-mono text-[10px] leading-tight tabular-nums text-muted-foreground">
                        <div>{minutesLabel(row.startMin)}</div>
                        <div className="opacity-70">
                          {minutesLabel(row.endMin)}
                        </div>
                      </div>
                      <CmpCell block={row.before} />
                      <CmpCell block={row.after} />
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <span className="size-2.5 rounded-sm border border-primary bg-primary/30" />
                  Moving
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="size-2.5 rounded-sm border border-icon-cyan/40 bg-icon-cyan/20" />
                  Elective
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="size-2.5 rounded-sm border border-input bg-card" />
                  Class
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="size-2.5 rounded-sm border border-dashed border-input/60" />
                  Free
                </span>
              </div>
            </div>
            </TooltipProvider>

            {selectedPeriod ? (
              <p className="text-xs text-muted-foreground">
                {dateChanged ? 'Moves to a different day' : 'Same day'}
                {timeChanged
                  ? ` · time ${srcStart}–${srcEnd} → ${tgtStart}–${tgtEnd}`
                  : ' · same time'}
                {cohort.length > 1 ? ` · ${cohort.length} options together` : ''}
              </p>
            ) : null}
              </div>

              {/* Slot picker — the primary action; ordered first so it's the
                  left column on wide screens and the top block on narrow ones,
                  reachable without scrolling past the preview. */}
              <div className="order-1 space-y-1.5">
              <Label>
                Choose the new slot · {DAY_LABELS[isoDow(targetDate)]?.long}
              </Label>
              {targetPeriods.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  This day's template has no teaching periods.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {targetPeriods.map((tp) => {
                    const conflicts = conflictsForPeriod(tp)
                    const hasConflict = conflicts.length > 0
                    const occupied = occupiedByPeriod.get(tp.id) ?? null
                    const selected = targetPeriodId === tp.id
                    const isCurrent =
                      session.session_date === targetDate &&
                      session.timetable_period_id === tp.id
                    return (
                      <button
                        key={tp.id}
                        type="button"
                        disabled={isCurrent}
                        onClick={() => pickTarget(tp.id)}
                        className={cn(
                          'flex w-full items-center justify-between gap-3 rounded-md border px-3 py-2 text-left text-sm transition-colors',
                          isCurrent
                            ? 'cursor-not-allowed opacity-50'
                            : selected
                              ? hasConflict
                                ? 'border-warning bg-warning/10'
                                : 'border-primary bg-primary/10'
                              : hasConflict
                                ? 'border-warning/40 bg-warning/5 hover:bg-warning/10'
                                : 'hover:bg-accent',
                        )}
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-x-2">
                            <span className="font-medium">{tp.label}</span>
                            <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                              {shortTime(tp.start_time)}–
                              {shortTime(tp.end_time)}
                            </span>
                          </div>
                          <div
                            className={cn(
                              'text-[11px]',
                              hasConflict
                                ? 'text-warning'
                                : 'text-muted-foreground',
                            )}
                          >
                            {isCurrent
                              ? 'Current slot'
                              : occupied
                                ? `Taken — ${occupied.subject?.name ?? occupied.subject?.code ?? 'class'}`
                                : 'Free'}
                            {hasConflict ? ` · ${conflicts.join(' · ')}` : ''}
                          </div>
                        </div>
                        {selected ? (
                          <Check className="size-4 shrink-0 text-primary" />
                        ) : null}
                      </button>
                    )
                  })}
                </div>
              )}
              </div>
            </div>
          </div>
        )}

        {!loading && session && targetPeriodId !== null && warnings.length > 0 ? (
          <div className="mx-4 mb-1 space-y-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <div>
                <p className="font-medium">
                  Heads up — this slot has {warnings.length} issue
                  {warnings.length === 1 ? '' : 's'}:
                </p>
                <ul className="mt-0.5 list-disc pl-4">
                  {warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            </div>
            <label className="flex cursor-pointer items-center gap-2 font-medium text-foreground">
              <input
                type="checkbox"
                checked={acknowledge}
                onChange={(e) => setAcknowledge(e.target.checked)}
                className="size-3.5"
              />
              {targetHoliday
                ? 'Schedule on this holiday anyway'
                : 'Schedule anyway'}
            </label>
          </div>
        ) : null}

        <SheetFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={() => void submit()}
            disabled={!canMove}
            variant={warnings.length > 0 ? 'destructive' : 'default'}
          >
            {submitting ? (
              <>
                <Loader2 className="animate-spin" />
                Moving…
              </>
            ) : warnings.length > 0 ? (
              'Reschedule anyway'
            ) : (
              'Reschedule'
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

// ---------------------------------------------------------------------------
// Republish diff — current vs after-publish for the selected window, aligned
// per day on a shared clock-time axis, with inline per-class actions.
// ---------------------------------------------------------------------------

type PreviewSessionT = PreviewResult['sessions'][number]

// Identify a preview row for the publish "don't add" exclude list.
function previewExcludeKey(n: PreviewSessionT): PublishExcludeKey {
  return {
    session_date: n.session_date,
    timetable_period_id: n.timetable_period_id,
    programme_semester_subject_id: n.programme_semester_subject_id,
    programme_semester_subject_option_id:
      n.programme_semester_subject_option_id,
  }
}

function excludeKeyStr(k: PublishExcludeKey): string {
  return `${k.session_date}|${k.timetable_period_id}|${k.programme_semester_subject_id}|${k.programme_semester_subject_option_id ?? 0}`
}

type DiffStatus =
  | 'added'
  | 'removed'
  | 'stays'
  | 'changed'
  | 'kept'
  | 'cancelled'
  | 'slot'

const DIFF_CHIP: Record<DiffStatus, { label: string; cls: string }> = {
  added: {
    label: 'Will be added',
    cls: 'border-icon-emerald/40 bg-icon-emerald/10 text-icon-emerald',
  },
  removed: {
    label: 'Will be removed',
    cls: 'border-destructive/40 bg-destructive/10 text-destructive',
  },
  stays: { label: 'Stays', cls: 'border-input bg-muted text-muted-foreground' },
  changed: {
    label: 'Changes',
    cls: 'border-warning/40 bg-warning/10 text-warning',
  },
  kept: {
    label: 'Marked · kept',
    cls: 'border-warning/40 bg-warning/10 text-warning',
  },
  cancelled: {
    label: 'Cancelled',
    cls: 'border-destructive/40 bg-destructive/10 text-destructive',
  },
  slot: {
    label: 'Elective slot',
    cls: 'border-input bg-muted text-muted-foreground',
  },
}

// One side (Before or After) of a diff row — what to print in that column.
interface SideDisplay {
  /** Subject code, e.g. "CS101" — blank for elective slots. */
  code: string
  name: string
  meta: string
  /** Elective category/slot label (e.g. "Honors 1", "Open Elective 1") shown
   *  as a coloured tag. Blank for ordinary classes. */
  tag: string
  /** Clock range for this side's period, e.g. "09:00–09:50". */
  time: string
  /** Length of this side's period, e.g. "50m" — may differ across sides. */
  duration: string
}

// Colour an elective tag by its category so Honors / Majors / Minors / Open
// Elective read at a glance.
function electiveTagClass(label: string): string {
  const l = label.toLowerCase()
  if (l.includes('honor'))
    return 'border-icon-amber/40 bg-icon-amber/10 text-icon-amber'
  if (l.includes('major'))
    return 'border-icon-blue/40 bg-icon-blue/10 text-icon-blue'
  if (l.includes('minor'))
    return 'border-icon-cyan/40 bg-icon-cyan/10 text-icon-cyan'
  if (l.includes('elective'))
    return 'border-icon-violet/40 bg-icon-violet/10 text-icon-violet'
  return 'border-input bg-muted text-muted-foreground'
}

// Human period length: "50m", "1h", "1h 10m".
function durationLabel(startMin: number, endMin: number): string {
  const d = Math.max(0, endMin - startMin)
  const h = Math.floor(d / 60)
  const m = d % 60
  if (h && m) return `${h}h ${m}m`
  if (h) return `${h}h`
  return `${m}m`
}

// Clock range + duration for a start/end pair (blank when times missing).
function timeRange(
  start?: string | null,
  end?: string | null,
): { time: string; duration: string } {
  if (!start || !end) return { time: '', duration: '' }
  return {
    time: `${shortTime(start)}–${shortTime(end)}`,
    duration: durationLabel(toMinutes(start), toMinutes(end)),
  }
}

interface DiffRowData {
  key: string
  start: string
  end: string
  /** The actionable current session at this slot (scheduled/cancelled single). */
  cur: InchargeSession | null
  next: PreviewSessionT | null
  status: DiffStatus
  slotLabel: string | null
  /** What's scheduled now (left column) and after publish (right column). */
  before: SideDisplay | null
  after: SideDisplay | null
  /** Set when this row's post-publish class overlaps another on the same day
   *  (e.g. a new class landing on a kept marked one) — the message names it. */
  conflict: string | null
  /** Options of one elective slot share this key; they're allowed to occupy
   *  the same period (students pick one), so the overlap check skips pairs that
   *  share a non-null groupKey. Null for ordinary single classes. */
  groupKey: string | null
  /** An "added" row the user dropped via "Don't add" — excluded from publish,
   *  greyed out, and ignored by the overlap check. */
  dropped: boolean
}

function previewPeriodLike(s: PreviewSessionT): AxisPeriodLike | null {
  if (!s.period_start_time || !s.period_end_time) return null
  return {
    start_time: s.period_start_time,
    end_time: s.period_end_time,
    label: s.period_label ?? '',
    is_break: false,
  }
}

// Name + teacher/room line for a current session (left/Before column).
function curSideDisplay(s: InchargeSession): SideDisplay {
  const sub =
    s.subject ??
    s.programme_semester_subject_option?.subject ??
    s.programme_semester_subject?.subject ??
    null
  const teacher =
    s.effective_employee?.emp_display_name ??
    s.scheduled_employee?.emp_display_name ??
    ''
  return {
    code: sub?.code ?? '',
    name: sub?.name ?? sub?.code ?? '—',
    meta: [teacher, s.room ? `Room ${s.room}` : ''].filter(Boolean).join(' · '),
    tag: '',
    ...timeRange(s.timetable_period?.start_time, s.timetable_period?.end_time),
  }
}

// Name + teacher/room line for a preview (to-be-published) session (After col).
function nextSideDisplay(n: PreviewSessionT): SideDisplay {
  return {
    code: n.subject_code ?? '',
    name: n.subject_name ?? n.subject_code ?? n.slot_placeholder_name ?? '—',
    meta: [n.teacher_name ?? '', n.room ? `Room ${n.room}` : '']
      .filter(Boolean)
      .join(' · '),
    tag: '',
    ...timeRange(n.period_start_time, n.period_end_time),
  }
}

// One Before/After cell. Empty (no class that side) renders a faint dash.
function DiffSideCell({
  display,
  strike,
  emphasis,
}: {
  display: SideDisplay | null
  strike?: boolean
  emphasis?: boolean
}) {
  if (!display) {
    return <div className="text-sm text-muted-foreground/40">—</div>
  }
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5">
        {display.tag ? (
          <span
            className={cn(
              'shrink-0 whitespace-nowrap rounded border px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide',
              electiveTagClass(display.tag),
            )}
          >
            {display.tag}
          </span>
        ) : null}
        <CellText
          tip={`${display.code ? `${display.code} ` : ''}${display.name}`}
          className={cn(
            'min-w-0 flex-1 text-sm',
            strike
              ? 'text-muted-foreground line-through'
              : emphasis
                ? 'font-medium'
                : 'text-foreground',
          )}
        >
          {display.code ? (
            <span className="font-mono text-[11px] font-normal text-muted-foreground">
              {display.code}{' '}
            </span>
          ) : null}
          {display.name}
        </CellText>
      </div>
      {display.time || display.duration || display.meta ? (
        <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          {display.time ? (
            <span className="shrink-0 font-mono tabular-nums">
              {display.time}
            </span>
          ) : null}
          {display.duration ? (
            <span className="shrink-0 rounded bg-muted px-1 py-0.5 font-mono text-[9px] tabular-nums">
              {display.duration}
            </span>
          ) : null}
          {display.meta ? (
            <span className="min-w-0 truncate" title={display.meta}>
              {display.time || display.duration ? '· ' : ''}
              {display.meta}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

// Build the per-time-row diff for one day: align current vs after-publish on a
// shared clock axis and classify each slot.
function buildDayDiff(
  iso: string,
  current: InchargeSession[],
  previewSessions: PreviewSessionT[],
  excluded: Set<string>,
): DiffRowData[] {
  const curDay = current.filter((s) => s.session_date === iso)
  const nextDay = previewSessions.filter((s) => s.session_date === iso)
  const isDropped = (n: PreviewSessionT): boolean =>
    excluded.has(excludeKeyStr(previewExcludeKey(n)))
  const curPeriods = curDay
    .map((s) => s.timetable_period)
    .filter((p): p is NonNullable<typeof p> => !!p)
  const nextPeriods = nextDay
    .map(previewPeriodLike)
    .filter((p): p is AxisPeriodLike => p !== null)
  const axis = mergeTimeAxis([curPeriods, nextPeriods])

  const rows = axis.flatMap((row): DiffRowData[] => {
    const curList = curDay.filter(
      (s) =>
        s.timetable_period &&
        s.timetable_period.start_time.slice(0, 5) === row.key,
    )
    const nextList = nextDay.filter(
      (s) => (s.period_start_time ?? '').slice(0, 5) === row.key,
    )
    const isSlot =
      nextList.some((n) => n.slot_placeholder_name !== null) ||
      curList.some((s) => s.programme_semester_subject_option_id !== null)
    if (isSlot) {
      const curElectives = curList.filter(
        (s) => s.programme_semester_subject_option_id !== null,
      )
      const slotLabel =
        nextList.find((n) => n.slot_placeholder_name)?.slot_placeholder_name ??
        curElectives.find((s) => s.programme_semester_subject?.placeholder_name)
          ?.programme_semester_subject?.placeholder_name ??
        'Elective slot'
      // All options of this slot share one period (students pick one), so they
      // must NOT count as clashing with each other in the overlap check.
      const groupKey = `slot:${row.key}`
      // Tag each option with the elective slot it belongs to (Honors / Majors
      // / Minors / Open Elective), shown as a coloured chip on the row.
      const tagSlot = (d: SideDisplay): SideDisplay => ({ ...d, tag: slotLabel })
      const optCode = (s: InchargeSession): string | null =>
        s.subject?.code ??
        s.programme_semester_subject_option?.subject?.code ??
        null
      const out: DiffRowData[] = []
      // New-template options get matched to a current option of the same
      // subject so an unchanged option reads as one STAYS/KEPT row instead of
      // duplicating into removed + added.
      const consumed = new Set<number>()
      for (const s of curElectives) {
        const code = optCode(s)
        let matched: PreviewSessionT | null = null
        if (code !== null && s.status !== 'cancelled') {
          const mi = nextList.findIndex(
            (n, i) => !consumed.has(i) && n.subject_code === code,
          )
          if (mi >= 0) {
            matched = nextList[mi]
            consumed.add(mi)
          }
        }
        const disp = tagSlot(curSideDisplay(s))
        let status: DiffStatus
        let after: SideDisplay | null
        let cur: InchargeSession | null
        if (s.status === 'completed') {
          status = 'kept' // marked option can't be wiped
          after = disp
          cur = null
        } else if (s.status === 'cancelled') {
          status = 'cancelled'
          after = null
          cur = s
        } else if (matched) {
          status = 'stays' // same subject survives the republish
          after = tagSlot(nextSideDisplay(matched))
          cur = s
        } else {
          status = 'removed' // unmarked, not in the new template → wiped
          after = null
          cur = s
        }
        out.push({
          key: `${row.key}:opt:${s.id}`,
          start: row.start,
          end: row.end,
          cur,
          next: matched,
          status,
          slotLabel,
          before: disp,
          after,
          conflict: null,
          groupKey,
          dropped: false,
        })
      }
      // New options with no current counterpart → genuinely added.
      nextList.forEach((n, i) => {
        if (consumed.has(i)) return
        out.push({
          key: `${row.key}:newopt:${i}`,
          start: row.start,
          end: row.end,
          cur: null,
          next: n,
          status: 'added' as DiffStatus,
          slotLabel,
          before: null,
          after: tagSlot(nextSideDisplay(n)),
          conflict: null,
          groupKey,
          dropped: isDropped(n),
        })
      })
      return out
    }
    const singles = curList.filter(
      (s) => s.programme_semester_subject_option_id === null,
    )
    const completed = singles.find((s) => s.status === 'completed') ?? null
    const active = singles.find((s) => s.status === 'scheduled') ?? null
    const cancelled = singles.find((s) => s.status === 'cancelled') ?? null
    const next = nextList[0] ?? null

    let status: DiffStatus
    let cur: InchargeSession | null
    if (completed) {
      status = 'kept'
      cur = null
    } else if (cancelled && !active) {
      status = 'cancelled'
      cur = cancelled
    } else if (next && active) {
      status = next.already_exists ? 'stays' : 'changed'
      cur = active
    } else if (next && !active) {
      status = 'added'
      cur = null
    } else if (active && !next) {
      status = active.timetable_entry_id === null ? 'stays' : 'removed'
      cur = active
    } else {
      status = 'stays'
      cur = active ?? null
    }

    // Before = what's scheduled now; After = what publishing leaves behind.
    const beforeSession = completed ?? active ?? cancelled ?? null
    const before = beforeSession ? curSideDisplay(beforeSession) : null
    let after: SideDisplay | null
    if (status === 'kept') {
      after = before // a marked/completed class is kept exactly as-is
    } else if (next) {
      after = nextSideDisplay(next)
    } else if (status === 'stays' && active) {
      after = curSideDisplay(active) // ad-hoc class that survives republish
    } else {
      after = null // removed / cancelled — nothing after
    }

    const main: DiffRowData = {
      key: row.key,
      start: row.start,
      end: row.end,
      cur,
      next,
      status,
      slotLabel: null,
      before,
      after,
      conflict: null,
      groupKey: null,
      dropped: status === 'added' && next ? isDropped(next) : false,
    }

    // A marked class is kept, but the new template still wants a *different*
    // class in this window — it gets published anyway (overlapping the kept
    // slot), so show it as its own "will be added" row. When the template's
    // class is the SAME subject as the kept one it's not a new class at all
    // (just the template re-stating what's already there, marked), so we don't
    // duplicate it into a phantom "will be added" row.
    const keptSubjectCode = completed?.subject?.code ?? null
    const nextDiffersFromKept =
      next != null &&
      (keptSubjectCode === null || next.subject_code !== keptSubjectCode)
    if (status === 'kept' && next && !next.already_exists && nextDiffersFromKept) {
      return [
        main,
        {
          key: `${row.key}:add`,
          start: row.start,
          end: row.end,
          cur: null,
          next,
          status: 'added' as DiffStatus,
          slotLabel: null,
          before: null,
          after: nextSideDisplay(next),
          conflict: null,
          groupKey: null,
          dropped: isDropped(next),
        },
      ]
    }
    return [main]
  })

  // Timing-conflict pass on the post-publish (After) state: any two classes
  // that will both exist after publishing and whose clock times overlap get
  // flagged — this is how a new class landing on a kept/marked class (the two
  // periods using different bell schedules so the seeder's slot check misses
  // it) surfaces instead of silently double-booking the student. Adjacent
  // periods (one ends exactly when the next starts) are not a conflict.
  const afterRows = rows.filter(
    (r) => r.after && !r.dropped && r.after.time.includes('–'),
  )
  const span = (t: string): [number, number] => {
    const [s, e] = t.split('–')
    return [toMinutes(s), toMinutes(e)]
  }
  const addConflict = (r: DiffRowData, msg: string) => {
    r.conflict = r.conflict ? `${r.conflict}; ${msg}` : msg
  }
  for (let i = 0; i < afterRows.length; i++) {
    for (let j = i + 1; j < afterRows.length; j++) {
      const a = afterRows[i]
      const b = afterRows[j]
      // Options of the same elective slot legitimately share a period.
      if (a.groupKey && a.groupKey === b.groupKey) continue
      const [as, ae] = span(a.after!.time)
      const [bs, be] = span(b.after!.time)
      if (as < be && bs < ae) {
        addConflict(a, `Overlaps ${b.after!.name} (${b.after!.time})`)
        addConflict(b, `Overlaps ${a.after!.name} (${a.after!.time})`)
      }
    }
  }
  return rows
}

interface DiffTotals {
  added: number
  removed: number
  stays: number
  changed: number
  kept: number
}

function RepublishDiff({
  group,
  preview,
  current,
  ctx,
  weekStart,
  selectedDays,
  excluded,
  onToggleExclude,
  onChanged,
  onReschedule,
  onTotals,
}: {
  group: InchargeGroupSummary
  preview: PreviewResult
  current: InchargeSession[] | null
  ctx: OngoingContext | null
  weekStart: Date
  selectedDays: Set<number>
  excluded: Set<string>
  onToggleExclude: (n: PreviewSessionT) => void
  onChanged: () => void
  onReschedule: (s: InchargeSession) => void
  onTotals?: (t: DiffTotals) => void
}) {
  const holidays = preview.holidays ?? []
  const blockedDates = useMemo(
    () => new Set(preview.blocked_dates ?? []),
    [preview.blocked_dates],
  )
  const sessions = preview.sessions ?? []

  const dayBlocks = useMemo(() => {
    const cur = current ?? []
    return Array.from(selectedDays)
      .sort((a, b) => a - b)
      .map((dow) => {
        const iso = toIsoDate(addDays(weekStart, dow - 1))
        return {
          dow,
          iso,
          blocked: blockedDates.has(iso),
          rows: buildDayDiff(iso, cur, sessions, excluded),
        }
      })
      .filter((d) => d.rows.length > 0 || d.blocked)
  }, [selectedDays, weekStart, current, sessions, blockedDates, excluded])

  const totals = useMemo(() => {
    const t = { added: 0, removed: 0, stays: 0, changed: 0, kept: 0 }
    for (const d of dayBlocks) {
      for (const r of d.rows) {
        if (r.dropped) continue // user chose not to publish this one
        if (r.status === 'added') t.added += 1
        else if (r.status === 'removed') t.removed += 1
        else if (r.status === 'changed') t.changed += 1
        else if (r.status === 'kept') t.kept += 1
        else if (r.status === 'stays' || r.status === 'slot') t.stays += 1
      }
    }
    return t
  }, [dayBlocks])

  // Report change totals up so the publish dialog can skip the "timetable
  // updated" notification when nothing actually changed.
  useEffect(() => {
    onTotals?.(totals)
  }, [totals, onTotals])

  // Classes that would overlap another after publishing (e.g. a new class on
  // top of a kept marked one). Each side of an overlap is flagged.
  const conflictCount = useMemo(
    () =>
      dayBlocks.reduce(
        (n, d) => n + d.rows.filter((r) => r.conflict).length,
        0,
      ),
    [dayBlocks],
  )

  const loadingCurrent = current === null

  return (
    <TooltipProvider>
      <div className="space-y-3">
      {conflictCount > 0 ? (
        <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>
            <span className="font-semibold">
              {conflictCount} timing conflict{conflictCount === 1 ? '' : 's'}
            </span>{' '}
            after publishing — classes below overlap on the clock (e.g. a new
            class on top of a kept/marked one). Review before publishing — use
            the row menu to drop a clashing class.
          </span>
        </div>
      ) : null}
      {holidays.length > 0 ? (
        <div className="rounded-md border bg-card px-3 py-2 text-xs">
          <p className="font-semibold text-foreground">Holidays in this week</p>
          <ul className="mt-1 space-y-0.5 text-muted-foreground">
            {holidays.map((h) => (
              <li key={h.date}>
                {h.date}
                {h.end_date && h.end_date !== h.date ? ` → ${h.end_date}` : ''}{' '}
                · {h.name}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="text-xs text-muted-foreground">
        {(() => {
          const parts: JSX.Element[] = []
          if (totals.added)
            parts.push(
              <span key="a" className="text-icon-emerald">
                {totals.added} added
              </span>,
            )
          if (totals.removed)
            parts.push(
              <span key="r" className="text-destructive">
                {totals.removed} removed
              </span>,
            )
          if (totals.changed)
            parts.push(
              <span key="c" className="text-warning">
                {totals.changed} changed
              </span>,
            )
          if (totals.stays) parts.push(<span key="s">{totals.stays} unchanged</span>)
          if (totals.kept)
            parts.push(
              <span key="k" className="text-warning">
                {totals.kept} marked kept
              </span>,
            )
          if (parts.length === 0) return 'Nothing to publish.'
          return parts.flatMap((node, i) =>
            i === 0 ? [node] : [<span key={`sep${i}`}> · </span>, node],
          )
        })()}
      </p>

      {loadingCurrent ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="shimmer h-10 rounded bg-muted/60" />
          ))}
        </div>
      ) : dayBlocks.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Nothing in the selected days.
        </p>
      ) : (
        <div className="space-y-3">
          {dayBlocks.map((d) => (
            <div key={d.iso} className="rounded-md border bg-card">
              <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-1.5">
                <span className="text-xs font-semibold">
                  {DAY_LABELS[d.dow].long}{' '}
                  <span className="font-mono tabular-nums text-muted-foreground">
                    {d.iso.slice(5)}
                  </span>
                </span>
                {d.blocked ? (
                  <Badge variant="destructive">Holiday</Badge>
                ) : null}
              </div>
              {d.rows.length === 0 ? (
                <p className="px-3 py-2 text-xs italic text-muted-foreground">
                  No classes.
                </p>
              ) : (
                <>
                  <div
                    className="grid items-center gap-x-3 border-b bg-muted/10 px-3 py-1 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground"
                    style={{
                      gridTemplateColumns:
                        'minmax(12rem,24rem) minmax(12rem,24rem) 1fr 7rem auto',
                    }}
                  >
                    <div>Before (now)</div>
                    <div>After (publish)</div>
                    <div />
                    <div>Change</div>
                    <div />
                  </div>
                  <ul className="divide-y">
                    {d.rows.map((row) => (
                      <DiffRow
                        key={row.key}
                        group={group}
                        ctx={ctx}
                        row={row}
                        onChanged={onChanged}
                        onReschedule={onReschedule}
                        onToggleExclude={onToggleExclude}
                      />
                    ))}
                  </ul>
                </>
              )}
            </div>
          ))}
        </div>
      )}
      </div>
    </TooltipProvider>
  )
}

function DiffRow({
  group,
  ctx,
  row,
  onChanged,
  onReschedule,
  onToggleExclude,
}: {
  group: InchargeGroupSummary
  ctx: OngoingContext | null
  row: DiffRowData
  onChanged: () => void
  onReschedule: (s: InchargeSession) => void
  onToggleExclude: (n: PreviewSessionT) => void
}) {
  const [mode, setMode] = useState<'idle' | 'remove' | 'edit'>('idle')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [fPss, setFPss] = useState<number | null>(null)
  const [fTeacher, setFTeacher] = useState<number | null>(null)

  const cur = row.cur
  // A brand-new ("added") class hasn't been written yet, so it can be dropped
  // from the publish rather than acted on like a real session.
  const droppable = row.status === 'added' && row.next !== null
  const chip = row.dropped
    ? {
        label: "Won't add",
        cls: 'border-input bg-muted text-muted-foreground',
      }
    : DIFF_CHIP[row.status]

  const subjects = useMemo(
    () => (ctx ? regularSubjects(ctx.pssLookup) : []),
    [ctx],
  )
  const selectedPss = useMemo(
    () => subjects.find((s) => s.id === fPss) ?? null,
    [subjects, fPss],
  )
  const faculty = useMemo(() => facultyForPss(selectedPss), [selectedPss])
  useEffect(() => {
    if (mode === 'edit') {
      setFTeacher((prev) => (faculty.length === 1 ? faculty[0].id : prev))
    }
  }, [faculty, mode])

  function openEdit() {
    if (!cur) return
    setFPss(cur.programme_semester_subject_id ?? null)
    setFTeacher(cur.effective_employee?.id ?? cur.scheduled_employee?.id ?? null)
    setError(null)
    setMode('edit')
  }

  async function run(fn: () => Promise<unknown>) {
    setBusy(true)
    setError(null)
    try {
      await fn()
      setMode('idle')
      onChanged()
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Action failed.',
      )
    } finally {
      setBusy(false)
    }
  }

  const canEditSave =
    cur !== null && fPss !== null && fTeacher !== null && !busy

  const showActions = cur !== null
  const isCancelled = cur?.status === 'cancelled'

  return (
    <li className="px-3 py-2">
      <div
        className="grid items-center gap-x-3"
        style={{
          gridTemplateColumns: 'minmax(12rem,24rem) minmax(12rem,24rem) 1fr 7rem auto',
        }}
      >
        <DiffSideCell
          display={row.before}
          strike={row.status === 'removed' || row.status === 'cancelled'}
        />
        <DiffSideCell
          display={row.after}
          emphasis={!row.dropped}
          strike={row.dropped}
        />
        {/* flexible spacer keeps Before/After tight together and pushes the
            Change chip + actions to the far right */}
        <div aria-hidden />
        <span
          className={cn(
            'justify-self-start whitespace-nowrap rounded-md border px-1.5 py-0.5 text-center text-[10px] font-medium uppercase tracking-wide',
            chip.cls,
          )}
        >
          {chip.label}
        </span>
        <div className="flex items-center gap-2 justify-self-end">
          {showActions ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Class actions"
                  className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <MoreVertical className="size-4" />
                </button>
              </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              {isCancelled ? (
                <DropdownMenuItem
                  onSelect={() => void run(() => uncancelInchargeSession(cur.id))}
                >
                  <RotateCcw />
                  Re-open this class
                </DropdownMenuItem>
              ) : (
                <>
                  <DropdownMenuItem onSelect={() => onReschedule(cur)}>
                    <ArrowLeftRight />
                    Reschedule…
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => openEdit()}>
                    <Pencil />
                    Edit subject / teacher
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => {
                      setReason('')
                      setError(null)
                      setMode('remove')
                    }}
                  >
                    <Ban />
                    Remove (cancel)
                  </DropdownMenuItem>
                </>
              )}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : droppable && row.next ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Added-class actions"
                  className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <MoreVertical className="size-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onSelect={() => onToggleExclude(row.next!)}>
                  {row.dropped ? (
                    <>
                      <RotateCcw />
                      Add back to publish
                    </>
                  ) : (
                    <>
                      <Ban />
                      Don't add this
                    </>
                  )}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </div>

      {row.conflict ? (
        <p className="mt-1 flex items-center gap-1.5 rounded-md border border-warning/40 bg-warning/10 px-2 py-1 text-[11px] text-warning">
          <AlertTriangle className="size-3.5 shrink-0" />
          Timing conflict — {row.conflict}
        </p>
      ) : null}

      {error ? (
        <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-destructive">
          <CircleAlert className="size-3.5 shrink-0" />
          {error}
        </p>
      ) : null}

      {mode === 'remove' && cur ? (
        <div className="mt-2 space-y-2 rounded-md border bg-muted/20 p-2">
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (optional)"
            maxLength={256}
            className="h-8"
          />
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setMode('idle')}
              disabled={busy}
            >
              Keep
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={busy}
              onClick={() =>
                void run(() =>
                  cancelInchargeSession(cur.id, {
                    reason: reason.trim() || 'Removed by incharge',
                  }),
                )
              }
            >
              {busy ? <Loader2 className="animate-spin" /> : null}
              Remove class
            </Button>
          </div>
        </div>
      ) : null}

      {mode === 'edit' && cur ? (
        <div className="mt-2 space-y-2 rounded-md border bg-muted/20 p-2">
          <p className="text-[11px] text-muted-foreground">
            Edits stick once you're done republishing — a later republish of the
            same template would reset this class.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <select
              value={fPss ?? ''}
              onChange={(e) =>
                setFPss(e.target.value ? Number(e.target.value) : null)
              }
              className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="">Select a subject…</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.subject
                    ? `${s.subject.code} · ${s.subject.name}`
                    : `Subject #${s.id}`}
                </option>
              ))}
            </select>
            <select
              value={fTeacher ?? ''}
              onChange={(e) =>
                setFTeacher(e.target.value ? Number(e.target.value) : null)
              }
              disabled={!selectedPss}
              className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm disabled:opacity-50"
            >
              <option value="">
                {selectedPss
                  ? faculty.length === 0
                    ? 'No faculty allocated'
                    : 'Select a teacher…'
                  : 'Pick a subject first'}
              </option>
              {faculty.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setMode('idle')}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!canEditSave}
              onClick={() =>
                void run(() =>
                  editInchargeSession(cur.id, {
                    programme_semester_subject_id: fPss ?? undefined,
                    scheduled_employee_id: fTeacher ?? undefined,
                  }),
                )
              }
            >
              {busy ? <Loader2 className="animate-spin" /> : null}
              Save
            </Button>
          </div>
        </div>
      ) : null}
    </li>
  )
}

// ---------------------------------------------------------------------------
// Week model
//
// Each day owns its own time-sorted list of cells. A "period" is a
// template-relative concept (P1 of template A is not the same clock time
// as P1 of template B), so the earlier matrix that aligned by period
// label lied the moment a week was published from two templates with
// different bell schedules. Columns by day, sorted by actual start time,
// keep every card honest about when it actually runs.
// ---------------------------------------------------------------------------

interface MatrixDay {
  iso: string
  dow: number
}

interface MatrixCell {
  kind: 'single' | 'slot'
  date: string
  /** Set on slot cells — the parent PSS placeholder name. */
  placeholder: string | null
  period: InchargeSession['timetable_period'] | null
  rows: InchargeSession[]
}

interface WeekData {
  days: MatrixDay[]
  /** dow (1..7) → cells for that day, sorted by period start_time. */
  cellsByDay: Map<number, MatrixCell[]>
}

interface SlotDetail {
  placeholder: string
  period: InchargeSession['timetable_period'] | null
  date: string
  rows: InchargeSession[]
}

function isSlotCohort(s: InchargeSession): boolean {
  return s.programme_semester_subject_option_id !== null
}

function subjectSortKey(s: InchargeSession): string {
  const sub =
    s.subject ??
    s.programme_semester_subject_option?.subject ??
    s.programme_semester_subject?.subject ??
    null
  return sub ? `${sub.code} ${sub.name}` : 'zzz'
}

/**
 * Group sessions into per-day columns sorted by their actual start
 * time. Slot cohorts (multiple option children sharing one cell) fold
 * into a single cell. Mon–Sat always render so the layout reads as a
 * consistent six-column board; Sunday is only included when at least
 * one session was published on that day — keeps the common case clean
 * while still surfacing the rare Sunday class when it exists.
 */
function buildWeek(rows: InchargeSession[], weekStart: Date): WeekData {
  const hasSunday = rows.some((r) => r.day_of_week === 7)
  const columns = hasSunday ? 7 : 6
  const days: MatrixDay[] = Array.from({ length: columns }, (_, i) => ({
    iso: toIsoDate(addDays(weekStart, i)),
    dow: i + 1,
  }))

  // Bucket sessions into one cell per (date, period, parent PSS). Slot
  // cohorts share the bucket key so their options fold together.
  const cellMap = new Map<string, MatrixCell>()
  for (const s of rows) {
    const slot = isSlotCohort(s)
    const key = slot
      ? `slot:${s.session_date}:${s.timetable_period_id}:${s.programme_semester_subject_id}`
      : `one:${s.id}`
    const existing = cellMap.get(key)
    if (existing) {
      existing.rows.push(s)
      continue
    }
    cellMap.set(key, {
      kind: slot ? 'slot' : 'single',
      date: s.session_date,
      placeholder: s.programme_semester_subject?.placeholder_name ?? null,
      period: s.timetable_period ?? null,
      rows: [s],
    })
  }

  const cellsByDay = new Map<number, MatrixCell[]>()
  for (const cell of cellMap.values()) {
    if (cell.kind === 'slot') {
      cell.rows.sort((a, b) =>
        subjectSortKey(a).localeCompare(subjectSortKey(b)),
      )
    }
    const dow = cell.rows[0].day_of_week
    const list = cellsByDay.get(dow) ?? []
    list.push(cell)
    cellsByDay.set(dow, list)
  }
  for (const list of cellsByDay.values()) {
    // Order each day by the cell's actual start_time — the only thing
    // that means "this comes before that" across templates. Fall back
    // to period position when start_time is missing.
    list.sort((a, b) => {
      const at = a.period?.start_time ?? ''
      const bt = b.period?.start_time ?? ''
      if (at !== bt) return at.localeCompare(bt)
      return (a.period?.position ?? 0) - (b.period?.position ?? 0)
    })
  }

  return { days, cellsByDay }
}

// ---------------------------------------------------------------------------
// Week view — days as columns. Each column owns its own time-sorted list
// of sessions, with the actual start/end clock time printed on every
// card. This is the layout that makes mixed-template weeks readable:
// Mon's "9:00" and Thu's "9:30" don't pretend to be the same row.
// ---------------------------------------------------------------------------

function SessionsWeek({
  week,
  canEdit,
  onCancel,
  onSubstitute,
  onUncancel,
  onReschedule,
  onEditDay,
  onOpenSlot,
}: {
  week: WeekData
  canEdit: boolean
  onCancel: (s: InchargeSession) => void
  onSubstitute: (s: InchargeSession) => void
  onUncancel: (s: InchargeSession) => void
  onReschedule: (s: InchargeSession) => void
  onEditDay: (iso: string) => void
  onOpenSlot: (detail: SlotDetail) => void
}) {
  const { days, cellsByDay } = week
  const todayIso = toIsoDate(new Date())
  // Per-column min width — 10rem × 7 = 70rem keeps Mon–Sat (60rem)
  // inside the typical employee-portal content area (~1100–1200px,
  // i.e. ~68–75rem). Sunday hangs just past the right edge so it's
  // discoverable via horizontal scroll but never crowds the layout
  // for the common Mon–Sat case.
  const minWidth = `${days.length * 10}rem`

  return (
    <div className="scrollbar-themed overflow-x-auto">
      <div
        className="grid divide-x"
        style={{
          gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))`,
          minWidth,
        }}
      >
        {days.map((d) => {
          const isToday = d.iso === todayIso
          const cells = cellsByDay.get(d.dow) ?? []
          return (
            <div
              key={d.iso}
              className={cn(
                'flex flex-col',
                isToday && 'bg-primary/[0.04]',
              )}
            >
              <button
                type="button"
                disabled={!canEdit}
                onClick={() => onEditDay(d.iso)}
                title={canEdit ? 'Edit this day' : undefined}
                className={cn(
                  'sticky top-0 z-10 border-b bg-muted/40 px-3 py-2 text-center',
                  isToday && 'bg-primary/10',
                  canEdit && 'group/dayhdr cursor-pointer hover:bg-accent',
                )}
              >
                <div
                  className={cn(
                    'flex items-center justify-center gap-1 text-[10px] font-semibold uppercase tracking-wide leading-tight',
                    isToday ? 'text-primary' : 'text-muted-foreground',
                  )}
                >
                  {DAY_LABELS[d.dow].short}
                  {canEdit ? (
                    <Pencil className="size-3 opacity-0 transition-opacity group-hover/dayhdr:opacity-60" />
                  ) : null}
                </div>
                <div className="font-mono text-xs tabular-nums leading-tight">
                  {d.iso.slice(5)}
                </div>
              </button>
              {cells.length === 0 ? (
                <div className="flex flex-1 items-center justify-center px-2 py-6 text-center text-[11px] italic text-muted-foreground">
                  No classes
                </div>
              ) : (
                <ul className="space-y-1.5 p-1.5">
                  {cells.map((cell, i) => (
                    <li
                      key={
                        cell.kind === 'single'
                          ? `single-${cell.rows[0].id}`
                          : `slot-${cell.date}-${cell.period?.id ?? i}-${
                              cell.rows[0].programme_semester_subject_id ?? i
                            }`
                      }
                      className="overflow-hidden rounded-md border bg-card shadow-sm"
                    >
                      <SessionCell
                        cell={cell}
                        canEdit={canEdit}
                        onCancel={onCancel}
                        onSubstitute={onSubstitute}
                        onUncancel={onUncancel}
                        onReschedule={onReschedule}
                        onOpenSlot={onOpenSlot}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/**
 * One cell inside a day column.
 *  - Slot:   button → opens the slot detail sheet listing every option
 *            with its own action menu (electives are inherently multi-
 *            teacher; squeezing actions into one dropdown would lie).
 *  - Single: clickable cell → DropdownMenu with cancel / re-open /
 *            substitute. Completed or view-only cells render the same
 *            body but without the trigger.
 *
 * Every card prints its own start/end clock time on the top line so two
 * cells with the same template-relative "Period 1" but different
 * timings sit honestly next to each other instead of being aligned by
 * the matrix's misleading shared row.
 */
function SessionCell({
  cell,
  canEdit,
  onCancel,
  onSubstitute,
  onUncancel,
  onReschedule,
  onOpenSlot,
}: {
  cell: MatrixCell
  canEdit: boolean
  onCancel: (s: InchargeSession) => void
  onSubstitute: (s: InchargeSession) => void
  onUncancel: (s: InchargeSession) => void
  onReschedule: (s: InchargeSession) => void
  onOpenSlot: (detail: SlotDetail) => void
}) {
  const period = cell.period
  const timeLine = period
    ? `${shortTime(period.start_time)}–${shortTime(period.end_time)}`
    : '—'

  // Shared hover state — `placement === null` means the card is hidden,
  // a non-null value carries the chosen edge (above/below + left/right).
  // We measure the trigger on enter so the popover never spills off the
  // viewport even for the last cell in a column or the rightmost column.
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [placement, setPlacement] = useState<HoverPlacement | null>(null)
  const openHover = () => {
    if (!wrapperRef.current) return
    setPlacement(computeHoverPlacement(wrapperRef.current.getBoundingClientRect()))
  }
  const closeHover = () => setPlacement(null)

  if (cell.kind === 'slot') {
    const placeholder = cell.placeholder ?? 'Elective slot'
    const allCancelled = cell.rows.every((r) => r.status === 'cancelled')
    const cancelledCount = cell.rows.filter(
      (r) => r.status === 'cancelled',
    ).length
    return (
      <div
        ref={wrapperRef}
        className="group relative"
        onMouseEnter={openHover}
        onMouseLeave={closeHover}
        onFocus={openHover}
        onBlur={closeHover}
      >
        <button
          type="button"
          onClick={() =>
            onOpenSlot({
              placeholder,
              period: cell.period,
              date: cell.date,
              rows: cell.rows,
            })
          }
          className={cn(
            'flex min-h-[5rem] w-full flex-col gap-1 px-2.5 py-2.5 text-left leading-tight transition-colors',
            'hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
            allCancelled && 'opacity-60',
          )}
          aria-label={`${placeholder} — ${cell.rows.length} options at ${timeLine}, click to inspect`}
        >
          <div className="flex items-center gap-1">
            <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
              {timeLine}
            </span>
            <span className="ml-auto inline-flex items-center gap-0.5 rounded-full bg-muted px-1 py-px text-[9px] font-semibold tabular-nums text-muted-foreground">
              <Users className="size-2.5" />
              {cell.rows.length}
            </span>
          </div>
          <div className="line-clamp-2 text-[11px] font-medium">
            {placeholder}
          </div>
          <div className="truncate text-[10px] italic text-muted-foreground">
            {cancelledCount > 0
              ? `${cancelledCount} cancelled`
              : 'Allocated dynamically'}
          </div>
          {/* Affordance icon: bottom-right corner. Subtle at rest, full
              opacity on hover — signals "this card opens something". */}
          <span
            aria-hidden
            className="pointer-events-none absolute bottom-1.5 right-1.5 text-muted-foreground opacity-30 transition-opacity group-hover:opacity-100"
          >
            <ChevronRight className="size-3" />
          </span>
        </button>
        {placement ? (
          <SessionHoverCard
            placement={placement}
            kind="slot"
            timeLine={timeLine}
            slotPlaceholder={placeholder}
            slotOptionCount={cell.rows.length}
            slotCancelledCount={cancelledCount}
            actionable={canEdit}
            actionHint="Click on the slot to inspect each option, cancel one, or assign a substitute"
          />
        ) : null}
      </div>
    )
  }

  const s = cell.rows[0]
  const subject =
    s.subject ??
    s.programme_semester_subject_option?.subject ??
    s.programme_semester_subject?.subject ??
    null
  const placeholderName = s.programme_semester_subject?.placeholder_name ?? null
  const cancelled = s.status === 'cancelled'
  const completed = s.status === 'completed'
  const substituted =
    s.scheduled_employee_id !== null &&
    s.effective_employee_id !== null &&
    s.scheduled_employee_id !== s.effective_employee_id
  const teacher = s.effective_employee?.emp_display_name ?? '—'
  const actionable = canEdit && !completed

  const body = (
    <div
      className={cn(
        'flex min-h-[5rem] flex-col gap-1 px-2.5 py-2.5 leading-tight',
        cancelled && 'opacity-60',
      )}
    >
      <div className="flex items-center gap-1">
        <span
          className={cn(
            'font-mono text-[10px] tabular-nums text-muted-foreground',
            cancelled && 'line-through',
          )}
        >
          {timeLine}
        </span>
        {subject ? (
          <span
            className={cn(
              'truncate font-mono text-[10px] uppercase text-muted-foreground',
              cancelled && 'line-through',
            )}
          >
            · {subject.code}
          </span>
        ) : null}
        {cancelled ? (
          <span
            aria-label="Cancelled"
            className="ml-auto inline-flex size-3.5 items-center justify-center rounded-full bg-destructive/15 text-[9px] font-bold text-destructive"
          >
            <CalendarX className="size-2.5" />
          </span>
        ) : completed ? (
          <span
            aria-label="Completed"
            className="ml-auto inline-flex size-3.5 items-center justify-center rounded-full bg-success/15 text-[9px] font-bold text-success"
          >
            ✓
          </span>
        ) : substituted ? (
          <span
            aria-label="Substituted"
            className="ml-auto inline-flex size-3.5 items-center justify-center rounded-full bg-warning/20 text-warning"
          >
            <UserCog className="size-2.5" />
          </span>
        ) : null}
      </div>
      <div
        className={cn(
          'line-clamp-2 text-[11px] font-medium',
          cancelled && 'line-through text-muted-foreground',
        )}
      >
        {subject ? subject.name : (placeholderName ?? '—')}
      </div>
      <div className="truncate text-[10px] text-muted-foreground">
        {teacher}
        {s.room ? ` · ${s.room}` : ''}
      </div>
    </div>
  )

  // Status hint for the hover card footer — explains what clicking does
  // OR why the cell is read-only (so the user understands the lack of
  // affordance icon on completed cells).
  const actionHint = !canEdit
    ? 'View only — your role can\'t edit sessions'
    : completed
      ? 'Already completed — can\'t change attendance afterwards'
      : cancelled
        ? 'Click on the subject to re-open this class or assign a substitute'
        : 'Click on the subject to cancel this class or assign an alternate teacher'

  const hoverCard = placement ? (
    <SessionHoverCard
      placement={placement}
      kind="single"
      timeLine={timeLine}
      subjectCode={subject?.code ?? null}
      subjectName={subject?.name ?? placeholderName ?? null}
      teacher={teacher}
      originalTeacher={
        substituted ? (s.scheduled_employee?.emp_display_name ?? null) : null
      }
      room={s.room}
      status={cancelled ? 'cancelled' : completed ? 'completed' : substituted ? 'substituted' : 'scheduled'}
      cancelReason={s.cancel_reason}
      actionable={actionable}
      actionHint={actionHint}
    />
  ) : null

  // No actions available → render the body inert with the hover card
  // still in place, so the user still gets the full details on hover
  // (just no menu trigger).
  if (!actionable) {
    return (
      <div
        ref={wrapperRef}
        className="group relative"
        onMouseEnter={openHover}
        onMouseLeave={closeHover}
        onFocus={openHover}
        onBlur={closeHover}
      >
        {body}
        {hoverCard}
      </div>
    )
  }

  return (
    <div
      ref={wrapperRef}
      className="group relative"
      onMouseEnter={openHover}
      onMouseLeave={closeHover}
      onFocus={openHover}
      onBlur={closeHover}
    >
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Session actions"
            className="block w-full text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          >
            {body}
            {/* Affordance icon: bottom-right corner. Always slightly
                visible so users know the card is actionable; full
                opacity on hover so it reads as the click target. */}
            <span
              aria-hidden
              className="pointer-events-none absolute bottom-1.5 right-1.5 text-muted-foreground opacity-40 transition-opacity group-hover:opacity-100"
            >
              <MoreVertical className="size-3.5" />
            </span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          {cancelled ? (
            <DropdownMenuItem onSelect={() => onUncancel(s)}>
              <RotateCcw />
              Re-open this class
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => onCancel(s)}
            >
              <CalendarX />
              Cancel this class
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={cancelled}
            onSelect={() => onSubstitute(s)}
          >
            <UserCog />
            Assign alternate teacher
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={cancelled}
            onSelect={() => onReschedule(s)}
          >
            <ArrowLeftRight />
            Reschedule…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {hoverCard}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Hover card placement
// ---------------------------------------------------------------------------

interface HoverPlacement {
  vertical: 'top' | 'bottom'
  horizontal: 'left' | 'center' | 'right'
}

// Rough max bounding box for the hover card. Used to predict whether
// the card would overflow on a given side so we can pre-flip placement
// before showing it. The actual rendered size is content-dependent;
// these are upper-bound estimates.
const HOVER_CARD_WIDTH = 256
const HOVER_CARD_MAX_HEIGHT = 240
const VIEWPORT_PADDING = 8

/**
 * Choose where to anchor the hover card relative to its trigger:
 *  - Vertical: prefer below; flip to above when the bottom edge of the
 *    viewport would clip the card and there's more room above.
 *  - Horizontal: prefer center-aligned on the trigger; if the
 *    center-anchored card would spill off either edge of the viewport,
 *    anchor to the matching side of the trigger instead.
 *
 * This is one-shot — recalculated on each hover-enter — which is fine
 * for a small, fixed-size popover. No resize listener needed.
 */
function computeHoverPlacement(rect: DOMRect): HoverPlacement {
  const vh = window.innerHeight
  const vw = window.innerWidth

  const spaceBelow = vh - rect.bottom - VIEWPORT_PADDING
  const spaceAbove = rect.top - VIEWPORT_PADDING
  const vertical: HoverPlacement['vertical'] =
    spaceBelow >= HOVER_CARD_MAX_HEIGHT || spaceBelow >= spaceAbove
      ? 'bottom'
      : 'top'

  const centerX = rect.left + rect.width / 2
  const halfCard = HOVER_CARD_WIDTH / 2
  let horizontal: HoverPlacement['horizontal'] = 'center'
  if (centerX - halfCard < VIEWPORT_PADDING) horizontal = 'left'
  else if (centerX + halfCard > vw - VIEWPORT_PADDING) horizontal = 'right'

  return { vertical, horizontal }
}

function placementClasses(p: HoverPlacement): string {
  return cn(
    p.vertical === 'bottom' ? 'top-full mt-1.5' : 'bottom-full mb-1.5',
    p.horizontal === 'center' && 'left-1/2 -translate-x-1/2',
    p.horizontal === 'left' && 'left-0',
    p.horizontal === 'right' && 'right-0',
  )
}

/**
 * Custom hover card that replaces the browser-native `title` tooltip on
 * each cell. Conditionally mounted — the parent passes `placement` only
 * when the trigger is hovered/focused, so the card flips above-vs-below
 * and left-vs-right depending on where the cell actually sits in the
 * viewport. Includes an explicit "click for options" footer when the
 * cell is actionable so the user knows what'll happen.
 */
function SessionHoverCard(
  props:
    | {
        placement: HoverPlacement
        kind: 'single'
        timeLine: string
        subjectCode: string | null
        subjectName: string | null
        teacher: string
        originalTeacher: string | null
        room: string | null
        status: 'scheduled' | 'completed' | 'cancelled' | 'substituted'
        cancelReason: string | null
        actionable: boolean
        actionHint: string
      }
    | {
        placement: HoverPlacement
        kind: 'slot'
        timeLine: string
        slotPlaceholder: string
        slotOptionCount: number
        slotCancelledCount: number
        actionable: boolean
        actionHint: string
      },
) {
  return (
    <div
      role="tooltip"
      className={cn(
        'pointer-events-none absolute z-30 w-64 rounded-md border bg-popover text-popover-foreground shadow-lg',
        placementClasses(props.placement),
      )}
    >
      <div className="space-y-1.5 p-3">
        {props.kind === 'single' ? (
          <>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                {props.subjectCode ? (
                  <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                    {props.subjectCode}
                  </p>
                ) : null}
                <p className="text-sm font-semibold leading-tight">
                  {props.subjectName ?? '—'}
                </p>
              </div>
              {props.status !== 'scheduled' ? (
                <StatusBadge status={props.status} />
              ) : null}
            </div>
            <div className="border-t pt-1.5 text-xs">
              <Row label="Time" value={props.timeLine} mono />
              <Row label="Teacher" value={props.teacher} />
              {props.originalTeacher ? (
                <Row
                  label="Originally"
                  value={props.originalTeacher}
                  muted
                />
              ) : null}
              {props.room ? <Row label="Room" value={props.room} /> : null}
              {props.cancelReason ? (
                <Row label="Reason" value={props.cancelReason} italic />
              ) : null}
            </div>
          </>
        ) : (
          <>
            <p className="text-sm font-semibold leading-tight">
              {props.slotPlaceholder}
            </p>
            <p className="text-[11px] italic text-muted-foreground">
              Open elective / honors slot — multiple options run in parallel
            </p>
            <div className="border-t pt-1.5 text-xs">
              <Row label="Time" value={props.timeLine} mono />
              <Row
                label="Options"
                value={`${props.slotOptionCount} subject${
                  props.slotOptionCount === 1 ? '' : 's'
                }`}
              />
              {props.slotCancelledCount > 0 ? (
                <Row
                  label="Cancelled"
                  value={`${props.slotCancelledCount} of ${props.slotOptionCount}`}
                />
              ) : null}
            </div>
          </>
        )}
        <div className="border-t pt-1.5">
          <p
            className={cn(
              'flex items-start gap-1 text-[11px] font-medium leading-snug',
              props.actionable ? 'text-primary' : 'text-muted-foreground',
            )}
          >
            {props.actionable ? (
              <ChevronRight className="mt-0.5 size-3 shrink-0" />
            ) : (
              <Eye className="mt-0.5 size-3 shrink-0" />
            )}
            <span>{props.actionHint}</span>
          </p>
        </div>
      </div>
    </div>
  )
}

function Row({
  label,
  value,
  mono = false,
  muted = false,
  italic = false,
}: {
  label: string
  value: string
  mono?: boolean
  muted?: boolean
  italic?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-2 py-0.5">
      <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span
        className={cn(
          'truncate text-right',
          mono && 'font-mono tabular-nums',
          muted && 'text-muted-foreground',
          italic && 'italic',
        )}
      >
        {value}
      </span>
    </div>
  )
}

function StatusBadge({
  status,
}: {
  status: 'cancelled' | 'completed' | 'substituted'
}) {
  if (status === 'cancelled') {
    return <Badge variant="destructive">Cancelled</Badge>
  }
  if (status === 'completed') {
    return <Badge variant="success">Completed</Badge>
  }
  return <Badge variant="secondary">Substituted</Badge>
}

// ---------------------------------------------------------------------------
// Slot detail sheet — opened when a slot cell is clicked. Shows each
// option (subject + current teacher) with its own action menu, since
// substitution and cancellation are per-option, not per-slot (the
// underlying class_sessions rows are per-cohort).
// ---------------------------------------------------------------------------

function SlotDetailSheet({
  open,
  detail,
  canEdit,
  onClose,
  onCancel,
  onSubstitute,
  onUncancel,
  onReschedule,
}: {
  open: boolean
  detail: SlotDetail | null
  canEdit: boolean
  onClose: () => void
  onCancel: (s: InchargeSession) => void
  onSubstitute: (s: InchargeSession) => void
  onUncancel: (s: InchargeSession) => void
  onReschedule: (s: InchargeSession) => void
}) {
  // A representative option to seed the reschedule sheet — the sheet gathers
  // the rest of the cohort itself. Only group-owned, still-actionable options
  // can be moved (cross-group cohorts are admin-only; completed are locked).
  const reschedulable =
    detail?.rows.find(
      (r) =>
        r.attendance_group_id !== null &&
        r.status !== 'completed' &&
        r.status !== 'cancelled',
    ) ?? null
  return (
    <Sheet open={open} onOpenChange={(v) => (!v ? onClose() : null)}>
      <SheetContent side="right" className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Users className="size-5 text-icon-cyan" />
            {detail?.placeholder ?? 'Elective slot'}
          </SheetTitle>
          <SheetDescription>
            {detail ? (
              <>
                <span className="font-medium">{detail.date}</span>
                {detail.period ? (
                  <>
                    {' '}· {detail.period.label} ·{' '}
                    <span className="font-mono">
                      {shortTime(detail.period.start_time)}–
                      {shortTime(detail.period.end_time)}
                    </span>
                  </>
                ) : null}
              </>
            ) : null}
          </SheetDescription>
        </SheetHeader>
        <div className="scrollbar-themed flex-1 space-y-3 overflow-y-auto px-4 pb-4">
          <p className="text-xs text-muted-foreground">
            Students follow whichever option they're enrolled in — per-option
            actions apply to a single subject + teacher combination, while
            rescheduling moves the whole slot at once.
          </p>
          {canEdit && reschedulable ? (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => onReschedule(reschedulable)}
            >
              <ArrowLeftRight />
              Reschedule whole slot
            </Button>
          ) : null}
          <ul className="space-y-1 rounded-md border bg-card p-2">
            {detail?.rows.map((child) => (
              <SlotChildRow
                key={child.id}
                child={child}
                canEdit={canEdit}
                onCancel={() => onCancel(child)}
                onUncancel={() => onUncancel(child)}
                onSubstitute={() => onSubstitute(child)}
              />
            ))}
          </ul>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function SlotChildRow({
  child,
  canEdit,
  onCancel,
  onUncancel,
  onSubstitute,
}: {
  child: InchargeSession
  canEdit: boolean
  onCancel: () => void
  onUncancel: () => void
  onSubstitute: () => void
}) {
  const subject =
    child.subject ??
    child.programme_semester_subject_option?.subject ??
    null
  const cancelled = child.status === 'cancelled'
  const completed = child.status === 'completed'
  const substituted =
    child.scheduled_employee_id !== null &&
    child.effective_employee_id !== null &&
    child.scheduled_employee_id !== child.effective_employee_id
  // Cross-group cohorts (cohort_scope='programme_semester') aren't owned
  // by any one incharge — the server refuses mutations on them. Disable
  // the menu visually so the reason is obvious.
  const crossGroup = child.attendance_group_id === null

  return (
    <li className="flex items-start gap-2 pl-1">
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={cn(
              'truncate text-sm',
              cancelled && 'line-through text-muted-foreground',
            )}
          >
            {subject ? (
              <>
                <span className="font-mono text-xs">{subject.code}</span>{' '}
                <span className="font-medium">{subject.name}</span>
              </>
            ) : (
              '—'
            )}
          </span>
          {cancelled ? (
            <Badge variant="destructive">Cancelled</Badge>
          ) : completed ? (
            <Badge variant="success">Completed</Badge>
          ) : substituted ? (
            <Badge variant="secondary">Substituted</Badge>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <UserCog className="size-3" />
            {sessionTeacherLabel(child)}
          </span>
          {substituted && child.scheduled_employee ? (
            <span className="text-[11px]">
              (originally {child.scheduled_employee.emp_display_name})
            </span>
          ) : null}
          {child.room ? <span>· Room {child.room}</span> : null}
        </div>
        {cancelled && child.cancel_reason ? (
          <p className="text-[11px] italic text-muted-foreground">
            Reason: {child.cancel_reason}
          </p>
        ) : null}
      </div>
      {canEdit ? (
        crossGroup ? (
          <span className="self-center text-[10px] uppercase tracking-wide text-muted-foreground">
            View only
          </span>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Option actions"
                disabled={completed}
              >
                <MoreVertical />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {cancelled ? (
                <DropdownMenuItem onSelect={() => onUncancel()}>
                  <RotateCcw />
                  Re-open this option
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={() => onCancel()}
                >
                  <CalendarX />
                  Cancel this option
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => onSubstitute()}
                disabled={cancelled}
              >
                <UserCog />
                Assign alternate teacher
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      ) : null}
    </li>
  )
}

function EmptyWeekState() {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      <div className="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
        <CalendarRange className="size-5" />
      </div>
      <h3 className="text-sm font-medium">No sessions this week</h3>
      <p className="max-w-sm text-xs text-muted-foreground">
        Use the Publish panel below to seed this week's sessions from a
        template.
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Cancel sheet
// ---------------------------------------------------------------------------

function CancelSessionSheet({
  open,
  session,
  onClose,
  onCancelled,
}: {
  open: boolean
  session: InchargeSession | null
  onClose: () => void
  onCancelled: (next: InchargeSession) => void
}) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setReason('')
      setError(null)
    }
  }, [open])

  async function submit() {
    if (!session || reason.trim().length === 0) return
    setBusy(true)
    setError(null)
    try {
      const next = await cancelInchargeSession(session.id, {
        reason: reason.trim(),
      })
      onCancelled(next)
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Couldn't cancel this class.",
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => (!v ? onClose() : null)}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <CalendarX className="size-5 text-destructive" />
            Cancel this class
          </SheetTitle>
          <SheetDescription>
            {session ? (
              <>
                {sessionSubjectLabel(session)} on{' '}
                <span className="font-medium">{session.session_date}</span>
                {session.timetable_period
                  ? ` · ${session.timetable_period.label}`
                  : ''}
              </>
            ) : null}
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-3 px-4">
          <Label htmlFor="cancel-reason">Reason</Label>
          <Input
            id="cancel-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Faculty on duty leave"
            maxLength={256}
          />
          <p className="text-xs text-muted-foreground">
            Students see the cancellation immediately; attendance for this
            session can't be marked afterwards. You can re-open the class
            from this list as long as the date hasn't passed.
          </p>
          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : null}
        </div>
        <SheetFooter>
          <Button
            variant="destructive"
            onClick={() => void submit()}
            disabled={busy || reason.trim().length === 0}
          >
            {busy ? <Loader2 className="animate-spin" /> : <CalendarX />}
            Cancel class
          </Button>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Keep class
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

// ---------------------------------------------------------------------------
// Substitute sheet
// ---------------------------------------------------------------------------

function SubstituteSessionSheet({
  open,
  session,
  onClose,
  onSubstituted,
}: {
  open: boolean
  session: InchargeSession | null
  onClose: () => void
  onSubstituted: (next: InchargeSession) => void
}) {
  const [employees, setEmployees] = useState<LookupEmployee[] | null>(null)
  const [filter, setFilter] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setFilter('')
    setSelectedId(null)
    setReason('')
    setError(null)
    let cancelled = false
    fetchInchargeEmployees()
      .then((rows) => {
        if (cancelled) return
        setEmployees(rows)
      })
      .catch((err) => {
        if (cancelled) return
        setError(
          err instanceof Error
            ? err.message
            : "Couldn't load the employee list.",
        )
      })
    return () => {
      cancelled = true
    }
  }, [open])

  const matches = useMemo(() => {
    const q = filter.trim().toLowerCase()
    const list = employees ?? []
    // Don't offer the currently effective teacher as a substitute.
    const filtered = list.filter(
      (e) => e.id !== session?.effective_employee_id,
    )
    if (q.length === 0) return filtered.slice(0, 30)
    return filtered
      .filter(
        (e) =>
          e.emp_display_name.toLowerCase().includes(q) ||
          e.emp_code.toLowerCase().includes(q),
      )
      .slice(0, 30)
  }, [employees, filter, session?.effective_employee_id])

  async function submit() {
    if (!session || selectedId === null) return
    setBusy(true)
    setError(null)
    try {
      const next = await substituteInchargeSession(session.id, {
        new_effective_employee_id: selectedId,
        reason: reason.trim() || undefined,
      })
      onSubstituted(next)
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Couldn't assign the substitute.",
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => (!v ? onClose() : null)}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <UserCog className="size-5 text-icon-blue" />
            Assign alternate teacher
          </SheetTitle>
          <SheetDescription>
            {session ? (
              <>
                {sessionSubjectLabel(session)} on{' '}
                <span className="font-medium">{session.session_date}</span>
                {session.timetable_period
                  ? ` · ${session.timetable_period.label}`
                  : ''}
                {session.effective_employee
                  ? ` · currently ${session.effective_employee.emp_display_name}`
                  : ''}
              </>
            ) : null}
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-3 px-4">
          <Label>Alternate teacher</Label>
          <TeacherPicker
            employees={employees}
            selectedId={selectedId}
            onSelect={setSelectedId}
            filter={filter}
            onFilterChange={setFilter}
            matches={matches}
          />
          <Label htmlFor="sub-reason">Reason (optional)</Label>
          <Input
            id="sub-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Faculty out sick"
            maxLength={256}
          />
          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : null}
        </div>
        <SheetFooter>
          <Button
            onClick={() => void submit()}
            disabled={busy || selectedId === null}
          >
            {busy ? <Loader2 className="animate-spin" /> : <UserCog />}
            Assign
          </Button>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

/**
 * Select-style teacher picker for the substitute sheet. The trigger
 * shows the chosen teacher (or a "Select…" placeholder) the way a
 * native `<select>` does; clicking opens a dropdown panel with a search
 * box on top and the filtered list below. Reads as a dropdown — which
 * is what users expect for "pick one of these" — instead of the older
 * always-visible scrollable list that looked like a free-form list.
 */
function TeacherPicker({
  employees,
  selectedId,
  onSelect,
  filter,
  onFilterChange,
  matches,
}: {
  employees: LookupEmployee[] | null
  selectedId: number | null
  onSelect: (id: number) => void
  filter: string
  onFilterChange: (q: string) => void
  matches: LookupEmployee[]
}) {
  const [open, setOpen] = useState(false)
  const selected = employees?.find((e) => e.id === selectedId) ?? null
  const loading = employees === null

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          disabled={loading}
          className={cn(
            'flex w-full items-center justify-between gap-2 rounded-md border bg-card px-3 py-2 text-left text-sm transition-colors',
            'hover:bg-accent hover:text-accent-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            'disabled:cursor-not-allowed disabled:opacity-60',
          )}
        >
          {loading ? (
            <span className="text-muted-foreground">
              Loading employees…
            </span>
          ) : selected ? (
            <span className="flex min-w-0 items-center gap-2">
              <span className="truncate">{selected.emp_display_name}</span>
              <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                {selected.emp_code}
              </span>
            </span>
          ) : (
            <span className="text-muted-foreground">
              Select an alternate teacher…
            </span>
          )}
          <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={4}
        // Match the trigger width so the panel reads as a continuation of
        // the same control rather than an unrelated popover.
        className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-[18rem] p-0"
        // Keep focus on our search input when the menu opens — Radix
        // would otherwise jump to the first item and immediately
        // scroll past the search field.
        onOpenAutoFocus={(e) => {
          e.preventDefault()
        }}
      >
        <div className="border-b p-2">
          <Input
            autoFocus
            value={filter}
            onChange={(e) => onFilterChange(e.target.value)}
            // Stop typing keys from bubbling up to Radix's menu nav so
            // letters land in the input instead of triggering item
            // type-ahead matching.
            onKeyDown={(e) => e.stopPropagation()}
            placeholder="Search by name or employee code"
          />
        </div>
        <div className="scrollbar-themed max-h-72 overflow-y-auto py-1">
          {matches.length === 0 ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">
              No matches.
            </div>
          ) : (
            matches.map((e) => {
              const isSelected = selectedId === e.id
              return (
                <DropdownMenuItem
                  key={e.id}
                  onSelect={() => onSelect(e.id)}
                  className="flex items-center justify-between gap-2"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Check
                      className={cn(
                        'size-3.5 shrink-0',
                        isSelected ? 'text-primary' : 'opacity-0',
                      )}
                    />
                    <span className="truncate">{e.emp_display_name}</span>
                  </span>
                  <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                    {e.emp_code}
                  </span>
                </DropdownMenuItem>
              )
            })
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}


