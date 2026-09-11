import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronRight,
  Info,
  Lock,
  Maximize2,
  Minus,
  SlidersHorizontal,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useContext, useEffect, useState, type ReactNode } from 'react'
import { ResponsiveContainer } from 'recharts'

import { readStored, writeStored } from '@/components/employee/attendance-analytics/format'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { PageHeader } from '@/components/ui/page-header'
import { EMPTY_SELECTION } from '@/lib/insights'
import { cn } from '@/lib/utils'
import { go, nf } from './insights-utils'
import { PanelSizeContext } from './panel-size-context'
import { AppliedScopeChips, ScopeBar } from './scope-bar'
import type { InsightsScopeState } from './use-insights-scope'
import { ViewsMenu } from './views-menu'

// --- header -------------------------------------------------------------------

const LS_FILTERS_OPEN = 'nucleus.insights.filtersExpanded'
/** Scrolling the page this far past the top folds an open filter bar away. */
const COLLAPSE_SCROLL_PX = 120

/**
 * The pinned header every insights page shares, kept to two lines by default:
 *
 *   1. title · tabs · Views — the shared PageHeader row. The tabs box takes
 *      only the width the title and Views leave and scrolls inside it, and
 *      drops to its own row below `lg`, so the three can never overlap.
 *   2. the filter line — a Filters button wearing the applied count, a muted
 *      readout of the scope size ("5 depts · 13 batches · 1,180 students")
 *      plus what is applied, and Clear all
 *
 * Opening Filters reveals the full bar (facets + the screen's own controls)
 * and the applied chips under that line; Done folds it away, and so does
 * scrolling the page down, so a reader who opened it and moved on gets the
 * space back. The open state is remembered per browser.
 *
 * Same sticky offsets as the attendance analytics page — `main` is the scroll
 * container with its own padding, so a plain `top-0` would leave a band above
 * the header for rows to scroll through.
 */
export function InsightsHeader({
  title,
  scope,
  screenKey,
  route,
  tabs,
  controls,
  summary,
  activeExtras = 0,
  hideScope = false,
}: {
  title: string
  scope: InsightsScopeState
  screenKey: string
  route: string
  tabs?: ReactNode
  controls?: ReactNode
  /** Readout of the screen's own filters, e.g. `Sem 3 · 12 Aug – 11 Sep`. */
  summary?: string
  /** How many of the screen's own filters are off their default. */
  activeExtras?: number
  /** Compare mode brings its own pickers; the scope bar stays out of the way. */
  hideScope?: boolean
}) {
  const [open, setOpen] = useState(() => readStored(LS_FILTERS_OPEN) === '1')
  const setOpenPersist = (v: boolean) => {
    setOpen(v)
    writeStored(LS_FILTERS_OPEN, v ? '1' : '0')
  }

  // Fold away on scroll — the reader has moved on to the content.
  useEffect(() => {
    if (!open) return
    const main = document.querySelector('main')
    if (!main) return
    const onScroll = () => {
      if (main.scrollTop > COLLAPSE_SCROLL_PX) {
        setOpen(false)
        writeStored(LS_FILTERS_OPEN, '0')
      }
    }
    main.addEventListener('scroll', onScroll, { passive: true })
    return () => main.removeEventListener('scroll', onScroll)
  }, [open])

  const { sel, setSel, tree } = scope
  const facetCount = hideScope
    ? 0
    : (sel.department_ids.length ? 1 : 0) +
      (sel.programme_ids.length ? 1 : 0) +
      (sel.programme_admission_year_ids.length ? 1 : 0) +
      (sel.attendance_group_ids.length ? 1 : 0)
  const count = facetCount + activeExtras
  const scopeParts = hideScope
    ? []
    : [
        sel.department_ids.length && `Departments ${sel.department_ids.length}`,
        sel.programme_ids.length && `Programmes ${sel.programme_ids.length}`,
        sel.programme_admission_year_ids.length &&
          `Batches ${sel.programme_admission_year_ids.length}`,
        sel.attendance_group_ids.length &&
          `Sections ${sel.attendance_group_ids.length}`,
      ].filter((x): x is string => typeof x === 'string')
  const scopeSummary = !hideScope && tree ? scopeSummaryText(scope) : null
  const readout = [
    ...(scopeSummary ? [scopeSummary] : []),
    ...(scopeParts.length
      ? scopeParts
      : hideScope || scopeSummary
        ? []
        : ['Whole scope']),
    ...(summary ? [summary] : []),
  ].join(' · ')

  return (
    <PageHeader
      sticky
      title={title}
      tabs={tabs}
      actions={<ViewsMenu screenKey={screenKey} route={route} />}
      className="space-y-1.5"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant={count > 0 ? 'default' : 'outline'}
          aria-pressed={open}
          aria-expanded={open}
          onClick={() => setOpenPersist(!open)}
          className="h-8 gap-1.5 px-2.5 text-xs font-normal"
        >
          <SlidersHorizontal className="size-3.5" />
          Filters
          {count > 0 && (
            <span className="rounded bg-background/25 px-1.5 text-[11px] leading-4 tabular-nums">
              {count}
            </span>
          )}
          <ChevronDown
            className={cn('size-3.5 opacity-60 transition-transform', open && 'rotate-180')}
          />
        </Button>
        {!open && readout && (
          <span className="min-w-0 truncate text-xs text-muted-foreground">
            {readout}
          </span>
        )}
        {facetCount > 0 && !open && (
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto h-8 px-2 text-xs text-muted-foreground"
            onClick={() => setSel(EMPTY_SELECTION)}
          >
            <X className="size-3.5" /> Clear all
          </Button>
        )}
        {open && (
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto h-8 px-2 text-xs"
            onClick={() => setOpenPersist(false)}
          >
            <Check className="size-3.5" /> Done
          </Button>
        )}
      </div>

      {open &&
        (hideScope ? (
          controls && (
            <div className="flex flex-wrap items-center gap-2">{controls}</div>
          )
        ) : (
          <>
            <ScopeBar scope={scope}>{controls}</ScopeBar>
            <AppliedScopeChips scope={scope} />
          </>
        ))}
    </PageHeader>
  )
}

