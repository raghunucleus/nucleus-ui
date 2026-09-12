import { useParams } from '@tanstack/react-router'
import {
  CalendarOff,
  CheckCircle2,
  CircleAlert,
  Loader2,
  RefreshCw,
  Search,
  Users,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { NoAccessEmptyState } from '@/components/employee/empty-states'
import { BackButton } from '@/components/ui/back-button'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/ui/page-header'
import { useScreenAccess } from '@/hooks/use-screen-access'
import { ApiError } from '@/lib/api'
import {
  fetchTeacherRoster,
  markTeacherAttendance,
  type AttendanceStatus,
  type RosterEntry,
  type TeacherRosterResult,
} from '@/lib/teacher-attendance'
import { cn } from '@/lib/utils'

/**
 * Imperative employee-portal navigation — the dual-router setup makes the
 * typed `<Link>` reject employee-only paths. Mirrors the helper in
 * `employee-portal-layout.tsx`.
 */
function navigateTo(route: string) {
  window.history.pushState({}, '', route)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

/**
 * The statuses a teacher works with in the room.
 *
 * Present / Absent are the two the teacher marks directly. `leave` is the
 * third: a student with an approved leave for the day is pre-filled as Leave
 * (the server enforces it on submit regardless) and the teacher may only
 * override it to Present when the student actually turned up. The
 * `class_session_attendance` table also supports `late`, `od` and `exempt`,
 * but those are admin-mediated and collapse to Present / Absent here.
 */
type MarkChoice = Extract<AttendanceStatus, 'present' | 'absent' | 'leave'>

export default function EmployeeAttendanceMarkSessionPage() {
  const access = useScreenAccess('attendance.entry.daily')
  const { sessionId: rawId } = useParams({ strict: false }) as {
    sessionId?: string
  }
  const sessionId = rawId ? Number(rawId) : NaN

  const [data, setData] = useState<TeacherRosterResult | null>(null)
  const [statuses, setStatuses] = useState<Record<number, MarkChoice>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [savedAt, setSavedAt] = useState<Date | null>(null)

  const load = useCallback(async () => {
    if (!Number.isFinite(sessionId)) {
      setError('Invalid session id.')
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetchTeacherRoster(sessionId)
      setData(res)
      // Seed selection from existing marks: any Late counts as Present here,
      // OD/Exempt collapse to Absent (the teacher should kick those upstairs
      // to the admin via the adjustments flow). Unmarked → default Present,
      // or Leave when an approved leave covers the day.
      const seed: Record<number, MarkChoice> = {}
      for (const s of res.students) {
        seed[s.id] = seedChoice(s)
      }
      setStatuses(seed)
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Could not load the roster.',
      )
    } finally {
      setLoading(false)
    }
  }, [sessionId])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    if (!data) return []
    const q = search.trim().toLowerCase()
    if (!q) return data.students
    return data.students.filter(
      (s) =>
        s.display_name.toLowerCase().includes(q) ||
        s.student_id.toLowerCase().includes(q),
    )
  }, [data, search])

  const counts = useMemo(() => {
    let present = 0
    let absent = 0
    let leave = 0
    for (const id in statuses) {
      if (statuses[id] === 'present') present += 1
      else if (statuses[id] === 'leave') leave += 1
      else absent += 1
    }
    return { present, absent, leave }
  }, [statuses])

  if (!access) return <NoAccessEmptyState />

  const canUpdate = access.actions.includes('update')
  const isAmending = data?.status === 'completed'

  function markAll(status: Extract<MarkChoice, 'present' | 'absent'>) {
    if (!data) return
    const next: Record<number, MarkChoice> = {}
    // "Mark all absent" keeps students on approved leave as Leave — the
    // server would coerce it anyway, and the teacher should see what will be
    // stored. "Mark all present" is an explicit override for everyone.
    for (const s of data.students) {
      next[s.id] = status === 'absent' && s.on_leave ? 'leave' : status
    }
    setStatuses(next)
  }

  function setOne(studentId: number, status: MarkChoice) {
    setStatuses((prev) => ({ ...prev, [studentId]: status }))
  }

  async function submit() {
    if (!data) return
    setSubmitting(true)
    setError(null)
    try {
      const entries = data.students.map((s) => ({
        student_id: s.id,
        status: statuses[s.id] ?? seedChoice(s),
      }))
      await markTeacherAttendance(sessionId, {
        entries,
        allow_amend: isAmending,
      })
      setSavedAt(new Date())
      await load()
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Couldn't save attendance.",
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    // min-h-full + flex column so the sticky bar's natural position is at
    // the bottom of <main> when the roster is short. Without this the bar
    // floats wherever the content ends.
    <section className="flex min-h-full flex-col gap-4">
      <PageHeader
        leading={
          <BackButton
            iconOnly
            label="Back to today's classes"
            onClick={() => navigateTo('/attendance/mark')}
          />
        }
        title={isAmending ? 'Amend attendance' : 'Mark attendance'}
      />

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

      {savedAt ? (
        <Card className="flex items-center gap-3 border-success/30 bg-success/10 px-4 py-3">
          <CheckCircle2 className="size-5 shrink-0 text-success" />
          <p className="text-sm text-success">
            Attendance saved at{' '}
            {savedAt.toLocaleTimeString('en-IN', {
              hour: '2-digit',
              minute: '2-digit',
            })}
            . You can amend any time.
          </p>
          <button
            type="button"
            onClick={() => setSavedAt(null)}
            aria-label="Dismiss"
            className="ml-auto rounded p-1 text-success/80 hover:bg-success/15"
          >
            <X className="size-4" />
          </button>
        </Card>
      ) : null}

      {loading && !data ? (
        <LoadingState />
      ) : data ? (
        <>
          <HeaderCard
            data={data}
            canUpdate={canUpdate}
            onMarkAll={markAll}
          />

          {/* Two-column layout: roster left, summary aside on the right.
              On screens below lg the aside falls back to a block below the
              roster — still useful, just not sticky. */}
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <Card className="flex flex-col overflow-hidden">
              <div className="flex flex-wrap items-center gap-3 border-b bg-muted/30 px-4 py-3">
                <div className="flex items-center gap-2">
                  <Users className="size-4 text-muted-foreground" />
                  <p className="text-sm font-medium">
                    {filtered.length} of {data.students.length} students
                  </p>
                </div>
                <div className="relative ml-auto w-full sm:w-72">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search name or roll…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-9 pl-8"
                  />
                </div>
              </div>

              {filtered.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No students match your search.
                </div>
              ) : (
                // Grid is calibrated to the remaining width after the aside
                // (~22rem on lg+). Single col on phones, 2 on tablet, 2 once
                // the aside appears at lg, 3 on xl, 4 on 2xl. The narrower
                // density on lg keeps the cells from getting squeezed when
                // the aside takes the right column.
                <div className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                  {filtered.map((student, index) => (
                    <StudentCell
                      key={student.id}
                      index={index}
                      student={student}
                      value={statuses[student.id]}
                      onChange={(next) => setOne(student.id, next)}
                      disabled={!canUpdate}
                    />
                  ))}
                </div>
              )}
            </Card>

            <SummaryAside
              data={data}
              counts={counts}
              absentees={data.students.filter(
                (s) => statuses[s.id] === 'absent',
              )}
              onLeave={data.students.filter(
                (s) => statuses[s.id] === 'leave',
              )}
              isAmending={!!isAmending}
              canUpdate={canUpdate}
              submitting={submitting}
              onSubmit={() => void submit()}
              onCancel={() => navigateTo('/attendance/mark')}
            />
          </div>
        </>
      ) : null}
    </section>
  )
}

