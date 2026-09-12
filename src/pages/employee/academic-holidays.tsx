import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  RefreshCw,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import { HolidayEmptyState, HolidayList } from '@/components/holiday-list'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { ApiError } from '@/lib/api'
import { fetchEmployeeHolidaysPaged } from '@/lib/employee-academics'
import { toIsoDate, type AcademicHoliday } from '@/lib/holidays'

// The calendar opens on what's coming up; done holidays sit behind the Past
// tab so the default view isn't cluttered with breaks already gone by.
type Scope = 'upcoming' | 'past'

const PAGE_SIZE = 10

/**
 * The institution academic calendar for employees — read-only and visible to
 * every employee, so no screen-access gate (the endpoint is auth-only by
 * design). Opens on upcoming holidays; the Past tab surfaces earlier ones.
 */
export default function EmployeeAcademicHolidaysPage() {
  const today = toIsoDate(new Date())

  const [scope, setScope] = useState<Scope>('upcoming')
  const [page, setPage] = useState(1)

  const [holidays, setHolidays] = useState<AcademicHoliday[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchEmployeeHolidaysPaged({
        scope,
        page,
        page_size: PAGE_SIZE,
      })
      setHolidays(res.items)
      setTotal(res.total)
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Could not load holidays.',
      )
    } finally {
      setLoading(false)
    }
  }, [scope, page])

  useEffect(() => {
    void load()
  }, [load])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const rangeEnd = Math.min(page * PAGE_SIZE, total)

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader icon={CalendarDays} title="Holidays" />

      <ScopeTabs
        value={scope}
        onChange={(s) => {
          setScope(s)
          // A scope switch invalidates the page index — jump back to page 1 so
          // the user never lands on an out-of-range page.
          setPage(1)
        }}
      />

      {loading ? (
        <ListSkeleton />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : holidays.length === 0 ? (
        <HolidayEmptyState
          message={
            scope === 'upcoming'
              ? 'No upcoming holidays. Check the Past tab for earlier breaks.'
              : 'No past holidays yet.'
          }
        />
      ) : (
        <div className="space-y-4">
          <HolidayList
            holidays={holidays}
            today={today}
            order={scope === 'past' ? 'desc' : 'asc'}
            dimPast={false}
          />
          <Pagination
            page={page}
            totalPages={totalPages}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            total={total}
            onPrev={() => setPage((p) => Math.max(1, p - 1))}
            onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
          />
        </div>
      )}
    </div>
  )
}

function ScopeTabs({
  value,
  onChange,
}: {
  value: Scope
  onChange: (s: Scope) => void
}) {
  const tabs: { value: Scope; label: string }[] = [
    { value: 'upcoming', label: 'Upcoming' },
    { value: 'past', label: 'Past' },
  ]
  return (
    <div className="inline-flex rounded-lg border bg-muted/40 p-0.5">
      {tabs.map((t) => (
        <button
          key={t.value}
          type="button"
          onClick={() => onChange(t.value)}
          className={
            value === t.value
              ? 'rounded-md bg-background px-3.5 py-1.5 text-xs font-semibold shadow-sm'
              : 'rounded-md px-3.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground'
          }
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

function Pagination({
  page,
  totalPages,
  rangeStart,
  rangeEnd,
  total,
  onPrev,
  onNext,
}: {
  page: number
  totalPages: number
  rangeStart: number
  rangeEnd: number
  total: number
  onPrev: () => void
  onNext: () => void
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border bg-card px-4 py-3 text-card-foreground shadow-sm">
      <p className="text-xs text-muted-foreground">
        Showing{' '}
        <span className="font-medium text-foreground">
          {rangeStart}–{rangeEnd}
        </span>{' '}
        of <span className="font-medium text-foreground">{total}</span>
      </p>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={onPrev}
          disabled={page <= 1}
        >
          <ChevronLeft />
          Prev
        </Button>
        <span className="text-xs text-muted-foreground">
          Page {page} of {totalPages}
        </span>
        <Button
          size="sm"
          variant="outline"
          onClick={onNext}
          disabled={page >= totalPages}
        >
          Next
          <ChevronRight />
        </Button>
      </div>
    </div>
  )
}

// Mirrors the real month-grouped HolidayList — a date tile, title/reason
// lines and a type pill per row — so the wait reads as "holidays loading"
// rather than as featureless blocks. Uses the shared `shimmer` sweep.
function ListSkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      {[3, 2].map((rows, g) => (
        <section
          key={g}
          className="rounded-xl border bg-card text-card-foreground shadow-sm"
        >
          <header className="flex items-center justify-between border-b px-5 py-3.5">
            <div className="shimmer h-3.5 w-28 rounded bg-muted/60" />
            <div className="shimmer h-3 w-16 rounded bg-muted/60" />
          </header>
          <ul className="divide-y">
            {Array.from({ length: rows }).map((_, i) => (
              <li key={i} className="flex items-start gap-3 px-5 py-3.5">
                <div className="shimmer size-12 shrink-0 rounded-xl bg-muted/60" />
                <div className="min-w-0 flex-1 space-y-2 py-0.5">
                  <div className="shimmer h-3.5 w-1/2 rounded bg-muted/60" />
                  <div className="shimmer h-3 w-2/3 rounded bg-muted/60" />
                  <div className="shimmer h-5 w-20 rounded-full bg-muted/60" />
                </div>
                <div className="shimmer h-3 w-14 shrink-0 rounded bg-muted/60" />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border bg-card p-10 text-center text-card-foreground">
      <div className="grid size-12 place-items-center rounded-full bg-destructive/10 text-destructive">
        <CircleAlert className="size-6" />
      </div>
      <div className="space-y-1">
        <h2 className="text-sm font-semibold">Couldn&rsquo;t load holidays</h2>
        <p className="max-w-sm text-xs text-muted-foreground">{message}</p>
      </div>
      <Button size="sm" onClick={onRetry}>
        <RefreshCw />
        Try again
      </Button>
    </div>
  )
}
