import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  ChevronsUpDown,
  Download,
  Info,
  Search,
  X,
} from 'lucide-react'
import * as React from 'react'
import { useId, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { TableHead } from '@/components/ui/table'
import { useDismissOnOutside } from '@/hooks/use-dismiss-on-outside'
import type { AnalyticsBasis } from '@/lib/attendance-analytics'
import { cn } from '@/lib/utils'
import {
  BAND_CLASS,
  RESULT_SCROLL,
  fmtPct,
  type SortDir,
  type SortState,
} from './format'

/** Small presentational pieces every Attendance Analytics tab reuses. Values
 *  and formatters live in `format.ts` so Fast Refresh keeps working here. */

/** A percentage rendered in its band colour. `held === 0` is "no classes yet",
 *  deliberately distinct from 0% — a student with nothing held is unmeasured,
 *  not failing. */
export function PctBadge({
  pct,
  band,
  held,
  className,
}: {
  pct: number
  band: string
  held?: number
  className?: string
}) {
  if (held !== undefined && held <= 0) {
    return (
      <span
        className={cn(
          'inline-flex rounded px-1.5 py-0.5 text-xs tabular-nums text-muted-foreground',
          className,
        )}
      >
        —
      </span>
    )
  }
  return (
    <span
      className={cn(
        'inline-flex rounded px-1.5 py-0.5 text-xs font-medium tabular-nums',
        BAND_CLASS[band] ?? 'bg-muted text-muted-foreground',
        className,
      )}
    >
      {fmtPct(pct)}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Toolbar
//
// One row per tab. Every tab used to hand-roll its own flex row, so they had
// drifted into four control heights, two alignment idioms, and an export button
// that was sometimes disabled-guarded and sometimes not.
//
// The rule the shape encodes: this row holds CONTROLS ONLY. Counts, day
// summaries and basis explanations are answers, not filters — they belong on
// the `SummaryStrip` glued to the result, next to the data they describe.
// ---------------------------------------------------------------------------

/**
 * The single control row.
 *
 * Not `role="toolbar"`: that role promises roving-tabindex arrow navigation,
 * which would take the arrow keys away from the search input inside it.
 */
export function TabToolbar({
  children,
  end,
  className,
}: {
  children?: React.ReactNode
  /** Right-aligned cluster — the export button, normally. */
  end?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex min-h-9 flex-wrap items-center gap-2', className)}>
      {children}
      {end ? (
        <div className="ml-auto flex items-center gap-1.5">{end}</div>
      ) : null}
    </div>
  )
}

export function SearchField({
  value,
  onChange,
  placeholder = 'Search…',
  label = 'Search',
  className,
}: {
  value: string
  onChange: (next: string) => void
  placeholder?: string
  label?: string
  className?: string
}) {
  return (
    <div className={cn('relative w-full sm:w-60', className)}>
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && value) {
            e.stopPropagation()
            onChange('')
          }
        }}
        placeholder={placeholder}
        aria-label={label}
        className="pl-8 pr-8"
      />
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange('')}
          className="absolute right-1.5 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  )
}

export interface SortOption<T extends string> {
  value: T
  label: string
  /** Consecutive options sharing a group are rendered under one heading. */
  group?: string
}

/**
 * The sort control.
 *
 * A menu rather than the cycling button it replaces: cycling hid the available
 * orderings and re-sorted the table under the reader on every step to the one
 * they wanted. Picking the already-active row flips direction, so the whole
 * ordering is reachable from here — the arrow on that row is the indicator,
 * carrying which field AND which way in one mark.
 *
 * Paired with sortable headers over the same state, so the two always agree.
 * The menu still earns its place next to them: it reaches fields that are not
 * columns (an absent streak), and columns that have scrolled off the right edge.
 */