// ---------------------------------------------------------------------------
// Header — session metadata + bulk actions
// (totals live in the SummaryAside on the right so they don't take vertical
//  space at the top of the page)
// ---------------------------------------------------------------------------

function HeaderCard({
  data,
  canUpdate,
  onMarkAll,
}: {
  data: TeacherRosterResult
  canUpdate: boolean
  onMarkAll: (status: Extract<MarkChoice, 'present' | 'absent'>) => void
}) {
  const onLeaveCount = data.students.filter((s) => s.on_leave).length
  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          Session #{data.session_id}
          {data.attendance_marked_at
            ? ` · marked ${new Date(data.attendance_marked_at).toLocaleString('en-IN', {
                day: '2-digit',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })}`
            : ''}
        </p>
        <Badge
          variant={
            data.status === 'completed'
              ? 'success'
              : data.status === 'cancelled'
                ? 'destructive'
                : 'default'
          }
        >
          {data.status === 'completed'
            ? 'Marked'
            : data.status === 'cancelled'
              ? 'Cancelled'
              : data.status === 'rescheduled'
                ? 'Rescheduled'
                : 'Pending'}
        </Badge>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onMarkAll('present')}
          disabled={!canUpdate}
        >
          Mark all present
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onMarkAll('absent')}
          disabled={!canUpdate}
        >
          Mark all absent
        </Button>
        {!canUpdate ? (
          <span className="self-center text-xs text-warning">
            View-only — submitting is disabled.
          </span>
        ) : null}
      </div>

      {onLeaveCount > 0 ? (
        <p className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-icon-violet/10 px-2.5 py-1.5 text-xs text-icon-violet">
          <CalendarOff className="size-3.5" />
          {onLeaveCount} student{onLeaveCount === 1 ? ' is' : 's are'} on
          approved leave today — pre-filled as Leave. Mark them Present only if
          they actually attended.
        </p>
      ) : null}
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Student cell — dense grid item with a Present/Absent toggle; students on
// approved leave get Present/Leave instead (Leave is what the server stores
// for them unless the teacher says they turned up).
// ---------------------------------------------------------------------------