/** "5 depts · 5 programmes · 13 batches · 7 sections · 1,180 students" —
 * the size of the scope, for the filter-line readout. */
function scopeSummaryText(scope: InsightsScopeState): string | null {
  if (!scope.tree) return null
  const students = scope.batches.reduce((a, b) => a + b.student_count, 0)
  const depts = new Set(scope.batches.map((b) => b.department_id)).size
  const progs = new Set(scope.batches.map((b) => b.programme_id)).size
  const batches = scope.batches.length
  const sections = scope.groups.length
  return [
    `${depts} ${depts === 1 ? 'dept' : 'depts'}`,
    `${progs} ${progs === 1 ? 'programme' : 'programmes'}`,
    `${batches} ${batches === 1 ? 'batch' : 'batches'}`,
    `${sections} ${sections === 1 ? 'section' : 'sections'}`,
    `${nf(students)} students`,
  ].join(' · ')
}

// --- panels -------------------------------------------------------------------

/** Icon-only expand trigger, shared by panels and result cards. */
export function ExpandButton({
  onClick,
  className,
}: {
  onClick: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Expand"
      title="Expand"
      className={cn(
        'grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
        className,
      )}
    >
      <Maximize2 className="size-3.5" />
    </button>
  )
}

/**
 * The near-full-viewport view of a panel's content. The same children render
 * again here under `PanelSizeContext.expanded`, so charts fill the height and
 * result tables drop their cap (the descendant rule below overrides the
 * `RESULT_SCROLL` max-height on the table's own scroll box).
 */
