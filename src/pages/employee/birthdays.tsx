import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowUp,
  Cake,
  CircleAlert,
  Loader2,
  PartyPopper,
  RefreshCw,
  Search,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ApiError } from '@/lib/api'
import {
  avatarColorFor,
  employeeBirthdays,
  groupByMonth,
  type BirthdayPerson,
} from '@/lib/employee-birthdays'
import { MODULE_SOFT } from '@/lib/modules'
import { cn } from '@/lib/utils'
import { useEmployeeAuthStore } from '@/stores/employee-auth-store'

const PAGE_SIZE = 30

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? parts[parts.length - 1][0] : ''
  return (first + last).toUpperCase() || '?'
}

/** "Sat, 12 Jun" — weekday + day + month of the upcoming birthday. */
function dateLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  })
}

/**
 * Birthdays of the signed-in employee's colleagues — locked server-side to the
 * caller's own department. Read-only: today's birthdays are highlighted, the
 * rest are grouped by month. Paginated for load-on-scroll; search spans the
 * whole department.
 */
export default function EmployeeBirthdaysPage() {
  const signOut = useEmployeeAuthStore((s) => s.signOut)
  const [items, setItems] = useState<BirthdayPerson[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [firstLoad, setFirstLoad] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [showTop, setShowTop] = useState(false)

  // Bumped on every new query so an in-flight fetch from a stale query can't
  // clobber the results of a newer one.
  const reqId = useRef(0)
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    document.title = 'Birthdays — Nucleus'
  }, [])

  // Surface a "back to top" button once the header has scrolled out of view.
  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 600)
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Debounce the raw input into the value we actually query with.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300)
    return () => clearTimeout(t)
  }, [query])

  // (Re)load the first page whenever the debounced query changes.
  const loadFirst = useCallback(async () => {
    const id = (reqId.current += 1)
    setLoading(true)
    setError(null)
    try {
      const page = await employeeBirthdays({
        limit: PAGE_SIZE,
        offset: 0,
        q: debounced || undefined,
      })
      if (id !== reqId.current) return
      setItems(page.items)
      setTotal(page.total)
    } catch (err) {
      if (id !== reqId.current) return
      if (err instanceof ApiError && err.status === 401) {
        signOut()
        return
      }
      setError(err instanceof Error ? err.message : 'Could not load birthdays.')
    } finally {
      if (id === reqId.current) {
        setLoading(false)
        setFirstLoad(false)
      }
    }
  }, [debounced, signOut])

  useEffect(() => {
    void loadFirst()
  }, [loadFirst])

  const hasMore = items.length < total

  const loadMore = useCallback(async () => {
    if (loading || loadingMore || items.length >= total) return
    const id = reqId.current
    setLoadingMore(true)
    try {
      const page = await employeeBirthdays({
        limit: PAGE_SIZE,
        offset: items.length,
        q: debounced || undefined,
      })
      if (id !== reqId.current) return
      setItems((prev) => [...prev, ...page.items])
      setTotal(page.total)
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) signOut()
      // Other errors: leave what we have; scrolling again retries.
    } finally {
      if (id === reqId.current) setLoadingMore(false)
    }
  }, [loading, loadingMore, items.length, total, debounced, signOut])

  // Fire loadMore as the sentinel nears the viewport.
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMore()
      },
      { rootMargin: '400px' },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [loadMore])

  const today = items.filter((p) => p.days_until <= 0)
  const upcoming = items.filter((p) => p.days_until > 0)

  const header = (
    <div className="flex items-start gap-3">
      <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-icon-rose/10 text-icon-rose">
        <Cake className="size-5" />
      </div>
      <div className="min-w-0">
        <h1 className="text-lg font-semibold tracking-tight">Birthdays</h1>
        <p className="text-sm text-muted-foreground">
          Birthdays of colleagues in your department.
        </p>
      </div>
    </div>
  )

  // Very first paint, before we know anything about the roster.
  if (firstLoad && loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        {header}
        <ListSkeleton />
      </div>
    )
  }

  if (error && items.length === 0) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        {header}
        <ErrorState message={error} onRetry={() => void loadFirst()} />
      </div>
    )
  }

  // No search active and nothing came back → no colleagues with a birthday on
  // record in this department yet.
  if (debounced === '' && items.length === 0 && !loading) {
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
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or employee code"
          className="pl-9"
          aria-label="Search birthdays"
        />
      </div>

      {loading ? (
        <ListSkeleton />
      ) : items.length === 0 ? (
        <p className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">
          No colleague matches &ldquo;{debounced}&rdquo;.
        </p>
      ) : (
        <>
          {today.length > 0 ? (
            <section className="rounded-2xl border border-icon-rose/20 bg-gradient-to-br from-icon-rose/10 to-icon-amber/10 p-5">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-icon-rose">
                <PartyPopper className="size-3.5" />
                Today
              </p>
              <ul className="mt-3 space-y-1">
                {today.map((person) => (
                  <li
                    key={person.id}
                    className="flex items-center gap-3 rounded-xl p-2"
                  >
                    <PersonAvatar name={person.display_name} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {person.display_name}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {person.emp_code}
                      </p>
                    </div>
                    <span className="shrink-0 text-lg" aria-hidden>
                      🎂
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {groupByMonth(upcoming).map((month) => (
            <section
              key={month.label}
              className="rounded-2xl border bg-card text-card-foreground shadow-sm"
            >
              <header className="flex items-center justify-between border-b px-5 py-3.5">
                <h3 className="text-sm font-semibold">{month.label}</h3>
              </header>
              <ul className="divide-y">
                {month.people.map((person) => (
                  <li
                    key={person.id}
                    className="flex items-center gap-3 px-5 py-3"
                  >
                    <PersonAvatar name={person.display_name} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {person.display_name}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {[person.emp_code, person.department]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs font-medium text-muted-foreground">
                      {dateLabel(person.date)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}

          {hasMore ? <div ref={sentinelRef} className="h-px" /> : null}
          {loadingMore ? (
            <div className="flex items-center justify-center gap-2 py-2 text-xs text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Loading more…
            </div>
          ) : null}
        </>
      )}

      {showTop ? (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          aria-label="Back to top"
          className="fixed bottom-6 right-6 z-40 inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-lg transition hover:opacity-90"
        >
          <ArrowUp className="size-4" />
          Top
        </button>
      ) : null}
    </div>
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

// Mirrors the month-grouped roster — an avatar circle with name/code lines
// and a trailing date per row — so the wait reads as "birthdays loading".
// Uses the shared `shimmer` sweep rather than a flat pulse.
function ListSkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      {[4, 3].map((rows, g) => (
        <section
          key={g}
          className="rounded-2xl border bg-card text-card-foreground shadow-sm"
        >
          <header className="flex items-center justify-between border-b px-5 py-3.5">
            <div className="shimmer h-3.5 w-32 rounded bg-muted/60" />
          </header>
          <ul className="divide-y">
            {Array.from({ length: rows }).map((_, i) => (
              <li key={i} className="flex items-center gap-3 px-5 py-3">
                <div className="shimmer size-10 shrink-0 rounded-full bg-muted/60" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="shimmer h-3.5 w-2/5 rounded bg-muted/60" />
                  <div className="shimmer h-3 w-3/5 rounded bg-muted/60" />
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

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border bg-card p-10 text-center text-card-foreground">
      <div className="grid size-12 place-items-center rounded-full bg-icon-rose/10 text-icon-rose">
        <Cake className="size-6" />
      </div>
      <div className="space-y-1">
        <h2 className="text-sm font-semibold">No birthdays right now</h2>
        <p className="max-w-sm text-xs text-muted-foreground">
          None of your colleagues have a birthday coming up, or their dates of
          birth haven&rsquo;t been recorded yet. Check back later.
        </p>
      </div>
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
    <div className="flex flex-col items-center gap-3 rounded-2xl border bg-card p-10 text-center text-card-foreground">
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
