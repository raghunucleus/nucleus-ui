import { CalendarOff } from 'lucide-react'

import {
  groupHolidaysByMonth,
  holidayDayCount,
  holidayIsPast,
  holidayRangeLabel,
  HOLIDAY_TYPE_COLOR,
  HOLIDAY_TYPE_LABEL,
  type AcademicHoliday,
} from '@/lib/holidays'
import { cn } from '@/lib/utils'

/** Day-of-month + short month tile, e.g. "12 / Aug". */
function DateTile({ iso, dim }: { iso: string; dim: boolean }) {
  const d = new Date(`${iso}T00:00:00`)
  const day = Number.isNaN(d.getTime())
    ? iso.slice(8, 10)
    : String(d.getDate()).padStart(2, '0')
  const month = Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString('en-IN', { month: 'short' })
  return (
    <div
      className={cn(
        'grid size-12 shrink-0 place-items-center rounded-xl border text-center leading-none',
        dim ? 'bg-muted/40' : 'bg-icon-blue/10',
      )}
    >
      <span
        className={cn(
          'text-base font-semibold',
          dim ? 'text-muted-foreground' : 'text-icon-blue',
        )}
      >
        {day}
      </span>
      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {month}
      </span>
    </div>
  )
}

/**
 * Read-only academic-calendar list, grouped by month. Shared by the student
 * and employee holiday pages — both surfaces just feed it the holidays their
 * scoped endpoint returned.
 *
 * `order` controls month-group direction ('desc' = newest first, for the Past
 * tab). `dimPast` greys out past entries; callers showing a homogeneous Past
 * list pass `false` so the whole list isn't dimmed.
 */
export function HolidayList({
  holidays,
  today,
  order = 'asc',
  dimPast = true,
}: {
  holidays: AcademicHoliday[]
  today: string
  order?: 'asc' | 'desc'
  dimPast?: boolean
}) {
  const groups = groupHolidaysByMonth(holidays, order)

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <section
          key={group.key}
          className="rounded-xl border bg-card text-card-foreground shadow-sm"
        >
          <header className="flex items-center justify-between border-b px-5 py-3.5">
            <h3 className="text-sm font-semibold">{group.label}</h3>
            <span className="text-xs text-muted-foreground">
              {group.holidays.length}{' '}
              {group.holidays.length === 1 ? 'holiday' : 'holidays'}
            </span>
          </header>
          <ul className="divide-y">
            {group.holidays.map((h) => {
              const past = dimPast && holidayIsPast(h, today)
              const days = holidayDayCount(h)
              return (
                <li
                  key={h.id}
                  className={cn(
                    'flex items-start gap-3 px-5 py-3.5',
                    past && 'opacity-55',
                  )}
                >
                  <DateTile iso={h.date} dim={past} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{h.name}</p>
                    {h.reason ? (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {h.reason}
                      </p>
                    ) : null}
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium',
                          HOLIDAY_TYPE_COLOR[h.type],
                        )}
                      >
                        {HOLIDAY_TYPE_LABEL[h.type]}
                      </span>
                      {days > 1 ? (
                        <span className="text-[11px] text-muted-foreground">
                          {days} days
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <span className="shrink-0 pt-0.5 text-xs font-medium text-muted-foreground">
                    {holidayRangeLabel(h)}
                  </span>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}

/** Shared empty state — no declared holidays in the fetched window. */
export function HolidayEmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border bg-card p-10 text-center text-card-foreground">
      <div className="grid size-12 place-items-center rounded-full bg-icon-blue/10 text-icon-blue">
        <CalendarOff className="size-6" />
      </div>
      <div className="space-y-1">
        <h2 className="text-sm font-semibold">No holidays listed</h2>
        <p className="max-w-sm text-xs text-muted-foreground">{message}</p>
      </div>
    </div>
  )
}
