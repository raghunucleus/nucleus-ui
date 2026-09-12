import {
  BarChart3,
  CalendarDays,
  ChevronsUpDown,
  ClipboardList,
  LayoutGrid,
  TriangleAlert,
  Users,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { TabsBar, type TabDef } from '@/components/ui/tabs-bar'
import { DailyTab } from '@/components/employee/attendance-analytics/daily-tab'
import { GroupPickerDialog } from '@/components/employee/attendance-analytics/group-picker-dialog'
import { OverviewTab } from '@/components/employee/attendance-analytics/overview-tab'
import { SessionsTab } from '@/components/employee/attendance-analytics/sessions-tab'
import {
  errMsg,
  nf,
  rangePresets,
  readStored,
  writeStored,
} from '@/components/employee/attendance-analytics/format'
import { StudentsTab } from '@/components/employee/attendance-analytics/students-tab'
import { SubjectsTab } from '@/components/employee/attendance-analytics/subjects-tab'
import { EmptyNote } from '@/components/employee/attendance-analytics/ui'
import { NoAccessEmptyState } from '@/components/employee/empty-states'
import { Button } from '@/components/ui/button'
import { Combobox } from '@/components/ui/combobox'
import { DateRangePicker } from '@/components/ui/date-range-picker'
import { PageHeader } from '@/components/ui/page-header'
import { useScreenAccess } from '@/hooks/use-screen-access'
import {
  fetchAnalyticsScope,
  type AnalyticsGroup,
  type AnalyticsRange,
} from '@/lib/attendance-analytics'
import { toIsoDate } from '@/lib/teacher-attendance'

export const ATTENDANCE_ANALYTICS_SCREEN_KEY =
  'attendance.incharge.analytics.view'

const TABS: TabDef[] = [
  { key: 'overview', label: 'Overview', icon: LayoutGrid },
  { key: 'students', label: 'Students', icon: Users },
  { key: 'subjects', label: 'Subjects', icon: BarChart3 },
  { key: 'daily', label: 'Day-wise', icon: CalendarDays },
  { key: 'defaulters', label: 'Defaulters', icon: TriangleAlert },
  { key: 'sessions', label: 'Classes', icon: ClipboardList },
]

const LS_GROUP = 'nucleus.attendanceAnalytics.groupId'
const LS_TAB = 'nucleus.attendanceAnalytics.tab'

/**
 * Attendance Analytics — the group-wise view for an attendance-group incharge.
 *
 * The whole screen is pinned to (group, semester, optional date range). Leaving
 * the dates empty is the DEFAULT and the meaningful one: the server then answers
 * from the same rollup the student's own dashboard reads, so the percentages
 * here are the official ones. Picking dates switches to a live scan of that
 * window and drops OD / medical adjustments — each tab says so.
 */
export default function EmployeeAttendanceAnalyticsPage() {
  const access = useScreenAccess(ATTENDANCE_ANALYTICS_SCREEN_KEY)

  const [groups, setGroups] = useState<AnalyticsGroup[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [groupId, setGroupId] = useState<number | null>(null)
  const [psId, setPsId] = useState<number | null>(null)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [tab, setTab] = useState(() => readStored(LS_TAB) ?? 'overview')
  const [pickerOpen, setPickerOpen] = useState(false)

  const today = toIsoDate(new Date())

  useEffect(() => {
    document.title = 'Attendance Analytics — Nucleus'
  }, [])

  useEffect(() => {
    let cancelled = false
    fetchAnalyticsScope()
      .then((d) => {
        if (cancelled) return
        setGroups(d.groups)
        setLoadError(null)
        const remembered = Number(readStored(LS_GROUP))
        const pick =
          d.groups.find((g) => g.id === remembered) ?? d.groups[0] ?? null
        if (pick) {
          setGroupId(pick.id)
          setPsId(pick.default_programme_semester_id)
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) setLoadError(errMsg(e, 'Could not load your groups.'))
      })
    return () => {
      cancelled = true
    }
  }, [])

  const group = useMemo(
    () => groups?.find((g) => g.id === groupId) ?? null,
    [groups, groupId],
  )

  // Changing group re-pins the semester: the previous one belongs to a
  // different batch and the server would reject it.
  const chooseGroup = useCallback(
    (g: AnalyticsGroup) => {
      setGroupId(g.id)
      setPsId(g.default_programme_semester_id)
      setFrom('')
      setTo('')
      writeStored(LS_GROUP, String(g.id))
    },
    [],
  )

  const changeTab = useCallback((k: string) => {
    setTab(k)
    writeStored(LS_TAB, k)
  }, [])

  /**
   * Dates are both-or-neither — the server 400s on half a range — and never run
   * past today, because there is no attendance in the future. The calendar has
   * `min` but no `max`, so the clamp lives here.
   *
   * One atomic setter rather than a pair: a preset sets both ends at once, and
   * two callbacks reading each other's state would each see the pre-update
   * value in the same tick. The half-set cases below reproduce what the old
   * `changeFrom`/`changeTo` did when the other end was still empty.
   */
  const changeRange = useCallback(
    ({ from: f, to: t }: { from: string; to: string }) => {
      const a = f && f > today ? today : f
      const b = t && t > today ? today : t
      if (!a && !b) {
        setFrom('')
        setTo('')
      } else if (a && !b) {
        setFrom(a)
        setTo(today)
      } else if (!a && b) {
        setFrom(b)
        setTo(b)
      } else {
        setFrom(a)
        setTo(b)
      }
    },
    [today],
  )

  const semester = useMemo(
    () => group?.programme_semesters.find((ps) => ps.id === psId) ?? null,
    [group, psId],
  )

  const presets = useMemo(
    () => rangePresets(today, semester),
    [today, semester],
  )

  const range: AnalyticsRange | null = useMemo(() => {
    if (groupId === null || psId === null) return null
    return {
      group_id: groupId,
      programme_semester_id: psId,
      ...(from && to ? { from, to } : {}),
    }
  }, [groupId, psId, from, to])

  if (!access) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <NoAccessEmptyState />
      </div>
    )
  }

  const groupMeta = group
    ? `${
        group.programme.department?.code
          ? `${group.programme.department.code} · `
          : ''
      }${group.programme.code} · ${group.admission_year.display_year} · ${nf(group.member_count)} students`
    : ''

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      {/* Pinned: identity, tabs and scope. These tables run to a thousand rows,
          so losing the semester and the range on scroll costs a round trip to
          the top just to check what you are looking at.

          z-30, not the primitive's z-10: `Table`'s wrapper is `relative` with
          `z-index: auto` and so creates no stacking context, which leaves the
          sticky theads (z-10) and pinned corner cells (z-20) inside it
          competing here in the root stacking context. */}
      <PageHeader
        sticky
        title="Attendance Analytics"
        tabs={
          groups !== null &&
          groups.length > 0 &&
          group &&
          group.programme_semesters.length > 0 ? (
            <TabsBar
              tabs={TABS}
              value={tab}
              onChange={changeTab}
              className="border-b-0"
              actions={
                <>
                  <label htmlFor="analytics-semester" className="sr-only">
                    Semester
                  </label>
                  <Combobox
                    id="analytics-semester"
                    size="sm"
                    className="w-40"
                    value={psId}
                    options={group.programme_semesters.map((ps) => ({
                      value: ps.id,
                      label: `Semester ${ps.semester.sem_number}${
                        ps.status === 'ongoing' ? ' (current)' : ''
                      }`,
                    }))}
                    onChange={setPsId}
                    placeholder="Semester…"
                    searchPlaceholder="Search semesters…"
                  />
                  <DateRangePicker
                    size="sm"
                    from={from}
                    to={to}
                    onChange={changeRange}
                    presets={presets}
                    emptyLabel="Whole semester"
                    min={semester?.planned_start_date ?? undefined}
                    align="end"
                    aria-label="Date range"
                  />
                </>
              }
            />
          ) : undefined
        }
        actions={
          group &&
          (groups !== null && groups.length > 1 ? (
            <Button
              size="sm"
              variant="outline"
              className="max-w-full"
              onClick={() => setPickerOpen(true)}
              aria-label={`Attendance group: ${group.name} ${group.code}. Change group.`}
            >
              <Users className="size-4" />
              <span className="truncate font-medium">{group.name}</span>
              <span className="text-muted-foreground">{group.code}</span>
              <span className="hidden text-muted-foreground md:inline">
                · {groupMeta}
              </span>
              <ChevronsUpDown className="size-4 opacity-50" />
            </Button>
          ) : (
            <p className="text-sm">
              <span className="font-medium">{group.name}</span>
              <span className="ml-1 text-muted-foreground">{group.code}</span>
              <span className="ml-1 text-xs text-muted-foreground">
                · {groupMeta}
              </span>
            </p>
          ))
        }
      />

      {loadError && <EmptyNote>{loadError}</EmptyNote>}

      {groups === null && !loadError && (
        <div className="shimmer h-12 w-full max-w-sm rounded-lg bg-muted/60" />
      )}

      {groups !== null && groups.length === 0 && (
        <EmptyNote>
          You are not the incharge of any active attendance group, so there is
          nothing to report on yet. Ask an admin to add you as an in-charge.
        </EmptyNote>
      )}

      {groups !== null && groups.length > 0 && (
        <>
          <GroupPickerDialog
            groups={groups}
            value={groupId}
            onSelect={chooseGroup}
            open={pickerOpen}
            onOpenChange={setPickerOpen}
          />

          {group && group.programme_semesters.length === 0 ? (
            <EmptyNote>
              No active programme semesters exist for this group's batch yet.
              Ask an admin to set them up.
            </EmptyNote>
          ) : (
            <div className="space-y-3">
              {range === null ? (
                <EmptyNote>Pick a semester to see the analytics.</EmptyNote>
              ) : (
                <>
                  {tab === 'overview' && <OverviewTab range={range} />}
                  {tab === 'students' && <StudentsTab range={range} />}
                  {tab === 'subjects' && <SubjectsTab range={range} />}
                  {tab === 'daily' && <DailyTab range={range} />}
                  {tab === 'defaulters' && (
                    <StudentsTab range={range} defaultersOnly />
                  )}
                  {tab === 'sessions' && <SessionsTab range={range} />}
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
