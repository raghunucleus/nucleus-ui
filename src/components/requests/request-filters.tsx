import { useState } from 'react'
import {
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  CalendarRange,
  Check,
  ChevronDown,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { DatePicker } from '@/components/ui/date-picker'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

/** `null` = no date filter ("Any time"). Boundaries are local ISO `YYYY-MM-DD`. */
export type DateRange = { from: string; to: string } | null
export type SortDir = 'newest' | 'oldest'

/**
 * Date + sort controls shared by the student "My Requests" list and the
 * employee "Approvals" table. Presentational only: it emits a `DateRange`
 * (null when "Any time") and a `SortDir` — the student page filters/sorts the
 * in-memory list with them, the approvals page passes them to the server query.
 */
export function RequestFilters({
  value,
  onChange,
  sort,
  onSortChange,
  className,
}: {
  value: DateRange
  onChange: (next: DateRange) => void
  sort: SortDir
  onSortChange: (next: SortDir) => void
  className?: string
}) {
  // Which preset drives the dropdown label. "custom" reveals the pickers; the
  // parent only ever sees the resolved DateRange.
  const [preset, setPreset] = useState<Preset>(value ? 'custom' : 'any')
  // Seed the custom range with the last 30 days so the pickers open sensibly.
  const [from, setFrom] = useState(value?.from ?? toIso(addDays(new Date(), -29)))
  const [to, setTo] = useState(value?.to ?? toIso(new Date()))

  function selectPreset(p: Preset) {
    setPreset(p)
    if (p === 'any') return onChange(null)
    if (p === 'custom') return onChange({ from, to })
    onChange(rangeForPreset(p))
  }

  function changeFrom(next: string) {
    const start = next || from
    // Keep the range valid: a start past the end drags the end with it.
    const end = start > to ? start : to
    setFrom(start)
    setTo(end)
    onChange({ from: start, to: end })
  }

  function changeTo(next: string) {
    const end = next || to
    const start = end < from ? end : from
    setTo(end)
    setFrom(start)
    onChange({ from: start, to: end })
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2 font-normal">
            <CalendarRange className="size-4 text-muted-foreground" />
            {PRESET_LABELS[preset]}
            <ChevronDown className="size-4 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-44">
          {PRESETS.map((p) => (
            <DropdownMenuItem
              key={p}
              onSelect={() => selectPreset(p)}
              className="justify-between"
            >
              {PRESET_LABELS[p]}
              {preset === p && <Check className="size-4 text-primary" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {preset === 'custom' && (
        <div className="flex items-center gap-1.5 rounded-md border bg-card px-2.5 py-1">
          <DatePicker
            value={from}
            hideIcon
            onChange={changeFrom}
            aria-label="Range start date"
          />
          <span className="text-xs text-muted-foreground">→</span>
          <DatePicker
            value={to}
            hideIcon
            onChange={changeTo}
            aria-label="Range end date"
          />
        </div>
      )}

      <Button
        variant="outline"
        size="sm"
        className="gap-2 font-normal"
        onClick={() => onSortChange(sort === 'newest' ? 'oldest' : 'newest')}
        aria-label={`Sort by date, ${sort === 'newest' ? 'newest' : 'oldest'} first`}
      >
        {sort === 'newest' ? (
          <ArrowDownWideNarrow className="size-4 text-muted-foreground" />
        ) : (
          <ArrowUpNarrowWide className="size-4 text-muted-foreground" />
        )}
        {sort === 'newest' ? 'Newest first' : 'Oldest first'}
      </Button>
    </div>
  )
}

// --- presets ----------------------------------------------------------------

type Preset = 'any' | 'last7' | 'last30' | 'month' | 'custom'

const PRESETS: Preset[] = ['any', 'last7', 'last30', 'month', 'custom']

const PRESET_LABELS: Record<Preset, string> = {
  any: 'Any time',
  last7: 'Last 7 days',
  last30: 'Last 30 days',
  month: 'This month',
  custom: 'Custom range',
}

/** Resolve a fixed preset to its [from, to] window, ending today (local). */
function rangeForPreset(p: Exclude<Preset, 'any' | 'custom'>): DateRange {
  const today = new Date()
  const to = toIso(today)
  if (p === 'month') {
    return { from: toIso(new Date(today.getFullYear(), today.getMonth(), 1)), to }
  }
  const back = p === 'last7' ? 6 : 29
  return { from: toIso(addDays(today, -back)), to }
}

// --- local date helpers (mirror ui/date-picker.tsx — keep this self-contained) --

function toIso(date: Date): string {
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
}
