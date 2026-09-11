import { CalendarDays, List } from 'lucide-react'
import { useMemo, useState } from 'react'

import {
  AttendanceCalendar,
  type CalendarItem,
} from '@/components/attendance/attendance-calendar'
import { ErrorBanner } from '@/components/attendance/error-banner'
import {
  SubjectSessionListRow,
  type SessionRowData,
} from '@/components/attendance/subject-session-row'
import { FilterChips } from '@/components/placement-filter-chips'
import { Card } from '@/components/ui/card'
import { Segmented } from '@/components/ui/segmented'
import { deriveSessionStatus } from '@/lib/attendance-status'
import type { SessionSubject } from '@/lib/student-academics'
import type { SubjectSessionsStrings } from '@/lib/subject-sessions-strings'
import { cn } from '@/lib/utils'

type View = 'calendar' | 'list'
type Filter = 'all' | 'absent'
type SubjectFilter = 'all' | `${number}`

type SessionItem = CalendarItem & { session: SessionRowData }

const CHIP_TONE = 'border-primary bg-primary/10 text-primary'

/**
 * A student's sessions — one subject's, or every subject's — as the body
 * under a page header on the student and parent portals. The calendar is
 * the default: a semester is 60–90 rows per subject, and the question is
 * almost always "which days did I miss", which a coloured month answers at
 * a glance. The list stays one click away for the chronological detail.
 *
 * With `subjects` (more than one) a chip row narrows BOTH views to one
 * subject; while "All subjects" is active each row names its subject.
 */
export function SessionsView({
  sessions,
  subjects,
  loading,
  error,
  onRetry,
  strings,
}: {
  /** `null` until the first response lands (drives the skeletons). */
  sessions: readonly SessionRowData[] | null
  subjects?: readonly SessionSubject[]
  loading: boolean
  error: string | null
  onRetry: () => void
  strings: SubjectSessionsStrings
}) {
  const [view, setView] = useState<View>('calendar')
  const [filter, setFilter] = useState<Filter>('all')
  const [subject, setSubject] = useState<SubjectFilter>('all')

  const all = useMemo(() => sessions ?? [], [sessions])
  const multi = (subjects?.length ?? 0) > 1
  // A chosen chip that vanished (subjects changed) falls back to "all".
  const activeSubject =
    multi && subjects?.some((s) => `${s.id}` === subject) ? subject : 'all'
  const showSubject = multi && activeSubject === 'all'

  const bySubject = useMemo(
    () =>
      activeSubject === 'all'
        ? all
        : all.filter(
            (s) => 'subject_id' in s && `${s.subject_id}` === activeSubject,
          ),
    [all, activeSubject],
  )

  const absentCount = useMemo(
    () => bySubject.filter((s) => s.attendance_status === 'absent').length,
    [bySubject],
  )
  const visibleSessions =
    filter === 'absent'
      ? bySubject.filter((s) => s.attendance_status === 'absent')
      : bySubject

  const items = useMemo<SessionItem[]>(
    () =>
      bySubject.map((s) => {
        const kind = deriveSessionStatus(s)
        return {
          id: s.session_id,
          date: s.date,
          kind,
          label: strings.statusLabel(kind),
          sortKey: s.start_time ?? '',
          session: s,
        }
      }),
    [bySubject, strings],
  )

  // Chip counts are totals, untouched by "Only absent", so the row stays
  // stable while the list filter toggles.
  const chipItems = useMemo(() => {
    if (!multi || !subjects) return []
    const counts = new Map<number, number>()
    for (const s of all) {
      if ('subject_id' in s) {
        counts.set(s.subject_id, (counts.get(s.subject_id) ?? 0) + 1)
      }
    }
    return [
      {
        value: 'all' as SubjectFilter,
        label: strings.filterAllSubjects,
        count: all.length,
        tone: CHIP_TONE,
      },
      ...subjects.map((s) => ({
        value: `${s.id}` as SubjectFilter,
        label: s.code,
        count: counts.get(s.id) ?? 0,
        tone: CHIP_TONE,
      })),
    ]
  }, [multi, subjects, all, strings.filterAllSubjects])

  const rowStrings = {
    reason: strings.reason,
    sub: strings.sub,
    statusLabel: strings.statusLabel,
  }

  return (
    <section className="space-y-4">
      {/* Controls stay mounted through loading so nothing jumps. */}
      <div className="flex flex-wrap items-center gap-2">
        <Segmented<View>
          aria-label={strings.viewLabel}
          value={view}
          onChange={setView}
          options={[
            {
              value: 'calendar',
              icon: CalendarDays,
              label: <span className="hidden sm:inline">{strings.viewCalendar}</span>,
              ariaLabel: strings.viewCalendar,
              title: strings.viewCalendar,
            },
            {
              value: 'list',
              icon: List,
              label: <span className="hidden sm:inline">{strings.viewList}</span>,
              ariaLabel: strings.viewList,
              title: strings.viewList,
            },
          ]}
        />
        {view === 'list' ? (
          <Segmented<Filter>
            size="sm"
            aria-label={strings.filterLabel}
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: strings.filterAll },
              { value: 'absent', label: strings.filterAbsent },
            ]}
          />
        ) : null}
        {view === 'list' && sessions ? (
          <p className="basis-full text-xs text-muted-foreground sm:ml-auto sm:basis-auto">
            {filter === 'absent'
              ? strings.showingAbsent(visibleSessions.length, bySubject.length)
              : strings.showingAll(bySubject.length, absentCount)}
          </p>
        ) : null}
      </div>

      {chipItems.length > 0 ? (
        <FilterChips<SubjectFilter>
          value={activeSubject}
          items={chipItems}
          onChange={setSubject}
        />
      ) : null}

      {error && !sessions ? (
        <ErrorBanner
          message={error}
          retryLabel={strings.retry}
          onRetry={onRetry}
        />
      ) : null}

      {loading && !sessions ? (
        view === 'calendar' ? (
          <CalendarSkeleton />
        ) : (
          <ListSkeleton />
        )
      ) : sessions ? (
        view === 'calendar' ? (
          <AttendanceCalendar<SessionItem>
            items={items}
            strings={strings.calendar}
            renderDay={(_date, list) => (
              <Card className="overflow-hidden">
                <ul className="divide-y">
                  {list.map((it) => (
                    <SubjectSessionListRow
                      key={it.id}
                      session={it.session}
                      strings={rowStrings}
                      hideDate
                      showSubject={showSubject}
                    />
                  ))}
                </ul>
              </Card>
            )}
          />
        ) : visibleSessions.length === 0 ? (
          <Card className="px-5 py-10 text-center text-sm italic text-muted-foreground">
            {filter === 'absent' ? strings.noAbsences : strings.noClassesYet}
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <ul className="divide-y">
              {visibleSessions.map((s) => (
                <SubjectSessionListRow
                  key={s.session_id}
                  session={s}
                  strings={rowStrings}
                  showSubject={showSubject}
                />
              ))}
            </ul>
          </Card>
        )
      ) : null}
    </section>
  )
}

