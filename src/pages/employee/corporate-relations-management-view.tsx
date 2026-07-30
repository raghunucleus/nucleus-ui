import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  BarChart3,
  Briefcase,
  CalendarRange,
  Columns3,
  History,
  Loader2,
  Rows2,
  Rows3,
  Search,
  SlidersHorizontal,
  Table2,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Combobox } from '@/components/ui/combobox'
import { Input } from '@/components/ui/input'
import { Pagination } from '@/components/ui/pagination'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { NoAccessEmptyState } from '@/components/employee/empty-states'
import {
  AppliedFilterChip,
  CompanyLogo,
  CompanyStatusBadge,
  Field,
  GroupHeaderRow,
  NativeSelect,
  TabBar,
  formatDate,
  type AppliedFacet,
  type TabDef,
} from '@/components/corporate-relations/bits'
import { CrViewColumnsDialog } from '@/components/corporate-relations/cr-view-columns-dialog'
import { CrViewContactsDialog } from '@/components/corporate-relations/cr-view-contacts-dialog'
import { CrViewFiltersDialog } from '@/components/corporate-relations/cr-view-filters-dialog'
import { CrViewStatusHistoryDialog } from '@/components/corporate-relations/cr-view-status-history-dialog'
import {
  ChipList,
  CompactChips,
  ContactCell,
  StatusValue,
  type CellDensity,
} from '@/components/corporate-relations/inline-cells'
import { ManagementInsights } from '@/components/corporate-relations/management-insights'
import { ManagementRecordSheet } from '@/components/corporate-relations/management-record-sheet'
import { useScreenAccess } from '@/hooks/use-screen-access'
import { ApiError } from '@/lib/api'
import {
  buildCrViewDisplayItems,
  type Chip,
  type CrViewGroupBy,
  type CrViewGroupContext,
} from '@/lib/corporate-relations'
import {
  EMPTY_CR_VIEW_FILTERS,
  NO_STATUS_ID,
  countActiveCrViewFilters,
  followUpLabel,
  matchesCrViewFilters,
  triStateLabel,
  type CrViewFilters,
} from '@/lib/cr-view-filters'
import {
  getManagementScope,
  getManagementStatusHistory,
  listManagementView,
  type ManagementRow,
  type ManagementScope,
} from '@/lib/management-view'
import { cn } from '@/lib/utils'

const SCREEN_KEY = 'corporate_relations.management_view.view'
// Its own keys, deliberately: a manager's column layout, density and year on
// this screen have nothing to do with what they last did on CR View.
const YEAR_STORAGE_KEY = 'nucleus.management-view.passout-year'
const COLUMNS_STORAGE_KEY = 'nucleus.management-view.columns'
const DENSITY_STORAGE_KEY = 'nucleus.management-view.density'
const PAGE_SIZE_STORAGE_KEY = 'nucleus.management-view.page-size'
const GROUP_BY_STORAGE_KEY = 'nucleus.management-view.group-by'

/** Group by CR is the dimension this screen adds — CR View cannot use it. */
const GROUP_BY_VALUES: CrViewGroupBy[] = [
  'none',
  'status',
  'cr',
  'follow_up',
  'company',
]

const PAGE_SIZES = [10, 25, 50, 100]
const DEFAULT_PAGE_SIZE = 25

type PanelTab = 'records' | 'insights'

const TABS: TabDef[] = [
  { key: 'records', label: 'Records', icon: Table2 },
  { key: 'insights', label: 'Insights', icon: BarChart3 },
]

/** Read the remembered density defensively — garbage degrades to compact. */
function initialDensity(): CellDensity {
  if (typeof window === 'undefined') return 'compact'
  const raw = window.localStorage.getItem(DENSITY_STORAGE_KEY)
  return raw === 'expanded' ? 'expanded' : 'compact'
}

function initialPageSize(): number {
  if (typeof window === 'undefined') return DEFAULT_PAGE_SIZE
  const raw = Number(window.localStorage.getItem(PAGE_SIZE_STORAGE_KEY))
  return PAGE_SIZES.includes(raw) ? raw : DEFAULT_PAGE_SIZE
}

function initialGroupBy(): CrViewGroupBy {
  if (typeof window === 'undefined') return 'none'
  const raw = window.localStorage.getItem(GROUP_BY_STORAGE_KEY)
  return GROUP_BY_VALUES.includes(raw as CrViewGroupBy)
    ? (raw as CrViewGroupBy)
    : 'none'
}

type SortField = 'company' | 'cr' | 'role' | 'updated_at' | 'next_follow_up'

