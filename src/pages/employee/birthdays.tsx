import { useEffect, useMemo, useState } from 'react'
import { Cake, CircleAlert, PartyPopper, RefreshCw, Search } from 'lucide-react'

import {
  BirthdayMonthsCard,
  BirthdayResultsCard,
  BirthdaysSkeleton,
} from '@/components/birthdays/birthday-months-card'
import { Button } from '@/components/ui/button'
import { EmptyState as EmptyStatePanel } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
import { Input } from '@/components/ui/input'
import { ApiError } from '@/lib/api'
import { birthdayMonths, matchesQuery } from '@/lib/birthday-months'
import { todayIso } from '@/lib/calendar-grid'
import {
  avatarColorFor,
  fetchAllEmployeeBirthdays,
  type BirthdayPerson,
} from '@/lib/employee-birthdays'
import { MODULE_SOFT } from '@/lib/modules'
import { cn } from '@/lib/utils'
import { useEmployeeAuthStore } from '@/stores/employee-auth-store'

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? parts[parts.length - 1][0] : ''
  return (first + last).toUpperCase() || '?'
}

/**
 * Birthdays of the signed-in employee's colleagues — locked server-side to the
 * caller's own department. Read-only: today's birthdays sit on top and the
 * rest of the year is browsed a month at a time. The whole department loads
 * once, so months and search never wait on the network.
 */
export default function EmployeeBirthdaysPage() {
  const signOut = useEmployeeAuthStore((s) => s.signOut)
  const [people, setPeople] = useState<BirthdayPerson[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  // The month being browsed; 0 is the current one, 11 the far end of the year.
  const [monthIndex, setMonthIndex] = useState(0)
  // Read once — the day must not shift under the buckets mid-session.
  const [today] = useState(todayIso)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    document.title = 'Birthdays — Nucleus'
  }, [])

  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const rows = await fetchAllEmployeeBirthdays()
        if (!alive) return
        setPeople(rows)
        setError(null)
      } catch (err) {
        if (!alive) return
        if (err instanceof ApiError && err.status === 401) {
          signOut()
          return
        }
        setError(err instanceof Error ? err.message : 'Could not load birthdays.')
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [reloadKey, signOut])

  function retry() {
    setLoading(true)
    setError(null)
    setReloadKey((key) => key + 1)
  }

  const q = query.trim()
  const roster = useMemo(() => people ?? [], [people])

  const todayPeople = useMemo(
    () =>
      roster.filter(
        (p) => p.days_until <= 0 && matchesQuery(q, p.display_name, p.emp_code),
      ),
    [roster, q],
  )
  const months = useMemo(() => birthdayMonths(roster, today), [roster, today])
  // A search spans the whole year, so it replaces the month view entirely.
  const results = useMemo(
    () =>
      q
        ? roster.filter(
            (p) => p.days_until > 0 && matchesQuery(q, p.display_name, p.emp_code),
          )
        : null,
    [roster, q],
  )

  const header = (
    <PageHeader
      icon={Cake}
      title="Birthdays"
      subtitle="Birthdays of colleagues in your department."
    />
  )

  if (error && !people) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        {header}
        <ErrorState message={error} onRetry={retry} />
      </div>
    )
  }

  // Nothing came back at all → no colleague has a date of birth on record yet.
  if (!loading && people && people.length === 0) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        {header}
        <EmptyState />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {header}

      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or employee code"
          className="pl-9"
          aria-label="Search birthdays"
        />
      </div>

      {todayPeople.length > 0 ? <TodayCard people={todayPeople} /> : null}

      {loading && !people ? (
        <BirthdaysSkeleton />
      ) : results ? (
        results.length > 0 ? (
          <BirthdayResultsCard
            people={results}
            renderPerson={(person) => <PersonCell person={person} />}
          />
        ) : todayPeople.length === 0 ? (
          <p className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
            No colleague matches &ldquo;{q}&rdquo;.
          </p>
        ) : null
      ) : (
        <BirthdayMonthsCard
          months={months}
          index={monthIndex}
          onIndexChange={setMonthIndex}
          renderPerson={(person) => <PersonCell person={person} />}
        />
      )}
    </div>
  )
}

/** Name + code/department — the part of a row that differs between portals. */
function PersonCell({ person }: { person: BirthdayPerson }) {
  return (
    <>
      <PersonAvatar name={person.display_name} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{person.display_name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {[person.emp_code, person.department].filter(Boolean).join(' · ')}
        </p>
      </div>
    </>
  )
}

/** Today's colleagues — read-only, there is no wishing on this portal. */
function TodayCard({ people }: { people: BirthdayPerson[] }) {
  return (
    <section className="rounded-xl border border-icon-rose/20 bg-gradient-to-br from-icon-rose/10 to-icon-amber/10 p-5">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-icon-rose uppercase">
        <PartyPopper className="size-3.5" />
        Today
      </p>
      <ul className="mt-3 space-y-1">
        {people.map((person) => (
          <li key={person.id} className="flex items-center gap-3 rounded-xl p-2">
            <PersonAvatar name={person.display_name} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{person.display_name}</p>
              <p className="truncate text-xs text-muted-foreground">{person.emp_code}</p>
            </div>
            <span className="shrink-0 text-lg" aria-hidden>
              🎂
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function PersonAvatar({ name }: { name: string }) {
  return (
    <div
      className={cn(
        'grid size-10 shrink-0 place-items-center rounded-full text-xs font-semibold',
        MODULE_SOFT[avatarColorFor(name)],
      )}
    >
      {initials(name)}
    </div>
  )
}

function EmptyState() {
  return (
    <EmptyStatePanel
      icon={Cake}
      title="No birthdays right now"
      description="None of your colleagues have a birthday coming up, or their dates of birth haven’t been recorded yet. Check back later."
    />
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
        <h2 className="text-sm font-semibold">Couldn&rsquo;t load birthdays</h2>
        <p className="max-w-sm text-xs text-muted-foreground">{message}</p>
      </div>
      <Button size="sm" onClick={onRetry}>
        <RefreshCw />
        Try again
      </Button>
    </div>
  )
}
