import * as React from 'react'
import { ChevronRight, Maximize2, Plus, Search, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { MetaAttribute } from '@/lib/student-search'
import { cn } from '@/lib/utils'

import { AttributePickerDialog } from './attribute-picker-dialog'
import { buildSections, useCollapsibleSections } from './picker-sections'

/**
 * A searchable, grouped dropdown for choosing which attribute to add as a
 * filter. The existing `Combobox` / `SearchableSelect` primitives are id-keyed
 * and flat, so this dedicated picker works over attribute *string keys* grouped
 * by `meta.groups`. Selecting an attribute calls `onPick` and closes.
 *
 * Categories are collapsible section headers (chevron + count) with their items
 * indented beneath a rail, so the two levels are visually distinct — the
 * catalog is ~130 attributes across 14 groups and reads as a wall of text
 * otherwise. An expand button opens {@link AttributePickerDialog}, which shows
 * everything at once in a multi-column modal.
 *
 * The trigger is a full-width "+ Add filter" button; a compact variant is used
 * for the inline OR-branch add. Behaviour (outside-click close, focus-on-open,
 * arrow-key nav over the visible option list) mirrors `ui/combobox.tsx`.
 */
export function AttributePicker({
  attributes,
  groups,
  onPick,
  triggerLabel = 'Add filter',
  compact = false,
  searchPlaceholder = 'Search filters…',
  emptyMessage = 'No filters match',
  dialogTitle = 'Add a filter',
}: {
  /** Already filtered to `filterable` attributes. */
  attributes: MetaAttribute[]
  groups: { key: string; label: string }[]
  onPick: (attr: MetaAttribute) => void
  triggerLabel?: string
  /** Smaller ghost trigger for the inline OR-branch add. */
  compact?: boolean
  searchPlaceholder?: string
  emptyMessage?: string
  dialogTitle?: string
}) {
  const [open, setOpen] = React.useState(false)
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const [activePos, setActivePos] = React.useState(0)
  // Bumped on each open so collapse state resets to the default fold.
  const [session, setSession] = React.useState(0)

  const rootRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const listRef = React.useRef<HTMLDivElement>(null)

  const openPanel = () => {
    setQuery('')
    setActivePos(0)
    setSession((s) => s + 1)
    setOpen(true)
    requestAnimationFrame(() => inputRef.current?.focus())
  }
  const toggle = () => (open ? setOpen(false) : openPanel())

  const { sections } = React.useMemo(
    () => buildSections(attributes, groups, query),
    [attributes, groups, query],
  )
  const fold = useCollapsibleSections(sections, query, session)
  const { visible } = fold

  // Clamp the highlight to the current list rather than storing a bounded value
  // (avoids a setState-in-effect as the visible list shrinks while typing).
  const activeSafe =
    visible.length === 0 ? 0 : Math.min(activePos, visible.length - 1)
  const activeItem = visible[activeSafe]

  // Close on outside mousedown. The expand dialog portals to <body> — outside
  // `rootRef` — so clicks inside it must not count as "outside".
  React.useEffect(() => {
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

  // Scroll the highlighted option into view during keyboard nav.
  React.useEffect(() => {
    if (!open) return
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-picker-index="${activeItem?.index ?? -1}"]`,
    )
    el?.scrollIntoView({ block: 'nearest' })
  }, [activeItem, open])

  const pick = (attr: MetaAttribute) => {
    onPick(attr)
    setOpen(false)
  }

  const expand = () => {
    setDialogOpen(true)
    setOpen(false)
  }

  const onKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (visible.length > 0)
        setActivePos((i) => Math.min(visible.length - 1, i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (visible.length > 0) setActivePos((i) => Math.max(0, i - 1))
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      // Open / close the section the highlight sits in. With everything folded
      // there is no highlight yet, so ArrowRight opens the first section.
      e.preventDefault()
      const key = activeItem
        ? fold.sectionOf(activeItem.index)
        : sections[0]?.key
      if (!key) return
      const isOpen = fold.isOpen(key)
      if (e.key === 'ArrowRight' ? !isOpen : isOpen) fold.toggle(key)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (activeItem) pick(activeItem.attr)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
    }
  }

  return (
    <div ref={rootRef} className="relative">
      {compact ? (
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          className="text-[11px] font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          + or (add a choice)
        </button>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full justify-start"
          onClick={toggle}
          aria-expanded={open}
        >
          <Plus className="size-4" />
          {triggerLabel}
        </Button>
      )}

      {open && (
        <div
          className={cn(
            'absolute left-0 top-full z-50 mt-1 w-full min-w-[16rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-lg',
            'animate-in fade-in-0 zoom-in-95 duration-150',
          )}
        >
          <div className="flex items-center gap-2 border-b px-3 py-2">
            <Search className="size-3.5 shrink-0 text-muted-foreground" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setActivePos(0)
              }}
              onKeyDown={onKeyDown}
              placeholder={searchPlaceholder}
              className="h-7 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            {query && (
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setQuery('')
                  inputRef.current?.focus()
                }}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="size-3.5" />
              </button>
            )}
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={expand}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Open full view"
              title="Open full view"
            >
              <Maximize2 className="size-3.5" />
            </button>
          </div>

          {/* Fold controls are pointless while searching — everything is open. */}
          {!query && sections.length > 1 ? (
            <div className="flex items-center justify-end border-b px-3 py-1">
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  if (fold.anyOpen) fold.collapseAll()
                  else fold.expandAll()
                  setActivePos(0)
                }}
                className="text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              >
                {fold.anyOpen ? 'Collapse all' : 'Expand all'}
              </button>
            </div>
          ) : null}

          <div
            ref={listRef}
            role="listbox"
            className="max-h-72 overflow-y-auto py-1"
          >
            {sections.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                {emptyMessage}
              </div>
            ) : (
              sections.map((section) => {
                const sectionOpen = fold.isOpen(section.key)
                return (
                  <div key={section.key}>
                    <button
                      type="button"
                      aria-expanded={sectionOpen}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => fold.toggle(section.key)}
                      className={cn(
                        'flex w-full items-center gap-1.5 px-2 py-1.5 text-left',
                        'bg-muted/40 hover:bg-muted',
                      )}
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
                        {section.items.length}
                        {section.items.length < section.total
                          ? `/${section.total}`
                          : ''}
                      </span>
                    </button>

                    {sectionOpen ? (
                      <div className="ml-4 border-l">
                        {section.items.map(({ attr, index }) => {
                          const isActive = activeItem?.index === index
                          return (
                            <button
                              key={attr.key}
                              type="button"
                              role="option"
                              aria-selected={isActive}
                              data-picker-index={index}
                              onMouseEnter={() =>
                                setActivePos(
                                  visible.findIndex((v) => v.index === index),
                                )
                              }
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => pick(attr)}
                              className={cn(
                                'flex w-full items-center py-1.5 pl-3 pr-3 text-left text-sm',
                                isActive && 'bg-accent text-accent-foreground',
                              )}
                            >
                              <span className="min-w-0 truncate">
                                {attr.label}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    ) : null}
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}

      <AttributePickerDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        attributes={attributes}
        groups={groups}
        onPick={onPick}
        title={dialogTitle}
        initialQuery={query}
        emptyMessage={emptyMessage}
      />
    </div>
  )
}
