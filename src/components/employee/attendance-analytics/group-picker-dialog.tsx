import { Search } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import type { AnalyticsGroup } from '@/lib/attendance-analytics'
import { cn } from '@/lib/utils'

/** Everything a group can be found by, lower-cased once per group. */
function haystack(g: AnalyticsGroup): string {
  return [
    g.name,
    g.code,
    g.description ?? '',
    g.programme.code,
    g.programme.name,
    g.programme.display_name,
    g.programme.department?.code ?? '',
    g.programme.department?.name ?? '',
    g.admission_year.display_year,
  ]
    .join(' ')
    .toLowerCase()
}

/**
 * Group picker for Attendance Analytics.
 *
 * An incharge of many sections had the whole first screen taken by a wrapping
 * wall of group cards they touch once a session, so the cards moved in here
 * behind a search box. The card markup is unchanged — the three lines of
 * context (programme, batch, size) are what tell two same-named sections apart.
 */
export function GroupPickerDialog({
  groups,
  value,
  onSelect,
  open,
  onOpenChange,
}: {
  groups: AnalyticsGroup[]
  value: number | null
  onSelect: (group: AnalyticsGroup) => void
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [q, setQ] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)

  const matches = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return groups
    return groups.filter((g) => haystack(g).includes(needle))
  }, [groups, q])

  // Clearing on close, not on open, keeps the reset out of an effect —
  // reopening still starts from the full list, and a stale query would
  // otherwise read as "you are incharge of nothing".
  const setOpen = (v: boolean) => {
    if (!v) setQ('')
    onOpenChange(v)
  }

  const choose = (g: AnalyticsGroup) => {
    onSelect(g)
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className="max-w-2xl"
        onOpenAutoFocus={(e) => {
          // Focus the search rather than the first card, so typing filters
          // instead of scrolling the list.
          e.preventDefault()
          searchRef.current?.focus()
        }}
      >
        <DialogHeader>
          <DialogTitle>Select attendance group</DialogTitle>
          <DialogDescription>
            The groups you are an in-charge of.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={searchRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && matches[0]) choose(matches[0])
            }}
            placeholder="Search by name, code, programme or batch…"
            className="pl-8"
            aria-label="Search groups"
          />
        </div>

        {matches.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No group matches “{q.trim()}”.
          </p>
        ) : (
          <div className="-mx-1 grid max-h-[60vh] grid-cols-1 gap-2 overflow-y-auto px-1 sm:grid-cols-2">
            {matches.map((g) => {
              const selected = value === g.id
              return (
                <button
                  key={g.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => choose(g)}
                  className={cn(
                    'flex flex-col items-start gap-0.5 rounded-lg border px-3 py-2 text-left transition-colors',
                    selected
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'bg-card hover:bg-accent hover:text-accent-foreground',
                  )}
                >
                  <span className="text-sm font-medium">
                    {g.name}
                    <span className="ml-1 opacity-70">{g.code}</span>
                  </span>
                  <span className="text-xs opacity-80">
                    {g.programme.department?.code
                      ? `${g.programme.department.code} · `
                      : ''}
                    {g.programme.code} · {g.admission_year.display_year}
                  </span>
                  <span className="text-xs opacity-70">
                    {g.member_count} students
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
