import { useMemo, useState } from 'react'

import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  fetchAnalyticsStudents,
  type AnalyticsRange,
  type StudentRow,
  type StudentsResult,
} from '@/lib/attendance-analytics'
import { downloadCsv } from '@/lib/csv'
import { cn } from '@/lib/utils'
import { StudentDetailSheet } from './student-detail-sheet'
import {
  DEFAULT_THRESHOLD,
  RESULT_SCROLL,
  cmpNum,
  cmpText,
  fmtPct,
  isBelow,
  nextSort,
  nf,
  projectionAt,
  readStored,
  writeStored,
  type SortDir,
  type SortState,
} from './format'
import { ThresholdControl } from './threshold-control'
import {
  BasisChip,
  EmptyNote,
  ExportButton,
  PctBadge,
  ResultCard,
  SearchField,
  SortHead,
  SortMenu,
  StripStat,
  TabToolbar,
  TableSkeleton,
  type SortOption,
} from './ui'
import { rangeKey, useAnalyticsQuery } from './use-analytics-query'

/** Every column, plus the absent streak — which is a line under the student's
 *  name rather than a column of its own, so the menu is its only way in. */
type SortKey =
  | 'roll'
  | 'name'
  | 'pct'
  | 'attended'
  | 'held'
  | 'needed'
  | 'streak'
  | `subject:${number}`

/** Where each field starts before any flip: names read A→Z, percentages worst
 *  first (the whole point of the screen), counts and urgency largest first. */
function naturalDir(by: SortKey): SortDir {
  return by === 'attended' || by === 'held' || by === 'needed' || by === 'streak'
    ? 'desc'
    : 'asc'
}

const subjectKeyOf = (by: SortKey): number | null =>
  by.startsWith('subject:') ? Number(by.slice('subject:'.length)) : null

const LS_THRESHOLD = 'nucleus.attendanceAnalytics.threshold'

function storedThreshold(): number {
  const n = Number(readStored(LS_THRESHOLD))
  return Number.isFinite(n) && n > 0 && n <= 100 ? n : DEFAULT_THRESHOLD
}

/**
 * The roster with every student's overall and per-subject attendance.
 *
 * `defaultersOnly` reuses this exact payload for the Defaulters tab, adding a
 * movable cutoff on top of it: 75% is the exam rule, but condonation lists are
 * drawn at 65% and shortlists at 85%. The filter and the "classes needed"
 * projection are therefore recomputed here from `attended`/`held` — the same
 * raw numbers the server used — rather than read off `below_threshold`.
 *
 * Never re-derive either from the rounded percentage: 74.96% renders as 75.0%.
 * At 75 these helpers reproduce the server's values exactly, which is why the
 * plain Students tab can share this code path with the cutoff pinned there.
 */
