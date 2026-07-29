import * as React from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronsUpDown, Loader2, Search, X } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { CalendarPanel } from '@/components/ui/date-picker'
import { Textarea, formatDate } from '@/components/corporate-relations/bits'
import { cn } from '@/lib/utils'
import type { Chip, CrViewContact } from '@/lib/corporate-relations'

/**
 * Edit-in-place cells for the CR View table.
 *
 * The whole cell is the trigger and there are no save buttons: a single-select
 * commits the moment you pick, a multi-select commits once when its popover
 * closes. That is the point of the screen — walking down a list nudging
 * statuses — and it is only safe because the endpoint behind it is a true PATCH
 * (an absent key is left alone), so one cell can never overwrite the other.
 *
 * The panels are portalled and fixed-positioned rather than absolutely
 * positioned children, for the same reason the student-search hover card is:
 * the table lives in a bounded `overflow-y-auto` scroll box that would clip an
 * in-flow popover at the row it opened from.
 */

const VIEWPORT_PADDING = 8
const GAP = 4
const PANEL_MAX_HEIGHT = 288
const PANEL_MIN_WIDTH = 224

interface PanelPos {
  top?: number
  bottom?: number
  left: number
  minWidth: number
  maxHeight: number
}

/** Viewport-clamped fixed coordinates, anchored to the edge nearest the cell. */
function panelPosition(
  rect: DOMRect,
  maxHeight: number = PANEL_MAX_HEIGHT,
): PanelPos {
  const vw = window.innerWidth
  const vh = window.innerHeight

  const spaceBelow = vh - rect.bottom - VIEWPORT_PADDING
  const spaceAbove = rect.top - VIEWPORT_PADDING
  const below = spaceBelow >= maxHeight || spaceBelow >= spaceAbove

  // Left-aligned on the cell, then pulled back inside the right edge.
  const minWidth = Math.max(rect.width, PANEL_MIN_WIDTH)
  const left = Math.min(
    Math.max(VIEWPORT_PADDING, rect.left),
    Math.max(VIEWPORT_PADDING, vw - minWidth - VIEWPORT_PADDING),
  )

  // Pinned by the edge nearest the trigger, never by a predicted height, so a
  // panel opening upward stays glued to its row whatever it ends up holding.
  return below
    ? {
        top: rect.bottom + GAP,
        left,
        minWidth,
        maxHeight: Math.min(maxHeight, spaceBelow - GAP),
      }
    : {
        bottom: vh - rect.top + GAP,
        left,
        minWidth,
        maxHeight: Math.min(maxHeight, spaceAbove - GAP),
      }
}

/**
 * The panel. Its position is measured by the caller when the cell is clicked
 * rather than here on mount: an event handler may touch the DOM, and there is
 * nothing to re-measure afterwards because the panel closes on any scroll or
 * resize instead of chasing its anchor.
 */
function CellPopover({
  anchor,
  pos,
  onClose,
  onCancel,
  children,
}: {
  anchor: React.RefObject<HTMLButtonElement | null>
  pos: PanelPos
  onClose: () => void
  /**
   * When set, Escape calls THIS instead of `onClose`. The chips cell treats
   * every close as a commit; the text cell must not save a half-typed sentence
   * on Escape, so it discards there instead.
   */
  onCancel?: () => void
  children: React.ReactNode
}) {
  const panelRef = React.useRef<HTMLDivElement>(null)

  // Held in refs so the listeners bind once: `onClose` commits, and a stale
  // closure would commit a stale draft.
  const closeRef = React.useRef(onClose)
  const cancelRef = React.useRef(onCancel)
  React.useLayoutEffect(() => {
    closeRef.current = onClose
    cancelRef.current = onCancel
  })

  React.useEffect(() => {
    function onDown(e: MouseEvent) {
      const t = e.target as Node
      if (panelRef.current?.contains(t) || anchor.current?.contains(t)) return
      closeRef.current()
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') (cancelRef.current ?? closeRef.current)()
    }
    // A fixed panel does not travel with the table's own scroll box, so it is
    // closed rather than chased. Capture-phase — scroll does not bubble.
    function onScroll(e: Event) {
      if (panelRef.current?.contains(e.target as Node)) return
      closeRef.current()
    }
    const onResize = () => closeRef.current()

    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onResize)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onResize)
    }
  }, [anchor])

  return createPortal(
    <div
      ref={panelRef}
      style={pos}
      className={cn(
        'fixed z-50 flex flex-col overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-lg',
        'animate-in fade-in-0 zoom-in-95 duration-150',
      )}
    >
      {children}
    </div>,
    document.body,
  )
}