export function SortMenu<T extends string>({
  value,
  dir,
  options,
  onChange,
  className,
}: {
  value: T
  dir: SortDir
  options: ReadonlyArray<SortOption<T>>
  onChange: (next: T) => void
  className?: string
}) {
  const current = options.find((o) => o.value === value)
  const Arrow = dir === 'asc' ? ArrowUp : ArrowDown
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          aria-label={`Sort by ${current?.label ?? 'a column'}`}
          className={cn('h-9 shrink-0 font-normal', className)}
        >
          <ArrowUpDown className="size-4 text-muted-foreground" />
          <span className="hidden text-muted-foreground sm:inline">Sort:</span>
          <span className="font-medium">{current?.label ?? '—'}</span>
          <ChevronDown className="size-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
        {options.map((o, i) => {
          const heading =
            o.group && o.group !== options[i - 1]?.group ? o.group : null
          return (
            <React.Fragment key={o.value}>
              {heading && (
                <>
                  {i > 0 && <DropdownMenuSeparator />}
                  <DropdownMenuLabel className="text-xs text-muted-foreground">
                    {heading}
                  </DropdownMenuLabel>
                </>
              )}
              <DropdownMenuItem
                onSelect={() => onChange(o.value)}
                className="justify-between gap-4"
              >
                <span className="truncate">{o.label}</span>
                {/* `text-foreground` beats the menu's default svg muting, so
                    the one row that carries the answer isn't the dimmest. */}
                {o.value === value && (
                  <Arrow className="size-3.5 text-foreground" />
                )}
              </DropdownMenuItem>
            </React.Fragment>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * The clickable part of a sortable column header.
 *
 * Exported on its own because this screen has two table idioms: the shared
 * `Table` primitives, and the hand-rolled `<table>` grids in the Day-wise tab
 * whose pinned cells carry their own sticky classes. This drops into either.
 */
export function SortLabel<T extends string>({
  field,
  label,
  sort,
  onSort,
  align = 'left',
  className,
}: {
  field: T
  label: React.ReactNode
  sort: SortState<T>
  onSort: (field: T) => void
  /** `right` flips the icon to the label's left, so numbers keep a clean edge. */
  align?: 'left' | 'right'
  className?: string
}) {
  const active = sort.by === field
  const Icon = !active
    ? ChevronsUpDown
    : sort.dir === 'asc'
      ? ArrowUp
      : ArrowDown
  return (
    <button
      type="button"
      onClick={() => onSort(field)}
      className={cn(
        '-mx-1 inline-flex items-center gap-1 rounded px-1 transition-colors hover:text-foreground',
        align === 'right' && 'flex-row-reverse',
        active && 'text-foreground',
        className,
      )}
    >
      {label}
      <Icon className={cn('size-3 shrink-0', !active && 'opacity-40')} />
    </button>
  )
}

/** `SortLabel` in a `TableHead`, for the shared `Table` primitives. */
export function SortHead<T extends string>({
  field,
  label,
  sort,
  onSort,
  align = 'left',
  title,
  className,
}: {
  field: T
  label: React.ReactNode
  sort: SortState<T>
  onSort: (field: T) => void
  align?: 'left' | 'right'
  title?: string
  className?: string
}) {
  return (
    <TableHead
      title={title}
      aria-sort={
        sort.by === field
          ? sort.dir === 'asc'
            ? 'ascending'
            : 'descending'
          : 'none'
      }
      className={cn(align === 'right' && 'text-right', className)}
    >
      <SortLabel
        field={field}
        label={label}
        sort={sort}
        onSort={onSort}
        align={align}
      />
    </TableHead>
  )
}

export function ExportButton({
  onClick,
  disabled,
  label = 'Download CSV',
  className,
}: {
  onClick: () => void
  disabled?: boolean
  label?: string
  className?: string
}) {
  return (
    <Button
      size="sm"
      variant="outline"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={cn('h-9 shrink-0', className)}
    >
      <Download className="size-4" />
      {/* Wide screens keep a text hint; tablets get the width back. */}
      <span className="hidden 2xl:inline">CSV</span>
    </Button>
  )
}

/**
 * A short label that carries a long explanation.
 *
 * Click-to-open rather than a hover tooltip: the explanations here are
 * operationally important ("these figures exclude OD adjustments", "N past
 * classes were never marked"), and a hover-only affordance is unreachable on
 * the tablets this screen is used on. `title` still gives pointer users the
 * text without a click.
 */
export function NoteChip({
  tone = 'muted',
  icon: Icon,
  children,
  detail,
  className,
}: {
  tone?: 'muted' | 'amber' | 'rose'
  icon?: React.ComponentType<{ className?: string }>
  children: React.ReactNode
  /** Full sentence. With it the chip becomes a disclosure button. */
  detail?: React.ReactNode
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const rootRef = useDismissOnOutside<HTMLSpanElement>(open, () =>
    setOpen(false),
  )

  const toneClass =
    tone === 'amber'
      ? 'border-icon-amber/40 bg-icon-amber/10 text-icon-amber'
      : tone === 'rose'
        ? 'border-icon-rose/40 bg-icon-rose/10 text-icon-rose'
        : 'bg-muted text-muted-foreground'

  const body = (
    <>
      {Icon ? <Icon className="size-3.5 shrink-0" /> : null}
      {children}
    </>
  )

  const shell = cn(
    'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
    toneClass,
    className,
  )

  if (!detail) return <span className={shell}>{body}</span>

  const text = typeof detail === 'string' ? detail : undefined
  return (
    <span ref={rootRef} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        title={text}
        className={cn(shell, 'transition-colors hover:brightness-95')}
      >
        {body}
        <Info className="size-3 opacity-70" />
      </button>
      {open && (
        <span
          id={panelId}
          role="note"
          className="absolute left-0 top-full z-50 mt-1.5 w-max max-w-xs rounded-md border bg-popover p-3 text-xs font-normal leading-relaxed text-popover-foreground shadow-md"
        >
          {detail}
        </span>
      )}
    </span>
  )
}

/**
 * Shown whenever a custom date range is active, because the figures then come
 * from a live session scan and exclude OD / medical adjustments.
 */
export function BasisChip({
  basis,
  className,
}: {
  basis: AnalyticsBasis
  className?: string
}) {
  if (basis === 'rollup') return null
  return (
    <NoteChip
      tone="amber"
      icon={Info}
      className={className}
      detail="Showing classes in the selected dates only. OD and medical adjustments apply to the whole semester and are excluded here — clear the date range for the official figures."
    >
      Selected dates only
    </NoteChip>
  )
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

/** The readout line above a result. Holds the numbers the toolbar used to. */
export function SummaryStrip({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-x-3 gap-y-1 border-b bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function StripStat({
  label,
  value,
  tone = 'default',
  className,
}: {
  label?: string
  value: React.ReactNode
  tone?: 'default' | 'amber' | 'rose' | 'emerald'
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 tabular-nums',
        tone === 'amber' && 'text-icon-amber',
        tone === 'rose' && 'text-icon-rose',
        tone === 'emerald' && 'text-icon-emerald',
        className,
      )}
    >
      {label ? <span className="text-muted-foreground">{label}</span> : null}
      {value}
    </span>
  )
}

/**
 * A result surface: optional readout strip, the content, optional footnote.
 *
 * `isolate` is load-bearing. `Table`'s wrapper is `relative` with `z-index:
 * auto`, so it creates no stacking context and the sticky `thead` (`z-10`) and
 * pinned corner cell (`z-20`) inside it compete in the ROOT stacking context —
 * against the page's own sticky header. Isolating the card traps those levels
 * so no table internal can ever paint over the page chrome or a popover.
 */
export function ResultCard({
  summary,
  footnote,
  scroll = true,
  scrollClassName,
  className,
  children,
}: {
  summary?: React.ReactNode
  footnote?: React.ReactNode
  /** Pass false when the child is a `<Table containerClassName={RESULT_SCROLL}>`
   *  that already owns its scroll box — otherwise you nest two scrollers. */
  scroll?: boolean
  scrollClassName?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <Card className={cn('relative isolate overflow-hidden p-0', className)}>
      {summary ? <SummaryStrip>{summary}</SummaryStrip> : null}
      {scroll ? (
        <div className={cn(RESULT_SCROLL, scrollClassName)}>{children}</div>
      ) : (
        children
      )}
      {footnote ? (
        <p className="border-t px-3 py-2 text-xs text-muted-foreground">
          {footnote}
        </p>
      ) : null}
    </Card>
  )
}

export function EmptyNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
      {children}
    </p>
  )
}

// ---------------------------------------------------------------------------
// Loading
//
// The repo's convention is the shared `.shimmer` sweep over a `bg-muted/60`
// block, shaped like the content it stands in for — "so the wait reads as
// 'holidays loading' rather than as featureless blocks". These tabs were the
// one place still using a flat `animate-pulse` grey rectangle for a KPI row, a
// 960-row roster and a period grid alike.
//
// Row counts are fixed rather than derived from the previous payload: a
// skeleton sized from stale data tells the reader something untrue.
// ---------------------------------------------------------------------------

const BAR = 'shimmer rounded bg-muted/60'

/** Deterministic pseudo-random width, so rows look like text without
 *  re-shuffling on every render (which reads as flicker, not loading). */
function widthOf(i: number, from = 40, to = 85): string {
  const n = (Math.sin(i * 12.9898) * 43758.5453) % 1
  return `${Math.round(from + Math.abs(n) * (to - from))}%`
}

/** Overview: four KPI tiles over a chart card. */
export function KpiSkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-2">
              <div className={cn(BAR, 'size-8 rounded-lg')} />
              <div className={cn(BAR, 'h-3 w-24')} />
            </div>
            <div className={cn(BAR, 'mt-3 h-7 w-20')} />
            <div className={cn(BAR, 'mt-2 h-3 w-32')} />
          </div>
        ))}
      </div>
      <ChartSkeleton />
    </div>
  )
}

