import * as React from 'react'
import { Search, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { SearchMeta } from '@/lib/student-search'
import { IMPLICIT_COLUMN_LABELS } from '@/lib/student-search'
import { cn } from '@/lib/utils'

import { buildSections } from './picker-sections'

/**
 * The roomy counterpart to {@link ColumnPicker}'s popover: every category and
 * every selectable attribute at once in a multi-column flow, so a 40-column
 * selection can be assembled without scrolling a 320px list. Selection is live
 * (each toggle writes straight through); "Apply" re-runs the search and closes.
 */
export function ColumnPickerDialog({
  open,
  onOpenChange,
  meta,
  columns,
  onChange,
  onApply,
  maxColumns,
  initialQuery = '',
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  meta: SearchMeta
  columns: string[]
  onChange: (columns: string[]) => void
  onApply?: () => void
  maxColumns: number
  initialQuery?: string
}) {
  const [query, setQuery] = React.useState(initialQuery)

  // Re-seeded on each open, adjusted during render rather than in an effect.
  const [wasOpen, setWasOpen] = React.useState(open)
  if (wasOpen !== open) {
    setWasOpen(open)
    if (open) setQuery(initialQuery)
  }

  const selectable = React.useMemo(
    () => meta.attributes.filter((a) => a.selectable),
    [meta.attributes],
  )
  const { sections } = React.useMemo(
    () => buildSections(selectable, meta.groups, query),
    [selectable, meta.groups, query],
  )

  const atLimit = columns.length >= maxColumns

  const toggle = (key: string) =>
    onChange(
      columns.includes(key)
        ? columns.filter((c) => c !== key)
        : [...columns, key],
    )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-5xl gap-3"
        onEscapeKeyDown={(e) => e.stopPropagation()}
      >
        <DialogHeader>
          <DialogTitle>Choose columns</DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-2 rounded-md border px-3 py-2">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search all columns…"
            className="h-6 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          {columns.length} of {maxColumns} columns selected
          {atLimit ? ' — limit reached' : ''}
        </p>

        <div className="max-h-[70vh] overflow-y-auto">
          <div className="mb-5">
            <div className="mb-1 border-b pb-1 text-[11px] font-semibold uppercase tracking-wide text-foreground">
              Always included
            </div>
            <div className="flex flex-wrap gap-x-6">
              {meta.implicitColumns.map((key) => (
                <label
                  key={key}
                  className="flex cursor-not-allowed items-center gap-2 px-2 py-1 text-sm opacity-60"
                >
                  <input
                    type="checkbox"
                    checked
                    disabled
                    className="accent-primary"
                  />
                  {IMPLICIT_COLUMN_LABELS[key] ?? key}
                </label>
              ))}
            </div>
          </div>

          {sections.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              No columns match
            </div>
          ) : (
            <div className="gap-6 sm:columns-2 lg:columns-3">
              {sections.map((section) => {
                const selected = section.items.filter((i) =>
                  columns.includes(i.attr.key),
                ).length
                return (
                  <div
                    key={section.key}
                    className="mb-5 break-inside-avoid-column"
                  >
                    <div className="mb-1 flex items-baseline gap-2 border-b pb-1">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-foreground">
                        {section.label}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {selected}/{section.items.length}
                      </span>
                    </div>
                    {section.items.map(({ attr }) => {
                      const on = columns.includes(attr.key)
                      const disabled = !on && atLimit
                      return (
                        <label
                          key={attr.key}
                          className={cn(
                            'flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-accent',
                            disabled && 'cursor-not-allowed opacity-50',
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={on}
                            disabled={disabled}
                            onChange={() => toggle(attr.key)}
                            className="accent-primary"
                          />
                          <span className="min-w-0 truncate">{attr.label}</span>
                        </label>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {onApply ? (
          <DialogFooter>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                onOpenChange(false)
                onApply()
              }}
            >
              Apply
            </Button>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
