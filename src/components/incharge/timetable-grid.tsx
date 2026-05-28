import { LayoutGrid, MapPin, Plus, User as UserIcon } from 'lucide-react'
import { useMemo } from 'react'

import { Card } from '@/components/ui/card'
import type {
  IncharqeTimetable,
  TimetableEntry,
} from '@/lib/incharge-schedule'
import { cn } from '@/lib/utils'

import type { CellEditorTarget } from './cell-editor-sheet'

const DAY_LABELS: Record<number, { short: string; long: string }> = {
  1: { short: 'Mon', long: 'Monday' },
  2: { short: 'Tue', long: 'Tuesday' },
  3: { short: 'Wed', long: 'Wednesday' },
  4: { short: 'Thu', long: 'Thursday' },
  5: { short: 'Fri', long: 'Friday' },
  6: { short: 'Sat', long: 'Saturday' },
  7: { short: 'Sun', long: 'Sunday' },
}

export interface TimetableGridProps {
  data: IncharqeTimetable
  canEdit: boolean
  onPickCell: (target: CellEditorTarget) => void
}

/**
 * Visual timetable grid — rows = teaching periods, cols = working days.
 * Click a cell to edit (or place a new class). Entries with span > 1 are
 * rendered with rowSpan so they visually merge across multiple periods.
 */
