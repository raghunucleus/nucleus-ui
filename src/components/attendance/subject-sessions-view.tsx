import { CalendarDays, List } from 'lucide-react'
import { useMemo, useState } from 'react'

import {
  AttendanceCalendar,
  type CalendarItem,
} from '@/components/attendance/attendance-calendar'
import { ErrorBanner } from '@/components/attendance/error-banner'
import { SubjectSessionListRow } from '@/components/attendance/subject-session-row'
import { Card } from '@/components/ui/card'
import { Segmented } from '@/components/ui/segmented'
import { deriveSessionStatus } from '@/lib/attendance-status'
import type {
  SubjectSessionRow,
  SubjectSessionsResult,
} from '@/lib/student-academics'
import type { SubjectSessionsStrings } from '@/lib/subject-sessions-strings'
import { cn } from '@/lib/utils'

type View = 'calendar' | 'list'
type Filter = 'all' | 'absent'

type SessionItem = CalendarItem & { session: SubjectSessionRow }

/**
 * One subject's sessions for one student — the body under the page header
 * on both the student and parent portals. The calendar is the default: a
 * semester is 60–90 rows, and the question is almost always "which days did
 * I miss", which a coloured month answers at a glance. The list stays one
 * click away for anyone who wants the chronological detail.
 */
export function SubjectSessionsView({
  data,
  loading,
  error,
  onRetry,
  strings,
}: {
  data: SubjectSessionsResult | null
  loading: boolean
  error: string | null
  onRetry: () => void
  strings: SubjectSessionsStrings
}) {
  const [view, setView] = useState<View>('calendar')
  const [filter, setFilter] = useState<Filter>('all')

  const sessions = useMemo(() => data?.sessions ?? [], [data])
  const absentCount = useMemo(
    () => sessions.filter((s) => s.attendance_status === 'absent').length,
    [sessions],
  )
  const visibleSessions =
    filter === 'absent'
      ? sessions.filter((s) => s.attendance_status === 'absent')
      : sessions

  const items = useMemo<SessionItem[]>(
    () =>
      sessions.map((s) => {
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
    [sessions, strings],
  )

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
        {view === 'list' && data ? (
          <p className="basis-full text-xs text-muted-foreground sm:ml-auto sm:basis-auto">
            {filter === 'absent'
              ? strings.showingAbsent(visibleSessions.length, sessions.length)
              : strings.showingAll(sessions.length, absentCount)}
          </p>
        ) : null}
      </div>

      {error && !data ? (
        <ErrorBanner
          message={error}
          retryLabel={strings.retry}
          onRetry={onRetry}
        />
      ) : null}

      {loading && !data ? (
        view === 'calendar' ? (
          <CalendarSkeleton />
        ) : (
          <ListSkeleton />
        )
      ) : data ? (
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