const BAR = 'shimmer rounded bg-muted/60'

function CalendarSkeleton() {
  return (
    <div
      className="grid gap-4 lg:grid-cols-[minmax(0,30rem)_minmax(0,1fr)] lg:items-start"
      aria-hidden
    >
      <div className="rounded-xl border bg-card p-3 sm:p-4">
        <div className="flex items-center justify-between">
          <div className={cn(BAR, 'size-8 rounded-md')} />
          <div className={cn(BAR, 'h-4 w-32')} />
          <div className={cn(BAR, 'size-8 rounded-md')} />
        </div>
        <div className="mt-3 flex gap-3">
          <div className={cn(BAR, 'h-3 w-16')} />
          <div className={cn(BAR, 'h-3 w-16')} />
        </div>
        <div className="mt-3 grid grid-cols-7 gap-1">
          {Array.from({ length: 7 }, (_, i) => (
            <div key={`h-${i}`} className={cn(BAR, 'mx-auto h-3 w-6')} />
          ))}
          {Array.from({ length: 35 }, (_, i) => (
            <div key={i} className={cn(BAR, 'aspect-square rounded-lg')} />
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <div className={cn(BAR, 'h-4 w-28')} />
        <Card className="space-y-3 p-4">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className={cn(BAR, 'h-3 w-16')} />
              <div className={cn(BAR, 'h-5 w-20 rounded-full')} />
            </div>
          ))}
        </Card>
      </div>
    </div>
  )
}

function ListSkeleton() {
  return (
    <div className="space-y-3" aria-hidden>
      {[0, 1, 2, 3, 4].map((i) => (
        <Card key={i} className="space-y-2 p-4">
          <div className={cn(BAR, 'h-3 w-20')} />
          <div className={cn(BAR, 'h-4 w-2/3')} />
        </Card>
      ))}
    </div>
  )
}
