import { ChevronDown, Search, X } from 'lucide-react'
import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export interface FacetOption {
  id: number
  name: string
  /** Muted second line, e.g. the department a programme belongs to. */
  sub?: string
  /** Right-aligned figure, e.g. a student count. */
  hint?: string | number
}

/** Above this many options the menu grows a search box. */
const SEARCH_THRESHOLD = 7

/**
 * A compact multi-select facet for one-row analytics filter bars.
 *
 * The trigger wears the facet NAME and a selection count, and flips to the
 * primary variant while anything is picked — so the bar stays one control
 * tall and never loses its labels, unlike the form multi-select whose chips
 * grow underneath it. The applied values themselves belong in a chip row
 * under the bar (see `AppliedFilterChip`), not inside the trigger.
 *
 * Built on the Radix dropdown menu (portalled, so it is never clipped by a
 * sticky header) with the same sticky search header as the marks-view picker.
 * `onSelect` is prevented on every item so the menu stays open across toggles.
 */
export function FacetMenu({
  label,
  options,
  selected,
  onChange,
  searchPlaceholder = 'Search…',
  disabled,
  className,
  size = 'default',
}: {
  label: string
  options: FacetOption[]
  selected: number[]
  onChange: (ids: number[]) => void
  searchPlaceholder?: string
  disabled?: boolean
  className?: string
  /** `sm` = 32px, for dense analytics headers. */
  size?: 'sm' | 'default'
}) {
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const searchable = options.length > SEARCH_THRESHOLD

  const filtered = useMemo(
    () =>
      q
        ? options.filter(
            (o) =>
              o.name.toLowerCase().includes(q) ||
              (o.sub ?? '').toLowerCase().includes(q),
          )
        : options,
    [options, q],
  )
  const picked = useMemo(() => new Set(selected), [selected])
  const count = selected.length

  const toggle = (id: number, on: boolean) =>
    onChange(on ? [...selected, id] : selected.filter((x) => x !== id))

  const selectShown = () =>
    onChange([...new Set([...selected, ...filtered.map((o) => o.id)])])

  return (
    <DropdownMenu onOpenChange={(open) => !open && setQuery('')}>
      <DropdownMenuTrigger asChild>
        <Button
          variant={count > 0 ? 'default' : 'outline'}
          disabled={disabled}
          className={cn(
            'gap-1.5 font-normal',
            size === 'sm' ? 'h-8 px-2.5 text-xs' : 'h-9 px-3',
            className,
          )}
          aria-label={count > 0 ? `${label}: ${count} selected` : label}
        >
          {label}
          {count > 0 && (
            <span
              className={cn(
                'rounded bg-background/25 px-1.5 text-[11px] tabular-nums',
                size === 'sm' ? 'leading-4' : 'leading-5',
              )}
            >
              {count}
            </span>
          )}
          <ChevronDown className="size-3.5 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        onOpenAutoFocus={(e: Event) => e.preventDefault()}
        className="w-64 p-0"
      >
        <div className="sticky top-0 z-10 border-b bg-popover">
          {searchable && (
            <div className="relative p-1">
              <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
                placeholder={searchPlaceholder}
                className="h-9 pl-8"
                aria-label={`Search ${label.toLowerCase()}`}
              />
            </div>
          )}
          <div className="flex items-center justify-between px-2 py-1 text-xs">
            <button
              type="button"
              onClick={selectShown}
              disabled={filtered.length === 0}
              className="font-medium text-primary hover:underline disabled:opacity-50"
            >
              {q ? 'Select matching' : 'Select all'}
            </button>
            <button
              type="button"
              onClick={() => onChange([])}
              disabled={count === 0}
              className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              <X className="size-3" /> Clear
            </button>
          </div>
        </div>
        <div className="max-h-72 overflow-y-auto p-1">
          {filtered.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">
              No matches
            </p>
          ) : (
            filtered.map((o) => (
              <DropdownMenuCheckboxItem
                key={o.id}
                checked={picked.has(o.id)}
                onCheckedChange={(on) => toggle(o.id, on === true)}
                onSelect={(e) => e.preventDefault()}
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate">{o.name}</span>
                  {o.sub && (
                    <span className="truncate text-xs text-muted-foreground">
                      {o.sub}
                    </span>
                  )}
                </span>
                {o.hint !== undefined && (
                  <span className="ml-auto pl-2 text-xs tabular-nums text-muted-foreground">
                    {o.hint}
                  </span>
                )}
              </DropdownMenuCheckboxItem>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