function StudentCell({
  index,
  student,
  value,
  onChange,
  disabled,
}: {
  index: number
  student: RosterEntry
  value: MarkChoice | undefined
  onChange: (next: MarkChoice) => void
  disabled: boolean
}) {
  const present = value === 'present'
  const absent = value === 'absent'
  const leave = value === 'leave'

  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-lg border bg-card p-2.5 transition-colors',
        present && 'border-success/40 bg-success/5',
        absent && 'border-destructive/40 bg-destructive/5',
        leave && 'border-icon-violet/40 bg-icon-violet/5',
      )}
    >
      {/* Identity block — roll number always on its own row so it's never
          clipped by the toggle. font-mono so rolls align column-wise even
          when names wrap. */}
      <div className="min-w-0">
        <p className="flex items-baseline gap-1.5">
          <span className="text-xs font-medium tabular-nums text-muted-foreground">
            {index + 1}.
          </span>
          <span className="whitespace-nowrap font-mono text-sm font-bold tracking-wide tabular-nums">
            {student.student_id}
          </span>
          {student.on_leave ? (
            <span
              className="ml-auto inline-flex items-center gap-1 rounded-full bg-icon-violet/15 px-1.5 py-0.5 text-[10px] font-semibold text-icon-violet"
              title={student.leave_type ?? 'On leave'}
            >
              <CalendarOff className="size-3" />
              {student.leave_type ?? 'On leave'}
            </span>
          ) : null}
        </p>
        <p
          className="mt-0.5 truncate text-xs text-muted-foreground"
          title={student.display_name}
        >
          {student.display_name}
        </p>
      </div>

      {/* Full-width toggle below. Each button takes 50% so the row works at
          any cell width — no horizontal competition with the roll number. */}
      <div
        role="radiogroup"
        aria-label={`Attendance for ${student.display_name}`}
        className="grid grid-cols-2 overflow-hidden rounded-md border"
      >
        <ToggleButton
          selected={present}
          tone="success"
          disabled={disabled}
          onClick={() => onChange('present')}
          label="Present"
          ariaLabel="Present"
        />
        {student.on_leave ? (
          <ToggleButton
            selected={leave}
            tone="leave"
            disabled={disabled}
            onClick={() => onChange('leave')}
            label="Leave"
            ariaLabel="On leave"
          />
        ) : (
          <ToggleButton
            selected={absent}
            tone="destructive"
            disabled={disabled}
            onClick={() => onChange('absent')}
            label="Absent"
            ariaLabel="Absent"
          />
        )}
      </div>
    </div>
  )
}

function ToggleButton({
  selected,
  tone,
  disabled,
  onClick,
  label,
  ariaLabel,
}: {
  selected: boolean
  tone: 'success' | 'destructive' | 'leave'
  disabled: boolean
  onClick: () => void
  label: string
  ariaLabel: string
}) {
  const selectedCls =
    tone === 'success'
      ? 'bg-success text-success-foreground'
      : tone === 'leave'
        ? 'bg-icon-violet text-icon-on'
        : 'bg-destructive text-destructive-foreground'
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'w-full px-2 py-1.5 text-sm font-semibold transition-colors',
        // first/last separator — only show vertical divider when neither side
        // is selected; the selected fill colour already provides separation.
        'border-r last:border-r-0 border-border',
        selected ? selectedCls + ' border-transparent' : 'bg-card text-muted-foreground hover:bg-muted hover:text-foreground',
        disabled && 'cursor-not-allowed opacity-50',
      )}
    >
      {label}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Summary aside — counts + absentee list + submit. Sticky on lg+, stacked
// under the roster on smaller screens. Submit lives here so the teacher's
// last action is reviewing absentees → posting, not hunting for a button.
// ---------------------------------------------------------------------------