/** The search row shared by both panels. */
function PanelSearch({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
}) {
  const ref = React.useRef<HTMLInputElement>(null)
  React.useEffect(() => {
    requestAnimationFrame(() => ref.current?.focus())
  }, [])
  return (
    <div className="flex shrink-0 items-center gap-2 border-b px-3 py-2">
      <Search className="size-3.5 shrink-0 text-muted-foreground" />
      <input
        ref={ref}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-7 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
      {value && (
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            onChange('')
            ref.current?.focus()
          }}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Clear search"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  )
}

/** The user-chosen table density — compact caps every cell to one row. */
export type CellDensity = 'compact' | 'expanded'

/** The cell chrome: hover affordance, chevron, and the in-flight spinner. */
function CellTrigger({
  triggerRef,
  onClick,
  saving,
  label,
  wrap = false,
  outlined = false,
  children,
}: {
  triggerRef: React.RefObject<HTMLButtonElement | null>
  onClick: () => void
  saving: boolean
  label: string
  /** Expanded density lets the content wrap; compact stays one row. */
  wrap?: boolean
  /**
   * Draw the input-style border. Used when the cell is EMPTY: a filled cell's
   * chips are their own affordance, but a bare "Select…" with no border reads
   * as dead text rather than a dropdown.
   */
  outlined?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      ref={triggerRef}
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        'group -mx-1.5 flex w-full items-center justify-between gap-1.5 rounded px-1.5 py-1 text-left transition-colors',
        'hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        outlined && 'rounded-md border border-input bg-background shadow-xs',
        saving && 'pointer-events-none opacity-60',
      )}
    >
      {/* Compact: flex-nowrap + overflow-hidden caps the cell to ONE row — the
          multi-selects summarise as "First +N" and everything else is already
          single-line, so wrapping would only make row heights uneven. */}
      <span
        className={cn(
          'flex min-w-0 items-center gap-1.5',
          wrap ? 'flex-wrap' : 'flex-nowrap overflow-hidden',
        )}
      >
        {children}
      </span>
      {saving ? (
        <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
      ) : (
        <ChevronsUpDown
          className={cn(
            'size-3.5 shrink-0 transition-opacity',
            outlined ? 'opacity-60' : 'opacity-30 group-hover:opacity-70',
          )}
        />
      )}
    </button>
  )
}

/**
 * The pickers only carry ACTIVE lookups, so a value saved before someone
 * deactivated it would silently vanish from its own editor — and then vanish
 * from the record on the next save. Folding what the record already holds back
 * into the list keeps it visible and re-savable, which is exactly what the
 * server allows (`assertSelectable` accepts an inactive value a record has).
 */
function withSaved(options: Chip[], saved: Chip[]): Chip[] {
  const known = new Set(options.map((o) => o.id))
  const missing = saved.filter((s) => !known.has(s.id))
  return missing.length === 0 ? options : [...options, ...missing]
}

/** Order-insensitive — the option list order is not the record's order. */
function sameIds(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false
  const set = new Set(a)
  return b.every((id) => set.has(id))
}

/** Read-only chips that wrap — for surfaces where height is not at a premium. */
export function ChipList({ items }: { items: Chip[] }) {
  if (items.length === 0) {
    return <span className="text-sm text-muted-foreground">—</span>
  }
  return (
    <>
      {items.map((i) => (
        <Badge key={i.id} variant="muted">
          {i.name}
        </Badge>
      ))}
    </>
  )
}

