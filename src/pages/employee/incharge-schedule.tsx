import {
  CalendarCheck,
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
  RefreshCw,
  RotateCcw,
  UserCog,
  Users,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

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
import { useScreenAccess } from '@/hooks/use-screen-access'
import { ApiError } from '@/lib/api'
import {
  fetchInchargeGroups,
  type InchargeGroupSummary,
} from '@/lib/incharge-attendance'
import {
  fetchInchargeEmployees,
  fetchInchargeProgrammeSemesters,
  fetchInchargeTimetables,
  fetchInchargeWeekSummaries,
  previewInchargeWeek,
  publishInchargeWeek,
  type IncharqeTimetableSummary,
  type LookupEmployee,
  type LookupProgrammeSemester,
  type PreviewResult,
  type WeekSummary,
} from '@/lib/incharge-schedule'
import {
  cancelInchargeSession,
  fetchInchargeSessions,
  substituteInchargeSession,
  uncancelInchargeSession,
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

  useEffect(() => {
    if (!open) return
    setPublishError(null)
    setPreview(null)
    setPreviewError(null)
    if (templates && templates.length > 0) {
      const def = templates.find((t) => t.is_default) ?? templates[0]
      setSelectedTemplateId(def.id)
    } else {
      setSelectedTemplateId(null)
    }
  }, [open, templates])

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
  }, [open, selectedTemplateId, from, to, daysKey])

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
      })
      // Refresh the strip + sessions list, then close — the user sees the
      // chip flip from "Publish" to "Republish" with the new session
      // counts, which is the natural success signal here.
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
              <PreviewBlock preview={preview} weekStart={weekStart} />
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
            onClick={() => void runPublish()}
            disabled={
              !canPublish ||
              !hasTemplates ||
              selectedTemplateId === null ||
              selectedDays.size === 0 ||
              publishing ||
              previewLoading
            }
          >
            {publishing ? (
              <>
                <Loader2 className="animate-spin" />
                Publishing…
              </>
            ) : (
              <>
                <CalendarCheck />
                {isPartialWeek
                  ? `Publish ${selectedDays.size} day${selectedDays.size === 1 ? '' : 's'}`
                  : 'Publish week'}
              </>
            )}
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
    </Sheet>
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
        <Button
          variant="outline"
          size="sm"
          onClick={() => void load()}
          disabled={loading}
        >
          {loading ? <Loader2 className="animate-spin" /> : <RefreshCw />}
          Refresh
        </Button>
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
      />
    </Card>
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
  onOpenSlot,
}: {
  week: WeekData
  canEdit: boolean
  onCancel: (s: InchargeSession) => void
  onSubstitute: (s: InchargeSession) => void
  onUncancel: (s: InchargeSession) => void
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
              <div
                className={cn(
                  'sticky top-0 z-10 border-b bg-muted/40 px-3 py-2 text-center',
                  isToday && 'bg-primary/10',
                )}
              >
                <div
                  className={cn(
                    'text-[10px] font-semibold uppercase tracking-wide leading-tight',
                    isToday ? 'text-primary' : 'text-muted-foreground',
                  )}
                >
                  {DAY_LABELS[d.dow].short}
                </div>
                <div className="font-mono text-xs tabular-nums leading-tight">
                  {d.iso.slice(5)}
                </div>
              </div>
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
  onOpenSlot,
}: {
  cell: MatrixCell
  canEdit: boolean
  onCancel: (s: InchargeSession) => void
  onSubstitute: (s: InchargeSession) => void
  onUncancel: (s: InchargeSession) => void
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
}: {
  open: boolean
  detail: SlotDetail | null
  canEdit: boolean
  onClose: () => void
  onCancel: (s: InchargeSession) => void
  onSubstitute: (s: InchargeSession) => void
  onUncancel: (s: InchargeSession) => void
}) {
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
            Students follow whichever option they're enrolled in — actions
            apply to a single subject + teacher combination.
          </p>
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

/**
 * Renders the would-be-published week as a periods × days matrix so the
 * incharge can scan the whole template at once and confirm everything is
 * where it should be before pressing publish.
 *
 * Columns: 7 days starting from weekStart (so Sun shows even with no
 *   working-day classes, since it still tells the user "yes, blank").
 * Rows: the distinct (teaching) periods seen in the preview — break
 *   periods are absent because they get no sessions seeded.
 * Cells: regular sessions render subject + teacher; slot cohorts
 *   collapse into one "Allocated dynamically" cell so the matrix doesn't
 *   pretend an open elective is one teacher.
 */
function PreviewBlock({
  preview,
  weekStart,
}: {
  preview: PreviewResult
  weekStart: Date
}) {
  const sessions = preview.sessions ?? []
  const holidays = preview.holidays ?? []
  const blockedDates = useMemo(
    () => new Set(preview.blocked_dates ?? []),
    [preview.blocked_dates],
  )
  const newSessions = sessions.filter((s) => !s.already_exists).length
  const alreadyExisting = sessions.length - newSessions

  // 7-day window, with trailing all-empty days trimmed off so a Mon–Sat
  // template doesn't leave a useless Sunday column eating horizontal
  // space. A day is "kept" if it has any session OR is holiday-blocked
  // (we still want the viewer to see the holiday call-out). Always keep
  // at least 5 columns so the first publish — where everything is
  // already_exists=false but the strip is empty — still renders Mon-Fri.
  const days = useMemo(() => {
    const sessionDates = new Set(sessions.map((s) => s.session_date))
    const all = Array.from({ length: 7 }, (_, i) => {
      const date = addDays(weekStart, i)
      const iso = toIsoDate(date)
      return { iso, dow: i + 1, date }
    })
    let lastUsed = -1
    for (let i = 0; i < all.length; i += 1) {
      if (sessionDates.has(all[i].iso) || blockedDates.has(all[i].iso)) {
        lastUsed = i
      }
    }
    const cutoff = Math.max(4, lastUsed) // 4 → keep through Fri
    return all.slice(0, cutoff + 1)
  }, [weekStart, sessions, blockedDates])

  // Distinct teaching periods in the preview, sorted by start_time so
  // the matrix reads top-to-bottom in clock order.
  const periods = useMemo(() => {
    const map = new Map<
      number,
      {
        id: number
        label: string | null
        start: string | null
        end: string | null
      }
    >()
    for (const s of sessions) {
      if (!map.has(s.timetable_period_id)) {
        map.set(s.timetable_period_id, {
          id: s.timetable_period_id,
          label: s.period_label,
          start: s.period_start_time,
          end: s.period_end_time,
        })
      }
    }
    return Array.from(map.values()).sort((a, b) =>
      (a.start ?? '').localeCompare(b.start ?? ''),
    )
  }, [sessions])

  // Cell lookup: keyed by `${period_id}:${date}`. Multiple entries means
  // a slot cohort cell (one per option).
  const cells = useMemo(() => {
    const m = new Map<string, typeof sessions>()
    for (const s of sessions) {
      const k = `${s.timetable_period_id}:${s.session_date}`
      const list = m.get(k) ?? []
      list.push(s)
      m.set(k, list)
    }
    return m
  }, [sessions])

  return (
    <div className="space-y-3">
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

      {periods.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Nothing to publish — the template has no classes scheduled in this
          week's working days.
        </p>
      ) : (
        <div className="rounded-md border bg-card">
          <table className="w-full table-fixed border-collapse text-xs">
            <colgroup>
              <col className="w-[6.5rem]" />
              {days.map((d) => (
                <col key={d.iso} />
              ))}
            </colgroup>
            <thead className="bg-muted/40">
              <tr>
                <th className="border-b border-r px-2 py-1.5 text-left font-medium">
                  Period
                </th>
                {days.map((d) => {
                  const blocked = blockedDates.has(d.iso)
                  return (
                    <th
                      key={d.iso}
                      className={cn(
                        'border-b border-r px-1.5 py-1.5 text-center font-medium',
                        blocked && 'bg-destructive/5',
                      )}
                    >
                      <div className="flex items-center justify-center gap-1.5 leading-tight">
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          {DAY_LABELS[d.dow].short}
                        </span>
                        <span className="font-mono tabular-nums">
                          {d.iso.slice(5)}
                        </span>
                        {blocked ? (
                          <Badge variant="destructive">Holiday</Badge>
                        ) : null}
                      </div>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {periods.map((p) => (
                <tr key={p.id}>
                  <td className="border-b border-r bg-muted/20 px-2 py-1.5 align-top">
                    <div className="truncate font-medium leading-tight">
                      {p.label ?? '—'}
                    </div>
                    <div className="font-mono text-[10px] leading-tight tabular-nums text-muted-foreground">
                      {shortTime(p.start)}–{shortTime(p.end)}
                    </div>
                  </td>
                  {days.map((d) => {
                    const blocked = blockedDates.has(d.iso)
                    const cellSessions =
                      cells.get(`${p.id}:${d.iso}`) ?? []
                    return (
                      <td
                        key={d.iso}
                        className={cn(
                          'border-b border-r px-1.5 py-1.5 align-top',
                          blocked && 'bg-destructive/5',
                        )}
                      >
                        <PreviewCell
                          blocked={blocked}
                          sessions={cellSessions}
                        />
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {sessions.length} session{sessions.length === 1 ? '' : 's'} planned
        {alreadyExisting > 0
          ? ` (${newSessions} new, ${alreadyExisting} already exist)`
          : ''}
        .
      </p>
    </div>
  )
}

function PreviewCell({
  blocked,
  sessions,
}: {
  blocked: boolean
  sessions: PreviewResult['sessions']
}) {
  if (blocked) {
    return (
      <span className="text-[10px] italic text-muted-foreground">Holiday</span>
    )
  }
  if (sessions.length === 0) {
    return <span className="text-muted-foreground">—</span>
  }
  const placeholder = sessions[0].slot_placeholder_name
  if (placeholder !== null) {
    return (
      <div className="space-y-0 leading-tight">
        <div className="truncate text-[11px] font-medium">{placeholder}</div>
        <div className="text-[10px] italic text-muted-foreground">
          Allocated dynamically
        </div>
        <div className="text-[10px] text-muted-foreground">
          {sessions.length} option{sessions.length === 1 ? '' : 's'}
        </div>
        {sessions.some((s) => s.already_exists) ? (
          <div className="text-[10px] text-warning">already exists</div>
        ) : null}
      </div>
    )
  }
  const s = sessions[0]
  // Build a multi-line tooltip with the full subject name + code +
  // teacher (and room, if any) so the user can hover any truncated cell
  // and read the complete details without leaving the preview.
  const tooltipLines = [
    s.subject_code && s.subject_name
      ? `${s.subject_code} · ${s.subject_name}`
      : (s.subject_name ?? s.subject_code ?? ''),
    s.teacher_name ? `Teacher: ${s.teacher_name}` : '',
    s.room ? `Room: ${s.room}` : '',
  ].filter(Boolean)
  return (
    <div
      className={cn('space-y-0 leading-tight', s.already_exists && 'opacity-70')}
      title={tooltipLines.join('\n')}
    >
      <div className="truncate text-[11px] font-medium">
        {s.subject_name ?? s.subject_code ?? '—'}
      </div>
      <div className="truncate text-[10px] text-muted-foreground">
        {s.teacher_name ?? '—'}
      </div>
      {s.already_exists ? (
        <div className="text-[10px] text-warning">already exists</div>
      ) : null}
    </div>
  )
}