function ChartSkeleton({ height = 260 }: { height?: number }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className={cn(BAR, 'h-3.5 w-40')} />
      <div className={cn(BAR, 'mt-2 h-3 w-56')} />
      <div
        className="mt-4 flex items-end gap-2"
        style={{ height }}
      >
        {Array.from({ length: 14 }, (_, i) => (
          <div
            key={i}
            className={cn(BAR, 'flex-1')}
            style={{ height: widthOf(i, 30, 100) }}
          />
        ))}
      </div>
    </div>
  )
}

/**
 * Students / Defaulters / Classes — a header row over striped rows, first
 * column wide (roll no + name) and the rest short and right-aligned.
 */
export function TableSkeleton({
  cols = 5,
  rows = 10,
}: {
  cols?: number
  rows?: number
}) {
  return (
    <div
      className="overflow-hidden rounded-xl border bg-card"
      aria-hidden
    >
      <div className="flex items-center gap-3 border-b bg-muted/30 px-3 py-2">
        <div className={cn(BAR, 'h-3 w-28')} />
        <div className={cn(BAR, 'ml-auto h-3 w-16')} />
      </div>
      <div className="divide-y">
        {Array.from({ length: rows }, (_, r) => (
          <div key={r} className="flex items-center gap-3 px-3 py-2.5">
            <div className={cn(BAR, 'h-3 w-20 shrink-0')} />
            <div
              className={cn(BAR, 'h-3')}
              style={{ width: widthOf(r) , maxWidth: '14rem' }}
            />
            <div className="ml-auto flex items-center gap-3">
              {Array.from({ length: Math.max(1, cols - 2) }, (_, c) => (
                <div key={c} className={cn(BAR, 'h-4 w-12')} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Day-wise: a pinned student column plus a row of per-period status pills. */
export function GridSkeleton({
  periods = 7,
  rows = 10,
}: {
  periods?: number
  rows?: number
}) {
  return (
    <div
      className="overflow-hidden rounded-xl border bg-card"
      aria-hidden
    >
      <div className="flex items-center gap-3 border-b bg-muted/30 px-3 py-2">
        <div className={cn(BAR, 'h-3 w-24')} />
        <div className="ml-auto flex gap-3">
          {Array.from({ length: periods }, (_, i) => (
            <div key={i} className={cn(BAR, 'h-3 w-10')} />
          ))}
        </div>
      </div>
      <div className="divide-y">
        {Array.from({ length: rows }, (_, r) => (
          <div key={r} className="flex items-center gap-3 px-3 py-2">
            <div className={cn(BAR, 'h-3 w-20 shrink-0')} />
            <div
              className={cn(BAR, 'h-3')}
              style={{ width: widthOf(r, 30, 60), maxWidth: '10rem' }}
            />
            <div className="ml-auto flex gap-3">
              {Array.from({ length: periods }, (_, c) => (
                <div key={c} className={cn(BAR, 'h-5 w-10')} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Subjects: the horizontal bar chart over collapsed subject cards. */
export function SubjectsSkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      <div className="rounded-xl border bg-card p-4">
        <div className={cn(BAR, 'h-3.5 w-44')} />
        <div className="mt-4 space-y-2.5">
          {Array.from({ length: 7 }, (_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className={cn(BAR, 'h-3 w-20 shrink-0')} />
              <div className={cn(BAR, 'h-4')} style={{ width: widthOf(i) }} />
            </div>
          ))}
        </div>
      </div>
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="rounded-xl border bg-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-2">
              <div className={cn(BAR, 'h-3.5 w-1/2')} />
              <div className={cn(BAR, 'h-3 w-1/3')} />
            </div>
            <div className={cn(BAR, 'h-5 w-14')} />
          </div>
          <div className={cn(BAR, 'mt-3 h-3 w-40')} />
        </div>
      ))}
    </div>
  )
}

/** The student sheet: three stat tiles over the per-subject and session lists. */
export function DetailSkeleton() {
  return (
    <div className="space-y-5" aria-hidden>
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="rounded-lg border p-3">
            <div className={cn(BAR, 'h-3 w-16')} />
            <div className={cn(BAR, 'mt-2 h-5 w-12')} />
          </div>
        ))}
      </div>
      <div className="space-y-2">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div
              className={cn(BAR, 'h-3.5')}
              style={{ width: widthOf(i, 30, 55) }}
            />
            <div className={cn(BAR, 'ml-auto h-4 w-12')} />
          </div>
        ))}
      </div>
    </div>
  )
}
