import * as React from 'react'
import { Search, X } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { MetaAttribute } from '@/lib/student-search'
import { cn } from '@/lib/utils'

import { buildSections } from './picker-sections'

const KIND_LABELS: Record<MetaAttribute['kind'], string> = {
  string: 'text',
  number: 'number',
  boolean: 'yes/no',
  date: 'date',
  enum: 'choice',
  fk: 'lookup',
}

/**
 * The roomy counterpart to {@link AttributePicker}'s dropdown: every category
 * and every attribute laid out at once in a multi-column flow, so the whole
 * ~130-attribute catalog can be scanned without scrolling a 288px list. Search
 * semantics are shared via {@link buildSections}, so results here match the
 * dropdown exactly.
 */
export function AttributePickerDialog({
  open,
  onOpenChange,
  attributes,
  groups,
  onPick,
  title = 'Add a filter',
  initialQuery = '',
  searchPlaceholder = 'Search all filters…',
  emptyMessage = 'No filters match',
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  attributes: MetaAttribute[]
  groups: { key: string; label: string }[]
  onPick: (attr: MetaAttribute) => void
  title?: string
  /** Seeded from the dropdown so expanding mid-search is continuous. */
  initialQuery?: string
  searchPlaceholder?: string
  emptyMessage?: string
}) {
  const [query, setQuery] = React.useState(initialQuery)

  // Re-seed each time the dialog opens rather than tracking `initialQuery`
  // continuously — once open, the field belongs to the user. Adjusted during
  // render (not in an effect) so the first paint already has the query.
  const [wasOpen, setWasOpen] = React.useState(open)
  if (wasOpen !== open) {
    setWasOpen(open)
    if (open) setQuery(initialQuery)
  }

  const { sections, flat } = React.useMemo(
    () => buildSections(attributes, groups, query),
    [attributes, groups, query],
  )

  const pick = (attr: MetaAttribute) => {
    onPick(attr)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-5xl gap-3"
        // The picker can be opened from inside the panel's own expand modal.
        // Without this, Escape would unwind both layers at once.
        onEscapeKeyDown={(e) => e.stopPropagation()}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-2 rounded-md border px-3 py-2">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
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
          {flat.length} {flat.length === 1 ? 'filter' : 'filters'} in{' '}
          {sections.length}{' '}
          {sections.length === 1 ? 'category' : 'categories'}
        </p>

        <div className="max-h-[70vh] overflow-y-auto">
          {sections.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              {emptyMessage}
            </div>
          ) : (
            <div className="gap-6 sm:columns-2 lg:columns-3">
              {sections.map((section) => (
                <div
                  key={section.key}
                  className="mb-5 break-inside-avoid-column"
                >
                  <div className="mb-1 flex items-baseline gap-2 border-b pb-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-foreground">
                      {section.label}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {section.items.length}
                    </span>
                  </div>
                  {section.items.map(({ attr }) => (
                    <button
                      key={attr.key}
                      type="button"
                      onClick={() => pick(attr)}
                      className={cn(
                        'flex w-full items-center justify-between gap-2 rounded px-2 py-1 text-left text-sm',
                        'hover:bg-accent hover:text-accent-foreground',
                      )}
                    >
                      <span className="min-w-0 truncate">{attr.label}</span>
                      <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
                        {KIND_LABELS[attr.kind]}
                      </span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