/**
 * The single-row summary of a multi-value field: the first value plus a "+N"
 * badge for the rest, with the full list in the native tooltip. This is what
 * keeps every table row one line tall — the complete selection is only ever
 * laid out inside the cell's editor.
 */
export function CompactChips({ items }: { items: Chip[] }) {
  if (items.length === 0) {
    return <span className="text-sm text-muted-foreground">—</span>
  }
  return (
    <span
      className="flex min-w-0 items-center gap-1.5 whitespace-nowrap"
      title={items.map((i) => i.name).join(', ')}
    >
      <Badge variant="muted" className="min-w-0 max-w-40 shrink">
        <span className="truncate">{items[0].name}</span>
      </Badge>
      {items.length > 1 && <Badge variant="muted">+{items.length - 1}</Badge>}
    </span>
  )
}

/**
 * A multi-select that edits in place: ticks accumulate in a draft and exactly
 * one PATCH fires when the panel closes — and only if something actually
 * changed. Firing per tick would mean four requests to record four
 * relationship types, each racing the last.
 */
export function InlineChipsCell({
  options,
  selected,
  saving,
  onCommit,
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  label,
  density = 'compact',
}: {
  options: Chip[]
  selected: Chip[]
  saving: boolean
  onCommit: (ids: number[]) => void
  placeholder?: string
  searchPlaceholder?: string
  label: string
  density?: CellDensity
}) {
  const triggerRef = React.useRef<HTMLButtonElement>(null)
  /** Doubles as the open flag — measured once, at the click that opened it. */
  const [panel, setPanel] = React.useState<PanelPos | null>(null)
  const [query, setQuery] = React.useState('')
  /** Non-null from the moment the panel opens until the save it caused settles. */
  const [draft, setDraft] = React.useState<number[] | null>(null)

  const selectedIds = React.useMemo(() => selected.map((s) => s.id), [selected])
  const all = React.useMemo(() => withSaved(options, selected), [options, selected])

  // Drop the draft once the row's save has settled: success lands on the
  // server's own value, failure snaps back to the old one — no rollback state.
  const wasSaving = React.useRef(saving)
  React.useEffect(() => {
    if (wasSaving.current && !saving) setDraft(null)
    wasSaving.current = saving
  }, [saving])

  const shown = React.useMemo(() => {
    if (draft === null) return selected
    const byId = new Map(all.map((o) => [o.id, o]))
    return draft.map((id) => byId.get(id)).filter((o): o is Chip => !!o)
  }, [draft, selected, all])

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? all.filter((o) => o.name.toLowerCase().includes(q)) : all
  }, [all, query])

  function close() {
    setPanel(null)
    setQuery('')
    if (draft === null) return
    if (sameIds(draft, selectedIds)) {
      setDraft(null)
      return
    }
    onCommit(draft)
  }

  function openPanel() {
    if (!triggerRef.current) return
    setDraft(selectedIds)
    setQuery('')
    setPanel(panelPosition(triggerRef.current.getBoundingClientRect()))
  }

  if (options.length === 0) {
    return density === 'expanded' ? (
      <span className="flex flex-wrap items-center gap-1.5">
        <ChipList items={selected} />
      </span>
    ) : (
      <CompactChips items={selected} />
    )
  }

  const current = draft ?? selectedIds
  const add = (id: number) => setDraft([...current, id])
  const remove = (id: number) => setDraft(current.filter((x) => x !== id))

  // The list offers only what is NOT yet selected — the selection itself sits
  // above it as removable pills, so a checked-list would say everything twice.
  const available = filtered.filter((o) => !current.includes(o.id))

  return (
    <>
      <CellTrigger
        triggerRef={triggerRef}
        onClick={() => (panel ? close() : openPanel())}
        saving={saving}
        label={label}
        wrap={density === 'expanded'}
        outlined={shown.length === 0}
      >
        {shown.length === 0 ? (
          <span className="text-sm text-muted-foreground">{placeholder}</span>
        ) : density === 'expanded' ? (
          <ChipList items={shown} />
        ) : (
          <CompactChips items={shown} />
        )}
      </CellTrigger>

      {panel && (
        <CellPopover anchor={triggerRef} pos={panel} onClose={close}>
          <PanelSearch
            value={query}
            onChange={setQuery}
            placeholder={searchPlaceholder}
          />
          {shown.length > 0 && (
            <div className="flex max-h-24 shrink-0 flex-wrap gap-1.5 overflow-y-auto border-b px-3 py-2">
              {shown.map((o) => (
                <span
                  key={o.id}
                  className="inline-flex items-center gap-1 rounded-full border border-primary bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground"
                >
                  {o.name}
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => remove(o.id)}
                    className="opacity-80 hover:opacity-100"
                    aria-label={`Remove ${o.name}`}
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="flex shrink-0 items-center justify-between border-b px-3 py-1.5 text-xs">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              // Unions the matches in, so searching then "Select all" never
              // drops a selection sitting outside the filter.
              onClick={() =>
                setDraft(
                  Array.from(new Set([...current, ...filtered.map((o) => o.id)])),
                )
              }
              disabled={available.length === 0}
              className="font-medium text-primary hover:underline disabled:opacity-50 disabled:no-underline"
            >
              {query ? 'Select all matching' : 'Select all'}
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setDraft([])}
              disabled={current.length === 0}
              className="text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              Clear
            </button>
          </div>
          <div role="listbox" className="flex-1 overflow-y-auto py-1">
            {available.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                {filtered.length === 0 ? 'No results' : 'Everything is selected'}
              </div>
            ) : (
              available.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  role="option"
                  aria-selected={false}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => add(o.id)}
                  className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                >
                  <span className="min-w-0 truncate">{o.name}</span>
                </button>
              ))
            )}
          </div>
        </CellPopover>
      )}
    </>
  )
}