function SummaryAside({
  data,
  counts,
  absentees,
  onLeave,
  isAmending,
  canUpdate,
  submitting,
  onSubmit,
  onCancel,
}: {
  data: TeacherRosterResult
  counts: { present: number; absent: number; leave: number }
  absentees: RosterEntry[]
  onLeave: RosterEntry[]
  isAmending: boolean
  canUpdate: boolean
  submitting: boolean
  onSubmit: () => void
  onCancel: () => void
}) {
  const total = data.students.length
  return (
    // self-start lets the aside take only its content height inside the grid
    // cell — without it the aside stretches to match the roster's height and
    // sticky never engages.
    <aside className="lg:sticky lg:top-4 lg:self-start">
      <Card className="flex max-h-[calc(100svh-7rem)] flex-col overflow-hidden">
        <div className="space-y-3 border-b p-4 sm:p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Summary
          </p>
          <div
            className={cn(
              'grid gap-3',
              counts.leave > 0 ? 'grid-cols-3' : 'grid-cols-2',
            )}
          >
            <SummaryTile
              label="Present"
              tone="success"
              value={counts.present}
              total={total}
            />
            <SummaryTile
              label="Absent"
              tone="destructive"
              value={counts.absent}
              total={total}
            />
            {counts.leave > 0 ? (
              <SummaryTile
                label="Leave"
                tone="leave"
                value={counts.leave}
                total={total}
              />
            ) : null}
          </div>
          {onLeave.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              On leave:{' '}
              <span className="font-mono font-medium text-foreground">
                {onLeave.map((s) => s.student_id).join(', ')}
              </span>
            </p>
          ) : null}
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Absent students
            </p>
            <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-semibold tabular-nums text-destructive">
              {absentees.length}
            </span>
          </div>
          <div className="scrollbar-themed min-h-0 flex-1 overflow-y-auto">
            {absentees.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
                <div className="grid size-10 place-items-center rounded-full bg-success/15 text-success">
                  <CheckCircle2 className="size-5" />
                </div>
                <p className="text-sm font-medium">Everyone is present</p>
                <p className="text-xs text-muted-foreground">
                  No absentees so far. Toggle any student on the left if
                  needed.
                </p>
              </div>
            ) : (
              <ul className="divide-y">
                {absentees.map((s, i) => (
                  <li
                    key={s.id}
                    className="flex items-baseline gap-3 px-4 py-2.5"
                  >
                    <span className="w-6 shrink-0 text-right text-xs font-medium tabular-nums text-muted-foreground">
                      {i + 1}.
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="whitespace-nowrap font-mono text-sm font-bold tracking-wide tabular-nums">
                        {s.student_id}
                      </p>
                      <p
                        className="truncate text-xs text-muted-foreground"
                        title={s.display_name}
                      >
                        {s.display_name}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="space-y-2 border-t p-3 sm:p-4">
          <Button
            onClick={onSubmit}
            disabled={!canUpdate || submitting}
            className="w-full"
          >
            {submitting ? (
              <>
                <Loader2 className="animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <CheckCircle2 />
                {isAmending ? 'Save amendment' : 'Post attendance'}
              </>
            )}
          </Button>
          <Button variant="outline" onClick={onCancel} className="w-full">
            Cancel
          </Button>
        </div>
      </Card>
    </aside>
  )
}

function SummaryTile({
  label,
  value,
  total,
  tone,
}: {
  label: string
  value: number
  total: number
  tone: 'success' | 'destructive' | 'leave'
}) {
  const dot =
    tone === 'success'
      ? 'bg-success'
      : tone === 'leave'
        ? 'bg-icon-violet'
        : 'bg-destructive'
  const ratio =
    total > 0 ? ` / ${total}` : ''
  return (
    <div className="rounded-lg border bg-card px-3 py-2">
      <div className="flex items-center gap-1.5">
        <span className={cn('size-2 rounded-full', dot)} />
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
      </div>
      <p className="mt-1 text-2xl font-bold leading-none tabular-nums">
        {value}
        <span className="text-sm font-medium text-muted-foreground">
          {ratio}
        </span>
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Loading state
// ---------------------------------------------------------------------------

function LoadingState() {
  return (
    <>
      <Card className="p-5 sm:p-6">
        <div className="h-7 w-48 animate-pulse rounded bg-muted/60" />
        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="h-16 animate-pulse rounded-lg bg-muted/60" />
          <div className="h-16 animate-pulse rounded-lg bg-muted/60" />
        </div>
      </Card>
      <Card className="overflow-hidden">
        <div className="h-12 animate-pulse border-b bg-muted/40" />
        <div className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-lg bg-muted/60" />
          ))}
        </div>
      </Card>
    </>
  )
}

// ---------------------------------------------------------------------------
// Status seeding — collapse server-side statuses to the three the teacher
// works in. Late counts as Present (the student did attend). A stored `leave`
// stays Leave. OD / Exempt are admin-mediated; default to Absent here so the
// teacher's submission doesn't silently lose an admin's prior excusal.
// Unmarked → Leave when an approved leave covers the day (what the server
// will store anyway), else Present, the most common case.
// ---------------------------------------------------------------------------
function seedChoice(entry: RosterEntry): MarkChoice {
  const s: AttendanceStatus | null = entry.current_status
  if (s === 'present' || s === 'late') return 'present'
  if (s === 'absent') return entry.on_leave ? 'leave' : 'absent'
  if (s === 'leave') return entry.on_leave ? 'leave' : 'absent'
  if (s === null) return entry.on_leave ? 'leave' : 'present'
  // od / exempt → absent; admin's adjustment row already credits them.
  return entry.on_leave ? 'leave' : 'absent'
}
