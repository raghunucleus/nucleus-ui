import { Clock, MapPin, Plus, User as UserIcon } from 'lucide-react'
import { useMemo } from 'react'

import { Card } from '@/components/ui/card'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
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

// Per-subject color palette (border + tint). Full literal class strings so
// Tailwind's JIT keeps them. A subject always maps to the same tone.
const TONES = [
  'border-icon-blue/40 bg-icon-blue/5',
  'border-icon-emerald/40 bg-icon-emerald/5',
  'border-icon-violet/40 bg-icon-violet/5',
  'border-icon-amber/40 bg-icon-amber/5',
  'border-icon-rose/40 bg-icon-rose/5',
  'border-icon-cyan/40 bg-icon-cyan/5',
  'border-icon-orange/40 bg-icon-orange/5',
]

export interface TimetableGridProps {
  data: IncharqeTimetable
  canEdit: boolean
  onPickCell: (target: CellEditorTarget) => void
}

/**
 * Visual timetable grid — rows = periods (breaks included as a full-width
 * banner row), cols = working days. Click a cell to edit (or place a new
 * class). Entries with span > 1 are rendered with rowSpan so they visually
 * merge across multiple teaching periods.
 *
 * Layout is `table-fixed` + `min-w-full`: the day columns stretch to fill the
 * available width when few days are configured, and overflow into a horizontal
 * scroll when there are too many to fit (e.g. a 7th Sunday column). Cell text
 * is clamped to keep every cell the same size; hover for the full details.
 */
export function TimetableGrid({
  data,
  canEdit,
  onPickCell,
}: TimetableGridProps) {
  // All periods (including breaks) drive the row order; teaching periods drive
  // the span math.
  const allPeriods = useMemo(
    () => [...(data.periods ?? [])].sort((a, b) => a.position - b.position),
    [data.periods],
  )
  const teachingPeriods = useMemo(
    () => allPeriods.filter((p) => !p.is_break),
    [allPeriods],
  )
  const teachingIndexById = useMemo(() => {
    const map = new Map<number, number>()
    teachingPeriods.forEach((p, i) => map.set(p.id, i))
    return map
  }, [teachingPeriods])

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
      const anchorIdx = teachingIndexById.get(e.timetable_period_id)
      if (anchorIdx === undefined) continue
      for (let i = 1; i < e.span; i += 1) {
        const p = teachingPeriods[anchorIdx + i]
        if (!p) break
        covered.add(`${e.day_of_week}:${p.id}`)
      }
    }
    return covered
  }, [data.entries, teachingPeriods, teachingIndexById])

  if (teachingPeriods.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-3 px-6 py-12 text-center">
        <div className="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
          <Clock className="size-5" />
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
        <Clock className="size-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Weekly grid
        </h2>
        {canEdit ? (
          <span className="ml-auto text-xs text-muted-foreground">
            Click a cell to place or edit a class.
          </span>
        ) : (
          <span className="ml-auto text-xs text-warning">
            Read-only — your role doesn't grant edit.
          </span>
        )}
      </header>

      <TooltipProvider>
        <div className="overflow-x-auto scrollbar-themed">
          <table className="min-w-full table-fixed border-collapse text-sm">
            <colgroup>
              <col className="w-[5rem]" />
              {workingDays.map((day) => (
                <col key={day} className="w-[9rem]" />
              ))}
            </colgroup>
            <thead>
              <tr className="border-b bg-muted/20">
                <th className="sticky left-0 z-10 border-r bg-muted/20 px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Period
                </th>
                {workingDays.map((day) => (
                  <th
                    key={day}
                    className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
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
              {allPeriods.map((period, rowIdx) => {
                // Break period → single full-width banner row.
                if (period.is_break) {
                  return (
                    <tr
                      key={period.id}
                      className="border-b bg-muted/10 last:border-b-0"
                    >
                      <td className="sticky left-0 z-10 border-r bg-card px-3 py-2">
                        <div className="flex flex-col">
                          <span className="truncate text-xs font-medium">
                            {period.label}
                          </span>
                          <span className="text-[10px] text-muted-foreground tabular-nums">
                            {shortTime(period.start_time)}–
                            {shortTime(period.end_time)}
                          </span>
                        </div>
                      </td>
                      <td
                        colSpan={workingDays.length}
                        className="px-3 py-3 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
                      >
                        {period.label}
                      </td>
                    </tr>
                  )
                }

                return (
                  <tr key={period.id} className="border-b last:border-b-0">
                    <td className="sticky left-0 z-10 border-r bg-card px-3 py-2">
                      <div className="flex flex-col">
                        <span className="truncate text-xs font-medium">
                          {period.label}
                        </span>
                        <span className="text-[10px] text-muted-foreground tabular-nums">
                          {shortTime(period.start_time)}–
                          {shortTime(period.end_time)}
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
                      // A merged class must stop at the next break (the backend
                      // rejects a span that covers one), so cap at the run of
                      // consecutive teaching periods starting here — NOT the
                      // total teaching periods left, which would jump the break.
                      let consecutiveTeaching = 0
                      for (
                        let i = rowIdx;
                        i < allPeriods.length && !allPeriods[i].is_break;
                        i += 1
                      ) {
                        consecutiveTeaching += 1
                      }
                      const maxSpan = Math.min(consecutiveTeaching, 6) // cap UI choice at 6
                      return (
                        <td
                          key={day}
                          rowSpan={span}
                          className="border-l p-1 align-top"
                        >
                          <CellButton
                            canEdit={canEdit}
                            entry={entry}
                            period={period}
                            dayLabel={DAY_LABELS[day]?.long ?? ''}
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
                )
              })}
            </tbody>
          </table>
        </div>
      </TooltipProvider>
    </Card>
  )
}

function CellButton({
  entry,
  canEdit,
  period,
  dayLabel,
  onClick,
}: {
  entry: TimetableEntry | null
  canEdit: boolean
  period: { label: string; start_time: string; end_time: string }
  dayLabel: string
  onClick: () => void
}) {
  if (!entry) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={!canEdit}
        className={cn(
          'flex h-full min-h-[5.5rem] w-full items-center justify-center rounded-md border border-dashed transition-colors',
          canEdit
            ? 'text-muted-foreground hover:border-primary/50 hover:bg-primary/5 hover:text-primary'
            : 'cursor-not-allowed border-transparent text-transparent',
        )}
      >
        {canEdit ? (
          <span className="inline-flex items-center gap-1 text-[11px]">
            <Plus className="size-3.5" /> Add
          </span>
        ) : null}
      </button>
    )
  }

  const info = subjectInfo(entry)

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          disabled={!canEdit}
          className={cn(
            'flex h-full min-h-[5.5rem] w-full flex-col gap-1 overflow-hidden rounded-md border px-2 py-1.5 text-left transition-colors',
            toneFor(info.colorKey),
            canEdit && 'hover:shadow-sm',
          )}
        >
          <div className="flex w-full items-start justify-between gap-1">
            <span className="line-clamp-2 text-xs font-semibold leading-snug">
              {info.title}
            </span>
            {entry.span > 1 ? (
              <span className="shrink-0 rounded-full bg-card/80 px-1.5 py-0.5 text-[10px] font-medium tabular-nums">
                ×{entry.span}
              </span>
            ) : null}
          </div>
          {info.subtitle ? (
            <span className="truncate text-[11px] italic text-muted-foreground">
              {info.subtitle}
            </span>
          ) : null}
          {info.teacher ? (
            <span className="flex min-w-0 items-center gap-1 text-[11px] text-muted-foreground">
              <UserIcon className="size-3 shrink-0" />
              <span className="min-w-0 flex-1 truncate">{info.teacher}</span>
            </span>
          ) : null}
          <div className="mt-auto flex w-full items-end justify-between gap-1 pt-0.5">
            {info.code ? (
              <span className="truncate text-[10px] text-muted-foreground tabular-nums">
                {info.code}
              </span>
            ) : (
              <span />
            )}
            {entry.room ? (
              <span className="flex min-w-0 shrink items-center gap-0.5 text-[10px] text-muted-foreground">
                <MapPin className="size-3 shrink-0" />
                <span className="min-w-0 truncate">{entry.room}</span>
              </span>
            ) : null}
          </div>
        </button>
      </TooltipTrigger>
      <TooltipContent align="start">
        <div className="space-y-1">
          <p className="text-[11px] font-medium text-muted-foreground">
            {dayLabel} · {period.label} · {shortTime(period.start_time)}–
            {shortTime(period.end_time)}
            {entry.span > 1 ? ` · ${entry.span} periods` : ''}
          </p>
          <p className="text-sm font-semibold">{info.title}</p>
          {info.subtitle ? (
            <p className="text-xs text-muted-foreground">{info.subtitle}</p>
          ) : null}
          {info.code ? (
            <p className="text-xs text-muted-foreground tabular-nums">
              {info.code}
            </p>
          ) : null}
          {info.teacher ? (
            <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <UserIcon className="size-3 shrink-0" />
              {info.teacher}
            </p>
          ) : null}
          {entry.room ? (
            <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="size-3 shrink-0" />
              {entry.room}
            </p>
          ) : null}
        </div>
      </TooltipContent>
    </Tooltip>
  )
}