/**
 * What the row recorded, or the master default in muted type when it recorded
 * nothing — both when there is no record at all and when the status was
 * explicitly cleared. The default is never stored, so this is the only place it
 * is ever seen.
 */
export function StatusValue({
  status,
  fallback,
}: {
  status: Chip | null
  fallback: Chip | null
}) {
  if (status) return <Badge variant="secondary">{status.name}</Badge>
  if (!fallback) return <span className="text-sm text-muted-foreground">—</span>
  return (
    <span
      className="text-sm italic text-muted-foreground"
      title="Default — nothing recorded for this year yet"
    >
      {fallback.name}
    </span>
  )
}

/**
 * A single-select that edits in place. Picking commits at once — there is no
 * second field to coordinate with, so a confirm step would be a click for
 * nothing. `null` is a real value here: it clears the status back to the
 * master default, which is never itself written to the record.
 */
export function InlineStatusCell({
  options,
  value,
  fallback,
  saving,
  onCommit,
  searchPlaceholder = 'Search…',
  label,
}: {
  options: Chip[]
  value: Chip | null
  fallback: Chip | null
  saving: boolean
  onCommit: (id: number | null) => void
  searchPlaceholder?: string
  label: string
}) {
  const triggerRef = React.useRef<HTMLButtonElement>(null)
  /** Doubles as the open flag — measured once, at the click that opened it. */
  const [panel, setPanel] = React.useState<PanelPos | null>(null)
  const [query, setQuery] = React.useState('')
  /** Wrapped, because a pending `null` and "nothing pending" are different. */
  const [pending, setPending] = React.useState<{ id: number | null } | null>(null)

  const all = React.useMemo(
    () => withSaved(options, value ? [value] : []),
    [options, value],
  )

  const wasSaving = React.useRef(saving)
  React.useEffect(() => {
    if (wasSaving.current && !saving) setPending(null)
    wasSaving.current = saving
  }, [saving])

  const shown =
    pending === null
      ? value
      : (all.find((o) => o.id === pending.id) ?? null)

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? all.filter((o) => o.name.toLowerCase().includes(q)) : all
  }, [all, query])

  function close() {
    setPanel(null)
    setQuery('')
  }

  function openPanel() {
    if (!triggerRef.current) return
    setQuery('')
    setPanel(panelPosition(triggerRef.current.getBoundingClientRect()))
  }

  function pick(id: number | null) {
    close()
    if (id === (shown?.id ?? null)) return
    setPending({ id })
    onCommit(id)
  }

  if (options.length === 0) {
    return <StatusValue status={value} fallback={fallback} />
  }

  const currentId = shown?.id ?? null
  const showReset = fallback !== null || currentId !== null

  return (
    <>
      <CellTrigger
        triggerRef={triggerRef}
        onClick={() => (panel ? close() : openPanel())}
        saving={saving}
        label={label}
        // The italic default (or a chosen badge) is its own affordance; only a
        // bare em-dash needs the border to read as a dropdown.
        outlined={!shown && !fallback}
      >
        <StatusValue status={shown} fallback={fallback} />
      </CellTrigger>

      {panel && (
        <CellPopover anchor={triggerRef} pos={panel} onClose={close}>
          <PanelSearch
            value={query}
            onChange={setQuery}
            placeholder={searchPlaceholder}
          />
          {showReset && !query && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(null)}
              className="shrink-0 border-b px-3 py-1.5 text-left text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            >
              {fallback ? `Use default — ${fallback.name}` : 'Clear'}
            </button>
          )}
          <div role="listbox" className="flex-1 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                No results
              </div>
            ) : (
              filtered.map((o) => {
                const on = o.id === currentId
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
        </CellPopover>
      )}
    </>
  )
}

