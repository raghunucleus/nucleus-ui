import type { ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  countLabel,
  dayParts,
  fullDateLabel,
  rowDate,
  soonLabel,
  type BirthdayLike,
  type BirthdayMonthBucket,
} from '@/lib/birthday-months'
import { cn } from '@/lib/utils'

/**
 * The birthdays month browser — one month at a time instead of a year-long
 * scroll.
 *
 * A cohort's birthdays are spread thinly over 365 days, so the useful question
 * is "who is coming up in this month", not "what is 200 rows down". The year
 * strip answers the other half: every month with its count, so a reader can
 * jump to a friend's month without scrolling at all.
 *
 * Rows are drawn here (date tile, timing hint, the muted treatment for
 * birthdays already gone) and the caller supplies just the person cell, which
 * differs between the student and employee screens.
 */
export function BirthdayMonthsCard<T extends BirthdayLike>({
  months,
  index,
  onIndexChange,
  renderPerson,
}: {
  months: BirthdayMonthBucket<T>[]
  index: number
  onIndexChange: (next: number) => void
  /** Avatar + name + subtitle for one row: an avatar then a `min-w-0 flex-1` block. */
  renderPerson: (person: T) => ReactNode
}) {
  const active = months[index]
  if (!active) return null
  const total = active.upcoming.length + active.passed.length

  return (
    <section className="rounded-xl border bg-card text-card-foreground shadow-sm">
      <header className="flex items-center gap-2 px-4 pt-4">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-8"
          onClick={() => onIndexChange(index - 1)}
          disabled={index === 0}
          aria-label="Previous month"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <div className="min-w-0 flex-1 text-center">
          <h2 className="truncate text-sm font-semibold" aria-live="polite">
            {active.title}
          </h2>
          <p className="text-xs text-muted-foreground">{countLabel(total)}</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-8"
          onClick={() => onIndexChange(index + 1)}
          disabled={index === months.length - 1}
          aria-label="Next month"
        >
          <ChevronRight className="size-4" />
        </Button>
      </header>

      {/* The year at a glance — twelve months from this one, each with a count. */}
      <div
        role="group"
        aria-label="Choose a month"
        className="grid grid-cols-6 gap-1.5 border-b px-4 pt-3 pb-4 sm:grid-cols-12"
      >
        {months.map((month, i) => {
          const count = month.upcoming.length + month.passed.length
          const selected = i === index
          return (
            <button
              key={month.key}
              type="button"
              title={month.title}
              aria-pressed={selected}
              aria-label={`${month.title}, ${countLabel(count)}`}
              onClick={() => onIndexChange(i)}
              className={cn(
                'flex flex-col items-center gap-0.5 rounded-lg border py-1.5 text-xs font-medium transition-colors',
                'focus-visible:ring-[3px] focus-visible:ring-ring/30 focus-visible:outline-none',
                selected
                  ? 'border-icon-rose bg-icon-rose/10 text-icon-rose'
                  : count === 0
                    ? 'border-border/60 text-muted-foreground/60 hover:bg-muted/40'
                    : 'border-border bg-card text-muted-foreground hover:bg-muted/40 hover:text-foreground',
              )}
            >
              <span>{month.short}</span>
              <span
                className={cn(
                  'text-[11px] leading-none font-semibold tabular-nums',
                  selected
                    ? undefined
                    : count === 0
                      ? 'font-normal'
                      : 'text-foreground',
                )}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {total === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-muted-foreground">
          No birthdays in {active.title}.
        </p>
      ) : (
        <>
          {active.upcoming.length > 0 ? (
            <ul className="divide-y">
              {active.upcoming.map((person) => (
                <PersonRow
                  key={person.id}
                  monthKey={active.key}
                  person={person}
                  trailing={soonLabel(person.days_until)}
                >
                  {renderPerson(person)}
                </PersonRow>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              No more birthdays this month.
            </p>
          )}

          {active.passed.length > 0 ? (
            <>
              <p className="border-y bg-muted/40 px-4 py-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                Earlier this month
              </p>
              <ul className="divide-y">
                {active.passed.map((person) => (
                  <PersonRow
                    key={person.id}
                    monthKey={active.key}
                    person={person}
                    trailing="Celebrated"
                    muted
                  >
                    {renderPerson(person)}
                  </PersonRow>
                ))}
              </ul>
            </>
          ) : null}
        </>
      )}
    </section>
  )
}

/** One person inside a month: date tile, the caller's cell, a timing hint. */
function PersonRow<T extends BirthdayLike>({
  monthKey,
  person,
  trailing,
  muted,
  children,
}: {
  monthKey: string
  person: T
  trailing: string
  muted?: boolean
  children: ReactNode
}) {
  const { day, weekday } = dayParts(rowDate(monthKey, person.date))
  return (
    <li
      className={cn(
        'flex items-center gap-3 px-4 py-3',
        muted && 'text-muted-foreground opacity-70',
      )}
    >
      <div
        className={cn(
          'flex w-9 shrink-0 flex-col items-center rounded-lg py-1',
          muted ? 'bg-muted text-muted-foreground' : 'bg-icon-rose/10 text-icon-rose',
        )}
        aria-hidden
      >
        <span className="text-sm leading-none font-semibold tabular-nums">{day}</span>
        <span className="mt-0.5 text-[10px] leading-none font-medium uppercase">
          {weekday}
        </span>
      </div>
      {children}
      {trailing ? (
        <span
          className={cn(
            'shrink-0 text-xs font-medium',
            muted ? 'text-muted-foreground' : 'text-icon-rose',
          )}
        >
          {trailing}
        </span>
      ) : null}
    </li>
  )
}

/**
 * Search results — a flat list across the whole year, so each row carries its
 * own full date instead of leaning on a month header.
 */
export function BirthdayResultsCard<T extends BirthdayLike>({
  people,
  renderPerson,
}: {
  people: T[]
  renderPerson: (person: T) => ReactNode
}) {
  return (
    <section className="rounded-xl border bg-card text-card-foreground shadow-sm">
      <header className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <h2 className="text-sm font-semibold">Results</h2>
        <span className="text-xs text-muted-foreground">{countLabel(people.length)}</span>
      </header>
      <ul className="divide-y">
        {people.map((person) => (
          <li key={person.id} className="flex items-center gap-3 px-4 py-3">
            {renderPerson(person)}
            <span className="shrink-0 text-xs font-medium text-muted-foreground">
              {person.days_until <= 0 ? 'Today 🎂' : fullDateLabel(person.date)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

/**
 * Shaped like the month card — nav row, year strip, a few people — so the wait
 * reads as "birthdays loading" rather than a generic block.
 */
export function BirthdaysSkeleton() {
  return (
    <section
      className="rounded-xl border bg-card text-card-foreground shadow-sm"
      aria-hidden
    >
      <div className="flex items-center gap-2 px-4 pt-4">
        <div className="shimmer size-8 shrink-0 rounded-md bg-muted/60" />
        <div className="flex flex-1 flex-col items-center gap-1.5">
          <div className="shimmer h-3.5 w-32 rounded bg-muted/60" />
          <div className="shimmer h-3 w-20 rounded bg-muted/60" />
        </div>
        <div className="shimmer size-8 shrink-0 rounded-md bg-muted/60" />
      </div>
      <div className="grid grid-cols-6 gap-1.5 border-b px-4 pt-3 pb-4 sm:grid-cols-12">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="shimmer h-10 rounded-lg bg-muted/60" />
        ))}
      </div>
      <ul className="divide-y">
        {Array.from({ length: 4 }).map((_, i) => (
          <li key={i} className="flex items-center gap-3 px-4 py-3">
            <div className="shimmer h-10 w-9 shrink-0 rounded-lg bg-muted/60" />
            <div className="shimmer size-10 shrink-0 rounded-full bg-muted/60" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="shimmer h-3.5 w-2/5 rounded bg-muted/60" />
              <div className="shimmer h-3 w-3/5 rounded bg-muted/60" />
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
