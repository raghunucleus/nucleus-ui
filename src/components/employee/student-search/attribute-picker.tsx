import * as React from 'react'
import { Plus, Search, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { MetaAttribute } from '@/lib/student-search'
import { cn } from '@/lib/utils'

/**
 * A searchable, grouped dropdown for choosing which attribute to add as a
 * filter. The existing `Combobox` / `SearchableSelect` primitives are id-keyed
 * and flat, so this dedicated picker works over attribute *string keys* grouped
 * by `meta.groups`. Selecting an attribute calls `onPick` and closes.
 *
 * The trigger is a full-width "+ Add filter" button; a compact variant is used
 * for the inline OR-branch add. Behaviour (outside-click close, focus-on-open,
 * arrow-key nav over the flattened option list) mirrors `ui/combobox.tsx`.
 */
export function AttributePicker({
  attributes,
  groups,
  onPick,
  triggerLabel = 'Add filter',
  compact = false,
  searchPlaceholder = 'Search filters…',
  emptyMessage = 'No filters match',
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
}) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const [activeIndex, setActiveIndex] = React.useState(0)

  const rootRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const listRef = React.useRef<HTMLDivElement>(null)

  const openPanel = () => {
    setQuery('')
    setActiveIndex(0)
    setOpen(true)
    requestAnimationFrame(() => inputRef.current?.focus())
  }
  const toggle = () => (open ? setOpen(false) : openPanel())

  // Attributes grouped in catalog order, filtered by the query. Empty groups
  // are dropped. `flat` is the flattened option list keyboard nav indexes into.
  const { sections, flat } = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    const matches = q
      ? attributes.filter((a) => a.label.toLowerCase().includes(q))
      : attributes
    const sections: { key: string; label: string; items: MetaAttribute[] }[] =
      []
    const flat: MetaAttribute[] = []
    for (const g of groups) {
      const items = matches.filter((a) => a.group === g.key)
      if (items.length === 0) continue
      sections.push({ key: g.key, label: g.label, items })
      flat.push(...items)
    }
    return { sections, flat }
  }, [attributes, groups, query])

  // Clamp the highlight to the current list rather than storing a bounded value
  // (avoids a setState-in-effect as the filtered list shrinks while typing).
  const activeSafe = flat.length === 0 ? 0 : Math.min(activeIndex, flat.length - 1)

  // Close on outside mousedown.
  React.useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  // Scroll the highlighted option into view during keyboard nav.
  React.useEffect(() => {
    if (!open) return
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-picker-index="${activeSafe}"]`,
    )
    el?.scrollIntoView({ block: 'nearest' })
  }, [activeSafe, open])

  const pick = (attr: MetaAttribute) => {
    onPick(attr)
    setOpen(false)
  }

  const onKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (flat.length > 0) setActiveIndex((i) => Math.min(flat.length - 1, i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (flat.length > 0) setActiveIndex((i) => Math.max(0, i - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const attr = flat[activeSafe]
      if (attr) pick(attr)
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
              onChange={(e) => setQuery(e.target.value)}
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
          </div>

          <div
            ref={listRef}
            role="listbox"
            className="max-h-72 overflow-y-auto py-1"
          >
            {flat.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                {emptyMessage}
              </div>
            ) : (
              sections.map((section) => (
                <div key={section.key}>
                  <div className="px-3 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    {section.label}
                  </div>
                  {section.items.map((attr) => {
                    const idx = flat.indexOf(attr)
                    const isActive = idx === activeSafe
                    return (
                      <button
                        key={attr.key}
                        type="button"
                        role="option"
                        aria-selected={isActive}
                        data-picker-index={idx}
                        onMouseEnter={() => setActiveIndex(idx)}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => pick(attr)}
                        className={cn(
                          'flex w-full items-center px-3 py-1.5 text-left text-sm',
                          isActive && 'bg-accent text-accent-foreground',
                        )}
                      >
                        <span className="min-w-0 truncate">{attr.label}</span>
                      </button>
                    )
                  })}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
