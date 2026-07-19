import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronRight, Columns3, Maximize2, Search, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { SearchMeta } from '@/lib/student-search'
import { IMPLICIT_COLUMN_LABELS } from '@/lib/student-search'
import { cn } from '@/lib/utils'

import { ColumnPickerDialog } from './column-picker-dialog'
import { buildSections, useCollapsibleSections } from './picker-sections'

const MAX_COLUMNS = 40

/**
 * Popover checkbox list of selectable attributes, grouped as the registry
 * groups them. Categories are collapsible headers carrying an "n of m
 * selected" count, so a folded section still says whether it contributes
 * columns. Implicit columns (id / roll number / name) are pinned — every
 * result carries them, so they render checked and disabled.
 *
 * The expand button opens {@link ColumnPickerDialog}, which lays the whole
 * catalog out at once.
 */
export function ColumnPicker({
  meta,
  columns,
  onChange,
  onApply,
}: {
  meta: SearchMeta
  columns: string[]
  onChange: (columns: string[]) => void
  /**
   * Re-run the search with the current column set. Rendered as an "Apply"
   * button in the popover footer so column changes fetch immediately instead
   * of waiting for the next Search.
   */
  onApply?: () => void
}) {
  const [open, setOpen] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [session, setSession] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)

  // Close on outside mousedown. The expand dialog portals to <body> — outside
  // `rootRef` — so clicks inside it must not count as "outside".
  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      const target = e.target as HTMLElement | null
      if (
        target?.closest?.(
          '[data-slot="dialog-content"],[data-slot="dialog-overlay"]',
        )
      )
        return
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const selectable = useMemo(
    () => meta.attributes.filter((a) => a.selectable),
    [meta.attributes],
  )
  const { sections } = useMemo(
    () => buildSections(selectable, meta.groups, query),
    [selectable, meta.groups, query],
  )
  const fold = useCollapsibleSections(sections, query, session)

  const atLimit = columns.length >= MAX_COLUMNS

  const togglePanel = () => {
    if (open) {
      setOpen(false)
    } else {
      setQuery('')
      setSession((s) => s + 1)
      setOpen(true)
    }
  }

  const toggle = (key: string) =>
    onChange(
      columns.includes(key)
        ? columns.filter((c) => c !== key)
        : [...columns, key],
    )

  return (
    <div ref={rootRef} className="relative">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={togglePanel}
        aria-expanded={open}
      >
        <Columns3 className="size-4" />
        Columns
        <span className="text-xs text-muted-foreground">{columns.length}</span>
      </Button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-72 overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-lg">
          <div className="flex items-center gap-2 border-b px-3 py-2">
            <Search className="size-3.5 shrink-0 text-muted-foreground" />
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search columns…"
              className="h-7 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            {query && (
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setQuery('')}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="size-3.5" />
              </button>
            )}
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setDialogOpen(true)
                setOpen(false)
              }}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Open full view"
              title="Open full view"
            >
              <Maximize2 className="size-3.5" />
            </button>
          </div>

          <div className="max-h-80 overflow-y-auto py-1">
            <div className="px-2 pb-1 text-[11px] uppercase tracking-wide text-muted-foreground">
              Always included
            </div>
            {meta.implicitColumns.map((key) => (
              <label
                key={key}
                className="flex cursor-not-allowed items-center gap-2 px-3 py-1 text-sm opacity-60"
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

            {sections.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                No columns match
              </div>
            ) : (
              sections.map((section) => {
                const sectionOpen = fold.isOpen(section.key)
                const selected = section.items.filter((i) =>
                  columns.includes(i.attr.key),
                ).length
                return (
                  <div key={section.key}>
                    <button
                      type="button"
                      aria-expanded={sectionOpen}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => fold.toggle(section.key)}
                      className="mt-1 flex w-full items-center gap-1.5 bg-muted/40 px-2 py-1.5 text-left hover:bg-muted"
                    >
                      <ChevronRight
                        className={cn(
                          'size-3.5 shrink-0 text-muted-foreground transition-transform',
                          sectionOpen && 'rotate-90',
                        )}
                      />
                      <span className="min-w-0 flex-1 truncate text-[11px] font-semibold uppercase tracking-wide">
                        {section.label}
                      </span>
                      <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                        {selected}/{section.items.length}
                      </span>
                    </button>

                    {sectionOpen ? (
                      <div className="ml-4 border-l">
                        {section.items.map(({ attr }) => {
                          const on = columns.includes(attr.key)
                          const disabled = !on && atLimit
                          return (
                            <label
                              key={attr.key}
                              className={cn(
                                'flex cursor-pointer items-center gap-2 py-1 pl-3 pr-3 text-sm hover:bg-accent',
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
                              <span className="min-w-0 truncate">
                                {attr.label}
                              </span>
                            </label>
                          )
                        })}
                      </div>
                    ) : null}
                  </div>
                )
              })
            )}

            {atLimit ? (
              <p className="mt-2 px-3 text-[11px] text-muted-foreground">
                Column limit reached ({MAX_COLUMNS}).
              </p>
            ) : null}
          </div>

          {onApply ? (
            <div className="border-t bg-popover px-2 py-2">
              <Button
                type="button"
                size="sm"
                className="w-full"
                onClick={() => {
                  setOpen(false)
                  onApply()
                }}
              >
                Apply
              </Button>
            </div>
          ) : null}
        </div>
      )}

      <ColumnPickerDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        meta={meta}
        columns={columns}
        onChange={onChange}
        onApply={onApply}
        maxColumns={MAX_COLUMNS}
        initialQuery={query}
      />
    </div>
  )
}