/**
 * Free text that edits in place. Closing the panel by clicking away (or
 * pressing Enter) commits — but ESCAPE DISCARDS, deliberately unlike the chips
 * cell where every close commits: a half-typed sentence is not something to
 * save by accident, while a half-ticked checklist is still a valid selection.
 * Shift+Enter inserts a newline.
 */
export function InlineTextCell({
  value,
  saving,
  onCommit,
  placeholder = 'Add…',
  label,
  density = 'compact',
}: {
  value: string | null
  saving: boolean
  onCommit: (v: string | null) => void
  placeholder?: string
  label: string
  density?: CellDensity
}) {
  const triggerRef = React.useRef<HTMLButtonElement>(null)
  /** Doubles as the open flag — measured once, at the click that opened it. */
  const [panel, setPanel] = React.useState<PanelPos | null>(null)
  const [draft, setDraft] = React.useState('')
  /** Wrapped, because a pending `null` and "nothing pending" are different. */
  const [pending, setPending] = React.useState<{ v: string | null } | null>(
    null,
  )

  const wasSaving = React.useRef(saving)
  React.useEffect(() => {
    if (wasSaving.current && !saving) setPending(null)
    wasSaving.current = saving
  }, [saving])

  const shown = pending === null ? value : pending.v

  function commitClose() {
    setPanel(null)
    const next = draft.trim() || null
    if (next === (shown ?? null)) return
    setPending({ v: next })
    onCommit(next)
  }

  function cancel() {
    setPanel(null)
  }

  function openPanel() {
    if (!triggerRef.current) return
    setDraft(shown ?? '')
    setPanel(panelPosition(triggerRef.current.getBoundingClientRect()))
  }

  return (
    <>
      <CellTrigger
        triggerRef={triggerRef}
        onClick={() => (panel ? commitClose() : openPanel())}
        saving={saving}
        label={label}
        outlined={!shown}
      >
        {shown ? (
          <span
            className={cn(
              'whitespace-pre-wrap text-sm',
              density === 'compact' && 'line-clamp-2',
            )}
          >
            {shown}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">{placeholder}</span>
        )}
      </CellTrigger>

      {panel && (
        <CellPopover
          anchor={triggerRef}
          pos={panel}
          onClose={commitClose}
          onCancel={cancel}
        >
          <div className="p-2">
            <Textarea
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  commitClose()
                }
              }}
              placeholder={placeholder}
              className="min-h-24 border-0 shadow-none focus-visible:ring-0"
            />
            <p className="px-1 pt-1 text-[11px] text-muted-foreground">
              Enter saves · Shift+Enter for a new line · Esc discards
            </p>
          </div>
        </CellPopover>
      )}
    </>
  )
}

