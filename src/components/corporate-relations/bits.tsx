import * as React from 'react'
import { Check, ChevronsUpDown, Search, X } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import type { Chip } from '@/lib/corporate-relations'

/** A styled multi-line text field matching the Input theme. */
export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      'flex min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs',
      'placeholder:text-muted-foreground outline-none transition-[color,box-shadow,border-color]',
      'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30',
      'disabled:cursor-not-allowed disabled:opacity-50',
      className,
    )}
    {...props}
  />
))
Textarea.displayName = 'Textarea'

/** A native <select> styled to match Input. */
export function NativeSelect({
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        'h-9 w-full rounded-md border border-input bg-background px-2 text-sm shadow-xs',
        'outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}

/** Label + control wrapper. */
export function Field({
  label,
  htmlFor,
  hint,
  children,
  className,
  required = false,
}: {
  label: string
  htmlFor?: string
  hint?: string
  children: React.ReactNode
  className?: string
  required?: boolean
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

/** Toggle-chip multi-select over a lookup list. */
export function ChipMultiSelect({
  options,
  selected,
  onChange,
  empty = 'No options configured yet.',
}: {
  options: Chip[]
  selected: number[]
  onChange: (ids: number[]) => void
  empty?: string
}) {
  if (options.length === 0) {
    return <p className="text-xs text-muted-foreground">{empty}</p>
  }
  const toggle = (id: number) =>
    onChange(
      selected.includes(id)
        ? selected.filter((x) => x !== id)
        : [...selected, id],
    )
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = selected.includes(o.id)
        return (
          <button
            key={o.id}
            type="button"
            aria-pressed={on}
            onClick={() => toggle(o.id)}
            className={cn(
              'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
              on
                ? 'border-primary bg-primary text-primary-foreground'
                : 'bg-card hover:bg-accent hover:text-accent-foreground',
            )}
          >
            {o.name}
          </button>
        )
      })}
    </div>
  )
}

/**
 * Searchable multi-select over a lookup list. Unlike ChipMultiSelect (which
 * renders every option as a toggle-chip up front), this keeps the list hidden
 * behind a trigger + search popover — nothing shows until you open it — and
 * surfaces the current selection as removable chips beneath the trigger. Suits
 * long, optional catalogs (industries, roles, …) where dumping every option is
 * noisy.
 */
