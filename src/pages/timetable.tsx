import { useEffect, useState } from 'react'
import { CalendarDays, MapPin, User } from 'lucide-react'

import { PageHeader } from '@/components/portal-layout'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import {
  ACADEMIC_CONTEXT,
  TIMETABLE,
  WEEKDAYS,
  WEEKDAY_LABELS,
  teachingCount,
  type ClassKind,
  type ClassSlot,
  type Weekday,
} from '@/lib/academics-mock'

/** Today's column, falling back to Monday on Sundays. */
function todayWeekday(): Weekday {
  const day = new Date().getDay() // 0 = Sunday … 6 = Saturday
  return day === 0 ? 'Mon' : WEEKDAYS[day - 1]
}

const KIND_BADGE: Record<
  Exclude<ClassKind, 'break'>,
  { label: string; variant: 'default' | 'secondary' | 'warning' }
> = {
  lecture: { label: 'Lecture', variant: 'default' },
  lab: { label: 'Lab', variant: 'secondary' },
  tutorial: { label: 'Tutorial', variant: 'warning' },
}

export default function Timetable() {
  const [day, setDay] = useState<Weekday>(todayWeekday())

  useEffect(() => {
    document.title = 'Timetable — Nucleus'
  }, [])

  const slots = TIMETABLE[day]

  return (
    <>
      <PageHeader
        title="Timetable"
        subtitle={`${ACADEMIC_CONTEXT.programme} · Semester ${ACADEMIC_CONTEXT.currentSemester}`}
        icon={CalendarDays}
        accent="blue"
      />

      <div className="flex flex-wrap gap-2">
        {WEEKDAYS.map((weekday) => {
          const selected = weekday === day
          return (
            <button
              key={weekday}
              type="button"
              aria-pressed={selected}
              onClick={() => setDay(weekday)}
              className={cn(
                'rounded-lg border px-4 py-2 text-sm font-medium transition-colors',
                selected
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'bg-card hover:bg-accent hover:text-accent-foreground',
              )}
            >
              <span className="sm:hidden">{weekday}</span>
              <span className="hidden sm:inline">{WEEKDAY_LABELS[weekday]}</span>
            </button>
          )
        })}
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center gap-2 border-b bg-muted/40 px-5 py-3">
          <CalendarDays className="size-4 text-muted-foreground" />
          <p className="text-sm font-medium">
            {WEEKDAY_LABELS[day]}
            <span className="text-muted-foreground">
              {' '}
              · {teachingCount(slots)} classes
            </span>
          </p>
        </div>

        <div>
          {slots.map((slot, index) =>
            slot.kind === 'break' ? (
              <BreakRow key={`break-${index}`} slot={slot} />
            ) : (
              <ClassRow
                key={`${slot.code}-${slot.start}`}
                slot={slot}
                last={index === slots.length - 1}
              />
            ),
          )}
        </div>
      </Card>
    </>
  )
}

function ClassRow({ slot, last }: { slot: ClassSlot; last: boolean }) {
  const badge = KIND_BADGE[slot.kind as Exclude<ClassKind, 'break'>]

  return (
    <div className={cn('flex gap-4 px-5 py-4', !last && 'border-b')}>
      <div className="w-16 shrink-0">
        <p className="text-sm font-semibold tabular-nums">{slot.start}</p>
        <p className="text-xs text-muted-foreground tabular-nums">{slot.end}</p>
      </div>

      <div className="min-w-0 flex-1 space-y-1.5 border-l pl-4">
        <div className="flex items-start justify-between gap-3">
          <p className="font-semibold">{slot.title}</p>
          <Badge variant={badge.variant}>{badge.label}</Badge>
        </div>
        {slot.code ? (
          <p className="text-xs text-muted-foreground">{slot.code}</p>
        ) : null}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {slot.faculty ? (
            <span className="inline-flex items-center gap-1.5">
              <User className="size-3.5" />
              {slot.faculty}
            </span>
          ) : null}
          {slot.room ? (
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="size-3.5" />
              {slot.room}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function BreakRow({ slot }: { slot: ClassSlot }) {
  return (
    <div className="flex items-center gap-3 border-b px-5 py-2">
      <span className="h-px flex-1 bg-border" />
      <span className="text-xs text-muted-foreground">
        {slot.title} · {slot.start}–{slot.end}
      </span>
      <span className="h-px flex-1 bg-border" />
    </div>
  )
}
