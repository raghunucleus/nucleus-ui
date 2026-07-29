import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  LayoutGrid,
  List,
  Search,
  SlidersHorizontal,
  UserCheck,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import {
  AppliedFilterChip,
  CompanyLogo,
  EnumChips,
  FilterField,
  formatDate,
  formatDateTime,
  SearchableMultiSelect,
  type AppliedFacet,
} from '@/components/corporate-relations/bits'
import { NoAccessEmptyState } from '@/components/employee/empty-states'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { useScreenAccess } from '@/hooks/use-screen-access'
import { ApiError } from '@/lib/api'
import { employeeNavigateTo } from '@/lib/employee-navigate'
import {
  DRIVE_STATUS_LABELS,
  DRIVE_STATUSES,
  driveStatusVariant,
  type Chip,
  type DriveListItem,
  type DriveSortField,
  type DriveStatus,
} from '@/lib/drive-management'
import {
  getCoordinatorFilterOptions,
  getCoordinatorScope,
  listCoordinatorDrives,
} from '@/lib/placement-coordinator'
import { cn } from '@/lib/utils'

/**
 * Placement Coordinator > Drives — the READ-ONLY, scope-filtered counterpart of
 * the Drive Management list. The server only returns drives whose eligibility
 * overlaps the coordinator's assigned programmes AND passout years, so this
 * page has no create/edit/delete anywhere; the extra Programme / Passout-year
 * facets offer only the coordinator's own accessible values (narrow, never
 * widen — the server clamps regardless).
 */

const SCREEN_KEY = 'placement_coordinator.drives.view'
const VIEW_STORAGE_KEY = 'nucleus.coordinator-drives.view'
const LIST_ROUTE = '/placement-coordinator/drives'
const PAGE_SIZE = 25

type ViewMode = 'table' | 'cards'

/** The committed filter state. Empty arrays = that facet is off. */
interface DriveFilters {
  statuses: DriveStatus[]
  companyIds: number[]
  offerTypeIds: number[]
  placementCategoryIds: number[]
  companyCategoryIds: number[]
  programmeIds: number[]
  passoutYears: number[]
}

const EMPTY_FILTERS: DriveFilters = {
  statuses: [],
  companyIds: [],
  offerTypeIds: [],
  placementCategoryIds: [],
  companyCategoryIds: [],
  programmeIds: [],
  passoutYears: [],
}

/** How many facets are active, for the Filters button / dialog badges. */
function countActive(f: DriveFilters): number {
  return (
    Object.values(f) as (DriveStatus[] | number[])[]
  ).filter((a) => a.length > 0).length
}

function errMsg(e: unknown, fallback: string): string {
  return e instanceof ApiError || e instanceof Error ? e.message : fallback
}

/** Read the saved view once, defensively — a stale/garbage value must not throw. */
function initialView(): ViewMode {
  if (typeof window === 'undefined') return 'table'
  return window.localStorage.getItem(VIEW_STORAGE_KEY) === 'cards'
    ? 'cards'
    : 'table'
}