export function TimetableGrid({
  data,
  canEdit,
  onPickCell,
}: TimetableGridProps) {
  const teachingPeriods = useMemo(
    () =>
      [...(data.periods ?? [])]
        .filter((p) => !p.is_break)
        .sort((a, b) => a.position - b.position),
    [data.periods],
  )
  const workingDays = useMemo(
    () => [...(data.working_days ?? [])].sort((a, b) => a - b),
    [data.working_days],
  )

  // Index entries by (day, period) for fast cell lookups.
  const entryByCell = useMemo(() => {
    const map = new Map<string, TimetableEntry>()
    for (const e of data.entries ?? []) {
      map.set(`${e.day_of_week}:${e.timetable_period_id}`, e)
    }
    return map
  }, [data.entries])

  // For span > 1, identify which (day, period) cells are *covered by another
  // entry's span* — those should be skipped during render.
  const coveredCells = useMemo(() => {
    const covered = new Set<string>()
    for (const e of data.entries ?? []) {
      if (e.span <= 1) continue
      const anchorIdx = teachingPeriods.findIndex(
        (p) => p.id === e.timetable_period_id,
      )
      if (anchorIdx === -1) continue
      for (let i = 1; i < e.span; i += 1) {
        const p = teachingPeriods[anchorIdx + i]
        if (!p) break
        covered.add(`${e.day_of_week}:${p.id}`)
      }
    }
    return covered
  }, [data.entries, teachingPeriods])

  if (teachingPeriods.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-3 px-6 py-12 text-center">
        <div className="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
          <LayoutGrid className="size-5" />
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-medium">No teaching periods yet</h3>
          <p className="max-w-sm text-xs text-muted-foreground">
            Set up the bell schedule first (use "Edit bell schedule" above),
            then come back to place classes in the grid.
          </p>
        </div>
      </Card>
    )
  }
  if (workingDays.length === 0) {
    return (
      <Card className="px-5 py-8 text-center text-sm text-muted-foreground">
        No working days configured. Set them on the template details above.
      </Card>
    )
  }

  return (
    <Card className="overflow-hidden">
      <header className="flex flex-wrap items-center gap-2 border-b bg-muted/30 px-5 py-3">
        <LayoutGrid className="size-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Schedule grid
        </h2>
        {canEdit ? (
          <span className="ml-auto text-xs text-muted-foreground">
            Click a cell to place / edit a class.
          </span>
        ) : (
          <span className="ml-auto text-xs text-warning">
            Read-only — your role doesn't grant edit.
          </span>
        )}
      </header>

      <div className="overflow-x-auto scrollbar-themed">
        <table className="w-full min-w-[40rem] border-collapse text-sm">
          <thead>
            <tr className="border-b bg-muted/20">
              <th className="sticky left-0 z-10 w-32 border-r bg-muted/20 px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Period
              </th>
              {workingDays.map((day) => (
                <th
                  key={day}
                  className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  <span className="sm:hidden">{DAY_LABELS[day]?.short}</span>
                  <span className="hidden sm:inline">
                    {DAY_LABELS[day]?.long}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {teachingPeriods.map((period, periodIdx) => (
              <tr key={period.id} className="border-b last:border-b-0">
                <td className="sticky left-0 z-10 border-r bg-card px-3 py-2">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{period.label}</span>
                    <span className="text-[11px] text-muted-foreground tabular-nums">
                      {shortTime(period.start_time)}–{shortTime(period.end_time)}
                    </span>
                  </div>
                </td>
                {workingDays.map((day) => {
                  const key = `${day}:${period.id}`
                  if (coveredCells.has(key)) {
                    // Anchor cell from a previous row spans into this one;
                    // skip rendering.
                    return null
                  }
                  const entry = entryByCell.get(key) ?? null
                  const span = entry?.span ?? 1
                  const remainingTeaching =
                    teachingPeriods.length - periodIdx
                  const maxSpan = Math.min(remainingTeaching, 6) // cap UI choice at 6
                  return (
                    <td
                      key={day}
                      rowSpan={span}
                      className="border-l p-1 align-top"
                    >
                      <CellButton
                        canEdit={canEdit}
                        entry={entry}
                        onClick={() =>
                          onPickCell({
                            day_of_week: day,
                            period: {
                              id: period.id,
                              label: period.label,
                              start_time: period.start_time,
                              end_time: period.end_time,
                            },
                            existing: entry,
                            maxSpan,
                          })
                        }
                      />
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

function CellButton({
  entry,
  canEdit,
  onClick,
}: {
  entry: TimetableEntry | null
  canEdit: boolean
  onClick: () => void
}) {
  if (!entry) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={!canEdit}
        className={cn(
          'flex h-16 w-full items-center justify-center rounded-md border border-dashed transition-colors',
          canEdit
            ? 'text-muted-foreground hover:border-primary/50 hover:bg-primary/5 hover:text-primary'
            : 'cursor-not-allowed border-transparent text-transparent',
        )}
      >
        {canEdit ? (
          <span className="inline-flex items-center gap-1 text-xs">
            <Plus className="size-3.5" /> Add
          </span>
        ) : null}
      </button>
    )
  }

  const subject = subjectLabel(entry)
  const teacher = teacherLabel(entry)
  const tone = subject.tone

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!canEdit}
      className={cn(
        'flex h-full w-full flex-col items-start gap-1 rounded-md border px-2 py-1.5 text-left transition-colors',
        tone === 'pss'
          ? 'border-icon-blue/30 bg-icon-blue/5'
          : tone === 'slot'
            ? 'border-icon-violet/30 bg-icon-violet/5'
            : 'border-icon-emerald/30 bg-icon-emerald/5',
        canEdit && 'hover:shadow-sm',
      )}
    >
      <div className="flex w-full items-center justify-between gap-1">
        <span className="truncate text-xs font-semibold">
          {subject.primary}
        </span>
        {entry.span > 1 ? (
          <span className="shrink-0 rounded-full bg-card/80 px-1.5 py-0.5 text-[10px] font-medium tabular-nums">
            ×{entry.span}
          </span>
        ) : null}
      </div>
      {subject.secondary ? (
        <span className="truncate text-[11px] text-muted-foreground">
          {subject.secondary}
        </span>
      ) : null}
      {teacher ? (
        <span className="inline-flex items-center gap-1 truncate text-[11px] text-muted-foreground">
          <UserIcon className="size-3" />
          {teacher}
        </span>
      ) : null}
      {entry.room ? (
        <span className="inline-flex items-center gap-1 truncate text-[11px] text-muted-foreground">
          <MapPin className="size-3" />
          {entry.room}
        </span>
      ) : null}
    </button>
  )
}

function subjectLabel(entry: TimetableEntry): {
  primary: string
  secondary?: string
  tone: 'pss' | 'slot' | 'course'
} {
  const pss = entry.programme_semester_subject
  if (pss) {
    if (pss.subject) {
      return {
        primary: pss.subject.code,
        secondary: pss.subject.name,
        tone: 'pss',
      }
    }
    return {
      primary: pss.placeholder_name ?? 'Slot',
      secondary: 'Elective slot',
      tone: 'slot',
    }
  }
  const course = entry.timetable_course
  if (course) {
    if (course.subject) {
      return {
        primary: course.subject.code,
        secondary: course.subject.name,
        tone: 'course',
      }
    }
    return {
      primary: course.custom_label ?? 'Custom',
      secondary: 'Timetable course',
      tone: 'course',
    }
  }
  return { primary: 'Class', tone: 'pss' }
}

function teacherLabel(entry: TimetableEntry): string | null {
  if (entry.employee) return entry.employee.emp_display_name
  return null
}

function shortTime(t: string): string {
  return t.length >= 5 ? t.slice(0, 5) : t
}