export function ExpandDialog({
  open,
  onOpenChange,
  title,
  subtitle,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  subtitle?: string
  children: ReactNode
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[92vh] w-[96vw] max-w-[96vw] flex-col gap-3 p-4 sm:p-5">
        <DialogHeader className="pr-8">
          <DialogTitle className="text-base">{title}</DialogTitle>
          {subtitle ? (
            <DialogDescription className="text-xs">{subtitle}</DialogDescription>
          ) : (
            <DialogDescription className="sr-only">
              Expanded view of {title}
            </DialogDescription>
          )}
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-auto scrollbar-themed [&_.scrollbar-themed]:max-h-[calc(92vh-9rem)]">
          <PanelSizeContext.Provider value={{ expanded: true }}>
            {open ? children : null}
          </PanelSizeContext.Provider>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/**
 * The card every insights chart, table and list sits in. Replaces the drive
 * analytics `SectionCard` here so each one can be expanded to a near-full
 * viewport dialog, and so a long table or list is capped and scrolls inside
 * the card instead of stretching the page (`scroll`).
 */
export function InsightsPanel({
  title,
  subtitle,
  actions,
  scroll = false,
  expandable = true,
  className,
  children,
}: {
  title: string
  subtitle?: string
  actions?: ReactNode
  /** Cap the body (about ten table rows) and scroll inside; pins table heads. */
  scroll?: boolean
  expandable?: boolean
  className?: string
  children: ReactNode
}) {
  const [expanded, setExpanded] = useState(false)
  return (
    <>
      <Card className={cn('flex flex-col p-4', className)}>
        <div className="mb-3 flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold">{title}</h2>
            {subtitle ? (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            ) : null}
          </div>
          {actions}
          {expandable && <ExpandButton onClick={() => setExpanded(true)} />}
        </div>
        <div
          className={cn(
            'min-h-0',
            scroll &&
              'max-h-80 overflow-auto scrollbar-themed [&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10 [&_thead]:bg-card',
          )}
        >
          {children}
        </div>
      </Card>
      {expandable && (
        <ExpandDialog
          open={expanded}
          onOpenChange={setExpanded}
          title={title}
          subtitle={subtitle}
        >
          <div className={cn(scroll && '[&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10 [&_thead]:bg-popover')}>
            {children}
          </div>
        </ExpandDialog>
      )}
    </>
  )
}

/**
 * Wrap a `ResultCard` (or anything with a readout strip) to give it an expand
 * button in the strip's top-right corner and a full-screen twin. The children
 * render twice — once in place, once in the dialog while it is open.
 */
export function Expandable({
  title = 'Expanded view',
  children,
}: {
  title?: string
  children: ReactNode
}) {
  const [expanded, setExpanded] = useState(false)
  return (
    <>
      <div className="relative">
        {children}
        <ExpandButton
          onClick={() => setExpanded(true)}
          className="absolute top-0.5 right-1.5 size-6"
        />
      </div>
      <ExpandDialog open={expanded} onOpenChange={setExpanded} title={title}>
        {children}
      </ExpandDialog>
    </>
  )
}

/**
 * Fixed-height chart box so every chart in the module sits on the same grid;
 * inside an expanded panel it fills the dialog instead.
 */
export function ChartBox({
  height = 240,
  children,
}: {
  height?: number
  children: React.ReactElement
}) {
  const { expanded } = useContext(PanelSizeContext)
  return (
    <div
      className={cn(expanded && 'h-[calc(92vh-9rem)] min-h-[60vh]')}
      style={expanded ? { width: '100%' } : { width: '100%', height }}
    >
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  )
}

// --- small pieces -------------------------------------------------------------

/**
 * Period-over-period change for a KPI tile. Direction colour is the only
 * tone: emerald when the number moved the good way, rose when it didn't,
 * muted when it didn't move or there is no prior period to compare with.
 */
export function DeltaChip({
  value,
  unit,
  good,
  label,
}: {
  value: number | null | undefined
  /** `pts` = percentage points, `pct` = percent, `n` = a count. */
  unit: 'pts' | 'pct' | 'n'
  /** Which direction is an improvement; `none` keeps the chip neutral. */
  good: 'up' | 'down' | 'none'
  label: string
}) {
  if (value === null || value === undefined) {
    return (
      <span className="text-[11px] text-muted-foreground">No prior period</span>
    )
  }
  const zero = Math.abs(value) < 0.05
  const improving = good !== 'none' && !zero && (value > 0) === (good === 'up')
  const worsening = good !== 'none' && !zero && !improving
  const Icon = zero ? Minus : value > 0 ? ArrowUpRight : ArrowDownRight
  const magnitude =
    unit === 'n' ? nf(Math.abs(value)) : Math.abs(value).toFixed(1)
  const suffix = unit === 'pts' ? ' pts' : unit === 'pct' ? '%' : ''
  return (
    <span className="inline-flex items-center gap-1 text-[11px] tabular-nums">
      <span
        className={cn(
          'inline-flex items-center gap-0.5 font-medium',
          improving && 'text-icon-emerald',
          worsening && 'text-icon-rose',
          !improving && !worsening && 'text-muted-foreground',
        )}
      >
        <Icon className="size-3" />
        {zero ? '0' : `${value > 0 ? '+' : '−'}${magnitude}`}
        {suffix}
      </span>
      <span className="text-muted-foreground">{label}</span>
    </span>
  )
}

/** A KPI whose domain the caller's role doesn't grant. */
export function LockedKpi({ label }: { label: string }) {
  return (
    <Card className="p-4 opacity-70">
      <div className="flex items-center gap-2">
        <span className="grid size-7 place-items-center rounded-lg bg-muted text-muted-foreground">
          <Lock className="size-4" />
        </span>
        <span className="text-xs font-medium text-muted-foreground">
          {label}
        </span>
      </div>
      <p className="mt-2 text-base font-medium text-muted-foreground">
        Not in your role
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Ask an admin for the matching insights screen.
      </p>
    </Card>
  )
}

export function Note({
  tone = 'muted',
  icon: Icon = Info,
  children,
}: {
  tone?: 'muted' | 'amber'
  icon?: LucideIcon
  children: ReactNode
}) {
  return (
    <p
      className={cn(
        'flex items-start gap-2 rounded-lg border px-3 py-2 text-xs',
        tone === 'amber'
          ? 'border-icon-amber/40 bg-icon-amber/10 text-foreground'
          : 'bg-muted/40 text-muted-foreground',
      )}
    >
      <Icon className="mt-0.5 size-3.5 shrink-0" />
      <span>{children}</span>
    </p>
  )
}

export function AttentionFeed({
  items,
}: {
  items: Array<{
    kind: string
    severity: 'high' | 'medium' | 'low'
    label: string
    route: string
    tab?: string
  }>
}) {
  const { expanded } = useContext(PanelSizeContext)
  if (items.length === 0) {
    return (
      <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
        Nothing needs attention right now.
      </p>
    )
  }
  const tone = {
    high: 'text-icon-rose',
    medium: 'text-icon-amber',
    low: 'text-muted-foreground',
  }
  return (
    <ul
      className={cn(
        'divide-y',
        !expanded && 'max-h-72 overflow-auto scrollbar-themed',
      )}
    >
      {items.map((it) => (
        <li key={it.kind}>
          <button
            type="button"
            onClick={() => go(it.route, { tab: it.tab })}
            className="flex w-full items-center gap-3 px-1 py-2.5 text-left text-sm transition-colors hover:bg-accent/50"
          >
            <AlertTriangle className={cn('size-4 shrink-0', tone[it.severity])} />
            <span className="flex-1">{it.label}</span>
            <ChevronRight className="size-4 text-muted-foreground" />
          </button>
        </li>
      ))}
    </ul>
  )
}

export function TreeToggle({
  open,
  hasChildren,
  depth,
  onToggle,
  children,
}: {
  open: boolean
  hasChildren: boolean
  depth: number
  onToggle: () => void
  children: ReactNode
}) {
  const Icon = open ? ChevronDown : ChevronRight
  return (
    <span
      className="flex items-center gap-1"
      style={{ paddingLeft: depth * 16 }}
    >
      {hasChildren ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onToggle()
          }}
          className="grid size-5 place-items-center rounded text-muted-foreground hover:bg-accent"
          aria-label={open ? 'Collapse' : 'Expand'}
        >
          <Icon className="size-3.5" />
        </button>
      ) : (
        <span className="size-5" />
      )}
      {children}
    </span>
  )
}

/** Stacked band bar — five thin segments coloured by band, widths by share. */
export function BandBar({
  bands,
  colors,
  total,
}: {
  bands: Array<{ key: string; count: number; label: string }>
  colors: Record<string, string>
  total: number
}) {
  if (total <= 0) return <span className="text-xs text-muted-foreground">—</span>
  return (
    <span
      className="flex h-2 w-28 gap-px overflow-hidden rounded-sm"
      title={bands.map((b) => `${b.label}: ${b.count}`).join(' · ')}
    >
      {bands.map((b) => (
        <span
          key={b.key}
          style={{
            width: `${(b.count / total) * 100}%`,
            backgroundColor: colors[b.key],
          }}
        />
      ))}
    </span>
  )
}