/** The calendar footprint: p-3 + switcher + weekday row + 6-row grid + footer. */
const DATE_PANEL_MAX_HEIGHT = 336

/**
 * A date that edits in place through the app's own calendar popover. The
 * native `<input type="date">` is deliberately NOT used here: its popup is
 * browser chrome the page cannot manage, and Chromium dismisses it whenever
 * focus or layout shifts around the input — which in this table made month
 * navigation close the picker. Picking a date commits at once; Clear commits
 * back to `null`.
 */
export function InlineDateCell({
  value,
  saving,
  onCommit,
  label,
}: {
  /** 'YYYY-MM-DD' or `null`. */
  value: string | null
  saving: boolean
  onCommit: (v: string | null) => void
  label: string
}) {
  const triggerRef = React.useRef<HTMLButtonElement>(null)
  /** Doubles as the open flag — measured once, at the click that opened it. */
  const [panel, setPanel] = React.useState<PanelPos | null>(null)
  /** Wrapped, because a pending `null` and "nothing pending" are different. */
  const [pending, setPending] = React.useState<{ v: string | null } | null>(
    null,
  )

  const wasSaving = React.useRef(saving)
  React.useEffect(() => {
    if (wasSaving.current && !saving) setPending(null)
    wasSaving.current = saving
  }, [saving])

  const shown = pending === null ? value : pending.v

  function commit(next: string | null) {
    setPanel(null)
    if (next === (shown ?? null)) return
    setPending({ v: next })
    onCommit(next)
  }

  function openPanel() {
    if (!triggerRef.current) return
    setPanel(
      panelPosition(
        triggerRef.current.getBoundingClientRect(),
        DATE_PANEL_MAX_HEIGHT,
      ),
    )
  }

  return (
    <>
      <CellTrigger
        triggerRef={triggerRef}
        onClick={() => (panel ? setPanel(null) : openPanel())}
        saving={saving}
        label={label}
        outlined={!shown}
      >
        {shown ? (
          <span className="whitespace-nowrap text-sm tabular-nums">
            {formatDate(shown)}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">Pick date…</span>
        )}
      </CellTrigger>

      {panel && (
        <CellPopover anchor={triggerRef} pos={panel} onClose={() => setPanel(null)}>
          <div className="overflow-y-auto">
            <CalendarPanel
              value={shown}
              onPick={(iso) => commit(iso)}
              onClear={shown ? () => commit(null) : undefined}
            />
          </div>
        </CellPopover>
      )}
    </>
  )
}

/**
 * The Contact column's cell — a summary trigger only. A repeatable five-field
 * group cannot edit inside a table cell, so clicking hands off to the contacts
 * dialog the page owns; this renders the first contact's name and how many
 * more there are.
 */
export function ContactCell({
  contacts,
  saving,
  onOpen,
  label,
  density = 'compact',
}: {
  contacts: CrViewContact[]
  saving: boolean
  onOpen: () => void
  label: string
  density?: CellDensity
}) {
  const triggerRef = React.useRef<HTMLButtonElement>(null)
  return (
    <CellTrigger
      triggerRef={triggerRef}
      onClick={onOpen}
      saving={saving}
      label={label}
      wrap={density === 'expanded'}
      outlined={contacts.length === 0}
    >
      {contacts.length === 0 ? (
        <span className="text-sm text-muted-foreground">Add contact</span>
      ) : density === 'expanded' ? (
        contacts.map((c) => (
          <Badge key={c.id} variant="muted">
            {c.hr_name}
          </Badge>
        ))
      ) : (
        <>
          <span className="truncate text-sm">{contacts[0].hr_name}</span>
          {contacts.length > 1 && (
            <Badge variant="muted">+{contacts.length - 1}</Badge>
          )}
        </>
      )}
    </CellTrigger>
  )
}