// The company column is pinned while the rest scroll under it, so both axes'
// stickiness meet in its header — hence the z-20 (the header row itself is
// z-10, and the corner must outrank both).
const STICKY_CELL = 'sticky left-0 z-10 border-r bg-card'
const STICKY_HEAD = 'sticky left-0 z-20 border-r bg-card'

interface ColumnMeta {
  key: string
  label: string
  /** Locked columns cannot be hidden or moved — Company, which is pinned. */
  locked?: boolean
  sortField?: SortField
  headClassName?: string
  cellClassName?: string
}

/**
 * CR View's columns plus `cr`, which is the column that makes this screen what
 * it is — second, right after the pinned company, because "who owns this" is the
 * question a manager reads the row for.
 */
const COLUMN_META: ColumnMeta[] = [
  {
    key: 'company',
    label: 'Company',
    locked: true,
    sortField: 'company',
    headClassName: STICKY_HEAD,
    cellClassName: STICKY_CELL,
  },
  { key: 'cr', label: 'CR', sortField: 'cr', cellClassName: 'min-w-40' },
  { key: 'role', label: 'Job role', sortField: 'role' },
  { key: 'categories', label: 'Categories', cellClassName: 'min-w-40' },
  { key: 'designation', label: 'Designation', cellClassName: 'min-w-44' },
  { key: 'programme', label: 'Programme', cellClassName: 'min-w-44' },
  { key: 'location', label: 'Location', cellClassName: 'min-w-44' },
  {
    key: 'relationship',
    label: 'Relationship type',
    cellClassName: 'min-w-52',
  },
  { key: 'current_status', label: 'Current status', cellClassName: 'min-w-44' },
  { key: 'remarks', label: 'Remarks', cellClassName: 'min-w-48 max-w-72' },
  { key: 'contact', label: 'Contact', cellClassName: 'min-w-40' },
  {
    key: 'next_follow_up',
    label: 'Next follow up',
    sortField: 'next_follow_up',
    cellClassName: 'whitespace-nowrap',
  },
  { key: 'status', label: 'Status' },
  {
    key: 'updated',
    label: 'Updated',
    sortField: 'updated_at',
    cellClassName: 'whitespace-nowrap',
  },
]
const DEFAULT_COLUMN_KEYS = COLUMN_META.map((c) => c.key)
const KNOWN_COLUMN_KEYS = new Set(DEFAULT_COLUMN_KEYS)

/** Read the remembered layout defensively — garbage degrades to the default. */
function initialColumns(): string[] {
  if (typeof window === 'undefined') return DEFAULT_COLUMN_KEYS
  try {
    const raw = window.localStorage.getItem(COLUMNS_STORAGE_KEY)
    if (!raw) return DEFAULT_COLUMN_KEYS
    const parsed: unknown = JSON.parse(raw)
    if (
      !Array.isArray(parsed) ||
      !parsed.every((k): k is string => typeof k === 'string')
    ) {
      return DEFAULT_COLUMN_KEYS
    }
    const known = parsed.filter((k) => KNOWN_COLUMN_KEYS.has(k))
    if (!known.includes('company')) known.unshift('company')
    return known.length > 1 ? known : DEFAULT_COLUMN_KEYS
  } catch {
    return DEFAULT_COLUMN_KEYS
  }
}

function errMsg(e: unknown, fallback: string): string {
  return e instanceof ApiError || e instanceof Error ? e.message : fallback
}

/** Read the remembered year once, defensively — garbage must not throw. */
function initialYear(): number | null {
  if (typeof window === 'undefined') return null
  const raw = Number(window.localStorage.getItem(YEAR_STORAGE_KEY))
  return Number.isInteger(raw) && raw > 0 ? raw : null
}

/** A clickable table header that toggles sorting on `field`. */
function SortableHead({
  label,
  field,
  sort,
  onToggle,
  className,
}: {
  label: string
  field: SortField
  sort: { by: SortField; dir: 'asc' | 'desc' }
  onToggle: (field: SortField) => void
  className?: string
}) {
  const active = sort.by === field
  const Icon = !active ? ArrowUpDown : sort.dir === 'asc' ? ArrowUp : ArrowDown
  return (
    <TableHead className={className}>
      <button
        type="button"
        onClick={() => onToggle(field)}
        className="-mx-1 inline-flex items-center gap-1 rounded px-1 hover:text-foreground"
        aria-label={`Sort by ${label}`}
      >
        {label}
        <Icon className={`size-3.5 ${active ? '' : 'opacity-40'}`} />
      </button>
    </TableHead>
  )
}

