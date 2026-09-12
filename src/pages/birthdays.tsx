import { useEffect, useMemo, useState } from 'react'
import { Cake, Check, CircleAlert, PartyPopper, RefreshCw, Search } from 'lucide-react'
import { toast } from 'sonner'

import {
  BirthdayMonthsCard,
  BirthdayResultsCard,
  BirthdaysSkeleton,
} from '@/components/birthdays/birthday-months-card'
import { PageHeader } from '@/components/portal-layout'
import { Button } from '@/components/ui/button'
import { EmptyState as EmptyStatePanel } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { sendBirthdayWishes, useChatConnection } from '@/lib/chat-socket'
import { ApiError } from '@/lib/api'
import { birthdayMonths, matchesQuery } from '@/lib/birthday-months'
import { todayIso } from '@/lib/calendar-grid'
import { MODULE_SOFT } from '@/lib/modules'
import {
  avatarColorFor,
  fetchAllStudentBirthdays,
  type BirthdayPerson,
} from '@/lib/student-birthdays'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? parts[parts.length - 1][0] : ''
  return (first + last).toUpperCase() || '?'
}

/**
 * Classmate birthdays, browsed a month at a time.
 *
 * The whole class group arrives in one load, so switching months and searching
 * never wait on the network. Today's classmates stay pinned at the top with
 * the wishing controls; everyone else sits under the month they fall in.
 */
export default function BirthdaysPage() {
  const signOut = useAuthStore((state) => state.signOut)
  const [people, setPeople] = useState<BirthdayPerson[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  // The month being browsed; 0 is the current one, 11 the far end of the year.
  const [monthIndex, setMonthIndex] = useState(0)
  // Read once — the day must not shift under the buckets mid-session.
  const [today] = useState(todayIso)
  const [reloadKey, setReloadKey] = useState(0)
  // Multi-select birthday wishing for today's cohort.
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [sending, setSending] = useState(false)
  useChatConnection()

  useEffect(() => {
    document.title = 'Birthdays — Nucleus'
  }, [])

  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const rows = await fetchAllStudentBirthdays()
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
        (p) => p.days_until <= 0 && matchesQuery(q, p.display_name, p.student_id),
      ),
    [roster, q],
  )
  const months = useMemo(() => birthdayMonths(roster, today), [roster, today])
  // A search spans the whole year, so it replaces the month view entirely.
  const results = useMemo(
    () =>
      q
        ? roster.filter(
            (p) => p.days_until > 0 && matchesQuery(q, p.display_name, p.student_id),
          )
        : null,
    [roster, q],
  )

  const selectedToday = todayPeople.filter((p) => selected.has(p.id))
  const allSelected =
    todayPeople.length > 0 && selectedToday.length === todayPeople.length

  const toggleSelect = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(todayPeople.map((p) => p.id)))

  const sendWishes = async () => {
    if (selectedToday.length === 0 || sending) return
    setSending(true)
    const pending = sendBirthdayWishes(selectedToday)
    toast.promise(pending, {
      loading: 'Sending wishes…',
      success: ({ sent }) => `Wished ${sent} classmate${sent === 1 ? '' : 's'} 🎉`,
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

  if (error && !people) {
    return (
      <>
        {header}
        <ErrorState message={error} onRetry={retry} />
      </>
    )
  }

  // Nothing came back at all → the student has no classmates yet.
  if (!loading && people && people.length === 0) {
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
      <div className="space-y-4">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or roll number"
            className="pl-9"
            aria-label="Search birthdays"
          />
        </div>

        {todayPeople.length > 0 ? (
          <TodayCard
            people={todayPeople}
            selected={selected}
            allSelected={allSelected}
            sending={sending}
            onToggle={toggleSelect}
            onToggleAll={toggleAll}
            onSend={() => void sendWishes()}
          />
        ) : null}

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
              No classmate matches &ldquo;{q}&rdquo;.
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
    </>
  )
}

/** Name + roll/section — the part of a row that differs between portals. */
function PersonCell({ person }: { person: BirthdayPerson }) {
  return (
    <>
      <PersonAvatar name={person.display_name} photoUrl={person.photo_url} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{person.display_name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {[person.student_id, person.section].filter(Boolean).join(' · ')}
        </p>
      </div>
    </>
  )
}

/** Today's classmates, with the wishing controls. */
function TodayCard({
  people,
  selected,
  allSelected,
  sending,
  onToggle,
  onToggleAll,
  onSend,
}: {
  people: BirthdayPerson[]
  selected: Set<number>
  allSelected: boolean
  sending: boolean
  onToggle: (id: number) => void
  onToggleAll: () => void
  onSend: () => void
}) {
  const selectedCount = people.filter((p) => selected.has(p.id)).length

  return (
    <section className="rounded-xl border border-icon-rose/20 bg-gradient-to-br from-icon-rose/10 to-icon-amber/10 p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-icon-rose uppercase">
          <PartyPopper className="size-3.5" />
          Today
        </p>
        {people.length > 1 ? (
          <button
            type="button"
            onClick={onToggleAll}
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
        {people.map((person) => {
          const isSel = selected.has(person.id)
          return (
            <li key={person.id}>
              <button
                type="button"
                onClick={() => onToggle(person.id)}
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
        disabled={selectedCount === 0 || sending}
        onClick={onSend}
      >
        <PartyPopper />
        {selectedCount > 0
          ? `Send ${selectedCount} wish${selectedCount === 1 ? '' : 'es'} 🎉`
          : 'Select classmates to wish'}
      </Button>
    </section>
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

function EmptyState() {
  return (
    <EmptyStatePanel
      icon={Cake}
      title="No birthdays right now"
      description="None of your classmates have a birthday coming up, or you’re not in a class group yet. Check back later."
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