export default function EmployeePlacementCoordinatorDrivesPage() {
  useEffect(() => {
    document.title = 'Drives — Placement Coordinator — Nucleus'
  }, [])

  const access = useScreenAccess(SCREEN_KEY)

  const [view, setView] = useState<ViewMode>(initialView)
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [sortBy, setSortBy] = useState<DriveSortField>('drive_date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(1)

  // Committed filters drive the fetch; the dialog edits a draft copy (below).
  const [filters, setFilters] = useState<DriveFilters>(EMPTY_FILTERS)
  const [filterOpen, setFilterOpen] = useState(false)
  const [draft, setDraft] = useState<DriveFilters>(EMPTY_FILTERS)

  // Filter option lists, loaded once. The programme / passout-year options come
  // from the coordinator's own RBAC scope — they can only narrow it.
  const [companyOpts, setCompanyOpts] = useState<Chip[]>([])
  const [offerTypeOpts, setOfferTypeOpts] = useState<Chip[]>([])
  const [placementOpts, setPlacementOpts] = useState<Chip[]>([])
  const [companyCatOpts, setCompanyCatOpts] = useState<Chip[]>([])
  const [programmeOpts, setProgrammeOpts] = useState<Chip[]>([])
  const [passoutYearOpts, setPassoutYearOpts] = useState<Chip[]>([])

  const [items, setItems] = useState<DriveListItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Debounce the search box so typing doesn't fire a request per keystroke.
  useEffect(() => {
    const t = window.setTimeout(() => {
      setDebounced(search)
      setPage(1)
    }, 300)
    return () => window.clearTimeout(t)
  }, [search])

  // Load the filter option lists once. Failures leave a facet's list empty
  // (the select shows "no options") — they must not block the drive list.
  useEffect(() => {
    let cancelled = false
    Promise.allSettled([
      getCoordinatorFilterOptions(),
      getCoordinatorScope(),
    ]).then(([options, scope]) => {
      if (cancelled) return
      if (options.status === 'fulfilled') {
        setCompanyOpts(options.value.companies)
        setOfferTypeOpts(options.value.offer_types)
        setPlacementOpts(options.value.placement_categories)
        setCompanyCatOpts(options.value.company_categories)
      }
      if (scope.status === 'fulfilled') {
        setProgrammeOpts(scope.value.programmes)
        setPassoutYearOpts(
          scope.value.passout_years.map((y) => ({ id: y, name: String(y) })),
        )
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Array refs aren't stable deps, so refetch off a serialized key instead.
  const filtersKey = JSON.stringify(filters)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const undef = <T,>(a: T[]) => (a.length ? a : undefined)
    listCoordinatorDrives({
      search: debounced || undefined,
      statuses: undef(filters.statuses),
      company_ids: undef(filters.companyIds),
      offer_type_ids: undef(filters.offerTypeIds),
      placement_category_ids: undef(filters.placementCategoryIds),
      company_category_ids: undef(filters.companyCategoryIds),
      programme_ids: undef(filters.programmeIds),
      passout_years: undef(filters.passoutYears),
      sort_by: sortBy,
      sort_dir: sortDir,
      page,
      limit: PAGE_SIZE,
    })
      .then((res) => {
        if (cancelled) return
        setItems(res.items)
        setTotal(res.total)
        setError(null)
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(errMsg(e, 'Could not load drives.'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced, filtersKey, sortBy, sortDir, page])

  const changeView = (next: ViewMode) => {
    setView(next)
    window.localStorage.setItem(VIEW_STORAGE_KEY, next)
  }

  const toggleSort = useCallback(
    (field: DriveSortField) => {
      if (sortBy === field) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
      } else {
        setSortBy(field)
        setSortDir('asc')
      }
      setPage(1)
    },
    [sortBy],
  )

  const openFilters = () => {
    setDraft(filters)
    setFilterOpen(true)
  }
  const applyFilters = () => {
    setPage(1)
    setFilters(draft)
    setFilterOpen(false)
  }
  const clearDraft = () => setDraft(EMPTY_FILTERS)
  const patchDraft = <K extends keyof DriveFilters>(
    key: K,
    value: DriveFilters[K],
  ) => setDraft((f) => ({ ...f, [key]: value }))

  // Removing a chip clears that whole facet against the committed filters,
  // which changes `filtersKey` and refetches immediately.
  const clearFacet = (key: keyof DriveFilters) => {
    setPage(1)
    setFilters((f) => ({ ...f, [key]: [] }))
  }
  const clearAllFilters = () => {
    setPage(1)
    setFilters(EMPTY_FILTERS)
  }

  const activeCount = countActive(filters)
  const draftCount = countActive(draft)
  const draftDirty = JSON.stringify(draft) !== filtersKey

  // One grouped chip per active facet, ids resolved to names. Ids whose option
  // list hasn't loaded yet are skipped rather than shown as a bare number.
  const idChip = (
    key: keyof DriveFilters,
    label: string,
    ids: number[],
    opts: Chip[],
  ) => {
    const names = ids
      .map((id) => opts.find((o) => o.id === id)?.name)
      .filter((n): n is string => Boolean(n))
    if (names.length === 0) return null
    return { id: key, label, values: names, onClear: () => clearFacet(key) }
  }
  const appliedChips = [
    filters.statuses.length > 0
      ? {
          id: 'statuses',
          label: 'Status',
          values: filters.statuses.map((s) => DRIVE_STATUS_LABELS[s]),
          onClear: () => clearFacet('statuses'),
        }
      : null,
    idChip('programmeIds', 'Programme', filters.programmeIds, programmeOpts),
    idChip('passoutYears', 'Passout year', filters.passoutYears, passoutYearOpts),
    idChip('companyIds', 'Company', filters.companyIds, companyOpts),
    idChip('offerTypeIds', 'Offer type', filters.offerTypeIds, offerTypeOpts),
    idChip(
      'placementCategoryIds',
      'Placement category',
      filters.placementCategoryIds,
      placementOpts,
    ),
    idChip(
      'companyCategoryIds',
      'Company category',
      filters.companyCategoryIds,
      companyCatOpts,
    ),
  ].filter((c): c is AppliedFacet => c !== null)

  if (!access) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <NoAccessEmptyState />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <UserCheck className="size-5 text-muted-foreground" />
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Drives</h1>
            <p className="text-sm text-muted-foreground">
              Placement drives open to your programmes and passout years.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-56 flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search drives or companies…"
              className="pl-8"
            />
          </div>

          <Button
            variant={activeCount > 0 ? 'default' : 'outline'}
            onClick={openFilters}
          >
            <SlidersHorizontal className="size-4" />
            Filters
            {activeCount > 0 && (
              <Badge variant="secondary" className="ml-1">
                {activeCount}
              </Badge>
            )}
          </Button>

          <div className="inline-flex overflow-hidden rounded-md border bg-background text-xs">
            <ViewButton
              active={view === 'table'}
              onClick={() => changeView('table')}
              icon={List}
              label="Table"
            />
            <ViewButton
              active={view === 'cards'}
              onClick={() => changeView('cards')}
              icon={LayoutGrid}
              label="Cards"
              bordered
            />
          </div>
        </div>

        {appliedChips.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              Filters · {activeCount}
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              {appliedChips.map((chip) => (
                <AppliedFilterChip key={chip.id} {...chip} />
              ))}
            </div>
            <button
              type="button"
              onClick={clearAllFilters}
              className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="size-3" /> Clear all
            </button>
          </div>
        )}
      </div>

      <Dialog open={filterOpen} onOpenChange={setFilterOpen}>
        <DialogContent className="flex max-h-[85vh] w-[calc(100vw-2rem)] max-w-3xl flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="border-b px-6 py-4">
            <DialogTitle className="flex items-center gap-2">
              Filters
              {draftCount > 0 && <Badge variant="secondary">{draftCount}</Badge>}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
            <FilterField label="Status">
              <EnumChips
                options={DRIVE_STATUSES}
                selected={draft.statuses}
                onChange={(v) => patchDraft('statuses', v as DriveStatus[])}
                format={(s) => DRIVE_STATUS_LABELS[s as DriveStatus]}
              />
            </FilterField>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FilterField label="Programme (your scope)">
                <SearchableMultiSelect
                  options={programmeOpts}
                  selected={draft.programmeIds}
                  onChange={(v) => patchDraft('programmeIds', v)}
                  placeholder="Any of your programmes"
                />
              </FilterField>
              <FilterField label="Passout year (your scope)">
                <SearchableMultiSelect
                  options={passoutYearOpts}
                  selected={draft.passoutYears}
                  onChange={(v) => patchDraft('passoutYears', v)}
                  placeholder="Any of your passout years"
                />
              </FilterField>
              <FilterField label="Company">
                <SearchableMultiSelect
                  options={companyOpts}
                  selected={draft.companyIds}
                  onChange={(v) => patchDraft('companyIds', v)}
                  placeholder="Any company"
                />
              </FilterField>
              <FilterField label="Offer type">
                <SearchableMultiSelect
                  options={offerTypeOpts}
                  selected={draft.offerTypeIds}
                  onChange={(v) => patchDraft('offerTypeIds', v)}
                  placeholder="Any offer type"
                />
              </FilterField>
              <FilterField label="Placement category">
                <SearchableMultiSelect
                  options={placementOpts}
                  selected={draft.placementCategoryIds}
                  onChange={(v) => patchDraft('placementCategoryIds', v)}
                  placeholder="Any placement category"
                />
              </FilterField>
              <FilterField label="Company category">
                <SearchableMultiSelect
                  options={companyCatOpts}
                  selected={draft.companyCategoryIds}
                  onChange={(v) => patchDraft('companyCategoryIds', v)}
                  placeholder="Any company category"
                />
              </FilterField>
            </div>
          </div>

          <DialogFooter className="flex-row justify-between border-t px-6 py-4">
            <Button
              variant="ghost"
              onClick={clearDraft}
              disabled={draftCount === 0}
            >
              <X className="size-4" /> Clear all
            </Button>
            <Button onClick={applyFilters} disabled={!draftDirty}>
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {error ? (
        <div className="rounded-xl border bg-card p-8 text-center text-sm text-destructive">
          {error}
        </div>
      ) : loading ? (
        <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
          Loading drives…
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border bg-card p-10 text-center">
          <p className="text-sm font-medium">No drives in your scope</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {debounced || activeCount > 0
              ? 'No drive matches those filters.'
              : 'No drive is currently open to your programmes and passout years.'}
          </p>
        </div>
      ) : view === 'table' ? (
        <DriveTable
          items={items}
          sortBy={sortBy}
          sortDir={sortDir}
          onSort={toggleSort}
          onOpen={(id) => employeeNavigateTo(`${LIST_ROUTE}/${id}`)}
        />
      ) : (
        <DriveCards
          items={items}
          onOpen={(id) => employeeNavigateTo(`${LIST_ROUTE}/${id}`)}
        />
      )}

      {!loading && !error && total > PAGE_SIZE && (
        <Pagination
          page={page}
          totalPages={Math.ceil(total / PAGE_SIZE)}
          onPage={setPage}
        />
      )}
    </div>
  )
}

function ViewButton({
  active,
  onClick,
  icon: Icon,
  label,
  bordered,
}: {
  active: boolean
  onClick: () => void
  icon: typeof List
  label: string
  bordered?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex items-center gap-1 px-2.5 py-1.5 transition-colors',
        bordered && 'border-l',
        active
          ? 'bg-primary/10 text-primary'
          : 'text-muted-foreground hover:bg-accent/40',
      )}
    >
      <Icon className="size-3.5" /> {label}
    </button>
  )
}

/** The package as one line, whichever side of the scope switch it sits on. */
function packageLabel(d: DriveListItem): string {
  if (!d.offer_type) return 'Per designation'
  return d.offer_type.name
}

function DriveTable({
  items,
  sortBy,
  sortDir,
  onSort,
  onOpen,
}: {
  items: DriveListItem[]
  sortBy: DriveSortField
  sortDir: 'asc' | 'desc'
  onSort: (f: DriveSortField) => void
  onOpen: (id: number) => void
}) {
  return (
    <div className="min-h-[62vh] rounded-xl border bg-card">
      <Table containerClassName="max-h-[62vh] overflow-y-auto">
        <TableHeader className="sticky top-0 z-10 bg-card">
          <TableRow>
            <TableHead className="w-12" />
            <SortableHead
              field="drive_name"
              label="Drive"
              sortBy={sortBy}
              sortDir={sortDir}
              onSort={onSort}
            />
            <SortableHead
              field="company_name"
              label="Company"
              sortBy={sortBy}
              sortDir={sortDir}
              onSort={onSort}
            />
            <TableHead>Designations</TableHead>
            <TableHead>Offer type</TableHead>
            <TableHead>Status</TableHead>
            <SortableHead
              field="drive_date"
              label="Drive date"
              sortBy={sortBy}
              sortDir={sortDir}
              onSort={onSort}
            />
            <SortableHead
              field="registration_end_date"
              label="Registration ends"
              sortBy={sortBy}
              sortDir={sortDir}
              onSort={onSort}
            />
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((d) => (
            <TableRow key={d.id}>
              <TableCell>
                <CompanyLogo name={d.company.name} logoUrl={d.company.logo_url} />
              </TableCell>
              <TableCell>
                <button
                  type="button"
                  onClick={() => onOpen(d.id)}
                  className="text-left font-medium hover:underline"
                >
                  {d.drive_name}
                </button>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {d.company.name}
              </TableCell>
              <TableCell>
                <span className="text-sm">
                  {d.designation_count === 1
                    ? d.designations[0]?.name
                    : `${d.designation_count} designations`}
                </span>
              </TableCell>
              <TableCell>
                <Badge variant="muted">{packageLabel(d)}</Badge>
              </TableCell>
              <TableCell>
                <Badge variant={driveStatusVariant(d.status)}>
                  {DRIVE_STATUS_LABELS[d.status]}
                </Badge>
              </TableCell>
              <TableCell>{formatDate(d.drive_date)}</TableCell>
              <TableCell>{formatDateTime(d.registration_end_date)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function SortableHead({
  field,
  label,
  sortBy,
  sortDir,
  onSort,
}: {
  field: DriveSortField
  label: string
  sortBy: DriveSortField
  sortDir: 'asc' | 'desc'
  onSort: (f: DriveSortField) => void
}) {
  const active = sortBy === field
  const Icon = !active ? ArrowUpDown : sortDir === 'asc' ? ArrowUp : ArrowDown
  return (
    <TableHead>
      <button
        type="button"
        onClick={() => onSort(field)}
        className={cn(
          'inline-flex items-center gap-1 transition-colors hover:text-foreground',
          active ? 'text-foreground' : 'text-muted-foreground',
        )}
      >
        {label} <Icon className="size-3" />
      </button>
    </TableHead>
  )
}

function DriveCards({
  items,
  onOpen,
}: {
  items: DriveListItem[]
  onOpen: (id: number) => void
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((d) => (
        <div
          key={d.id}
          className="flex flex-col gap-3 rounded-xl border bg-card p-4 transition-shadow hover:shadow-sm"
        >
          <div className="flex items-start gap-3">
            <CompanyLogo
              name={d.company.name}
              logoUrl={d.company.logo_url}
              className="size-11 shrink-0"
            />
            <div className="min-w-0 flex-1">
              <button
                type="button"
                onClick={() => onOpen(d.id)}
                className="line-clamp-2 text-left font-medium hover:underline"
              >
                {d.drive_name}
              </button>
              <p className="truncate text-sm text-muted-foreground">
                {d.company.name}
              </p>
            </div>
            <Badge variant={driveStatusVariant(d.status)}>
              {DRIVE_STATUS_LABELS[d.status]}
            </Badge>
          </div>

          <div className="flex flex-wrap gap-1.5">
            <Badge variant="muted">{packageLabel(d)}</Badge>
            <Badge variant="muted">
              {d.designation_count === 1
                ? d.designations[0]?.name
                : `${d.designation_count} designations`}
            </Badge>
            {d.placement_categories.map((c) => (
              <Badge key={c.id} variant="muted">
                {c.name}
              </Badge>
            ))}
          </div>

          <dl className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Drive date</dt>
              <dd>{formatDate(d.drive_date)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Registration ends</dt>
              <dd>{formatDateTime(d.registration_end_date)}</dd>
            </div>
          </dl>
        </div>
      ))}
    </div>
  )
}