/**
 * Management View — every company job role for one passout year, across every
 * CR, with the insights management reads instead of scrolling.
 *
 * The unscoped twin of CR View. That screen shows the signed-in employee their
 * own roles and lets them edit each cell; this one shows EVERYBODY's and edits
 * nothing: the screen key has no `edit` action and the controller behind it has
 * no write handler, so read-only here is a property of the API, not a prop on a
 * component. A record is corrected by its own CR, on their screen.
 *
 * Everything is client-side over one unpaginated fetch — the same doctrine as CR
 * View, with a second payoff here: the Insights tab derives every chart from the
 * exact rows the table is showing, so clicking a chart segment and reading the
 * filtered list can never disagree.
 */
export default function EmployeeManagementViewPage() {
  useEffect(() => {
    document.title = 'Management View — Nucleus'
  }, [])

  const access = useScreenAccess(SCREEN_KEY)

  const [scope, setScope] = useState<ManagementScope | null>(null)
  const [scopeLoaded, setScopeLoaded] = useState(false)
  const [scopeError, setScopeError] = useState<string | null>(null)
  const [yearId, setYearId] = useState<number | null>(initialYear)

  const [tab, setTab] = useState<PanelTab>('records')
  const [search, setSearch] = useState('')
  /** Committed facets — applied client-side, so no draft copy is needed. */
  const [filters, setFilters] = useState<CrViewFilters>(EMPTY_CR_VIEW_FILTERS)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [sort, setSort] = useState<{ by: SortField; dir: 'asc' | 'desc' }>({
    by: 'company',
    dir: 'asc',
  })
  const [rows, setRows] = useState<ManagementRow[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  /** Visible column keys in display order — the picker edits this. */
  const [columns, setColumns] = useState<string[]>(initialColumns)
  const [columnsOpen, setColumnsOpen] = useState(false)
  /** Compact = one-row cells with "+N"; expanded = every value, wrapping. */
  const [density, setDensity] = useState<CellDensity>(initialDensity)
  /** 1-based; clamped against the filtered list, so it can never dangle. */
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<number>(initialPageSize)
  const [groupBy, setGroupBy] = useState<CrViewGroupBy>(initialGroupBy)
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(
    () => new Set(),
  )
  /** The row whose contacts are being read; `null` = closed. */
  const [contactsRow, setContactsRow] = useState<ManagementRow | null>(null)
  /** The row whose full detail sheet is open; `null` = closed. */
  const [detailRow, setDetailRow] = useState<ManagementRow | null>(null)
  /** The row whose status-history dialog is open; `null` = closed. */
  const [historyRow, setHistoryRow] = useState<ManagementRow | null>(null)

  useEffect(() => {
    let cancelled = false
    getManagementScope()
      .then((s) => {
        if (cancelled) return
        setScope(s)
        // A remembered id can name a year that has since been deactivated. Fall
        // back to the server's today-aware default, not to the first option.
        setYearId((cur) =>
          s.years.some((y) => y.id === cur) ? cur : s.default_year_id,
        )
      })
      .catch((e: unknown) => {
        if (!cancelled) setScopeError(errMsg(e, 'Could not load passout years.'))
      })
      .finally(() => {
        if (!cancelled) setScopeLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Gated on the scope: firing with a stale localStorage year would 404 on
  // every load and never recover.
  useEffect(() => {
    if (!scopeLoaded || yearId === null) return
    let cancelled = false
    setLoading(true)
    setError(null)
    listManagementView({ passout_year_id: yearId })
      .then((r) => {
        if (!cancelled) setRows(r.items)
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(errMsg(e, 'Could not load the job roles.'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [scopeLoaded, yearId])

  const changeYear = (next: number | null) => {
    if (next === null) return
    setYearId(next)
    setPage(1)
    window.localStorage.setItem(YEAR_STORAGE_KEY, String(next))
  }

  const changeFilters = (next: CrViewFilters) => {
    setFilters(next)
    setPage(1)
  }

  /**
   * A chart click. Merges the facet it carries and switches to the list — the
   * whole point of a clickable chart is landing on the rows behind the number.
   */
  const drill = (patch: Partial<CrViewFilters>) => {
    setFilters((cur) => ({ ...cur, ...patch }))
    setPage(1)
    setTab('records')
  }

  const changePageSize = (next: number) => {
    setPageSize(next)
    setPage(1)
    try {
      window.localStorage.setItem(PAGE_SIZE_STORAGE_KEY, String(next))
    } catch {
      // Private mode / quota — the size still applies, it just won't persist.
    }
  }

  const changeGroupBy = (next: CrViewGroupBy) => {
    setGroupBy(next)
    // Group keys mean nothing across dimensions, and the pager (hidden while
    // grouped) should come back on page 1 rather than wherever it was left.
    setCollapsed(new Set())
    setPage(1)
    try {
      window.localStorage.setItem(GROUP_BY_STORAGE_KEY, next)
    } catch {
      // Private mode / quota — the choice still applies, it just won't persist.
    }
  }

  const toggleGroup = (key: string) => {
    setCollapsed((cur) => {
      const next = new Set(cur)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const changeColumns = (keys: string[]) => {
    setColumns(keys)
    try {
      window.localStorage.setItem(COLUMNS_STORAGE_KEY, JSON.stringify(keys))
    } catch {
      // Private mode / quota — the layout still applies, it just won't persist.
    }
  }

  const changeDensity = (next: CellDensity) => {
    setDensity(next)
    try {
      window.localStorage.setItem(DENSITY_STORAGE_KEY, next)
    } catch {
      // Private mode / quota — the choice still applies, it just won't persist.
    }
  }

  function toggleSort(field: SortField) {
    // `updated_at` opens newest-first; `next_follow_up` opens soonest-first —
    // "which desks are behind" is the question those columns answer here.
    setSort((cur) =>
      cur.by === field
        ? { by: field, dir: cur.dir === 'asc' ? 'desc' : 'asc' }
        : { by: field, dir: field === 'updated_at' ? 'desc' : 'asc' },
    )
  }

  // Client-side: the list arrives whole, so re-fetching per keystroke would only
  // add latency. The CR name is searchable here (it isn't on CR View, where every
  // row has the same one).
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    const searched = q
      ? (rows ?? []).filter(
          (r) =>
            r.role_name.toLowerCase().includes(q) ||
            r.company.name.toLowerCase().includes(q) ||
            r.responsible_employee.emp_display_name.toLowerCase().includes(q) ||
            r.responsible_employee.emp_code.toLowerCase().includes(q) ||
            (r.record?.contacts ?? []).some((c) =>
              c.hr_name.toLowerCase().includes(q),
            ),
        )
      : (rows ?? [])
    const filtered = searched.filter((r) => matchesCrViewFilters(r, filters))
    const dir = sort.dir === 'asc' ? 1 : -1
    return [...filtered].sort((a, b) => {
      if (sort.by === 'updated_at' || sort.by === 'next_follow_up') {
        // Rows with nothing recorded sort last either way — they have no date to
        // compare, and burying them under a 1970 epoch would be a lie. Both
        // formats ('YYYY-MM-DD' and full ISO) compare lexicographically.
        const dateOf = (r: ManagementRow) =>
          sort.by === 'updated_at'
            ? (r.record?.updated_at ?? null)
            : (r.record?.next_follow_up_date ?? null)
        const at = dateOf(a)
        const bt = dateOf(b)
        if (at === null && bt === null) return 0
        if (at === null) return 1
        if (bt === null) return -1
        return dir * at.localeCompare(bt)
      }
      const key =
        sort.by === 'role'
          ? ([a.role_name, b.role_name] as const)
          : sort.by === 'cr'
            ? ([
                a.responsible_employee.emp_display_name,
                b.responsible_employee.emp_display_name,
              ] as const)
            : ([a.company.name, b.company.name] as const)
      const cmp = key[0].localeCompare(key[1])
      return dir * (cmp !== 0 ? cmp : a.role_name.localeCompare(b.role_name))
    })
  }, [rows, search, filters, sort])

  const companyCount = useMemo(
    () => new Set(visible.map((r) => r.company.id)).size,
    [visible],
  )
  const crCount = useMemo(
    () => new Set(visible.map((r) => r.responsible_employee.id)).size,
    [visible],
  )

  // Categories have no scope list of their own — the dialog offers exactly the
  // ones that appear on the loaded companies, which is also all it can match.
  const categoryOptions = useMemo(() => {
    const byId = new Map<number, Chip>()
    for (const r of rows ?? []) {
      for (const c of r.company.categories) byId.set(c.id, c)
    }
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [rows])

  /** Same story as categories: the companies actually present in the year. */
  const companyOptions = useMemo(() => {
    const byId = new Map<number, Chip>()
    for (const r of rows ?? []) byId.set(r.company.id, r.company)
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [rows])

  /** From the scope, not the rows — a facet must be able to widen a filter. */
  const crOptions = useMemo<Chip[]>(
    () =>
      (scope?.crs ?? []).map((c) => ({
        id: c.id,
        name: `${c.emp_display_name} · ${c.emp_code}`,
      })),
    [scope],
  )

  const statusFilterOptions = useMemo<Chip[]>(
    () => [
      { id: NO_STATUS_ID, name: 'No status' },
      ...(scope?.current_statuses ?? []),
    ],
    [scope],
  )

  const activeFilterCount = countActiveCrViewFilters(filters)

  // One grouped chip per active facet, ids resolved to names. Ids whose option
  // list can't resolve them are skipped rather than shown as a bare number.
  const facetChip = (
    key: keyof CrViewFilters,
    label: string,
    ids: number[],
    opts: Chip[],
  ): AppliedFacet | null => {
    const names = ids
      .map((id) => opts.find((o) => o.id === id)?.name)
      .filter((n): n is string => Boolean(n))
    if (names.length === 0) return null
    return {
      id: key,
      label,
      values: names,
      onClear: () => changeFilters({ ...filters, [key]: [] }),
    }
  }

  const appliedChips = [
    facetChip('cr_ids', 'CR', filters.cr_ids, crOptions),
    facetChip('company_ids', 'Company', filters.company_ids, companyOptions),
    facetChip('status_ids', 'Status', filters.status_ids, statusFilterOptions),
    facetChip(
      'relationship_type_ids',
      'Relationship',
      filters.relationship_type_ids,
      scope?.relationship_types ?? [],
    ),
    facetChip(
      'designation_ids',
      'Designation',
      filters.designation_ids,
      scope?.designations ?? [],
    ),
    facetChip(
      'programme_ids',
      'Programme',
      filters.programme_ids,
      scope?.programmes ?? [],
    ),
    facetChip(
      'location_ids',
      'Location',
      filters.location_ids,
      scope?.job_locations ?? [],
    ),
    facetChip('category_ids', 'Category', filters.category_ids, categoryOptions),
    filters.follow_up !== 'any'
      ? {
          id: 'follow_up',
          label: 'Next follow up',
          values: [followUpLabel(filters.follow_up)],
          onClear: () => changeFilters({ ...filters, follow_up: 'any' }),
        }
      : null,
    filters.has_contacts !== 'any'
      ? {
          id: 'has_contacts',
          label: 'Has contacts',
          values: [triStateLabel(filters.has_contacts)],
          onClear: () => changeFilters({ ...filters, has_contacts: 'any' }),
        }
      : null,
    filters.has_remarks !== 'any'
      ? {
          id: 'has_remarks',
          label: 'Has remarks',
          values: [triStateLabel(filters.has_remarks)],
          onClear: () => changeFilters({ ...filters, has_remarks: 'any' }),
        }
      : null,
  ].filter((c): c is AppliedFacet => c !== null)

  // Client-side pagination over the filtered/sorted list. `safePage` clamps
  // rather than resetting so a shrinking filter can never leave the pager past
  // the end.
  const pageCount = Math.max(1, Math.ceil(visible.length / pageSize))
  const safePage = Math.min(page, pageCount)
  const paged = useMemo(
    () => visible.slice((safePage - 1) * pageSize, safePage * pageSize),
    [visible, safePage, pageSize],
  )

  const grouped = groupBy !== 'none'
  const groupCtx = useMemo<CrViewGroupContext>(
    () => ({
      statuses: scope?.current_statuses ?? [],
      defaultStatus: scope?.default_status ?? null,
    }),
    [scope],
  )
  const displayItems = useMemo(
    () =>
      grouped
        ? buildCrViewDisplayItems(visible, groupBy, collapsed, groupCtx)
        : null,
    [grouped, visible, groupBy, collapsed, groupCtx],
  )

  const selectedYear = scope?.years.find((y) => y.id === yearId) ?? null

  const visibleMeta = useMemo(
    () =>
      columns
        .map((k) => COLUMN_META.find((c) => c.key === k))
        .filter((c): c is ColumnMeta => !!c),
    [columns],
  )

  /** Read-only multi-value render, honouring the density choice. */
  const roChips = (items: Chip[]) =>
    density === 'expanded' ? (
      <span className="flex flex-wrap items-center gap-1.5">
        <ChipList items={items} />
      </span>
    ) : (
      <CompactChips items={items} />
    )

  /**
   * One cell body, keyed by the column registry. Every one of these is a
   * READ-ONLY render — the inline editors CR View uses have no counterpart here
   * on purpose, and there is no save function on this page to call.
   */
  function cellContent(key: string, r: ManagementRow) {
    const at = `${r.role_name} at ${r.company.name}`
    switch (key) {
      case 'company':
        // The company name opens the full read-only sheet — same affordance as
        // CR View's editor entry point, without the editing.
        return (
          <button
            type="button"
            title="View all details"
            aria-label={`View all details — ${at}`}
            onClick={() => setDetailRow(r)}
            className="group/company -mx-1.5 flex items-center gap-2.5 rounded px-1.5 py-0.5 text-left transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <CompanyLogo name={r.company.name} logoUrl={r.company.logo_url} />
            <span className="whitespace-nowrap text-sm font-medium underline-offset-4 group-hover/company:underline">
              {r.company.name}
            </span>
          </button>
        )
      case 'cr':
        return (
          <button
            type="button"
            title="Filter to this CR"
            onClick={() =>
              changeFilters({
                ...filters,
                cr_ids: [r.responsible_employee.id],
              })
            }
            className="-mx-1 flex min-w-0 flex-col items-start rounded px-1 text-left hover:bg-accent/50"
          >
            <span className="truncate text-sm">
              {r.responsible_employee.emp_display_name}
            </span>
            <span className="text-xs text-muted-foreground">
              {r.responsible_employee.emp_code}
            </span>
          </button>
        )
      case 'role':
        return <span className="text-sm">{r.role_name}</span>
      case 'categories':
        return roChips(r.company.categories)
      case 'designation':
        return roChips(r.record?.designations ?? [])
      case 'programme':
        return roChips(r.record?.programmes ?? [])
      case 'location':
        return roChips(r.record?.job_locations ?? [])
      case 'relationship':
        return roChips(r.record?.relationship_types ?? [])
      case 'current_status':
        return (
          <div className="flex items-center gap-1">
            <div className="min-w-0 flex-1">
              <StatusValue
                status={r.record?.current_status ?? null}
                fallback={scope?.default_status ?? null}
              />
            </div>
            {/* History exists only once something was saved — a never-saved row
                has no transitions to show by definition. */}
            {r.record && (
              <button
                type="button"
                title="Status history"
                aria-label={`Status history — ${at}`}
                onClick={() => setHistoryRow(r)}
                className="shrink-0 rounded p-1 text-muted-foreground opacity-60 transition hover:bg-accent hover:text-foreground hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <History className="size-3.5" />
              </button>
            )}
          </div>
        )
      case 'remarks':
        return r.record?.remarks ? (
          <span
            className={cn(
              'whitespace-pre-wrap text-sm',
              density === 'compact' && 'line-clamp-2',
            )}
            title={density === 'compact' ? r.record.remarks : undefined}
          >
            {r.record.remarks}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        )
      case 'contact': {
        const contacts = r.record?.contacts ?? []
        if (contacts.length === 0) {
          return <span className="text-sm text-muted-foreground">—</span>
        }
        return (
          <ContactCell
            contacts={contacts}
            saving={false}
            onOpen={() => setContactsRow(r)}
            label={`Contact details — ${at}`}
            density={density}
          />
        )
      }
      case 'next_follow_up':
        return (
          <span className="text-sm text-muted-foreground">
            {formatDate(r.record?.next_follow_up_date)}
          </span>
        )
      case 'status':
        return <CompanyStatusBadge company={r.company} />
      case 'updated':
        // An em-dash is the "nothing recorded for this year yet" signal — the
        // record row is created on the CR's first save.
        return (
          <span className="text-xs text-muted-foreground">
            {r.record ? formatDate(r.record.updated_at) : '—'}
          </span>
        )
      default:
        return null
    }
  }

  /** One data row — shared by the flat and grouped table bodies. */
  const renderRow = (r: ManagementRow) => (
    <TableRow key={r.job_role_id}>
      {visibleMeta.map((c) => (
        <TableCell key={c.key} className={c.cellClassName}>
          {cellContent(c.key, r)}
        </TableCell>
      ))}
    </TableRow>
  )

  if (!access) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <NoAccessEmptyState />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      {/* No subtitle: the screen is dense and the tab row below already says
          what the year and the two views are. */}
      <h1 className="text-lg font-semibold tracking-tight">Management View</h1>

      {!scopeLoaded ? (
        <div className="h-[70vh] animate-pulse rounded-xl bg-muted" />
      ) : scopeError ? (
        <p className="text-sm text-destructive">{scopeError}</p>
      ) : !scope || scope.years.length === 0 ? (
        <div className="flex min-h-[62vh] flex-col items-center justify-center rounded-xl border border-dashed bg-muted/20 px-6 py-14 text-center">
          <CalendarRange className="mb-2 size-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No passout years are active.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Ask a placement admin to add one on Company Attributes.
          </p>
        </div>
      ) : (
        <>
          {/* The year drives both tabs, and the applied chips sit above the tab
              bar so a filter is visible from the charts as well as the list. */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-end gap-3">
              <Field label="Passout year" className="w-56">
                <Combobox
                  value={yearId}
                  options={scope.years.map((y) => ({
                    value: y.id,
                    label: y.display_year,
                  }))}
                  onChange={changeYear}
                  placeholder="Select a passout year…"
                  searchPlaceholder="Search years…"
                />
              </Field>
              <Button
                variant={activeFilterCount > 0 ? 'default' : 'outline'}
                onClick={() => setFiltersOpen(true)}
              >
                <SlidersHorizontal className="size-4" />
                Filters
                {activeFilterCount > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {activeFilterCount}
                  </Badge>
                )}
              </Button>
            </div>

            {appliedChips.length > 0 && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">
                  Filters · {activeFilterCount}
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {appliedChips.map((chip) => (
                    <AppliedFilterChip key={chip.id} {...chip} />
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => changeFilters(EMPTY_CR_VIEW_FILTERS)}
                  className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  <X className="size-3" /> Clear all
                </button>
              </div>
            )}

            <TabBar
              tabs={TABS}
              active={tab}
              onChange={(k) => setTab(k as PanelTab)}
            />
          </div>

          {loading && !rows ? (
            <div className="flex min-h-[62vh] items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="mr-2 size-4 animate-spin" /> Loading…
            </div>
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : tab === 'insights' ? (
            selectedYear && (
              <ManagementInsights
                rows={visible}
                ctx={groupCtx}
                year={selectedYear}
                filtersActive={activeFilterCount > 0 || search.trim() !== ''}
                onDrill={drill}
                onClearFilters={() => {
                  changeFilters(EMPTY_CR_VIEW_FILTERS)
                  setSearch('')
                }}
              />
            )
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative min-w-48 flex-1">
                  <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value)
                      setPage(1)
                    }}
                    placeholder="Search roles, companies, CRs or contacts…"
                    className="pl-8"
                  />
                </div>
                <NativeSelect
                  aria-label="Group by"
                  className="h-9 w-44"
                  value={groupBy}
                  onChange={(e) =>
                    changeGroupBy(e.target.value as CrViewGroupBy)
                  }
                >
                  <option value="none">No grouping</option>
                  <option value="status">Group: Status</option>
                  <option value="cr">Group: CR</option>
                  <option value="follow_up">Group: Follow-up</option>
                  <option value="company">Group: Company</option>
                </NativeSelect>
                <div
                  role="group"
                  aria-label="Table density"
                  className="flex h-9 items-center rounded-md border border-input bg-background p-0.5 shadow-xs"
                >
                  <button
                    type="button"
                    title="Compact — one row per role"
                    aria-pressed={density === 'compact'}
                    onClick={() => changeDensity('compact')}
                    className={cn(
                      'flex h-full items-center gap-1.5 rounded px-2.5 text-sm transition-colors',
                      density === 'compact'
                        ? 'bg-accent text-accent-foreground'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <Rows3 className="size-4" /> Compact
                  </button>
                  <button
                    type="button"
                    title="Expanded — every value shown in full"
                    aria-pressed={density === 'expanded'}
                    onClick={() => changeDensity('expanded')}
                    className={cn(
                      'flex h-full items-center gap-1.5 rounded px-2.5 text-sm transition-colors',
                      density === 'expanded'
                        ? 'bg-accent text-accent-foreground'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <Rows2 className="size-4" /> Expanded
                  </button>
                </div>
                <Button variant="outline" onClick={() => setColumnsOpen(true)}>
                  <Columns3 className="size-4" /> Columns
                </Button>
              </div>

              {visible.length === 0 ? (
                <div className="flex min-h-[62vh] flex-col items-center justify-center rounded-xl border border-dashed bg-muted/20 px-6 py-14 text-center">
                  <Briefcase className="mb-2 size-6 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    {rows && rows.length > 0
                      ? activeFilterCount > 0
                        ? 'No roles match those filters.'
                        : 'No roles match your search.'
                      : 'No job roles have been added to any company yet.'}
                  </p>
                </div>
              ) : (
                <div className="min-h-[62vh] overflow-hidden rounded-xl border bg-card">
                  <Table containerClassName="max-h-[62vh] overflow-y-auto">
                    <TableHeader>
                      <TableRow className="sticky top-0 z-10 [&>th]:bg-card">
                        {visibleMeta.map((c) =>
                          c.sortField ? (
                            <SortableHead
                              key={c.key}
                              label={c.label}
                              field={c.sortField}
                              sort={sort}
                              onToggle={toggleSort}
                              className={c.headClassName}
                            />
                          ) : (
                            <TableHead key={c.key} className={c.headClassName}>
                              {c.label}
                            </TableHead>
                          ),
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {grouped && displayItems
                        ? displayItems.map((item) =>
                            item.kind === 'header' ? (
                              // Header keys are prefixed — status/company/CR
                              // group keys are numeric strings that could
                              // collide with a job_role_id.
                              <GroupHeaderRow
                                key={`h:${item.key}`}
                                label={item.label}
                                count={item.count}
                                noun="role"
                                open={item.open}
                                colSpan={visibleMeta.length}
                                onToggle={() => toggleGroup(item.key)}
                              />
                            ) : (
                              renderRow(item.row)
                            ),
                          )
                        : paged.map(renderRow)}
                    </TableBody>
                  </Table>
                </div>
              )}

              {visible.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-muted-foreground">
                    {/* Grouped shows the whole list at once, so a page range
                        would be a lie — just the totals. */}
                    {!grouped && (
                      <>
                        {(safePage - 1) * pageSize + 1}–
                        {Math.min(safePage * pageSize, visible.length)} of{' '}
                      </>
                    )}
                    {visible.length} {visible.length === 1 ? 'role' : 'roles'}{' '}
                    across {companyCount}{' '}
                    {companyCount === 1 ? 'company' : 'companies'} and {crCount}{' '}
                    {crCount === 1 ? 'CR' : 'CRs'}
                    {selectedYear ? ` for ${selectedYear.display_year}` : ''}
                  </p>
                  {!grouped && (
                    <div className="flex flex-wrap items-center gap-3">
                      <NativeSelect
                        className="h-8 w-auto"
                        value={String(pageSize)}
                        onChange={(e) => changePageSize(Number(e.target.value))}
                        aria-label="Rows per page"
                      >
                        {PAGE_SIZES.map((s) => (
                          <option key={s} value={s}>
                            {s} / page
                          </option>
                        ))}
                      </NativeSelect>
                      <Pagination
                        page={safePage}
                        totalPages={pageCount}
                        onPage={setPage}
                      />
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          <CrViewFiltersDialog
            open={filtersOpen}
            onOpenChange={setFiltersOpen}
            scope={scope}
            categoryOptions={categoryOptions}
            crOptions={crOptions}
            companyOptions={companyOptions}
            value={filters}
            onChange={changeFilters}
          />

          <CrViewColumnsDialog
            open={columnsOpen}
            columns={COLUMN_META}
            value={columns}
            defaultValue={DEFAULT_COLUMN_KEYS}
            onOpenChange={setColumnsOpen}
            onApply={changeColumns}
          />

          {/* The contacts editor in its read-only mode — this screen can never
              save, so the handler is unreachable rather than merely unused. */}
          <CrViewContactsDialog
            open={contactsRow !== null}
            title={contactsRow?.role_name ?? ''}
            subtitle={[contactsRow?.company.name, selectedYear?.display_year]
              .filter(Boolean)
              .join(' · ')}
            contacts={contactsRow?.record?.contacts ?? []}
            readOnly
            onOpenChange={(open) => !open && setContactsRow(null)}
            onSave={() => Promise.resolve(false)}
          />

          {selectedYear && (
            <ManagementRecordSheet
              row={detailRow}
              year={selectedYear}
              defaultStatus={scope.default_status}
              onOpenChange={(open) => !open && setDetailRow(null)}
              onShowHistory={(r) => {
                setDetailRow(null)
                setHistoryRow(r)
              }}
            />
          )}

          {selectedYear && historyRow && (
            <CrViewStatusHistoryDialog
              open
              title={historyRow.role_name}
              subtitle={`${historyRow.company.name} · ${historyRow.responsible_employee.emp_display_name} · ${selectedYear.display_year}`}
              jobRoleId={historyRow.job_role_id}
              passoutYearId={selectedYear.id}
              fetcher={getManagementStatusHistory}
              onOpenChange={(open) => !open && setHistoryRow(null)}
            />
          )}
        </>
      )}
    </div>
  )
}
