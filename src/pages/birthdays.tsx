import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowUp,
  Cake,
  Check,
  CircleAlert,
  Loader2,
  PartyPopper,
  RefreshCw,
  Search,
} from 'lucide-react'
import { toast } from 'sonner'

import { PageHeader } from '@/components/portal-layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { sendBirthdayWishes, useChatConnection } from '@/lib/chat-socket'
import { ApiError } from '@/lib/api'
import { MODULE_SOFT } from '@/lib/modules'
import {
  avatarColorFor,
  groupByMonth,
  studentBirthdays,
  type BirthdayPerson,
} from '@/lib/student-birthdays'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'

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

export default function BirthdaysPage() {
  const signOut = useAuthStore((state) => state.signOut)
  const [items, setItems] = useState<BirthdayPerson[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [firstLoad, setFirstLoad] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [showTop, setShowTop] = useState(false)
  // Multi-select birthday wishing for today's cohort.
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [sending, setSending] = useState(false)
  useChatConnection()

  // Bumped on every new query so an in-flight fetch from a stale query can't
  // clobber the results of a newer one.
  const reqId = useRef(0)
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    document.title = 'Birthdays — Nucleus'
  }, [])

  // Surface a "back to top" button once the header (and its back link) has
  // scrolled well out of view.
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
      const page = await studentBirthdays({
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
      const page = await studentBirthdays({
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

  const selectedToday = today.filter((p) => selected.has(p.id))
  const allSelected = today.length > 0 && selectedToday.length === today.length

  const toggleSelect = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(today.map((p) => p.id)))

  const sendWishes = async () => {
    if (selectedToday.length === 0 || sending) return
    setSending(true)
    const pending = sendBirthdayWishes(selectedToday)
    toast.promise(pending, {
      loading: 'Sending wishes…',
      success: ({ sent }) =>
        `Wished ${sent} classmate${sent === 1 ? '' : 's'} 🎉`,
      error: 'Could not send wishes.',
    })
    try {
      await pending
      setSelected(new Set())
    } finally {
      setSending(false)
    }
  }

  const header = (
    <PageHeader
      title="Birthdays"
      subtitle="Birthdays of your classmates — send them a wish."
      icon={Cake}
      accent="rose"
    />
  )

  // Very first paint, before we know anything about the roster.
  if (firstLoad && loading) {
    return (
      <>
        {header}
        <ListSkeleton />
      </>
    )
  }

  if (error && items.length === 0) {
    return (
      <>
        {header}
        <ErrorState message={error} onRetry={() => void loadFirst()} />
      </>
    )
  }

  // No search active and nothing came back → the student has no classmates yet.
  if (debounced === '' && items.length === 0 && !loading) {
    return (
      <>
        {header}
        <EmptyState />
      </>
    )
  }

  return (
    <>
      {header}
      <div className="space-y-6">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or roll number"
            className="pl-9"
            aria-label="Search birthdays"
          />
        </div>

        {loading ? (
          <ListSkeleton />
        ) : items.length === 0 ? (
          <p className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
            No classmate matches &ldquo;{debounced}&rdquo;.
          </p>
        ) : (
          <>
            {today.length > 0 ? (
              <section className="rounded-xl border border-icon-rose/20 bg-gradient-to-br from-icon-rose/10 to-icon-amber/10 p-5">
                <div className="flex items-center justify-between gap-2">
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-icon-rose">
                    <PartyPopper className="size-3.5" />
                    Today
                  </p>
                  {today.length > 1 ? (
                    <button
                      type="button"
                      onClick={toggleAll}
                      className="text-xs font-medium text-icon-rose hover:underline"
                    >
                      {allSelected ? 'Clear' : 'Select all'}
                    </button>
                  ) : null}
                </div>

                <p className="mt-1 text-xs text-muted-foreground">
                  Select classmates and send them a birthday wish 🎂
                </p>

                <ul className="mt-3 space-y-1">
                  {today.map((person) => {
                    const isSel = selected.has(person.id)
                    return (
                      <li key={person.id}>
                        <button
                          type="button"
                          onClick={() => toggleSelect(person.id)}
                          aria-pressed={isSel}
                          className={cn(
                            'flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors',
                            isSel ? 'bg-icon-rose/15' : 'hover:bg-background/40',
                          )}
                        >
                          <span
                            className={cn(
                              'grid size-5 shrink-0 place-items-center rounded-md border transition-colors',
                              isSel
                                ? 'border-icon-rose bg-icon-rose text-icon-on'
                                : 'border-muted-foreground/40',
                            )}
                          >
                            {isSel ? <Check className="size-3.5" /> : null}
                          </span>
                          <PersonAvatar
                            name={person.display_name}
                            photoUrl={person.photo_url}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold">
                              {person.display_name}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {person.student_id}
                            </p>
                          </div>
                        </button>
                      </li>
                    )
                  })}
                </ul>

                <Button
                  className="mt-3 w-full"
                  disabled={selectedToday.length === 0 || sending}
                  onClick={() => void sendWishes()}
                >
                  <PartyPopper />
                  {selectedToday.length > 0
                    ? `Send ${selectedToday.length} wish${
                        selectedToday.length === 1 ? '' : 'es'
                      } 🎉`
                    : 'Select classmates to wish'}
                </Button>
              </section>
            ) : null}

            {groupByMonth(upcoming).map((month) => (
              <section
                key={month.label}
                className="rounded-xl border bg-card text-card-foreground shadow-sm"
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
                      <PersonAvatar
                        name={person.display_name}
                        photoUrl={person.photo_url}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {person.display_name}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {[person.student_id, person.section]
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
      </div>

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
    </>
  )
}

function PersonAvatar({
  name,
  photoUrl,
}: {
  name: string
  photoUrl?: string | null
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null)

  // Failure is per-URL: when a refetch delivers a fresh signed URL, retry the
  // image instead of staying on initials forever.
  if (photoUrl && failedUrl !== photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={name}
        onError={() => setFailedUrl(photoUrl)}
        className="size-10 shrink-0 rounded-full border bg-muted object-cover"
      />
    )
  }

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

function ListSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-28 animate-pulse rounded-xl bg-muted" />
      <div className="h-64 animate-pulse rounded-xl bg-muted" />
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border bg-card p-10 text-center text-card-foreground">
      <div className="grid size-12 place-items-center rounded-full bg-icon-rose/10 text-icon-rose">
        <Cake className="size-6" />
      </div>
      <div className="space-y-1">
        <h2 className="text-sm font-semibold">No birthdays right now</h2>
        <p className="max-w-sm text-xs text-muted-foreground">
          None of your classmates have a birthday coming up, or you&rsquo;re not
          in a class group yet. Check back later.
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