interface SubjectInfo {
  title: string
  code: string | null
  subtitle: string | null
  teacher: string | null
  colorKey: string
}

function subjectInfo(entry: TimetableEntry): SubjectInfo {
  const teacher = entry.employee?.emp_display_name ?? null

  const pss = entry.programme_semester_subject
  if (pss) {
    if (pss.subject) {
      return {
        title: pss.subject.name,
        code: pss.subject.code,
        subtitle: null,
        teacher,
        colorKey: pss.subject.code,
      }
    }
    const name = pss.placeholder_name ?? 'Slot'
    return {
      title: name,
      code: null,
      subtitle: 'Elective — varies',
      teacher,
      colorKey: `slot:${name}`,
    }
  }

  const course = entry.timetable_course
  if (course) {
    if (course.subject) {
      return {
        title: course.subject.name,
        code: course.subject.code,
        subtitle: null,
        teacher,
        colorKey: course.subject.code,
      }
    }
    const label = course.custom_label ?? 'Custom'
    return {
      title: label,
      code: null,
      subtitle: 'Timetable course',
      teacher,
      colorKey: `course:${label}`,
    }
  }

  return { title: 'Class', code: null, subtitle: null, teacher, colorKey: 'class' }
}

/** Deterministic tone for a subject so the same subject is always one color. */
function toneFor(key: string): string {
  let h = 0
  for (let i = 0; i < key.length; i += 1) {
    h = (h * 31 + key.charCodeAt(i)) >>> 0
  }
  return TONES[h % TONES.length]
}

function shortTime(t: string): string {
  return t.length >= 5 ? t.slice(0, 5) : t
}