export function SearchableMultiSelect({
  options,
  selected,
  onChange,
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  emptyMessage = 'No results',
  noOptions = 'No options configured yet.',
  showSelectAll = false,
  id,
}: {
  options: Chip[]
  selected: number[]
  onChange: (ids: number[]) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
  noOptions?: string
  /** Show a "Select all / Clear" row above the option list. */
  showSelectAll?: boolean
  id?: string
}) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const rootRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter((o) => o.name.toLowerCase().includes(q))
  }, [options, query])

  const selectedChips = React.useMemo(
    () => options.filter((o) => selected.includes(o.id)),
    [options, selected],
  )

  React.useEffect(() => {
    if (open) {
      setQuery('')
      requestAnimationFrame(() => inputRef.current?.focus())
    } else {
      setQuery('')
    }
  }, [open])

  // Close on outside mousedown.
  React.useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  if (options.length === 0) {
    return <p className="text-xs text-muted-foreground">{noOptions}</p>
  }

  const toggle = (optId: number) =>
    onChange(
      selected.includes(optId)
        ? selected.filter((x) => x !== optId)
        : [...selected, optId],
    )

  // Union the currently-filtered ids into the selection so a search + "Select
  // all" adds the matches without dropping selections outside the filter.
  const selectAllFiltered = () =>
    onChange(Array.from(new Set([...selected, ...filtered.map((o) => o.id)])))

  const triggerLabel =
    selected.length === 0
      ? placeholder
      : `${selected.length} selected`

  return (
    <div ref={rootRef} className="space-y-2">
      <div className="relative">
        <button
          type="button"
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          onClick={() => setOpen((o) => !o)}
          className={cn(
            'flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none transition',
            'focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
            'hover:bg-accent/40 hover:text-accent-foreground',
          )}
        >
          <span
            className={cn(
              'truncate text-left',
              selected.length === 0 && 'text-muted-foreground',
            )}
          >
            {triggerLabel}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </button>

        {open && (
          <div
            className={cn(
              'absolute left-0 top-full z-50 mt-1 w-full min-w-[14rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-lg',
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
                onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
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

            {showSelectAll && filtered.length > 0 && (
              <div className="flex items-center justify-between border-b px-3 py-1.5 text-xs">
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={selectAllFiltered}
                  className="font-medium text-primary hover:underline"
                >
                  {query ? 'Select all matching' : 'Select all'}
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => onChange([])}
                  disabled={selected.length === 0}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-50"
                >
                  Clear
                </button>
              </div>
            )}

            <div role="listbox" className="max-h-64 overflow-y-auto py-1">
              {filtered.length === 0 ? (
                <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                  {emptyMessage}
                </div>
              ) : (
                filtered.map((o) => {
                  const on = selected.includes(o.id)
                  return (
                    <button
                      key={o.id}
                      type="button"
                      role="option"
                      aria-selected={on}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => toggle(o.id)}
                      className={cn(
                        'flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground',
                        on && 'font-medium',
                      )}
                    >
                      <span className="min-w-0 truncate">{o.name}</span>
                      {on && <Check className="size-4 shrink-0 text-primary" />}
                    </button>
                  )
                })
              )}
            </div>
          </div>
        )}
      </div>

      {selectedChips.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedChips.map((o) => (
            <span
              key={o.id}
              className="inline-flex items-center gap-1 rounded-full border border-primary bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground"
            >
              {o.name}
              <button
                type="button"
                onClick={() => toggle(o.id)}
                className="opacity-80 hover:opacity-100"
                aria-label={`Remove ${o.name}`}
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Searchable single-select over a lookup list — the single-value sibling of
 * {@link SearchableMultiSelect}. The trigger shows the chosen option's name (or
 * the placeholder) and, when `clearable`, an inline ✕ to reset to nothing; the
 * option list lives behind a search popover. Suits long lists (companies,
 * designations, …) where a native `<select>` is hard to scan. Value is the
 * option id, or `null` for "nothing selected".
 */
export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  emptyMessage = 'No results',
  noOptions = 'No options configured yet.',
  clearable = true,
  id,
}: {
  options: Chip[]
  value: number | null
  onChange: (id: number | null) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
  noOptions?: string
  clearable?: boolean
  id?: string
}) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const rootRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter((o) => o.name.toLowerCase().includes(q))
  }, [options, query])

  const selected = React.useMemo(
    () => options.find((o) => o.id === value) ?? null,
    [options, value],
  )

  React.useEffect(() => {
    if (open) {
      setQuery('')
      requestAnimationFrame(() => inputRef.current?.focus())
    } else {
      setQuery('')
    }
  }, [open])

  // Close on outside mousedown.
  React.useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  if (options.length === 0) {
    return <p className="text-xs text-muted-foreground">{noOptions}</p>
  }

  const pick = (optId: number) => {
    onChange(optId)
    setOpen(false)
  }

  const showClear = clearable && !!selected

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-background pl-3 text-sm shadow-xs outline-none transition',
          'focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          'hover:bg-accent/40 hover:text-accent-foreground',
          showClear ? 'pr-14' : 'pr-3',
        )}
      >
        <span
          className={cn('truncate text-left', !selected && 'text-muted-foreground')}
        >
          {selected ? selected.name : placeholder}
        </span>
        <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
      </button>

      {/* Clear sits as a sibling, not a child of the trigger: a <button> may not
          nest another interactive element. */}
      {showClear && (
        <button
          type="button"
          onClick={() => onChange(null)}
          aria-label="Clear selection"
          className="absolute right-8 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      )}

      {open && (
        <div
          className={cn(
            'absolute left-0 top-full z-50 mt-1 w-full min-w-[14rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-lg',
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
              onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
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

          <div role="listbox" className="max-h-64 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                {emptyMessage}
              </div>
            ) : (
              filtered.map((o) => {
                const on = o.id === value
                return (
                  <button
                    key={o.id}
                    type="button"
                    role="option"
                    aria-selected={on}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pick(o.id)}
                    className={cn(
                      'flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground',
                      on && 'font-medium',
                    )}
                  >
                    <span className="min-w-0 truncate">{o.name}</span>
                    {on && <Check className="size-4 shrink-0 text-primary" />}
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/** "Tata Consultancy Services" → "TC"; falls back to "?" for an unusable name. */
export function companyInitials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('') || '?'
  )
}

/**
 * A company's logo, with an initials fallback when it has none. Shared by the
 * company lists and the drives screen so the two never drift apart.
 */
export function CompanyLogo({
  name,
  logoUrl,
  className,
}: {
  name: string
  logoUrl: string | null
  className?: string
}) {
  // A broken/unreachable presigned URL should degrade to the initials box, not
  // leave the browser's broken-image glyph in the row.
  const [failed, setFailed] = React.useState(false)
  React.useEffect(() => setFailed(false), [logoUrl])

  // The image fills a fixed-size, overflow-hidden box with `object-cover` (the
  // same treatment as the company-detail header). Using `object-cover` on a
  // sized wrapper — rather than `object-contain` on the <img> itself — keeps
  // non-square logos (wide wordmarks) filling the box instead of collapsing to
  // an invisible sliver.
  return (
    <div
      className={cn(
        'flex items-center justify-center overflow-hidden rounded-md border bg-muted',
        className ?? 'size-8',
      )}
    >
      {logoUrl && !failed ? (
        <img
          src={logoUrl}
          alt=""
          onError={() => setFailed(true)}
          className="size-full object-cover"
        />
      ) : (
        <span className="text-[10px] font-semibold text-muted-foreground">
          {companyInitials(name)}
        </span>
      )}
    </div>
  )
}

/** Read-only chip row for the detail view. */
export function ChipRow({ items }: { items: Chip[] | { id: number; name: string }[] }) {
  if (!items || items.length === 0) {
    return <span className="text-sm text-muted-foreground">—</span>
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((i) => (
        <Badge key={i.id} variant="muted">
          {i.name}
        </Badge>
      ))}
    </div>
  )
}

export interface TabDef {
  key: string
  label: string
  icon?: React.ComponentType<{ className?: string }>
}

/** Bottom-bordered button-row tab switcher (shared inner tabs). */
export function TabBar({
  tabs,
  active,
  onChange,
}: {
  tabs: TabDef[]
  active: string
  onChange: (key: string) => void
}) {
  return (
    <div className="flex gap-1 overflow-x-auto border-b">
      {tabs.map((t) => {
        const on = t.key === active
        const Icon = t.icon
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => onChange(t.key)}
            className={cn(
              'flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors',
              on
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {Icon ? <Icon className="size-4" /> : null}
            {t.label}
          </button>
        )
      })}
    </div>
  )
}

// --- formatting -----------------------------------------------------------

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/** Like `formatDate` but includes the time — for datetime fields (deadlines). */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function titleCase(s: string): string {
  return s
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export function relationshipVariant(
  status: string,
): 'success' | 'warning' | 'muted' | 'default' {
  switch (status) {
    case 'strategic':
      return 'success'
    case 'active':
      return 'default'
    case 'dormant':
      return 'warning'
    default:
      return 'muted'
  }
}
