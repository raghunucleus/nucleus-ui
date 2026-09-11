import { ChevronLeft, ChevronRight } from 'lucide-react'
import type * as React from 'react'

import type { CalendarItem } from '@/components/attendance/attendance-calendar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from '@/components/ui/sheet'
import type { AttendanceCalendarStrings } from '@/lib/subject-sessions-strings'

/**
 * One day's classes in a bottom sheet — the phone-width home of the
 * calendar's day detail. The header pages to the previous / next day that
 * HAS classes (never an empty day), so a reader can walk a fortnight of
 * absences without ever touching the grid behind. ← / → do the same from
 * the keyboard while the sheet is open.
 */
export function DayDetailSheet<T extends CalendarItem>({
  open,
  onOpenChange,
  date,
  items,
  isToday,
  canPrev,
  canNext,
  onPrev,
  onNext,
  renderDay,
  strings,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** `YYYY-MM-DD`; `null` renders nothing. */
  date: string | null
  items: readonly T[]
  isToday: boolean
  canPrev: boolean
  canNext: boolean
  onPrev: () => void
  onNext: () => void
  renderDay: (date: string, items: readonly T[]) => React.ReactNode
  strings: AttendanceCalendarStrings
}) {
  const absent = items.filter((it) => it.kind === 'absent').length
  const dayTitle = strings.dayTitle ?? ((iso: string) => iso)

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft' && canPrev) {
      e.preventDefault()
      onPrev()
    } else if (e.key === 'ArrowRight' && canNext) {
      e.preventDefault()
      onNext()
    }
  }

  return (
    <Sheet open={open && date !== null} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        onKeyDown={onKeyDown}
        className="max-h-[75vh] gap-0 rounded-t-2xl p-0"
      >
        {/* Grabber — visual only, matches the mobile app's sheets. */}
        <div aria-hidden className="flex justify-center pt-2">
          <div className="h-1 w-9 rounded-full bg-muted-foreground/30" />
        </div>

        <div className="flex items-center justify-between gap-2 px-4 pb-3 pt-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-8 shrink-0"
            onClick={onPrev}
            disabled={!canPrev}
            aria-label={strings.prevDay}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <div className="min-w-0 text-center">
            <SheetTitle
              className="flex items-center justify-center gap-2 text-sm"
              aria-live="polite"
            >
              <span className="truncate">{date ? dayTitle(date) : ''}</span>
              {isToday ? (
                <Badge variant="secondary" className="shrink-0">
                  {strings.today}
                </Badge>
              ) : null}
            </SheetTitle>
            <SheetDescription className="text-xs tabular-nums">
              {strings.daySummary(items.length, absent)}
            </SheetDescription>
          </div>
          {/* Room for the Radix close X at top-right; next sits just inside it. */}
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="mr-8 size-8 shrink-0"
            onClick={onNext}
            disabled={!canNext}
            aria-label={strings.nextDay}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>

        <div className="scrollbar-themed min-h-0 flex-1 overflow-y-auto border-t px-4 py-3">
          {date ? renderDay(date, items) : null}
        </div>

        <div className="border-t p-3">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => onOpenChange(false)}
          >
            {strings.close}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