export function StudentsTab({
  range,
  defaultersOnly = false,
  subjectId,
}: {
  range: AnalyticsRange
  defaultersOnly?: boolean
  /** When set, the table pivots to that subject's numbers instead of overall. */
  subjectId?: number
}) {
  const { data, loading, error } = useAnalyticsQuery<StudentsResult>(
    rangeKey(range),
    () => fetchAnalyticsStudents(range),
    'Could not load the students.',
  )
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<SortState<SortKey>>(() => ({
    by: defaultersOnly ? 'pct' : 'name',
    dir: 'asc',
  }))
  const [open, setOpen] = useState<StudentRow | null>(null)
  const [picked, setPicked] = useState(storedThreshold)

  // Only Defaulters exposes the control; everywhere else the official 75%
  // stands, so the page keeps reporting the real exam-eligibility figure.
  const threshold = defaultersOnly ? picked : DEFAULT_THRESHOLD

  const changeThreshold = (v: number) => {
    setPicked(v)
    writeStored(LS_THRESHOLD, String(v))
  }

  const remaining = data?.sessions_remaining ?? 0

  // Every subject any student has a row for — the column set for the pivot.
  const subjects = useMemo(() => {
    const seen = new Map<number, { id: number; code: string; name: string }>()
    for (const s of data?.rows ?? []) {
      for (const sub of s.per_subject) {
        if (!seen.has(sub.subject_id)) {
          seen.set(sub.subject_id, {
            id: sub.subject_id,
            code: sub.subject_code,
            name: sub.subject_name,
          })
        }
      }
    }
    return [...seen.values()].sort((a, b) => a.code.localeCompare(b.code))
  }, [data])

  // A subject column can vanish under an active sort when the date range
  // changes. Derived rather than corrected in an effect — an effect that writes
  // the state it reads is the loop this repo has already been bitten by.
  const active: SortState<SortKey> = useMemo(() => {
    const key = subjectKeyOf(sort.by)
    if (key === null || subjects.some((s) => s.id === key)) return sort
    return { by: defaultersOnly ? 'pct' : 'name', dir: 'asc' }
  }, [sort, subjects, defaultersOnly])

  // From `active`, not from `sort`: after a fallback the two differ, and
  // stepping off the stale key would land on the value already on screen —
  // a click that visibly does nothing.
  const toggleSort = (by: SortKey) =>
    setSort(nextSort(active, by, naturalDir(by)))

  const sortOptions = useMemo<Array<SortOption<SortKey>>>(
    () => [
      { value: 'pct', label: 'Attendance' },
      { value: 'name', label: 'Name' },
      { value: 'roll', label: 'Roll no' },
      { value: 'streak', label: 'Absent streak' },
      { value: 'attended', label: 'Attended' },
      { value: 'held', label: 'Held' },
      { value: 'needed', label: `To reach ${threshold}%` },
      ...subjects.map(
        (s): SortOption<SortKey> => ({
          value: `subject:${s.id}`,
          label: s.code,
          group: 'By subject',
        }),
      ),
    ],
    [subjects, threshold],
  )

  const rows = useMemo(() => {
    let list = data?.rows ?? []
    if (defaultersOnly) {
      list = list.filter((r) => {
        const hit = subjectId
          ? r.per_subject.find((s) => s.subject_id === subjectId)
          : r
        return hit ? isBelow(hit.attended, hit.held, threshold) : false
      })
    }
    const needle = q.trim().toLowerCase()
    if (needle) {
      list = list.filter(
        (r) =>
          r.display_name.toLowerCase().includes(needle) ||
          r.roll_no.toLowerCase().includes(needle),
      )
    }

    // `null` wherever the cell renders `—`, so unmeasured students sink in both
    // directions instead of masquerading as the worst in the group.
    const overall = (r: StudentRow) => {
      const hit = subjectId
        ? r.per_subject.find((s) => s.subject_id === subjectId)
        : r
      return hit && hit.held > 0 ? hit.pct : null
    }
    const subjectPct = (r: StudentRow, id: number) => {
      const hit = r.per_subject.find((s) => s.subject_id === id)
      return hit && hit.held > 0 ? hit.pct : null
    }
    // "Not reachable" is more urgent than any finite number of classes.
    const needed = (r: StudentRow) => {
      if (r.held === 0) return null
      const n = projectionAt(
        r.attended,
        r.held,
        remaining,
        threshold,
      ).sessions_needed
      return n === null ? Infinity : n
    }

    const { by, dir } = active
    const key = subjectKeyOf(by)
    return [...list].sort((a, b) => {
      let c = 0
      if (key !== null) c = cmpNum(subjectPct(a, key), subjectPct(b, key), dir)
      else if (by === 'roll') c = cmpText(a.roll_no, b.roll_no, dir)
      else if (by === 'name') c = cmpText(a.display_name, b.display_name, dir)
      else if (by === 'pct') c = cmpNum(overall(a), overall(b), dir)
      else if (by === 'attended') c = cmpNum(a.attended, b.attended, dir)
      else if (by === 'held') c = cmpNum(a.held, b.held, dir)
      else if (by === 'needed') c = cmpNum(needed(a), needed(b), dir)
      else if (by === 'streak')
        c = cmpNum(a.current_absent_streak, b.current_absent_streak, dir)
      // Ties are common on every count column; roll no keeps them stable.
      return c !== 0 ? c : a.roll_no.localeCompare(b.roll_no)
    })
  }, [data, defaultersOnly, subjectId, q, active, threshold, remaining])

  const exportCsv = () => {
    downloadCsv(
      defaultersOnly ? 'attendance-defaulters' : 'attendance-students',
      [
        'Roll no',
        'Student',
        'Attended',
        'Held',
        'Attendance %',
        'Absent streak',
        `Classes needed for ${threshold}%`,
        'Best possible %',
        ...subjects.map((s) => `${s.code} %`),
      ],
      rows.map((r) => {
        const proj = projectionAt(r.attended, r.held, remaining, threshold)
        return [
          r.roll_no,
          r.display_name,
          r.attended,
          r.held,
          r.held > 0 ? r.pct : '',
          r.current_absent_streak,
          proj.sessions_needed === null
            ? 'Not reachable'
            : proj.sessions_needed,
          proj.max_achievable_pct,
          ...subjects.map((s) => {
            const hit = r.per_subject.find((x) => x.subject_id === s.id)
            return hit && hit.held > 0 ? hit.pct : ''
          }),
        ]
      }),
    )
  }

  return (
    <div className="space-y-3 pb-4">
      <TabToolbar
        end={<ExportButton onClick={exportCsv} disabled={rows.length === 0} />}
      >
        <SearchField
          value={q}
          onChange={setQ}
          placeholder="Search name or roll no…"
          label="Search students"
        />
        <SortMenu
          value={active.by}
          dir={active.dir}
          options={sortOptions}
          onChange={toggleSort}
        />
        {defaultersOnly && (
          <ThresholdControl value={threshold} onChange={changeThreshold} />
        )}
        <BasisChip basis={data?.basis ?? 'rollup'} />
      </TabToolbar>

      {loading ? (
        <TableSkeleton cols={6} rows={12} />
      ) : error ? (
        <EmptyNote>{error}</EmptyNote>
      ) : !data ? null : rows.length === 0 ? (
        <EmptyNote>
          {defaultersOnly
            ? `No student is below ${threshold}% in this period. `
            : 'No students match. '}
        </EmptyNote>
      ) : (
        <ResultCard
          scroll={false}
          summary={
            <>
              <StripStat
                value={
                  defaultersOnly
                    ? `${nf(rows.length)} of ${nf(data.rows.length)} below ${threshold}%`
                    : `${nf(rows.length)} ${rows.length === 1 ? 'student' : 'students'}`
                }
              />
              {remaining > 0 && (
                <StripStat label="Classes left" value={nf(remaining)} />
              )}
            </>
          }
        >
        <Table containerClassName={RESULT_SCROLL}>
          <TableHeader className="sticky top-0 z-10 bg-background">
            <TableRow>
              <SortHead
                field="roll"
                label="Roll no"
                sort={active}
                onSort={toggleSort}
                className="w-28"
              />
              <SortHead
                field="name"
                label="Student"
                sort={active}
                onSort={toggleSort}
              />
              <SortHead
                field="attended"
                label="Attended"
                sort={active}
                onSort={toggleSort}
                align="right"
              />
              <SortHead
                field="held"
                label="Held"
                sort={active}
                onSort={toggleSort}
                align="right"
              />
              <SortHead
                field="pct"
                label="Overall"
                sort={active}
                onSort={toggleSort}
                align="right"
              />
              <SortHead
                field="needed"
                label={`To reach ${threshold}%`}
                sort={active}
                onSort={toggleSort}
                align="right"
              />
              {subjects.map((s) => (
                <SortHead
                  key={s.id}
                  field={`subject:${s.id}`}
                  label={s.code}
                  sort={active}
                  onSort={toggleSort}
                  align="right"
                  title={s.name}
                />
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => {
              const proj = projectionAt(
                r.attended,
                r.held,
                remaining,
                threshold,
              )
              return (
                <TableRow
                  key={r.student_id}
                  onClick={() => setOpen(r)}
                  className="cursor-pointer"
                >
                  <TableCell className="font-mono text-xs">{r.roll_no}</TableCell>
                  <TableCell>
                    <span className="block">{r.display_name}</span>
                    {r.current_absent_streak >= 3 && (
                      <span className="text-xs text-icon-rose">
                        Absent {r.current_absent_streak} days running
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {nf(r.attended)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {nf(r.held)}
                  </TableCell>
                  <TableCell className="text-right">
                    <PctBadge pct={r.pct} band={r.band} held={r.held} />
                  </TableCell>
                  <TableCell
                    className={cn(
                      'text-right text-xs tabular-nums',
                      proj.sessions_needed === null && 'text-icon-rose',
                    )}
                  >
                    {r.held === 0
                      ? '—'
                      : proj.sessions_needed === null
                        ? `Max ${fmtPct(proj.max_achievable_pct)}`
                        : proj.sessions_needed === 0
                          ? 'Clear'
                          : `${nf(proj.sessions_needed)} more`}
                  </TableCell>
                  {subjects.map((s) => {
                    const hit = r.per_subject.find((x) => x.subject_id === s.id)
                    return (
                      <TableCell key={s.id} className="text-right">
                        {hit ? (
                          <PctBadge
                            pct={hit.pct}
                            band={hit.band}
                            held={hit.held}
                          />
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    )
                  })}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
        </ResultCard>
      )}

      <StudentDetailSheet
        range={range}
        student={open}
        threshold={threshold}
        sessionsRemaining={remaining}
        onClose={() => setOpen(null)}
      />
    </div>
  )
}
