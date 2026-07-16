import { useSearch } from '@tanstack/react-router'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Building2,
  Loader2,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Pagination } from '@/components/ui/pagination'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { NoAccessEmptyState } from '@/components/employee/empty-states'
import { CompanyDetail } from '@/components/corporate-relations/company-detail'
import {
  NativeSelect,
  SearchableMultiSelect,
  formatDate,
  relationshipVariant,
  titleCase,
} from '@/components/corporate-relations/bits'
import { cn } from '@/lib/utils'
import { useScreenAccess } from '@/hooks/use-screen-access'
import {
  getAssignableEmployees,
  getFormOptions,
  listCompanies,
  setCompanyStatus,
  type AssignableEmployee,
  type CompanyListItem,
  type CompanyListParams,
  type CompanySortField,
  type FormOptions,
} from '@/lib/corporate-relations'

const SCREEN_KEY = 'corporate_relations.company_management.manage'
const BASE_ROUTE = '/corporate-relations/company-management'

/**
 * Imperative employee-portal navigation — the dual-router setup makes the typed
 * `<Link>` reject employee-only paths. Mirrors the helper in
 * `employee-portal-layout.tsx`.
 */
function navigateTo(route: string) {
  window.history.pushState({}, '', route)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

export default function EmployeeCompanyManagementPage() {
  useEffect(() => {
    document.title = 'Company Management — Nucleus'
  }, [])

  const access = useScreenAccess(SCREEN_KEY)
  const actions = access?.actions ?? []

  const search = useSearch({ strict: false }) as { open?: number }
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  // After the full-screen create/edit form saves, it redirects back here with
  // `?open=<id>`; reopen that company's detail and strip the param so a manual
  // back/refresh doesn't re-trigger it.
  useEffect(() => {
    if (search.open) {
      setSelectedId(search.open)
      setReloadToken((n) => n + 1)
      window.history.replaceState({}, '', BASE_ROUTE)
    }
    // Run once on mount for the incoming redirect only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!access) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <NoAccessEmptyState />
      </div>
    )
  }

  if (selectedId !== null) {
    return (
      <div className="mx-auto h-full max-w-5xl">
        <CompanyDetail
          surface="management"
          companyId={selectedId}
          canEditCompany={actions.includes('edit')}
          canRecord={actions.includes('view')}
          canEditDetails={actions.includes('edit')}
          nameEditable
          onBack={() => setSelectedId(null)}
          onEditCompany={(c) => navigateTo(`${BASE_ROUTE}/${c.id}/edit`)}
          reloadToken={reloadToken}
        />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">
            Company Management
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage the recruiting-company catalog and assign officers.
          </p>
        </div>
        {actions.includes('create') && (
          <Button onClick={() => navigateTo(`${BASE_ROUTE}/new`)}>
            <Plus className="size-4" /> New company
          </Button>
        )}
      </div>

      <CompanyList
        surface="management"
        onOpen={(id) => setSelectedId(id)}
        onEditCompany={(id) => navigateTo(`${BASE_ROUTE}/${id}/edit`)}
        reloadToken={reloadToken}
        showFilters
        canEdit={actions.includes('edit')}
        canActivate={actions.includes('activate')}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Shared company list (used by both manager and officer pages)
// ---------------------------------------------------------------------------

/** Advanced (collapsible) filters beyond the always-visible search + status. */
type AdvancedFilters = {
  category_ids: number[]
  industry_ids: number[]
  type_ids: number[]
  size_ids: number[]
  source_ids: number[]
  hiring_mode_ids: number[]
  role_ids: number[]
  tag_ids: number[]
  tiers: string[]
  relationship_statuses: string[]
  ownership_types: string[]
  responsible_employee_ids: number[]
  offers_internships: boolean
  offers_ppo: boolean
}

const EMPTY_FILTERS: AdvancedFilters = {
  category_ids: [],
  industry_ids: [],
  type_ids: [],
  size_ids: [],
  source_ids: [],
  hiring_mode_ids: [],
  role_ids: [],
  tag_ids: [],
  tiers: [],
  relationship_statuses: [],
  ownership_types: [],
  responsible_employee_ids: [],
  offers_internships: false,
  offers_ppo: false,
}

function packageLabel(min: string | null, max: string | null): string {
  const lo = min == null ? null : Number(min)
  const hi = max == null ? null : Number(max)
  if (lo == null && hi == null) return '—'
  if (lo != null && hi != null)
    return lo === hi ? `${lo} LPA` : `${lo}–${hi} LPA`
  return `${(lo ?? hi) as number} LPA`
}

function companyInitials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('') || '?'
  )
}

/** Small toggle-chip multi-select over a fixed string enum (tiers, …). */
function EnumChips({
  options,
  selected,
  onChange,
  format = titleCase,
}: {
  options: string[]
  selected: string[]
  onChange: (v: string[]) => void
  format?: (s: string) => string
}) {
  if (options.length === 0) {
    return <p className="text-xs text-muted-foreground">—</p>
  }
  const toggle = (v: string) =>
    onChange(
      selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v],
    )
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = selected.includes(o)
        return (
          <button
            key={o}
            type="button"
            aria-pressed={on}
            onClick={() => toggle(o)}
            className={cn(
              'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
              on
                ? 'border-primary bg-primary text-primary-foreground'
                : 'bg-card hover:bg-accent hover:text-accent-foreground',
            )}
          >
            {format(o)}
          </button>
        )
      })}
    </div>
  )
}

/** A labelled block in the filter / edit grids. */
function FilterField({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      {children}
    </div>
  )
}

/** A titled group of fields inside the filter sheet. */
function FilterSection({
  title,
  children,
  className,
}: {
  title: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('space-y-3 border-t pt-4 first:border-t-0 first:pt-0', className)}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      {children}
    </div>
  )
}

// The id-based classifier facets, in display order. `source` picks the matching
// option list off `FormOptions` so a selected id can be resolved to its name for
// the applied-filter chips. `responsible_employee_ids` is handled separately
// (its options come from the officers endpoint, management surface only).
type IdFacetKey =
  | 'industry_ids'
  | 'category_ids'
  | 'type_ids'
  | 'size_ids'
  | 'source_ids'
  | 'hiring_mode_ids'
  | 'role_ids'
  | 'tag_ids'
const ID_FACETS: {
  key: IdFacetKey
  label: string
  source: (o: FormOptions) => { id: number; name: string }[]
}[] = [
  { key: 'industry_ids', label: 'Industry', source: (o) => o.industries },
  { key: 'category_ids', label: 'Category', source: (o) => o.categories },
  { key: 'type_ids', label: 'Type', source: (o) => o.types },
  { key: 'size_ids', label: 'Size', source: (o) => o.sizes },
  { key: 'source_ids', label: 'Source', source: (o) => o.sources },
  { key: 'hiring_mode_ids', label: 'Hiring mode', source: (o) => o.hiring_modes },
  { key: 'role_ids', label: 'Role', source: (o) => o.roles },
  { key: 'tag_ids', label: 'Tag', source: (o) => o.tags },
]

// The fixed-enum (string) facets and how to render each value in a chip.
type EnumFacetKey = 'tiers' | 'relationship_statuses' | 'ownership_types'
const ENUM_FACETS: {
  key: EnumFacetKey
  label: string
  format: (s: string) => string
}[] = [
  { key: 'tiers', label: 'Tier', format: (s) => s.toUpperCase() },
  { key: 'relationship_statuses', label: 'Relationship', format: titleCase },
  { key: 'ownership_types', label: 'Ownership', format: titleCase },
]

// The boolean facets and their chip labels.
const BOOL_FACETS: { key: 'offers_internships' | 'offers_ppo'; label: string }[] = [
  { key: 'offers_internships', label: 'Offers internships' },
  { key: 'offers_ppo', label: 'Offers PPO' },
]

/** One grouped, removable applied-filter chip (a whole facet). */
type AppliedFacetChip = {
  /** Stable react key — the facet key. */
  id: string
  /** Facet label, e.g. "Industry". */
  label: string
  /** Resolved value names; empty for a boolean facet (label only). */
  values: string[]
  /** Clears the whole facet. */
  onClear: () => void
}

/** A grouped pill used in the applied-filters row (facet + its values). */
function AppliedFilterChip({ label, values, onClear }: AppliedFacetChip) {
  const shown = values.slice(0, 2)
  const overflow = values.length - shown.length
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border bg-muted py-1 pl-2.5 pr-1 text-xs">
      <span className="min-w-0 truncate">
        <span className="font-medium text-foreground">{label}</span>
        {values.length > 0 && (
          <>
            <span className="text-muted-foreground">: </span>
            <span className="font-medium text-foreground">
              {shown.join(', ')}
            </span>
            {overflow > 0 && (
              <span className="text-muted-foreground"> +{overflow}</span>
            )}
          </>
        )}
      </span>
      <button
        type="button"
        onClick={onClear}
        className="flex size-4 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground"
        aria-label={`Remove ${label} filter`}
      >
        <X className="size-3" />
      </button>
    </span>
  )
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
  field: CompanySortField
  sort: { by: CompanySortField; dir: 'asc' | 'desc' } | null
  onToggle: (field: CompanySortField) => void
  className?: string
}) {
  const active = sort?.by === field
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

export function CompanyList({
  surface,
  onOpen,
  onEditCompany,
  reloadToken = 0,
  showFilters = false,
  canEdit = false,
  canActivate = false,
}: {
  surface: 'management' | 'companies'
  onOpen: (id: number) => void
  onEditCompany?: (id: number) => void
  reloadToken?: number
  showFilters?: boolean
  canEdit?: boolean
  canActivate?: boolean
}) {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<'active' | 'inactive' | 'all'>('active')
  const [filters, setFilters] = useState<AdvancedFilters>(EMPTY_FILTERS)
  const [filterOpen, setFilterOpen] = useState(false)
  const [draftFilters, setDraftFilters] = useState<AdvancedFilters>(EMPTY_FILTERS)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(25)
  // `null` = server default order (updated_at desc); a value = an active header sort.
  const [sort, setSort] = useState<{
    by: CompanySortField
    dir: 'asc' | 'desc'
  } | null>(null)
  const [localReload, setLocalReload] = useState(0)
  const [data, setData] = useState<{
    items: CompanyListItem[]
    total: number
    limit: number
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Option lists for filters + inline editing.
  const [options, setOptions] = useState<FormOptions | null>(null)
  const [officers, setOfficers] = useState<AssignableEmployee[]>([])

  // Status toggle state.
  const [busyStatusId, setBusyStatusId] = useState<number | null>(null)

  const canFilter = showFilters
  const wantsOptions = showFilters

  useEffect(() => {
    if (!wantsOptions) return
    let cancelled = false
    getFormOptions(surface)
      .then((o) => !cancelled && setOptions(o))
      .catch(() => {})
    // Assignable officers are a manager-only endpoint.
    if (surface === 'management') {
      getAssignableEmployees()
        .then((e) => !cancelled && setOfficers(e))
        .catch(() => {})
    }
    return () => {
      cancelled = true
    }
  }, [surface, wantsOptions])

  const filtersKey = JSON.stringify(filters)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    const params: CompanyListParams = {
      search: search || undefined,
      status,
      page,
      limit,
      category_ids: filters.category_ids,
      industry_ids: filters.industry_ids,
      type_ids: filters.type_ids,
      size_ids: filters.size_ids,
      source_ids: filters.source_ids,
      hiring_mode_ids: filters.hiring_mode_ids,
      role_ids: filters.role_ids,
      tag_ids: filters.tag_ids,
      tiers: filters.tiers,
      relationship_statuses: filters.relationship_statuses,
      ownership_types: filters.ownership_types,
      responsible_employee_ids: filters.responsible_employee_ids,
      offers_internships: filters.offers_internships || undefined,
      offers_ppo: filters.offers_ppo || undefined,
      sort_by: sort?.by,
      sort_dir: sort?.dir,
    }
    listCompanies(surface, params)
      .then((r) => {
        if (!cancelled) setData(r)
      })
      .catch((e) => {
        if (!cancelled)
          setError(e instanceof Error ? e.message : 'Could not load companies.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // `filtersKey` is a stable JSON snapshot of the whole `filters` object.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    surface,
    search,
    status,
    page,
    limit,
    sort,
    filtersKey,
    reloadToken,
    localReload,
  ])

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1

  const activeFilterCount = [
    filters.category_ids,
    filters.industry_ids,
    filters.type_ids,
    filters.size_ids,
    filters.source_ids,
    filters.hiring_mode_ids,
    filters.role_ids,
    filters.tag_ids,
    filters.tiers,
    filters.relationship_statuses,
    filters.ownership_types,
    filters.responsible_employee_ids,
  ].filter((a) => a.length > 0).length +
    (filters.offers_internships ? 1 : 0) +
    (filters.offers_ppo ? 1 : 0)

  // Filters live behind an Apply — the sheet edits a draft so the list doesn't
  // refetch on every selection while the user is still choosing.
  function patchDraft<K extends keyof AdvancedFilters>(
    key: K,
    value: AdvancedFilters[K],
  ) {
    setDraftFilters((f) => ({ ...f, [key]: value }))
  }

  function openFilters() {
    setDraftFilters(filters)
    setFilterOpen(true)
  }

  function applyFilters() {
    setPage(1)
    setFilters(draftFilters)
    setFilterOpen(false)
  }

  function clearDraft() {
    setDraftFilters(EMPTY_FILTERS)
  }

  // Clicking the active column flips direction; a new column starts at its
  // natural default (A→Z for names, high→low for package/recency).
  function toggleSort(field: CompanySortField) {
    setPage(1)
    setSort((cur) => {
      if (cur?.by === field) {
        return { by: field, dir: cur.dir === 'asc' ? 'desc' : 'asc' }
      }
      return { by: field, dir: field === 'name' ? 'asc' : 'desc' }
    })
  }

  // Removing a chip applies instantly against the committed filters (clears the
  // whole facet) — this changes `filtersKey` and refetches.
  function clearArrayFacet(
    key: IdFacetKey | 'responsible_employee_ids' | EnumFacetKey,
  ) {
    setPage(1)
    setFilters((f) => ({ ...f, [key]: [] }))
  }
  function clearBool(key: 'offers_internships' | 'offers_ppo') {
    setPage(1)
    setFilters((f) => ({ ...f, [key]: false }))
  }
  function clearAllFilters() {
    setPage(1)
    setFilters(EMPTY_FILTERS)
  }

  // One grouped chip per active facet, values resolved to names. Ids whose option
  // lists haven't loaded yet are skipped rather than shown as a bare number.
  const appliedChips: AppliedFacetChip[] = []
  if (options) {
    for (const facet of ID_FACETS) {
      const ids = filters[facet.key]
      if (ids.length === 0) continue
      const opts = facet.source(options)
      const names = ids
        .map((id) => opts.find((o) => o.id === id)?.name)
        .filter((n): n is string => Boolean(n))
      if (names.length === 0) continue
      appliedChips.push({
        id: facet.key,
        label: facet.label,
        values: names,
        onClear: () => clearArrayFacet(facet.key),
      })
    }
  }
  if (surface === 'management' && filters.responsible_employee_ids.length > 0) {
    const names = filters.responsible_employee_ids
      .map((id) => officers.find((o) => o.id === id)?.name)
      .filter((n): n is string => Boolean(n))
    if (names.length > 0) {
      appliedChips.push({
        id: 'responsible_employee_ids',
        label: 'Officer',
        values: names,
        onClear: () => clearArrayFacet('responsible_employee_ids'),
      })
    }
  }
  for (const facet of ENUM_FACETS) {
    const values = filters[facet.key]
    if (values.length === 0) continue
    appliedChips.push({
      id: facet.key,
      label: facet.label,
      values: values.map(facet.format),
      onClear: () => clearArrayFacet(facet.key),
    })
  }
  for (const facet of BOOL_FACETS) {
    if (filters[facet.key]) {
      appliedChips.push({
        id: facet.key,
        label: facet.label,
        values: [],
        onClear: () => clearBool(facet.key),
      })
    }
  }

  // Whether the draft differs from the committed filters — drives the Apply button.
  const draftDirty = JSON.stringify(draftFilters) !== filtersKey
  // Live count of facets selected in the draft (mirrors `activeFilterCount`).
  const draftFilterCount = [
    draftFilters.category_ids,
    draftFilters.industry_ids,
    draftFilters.type_ids,
    draftFilters.size_ids,
    draftFilters.source_ids,
    draftFilters.hiring_mode_ids,
    draftFilters.role_ids,
    draftFilters.tag_ids,
    draftFilters.tiers,
    draftFilters.relationship_statuses,
    draftFilters.ownership_types,
    draftFilters.responsible_employee_ids,
  ].filter((a) => a.length > 0).length +
    (draftFilters.offers_internships ? 1 : 0) +
    (draftFilters.offers_ppo ? 1 : 0)

  async function toggleActive(row: CompanyListItem) {
    setBusyStatusId(row.id)
    try {
      await setCompanyStatus(row.id, !row.is_active)
      toast.success(row.is_active ? 'Company deactivated.' : 'Company activated.')
      setLocalReload((n) => n + 1)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not update status.')
    } finally {
      setBusyStatusId(null)
    }
  }

  return (
    <div className="space-y-3">
      {canFilter && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-48 flex-1">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => {
                  setPage(1)
                  setSearch(e.target.value)
                }}
                placeholder="Search companies…"
                className="pl-8"
              />
            </div>
            <NativeSelect
              value={status}
              onChange={(e) => {
                setPage(1)
                setStatus(e.target.value as 'active' | 'inactive' | 'all')
              }}
              className="w-36"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="all">All</option>
            </NativeSelect>
            <Button
              variant={activeFilterCount > 0 ? 'default' : 'outline'}
              onClick={openFilters}
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
                onClick={clearAllFilters}
                className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="size-3" /> Clear all
              </button>
            </div>
          )}
        </div>
      )}

      <Dialog open={filterOpen} onOpenChange={setFilterOpen}>
        <DialogContent className="flex max-h-[85vh] w-[calc(100vw-2rem)] max-w-4xl flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="border-b px-6 py-4">
            <DialogTitle className="flex items-center gap-2">
              Filters
              {draftFilterCount > 0 && (
                <Badge variant="secondary">{draftFilterCount}</Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
            <FilterSection title="Classification">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <FilterField label="Industries">
                  <SearchableMultiSelect
                    options={options?.industries ?? []}
                    selected={draftFilters.industry_ids}
                    onChange={(v) => patchDraft('industry_ids', v)}
                    placeholder="Any industry"
                  />
                </FilterField>
                <FilterField label="Categories">
                  <SearchableMultiSelect
                    options={options?.categories ?? []}
                    selected={draftFilters.category_ids}
                    onChange={(v) => patchDraft('category_ids', v)}
                    placeholder="Any category"
                  />
                </FilterField>
                <FilterField label="Types">
                  <SearchableMultiSelect
                    options={options?.types ?? []}
                    selected={draftFilters.type_ids}
                    onChange={(v) => patchDraft('type_ids', v)}
                    placeholder="Any type"
                  />
                </FilterField>
                <FilterField label="Company size">
                  <SearchableMultiSelect
                    options={options?.sizes ?? []}
                    selected={draftFilters.size_ids}
                    onChange={(v) => patchDraft('size_ids', v)}
                    placeholder="Any size"
                  />
                </FilterField>
                <FilterField label="Tags">
                  <SearchableMultiSelect
                    options={options?.tags ?? []}
                    selected={draftFilters.tag_ids}
                    onChange={(v) => patchDraft('tag_ids', v)}
                    placeholder="Any tag"
                  />
                </FilterField>
              </div>
            </FilterSection>

            <FilterSection title="Sourcing & hiring">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <FilterField label="Sources">
                  <SearchableMultiSelect
                    options={options?.sources ?? []}
                    selected={draftFilters.source_ids}
                    onChange={(v) => patchDraft('source_ids', v)}
                    placeholder="Any source"
                  />
                </FilterField>
                <FilterField label="Hiring modes">
                  <SearchableMultiSelect
                    options={options?.hiring_modes ?? []}
                    selected={draftFilters.hiring_mode_ids}
                    onChange={(v) => patchDraft('hiring_mode_ids', v)}
                    placeholder="Any hiring mode"
                  />
                </FilterField>
                <FilterField label="Roles">
                  <SearchableMultiSelect
                    options={options?.roles ?? []}
                    selected={draftFilters.role_ids}
                    onChange={(v) => patchDraft('role_ids', v)}
                    placeholder="Any role"
                  />
                </FilterField>
              </div>
            </FilterSection>

            <FilterSection title="Status">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <FilterField label="Tier">
                  <EnumChips
                    options={options?.tiers ?? []}
                    selected={draftFilters.tiers}
                    onChange={(v) => patchDraft('tiers', v)}
                    format={(s) => s.toUpperCase()}
                  />
                </FilterField>
                <FilterField label="Relationship">
                  <EnumChips
                    options={options?.relationship_statuses ?? []}
                    selected={draftFilters.relationship_statuses}
                    onChange={(v) => patchDraft('relationship_statuses', v)}
                  />
                </FilterField>
                <FilterField label="Ownership">
                  <EnumChips
                    options={options?.ownership_types ?? []}
                    selected={draftFilters.ownership_types}
                    onChange={(v) => patchDraft('ownership_types', v)}
                  />
                </FilterField>
              </div>
            </FilterSection>

            <FilterSection title="Offerings">
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={draftFilters.offers_internships}
                    onCheckedChange={(v) => patchDraft('offers_internships', v)}
                  />
                  Offers internships
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={draftFilters.offers_ppo}
                    onCheckedChange={(v) => patchDraft('offers_ppo', v)}
                  />
                  Offers PPO
                </label>
              </div>
            </FilterSection>

            {surface === 'management' && (
              <FilterSection title="Assignment">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <FilterField label="Responsible officer">
                    <SearchableMultiSelect
                      options={officers.map((o) => ({ id: o.id, name: o.name }))}
                      selected={draftFilters.responsible_employee_ids}
                      onChange={(v) => patchDraft('responsible_employee_ids', v)}
                      placeholder="Any officer"
                    />
                  </FilterField>
                </div>
              </FilterSection>
            )}
          </div>

          <DialogFooter className="flex-row justify-between border-t px-6 py-4">
            <Button
              variant="ghost"
              onClick={clearDraft}
              disabled={draftFilterCount === 0}
            >
              <X className="size-4" /> Clear all
            </Button>
            <Button onClick={applyFilters} disabled={!draftDirty}>
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {loading && !data ? (
        <div className="flex min-h-[62vh] items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 size-4 animate-spin" /> Loading…
        </div>
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : !data || data.items.length === 0 ? (
        <div className="flex min-h-[62vh] flex-col items-center justify-center rounded-xl border border-dashed bg-muted/20 px-6 py-14 text-center">
          <Building2 className="mb-2 size-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No companies found.</p>
        </div>
      ) : (
        <div className="min-h-[62vh] overflow-hidden rounded-xl border bg-card">
          <Table containerClassName="max-h-[62vh] overflow-y-auto">
            <TableHeader>
              <TableRow className="sticky top-0 z-10 [&>th]:bg-card">
                <TableHead className="w-10"></TableHead>
                <SortableHead
                  label="Company"
                  field="name"
                  sort={sort}
                  onToggle={toggleSort}
                />
                <SortableHead
                  label="Tier"
                  field="tier"
                  sort={sort}
                  onToggle={toggleSort}
                />
                <SortableHead
                  label="Relationship"
                  field="relationship_status"
                  sort={sort}
                  onToggle={toggleSort}
                />
                <TableHead>Officer</TableHead>
                <TableHead>Industries</TableHead>
                <SortableHead
                  label="Package"
                  field="package"
                  sort={sort}
                  onToggle={toggleSort}
                />
                <SortableHead
                  label="Engaged"
                  field="last_engaged_on"
                  sort={sort}
                  onToggle={toggleSort}
                />
                {canActivate && <TableHead>Active</TableHead>}
                {canEdit && <TableHead className="w-10"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((c) => (
                <TableRow key={c.id}>
                    <TableCell>
                      {c.logo_url ? (
                        <img
                          src={c.logo_url}
                          alt=""
                          className="size-8 rounded-md border object-contain"
                        />
                      ) : (
                        <div className="flex size-8 items-center justify-center rounded-md border bg-muted text-[10px] font-semibold text-muted-foreground">
                          {companyInitials(c.name)}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <button
                        type="button"
                        onClick={() => onOpen(c.id)}
                        className="text-left"
                      >
                        <span className="flex flex-wrap items-center gap-1.5 text-sm font-medium hover:underline">
                          {c.name}
                          {!c.is_active && (
                            <Badge variant="destructive">Inactive</Badge>
                          )}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                          {[c.short_name, c.city].filter(Boolean).join(' · ') ||
                            '—'}
                        </span>
                      </button>
                    </TableCell>
                    <TableCell>
                      {c.tier ? (
                        <Badge variant="outline">{c.tier.toUpperCase()}</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={relationshipVariant(c.relationship_status)}>
                        {titleCase(c.relationship_status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      {c.responsible_employee?.name ?? (
                        <span className="text-muted-foreground">Unassigned</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {c.industries.length > 0 ? (
                        <div className="flex max-w-52 flex-wrap gap-1">
                          {c.industries.slice(0, 2).map((i) => (
                            <Badge key={i.id} variant="muted">
                              {i.name}
                            </Badge>
                          ))}
                          {c.industries.length > 2 && (
                            <Badge variant="muted">
                              +{c.industries.length - 2}
                            </Badge>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      {packageLabel(c.package_min, c.package_max)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {c.last_engaged_on
                        ? formatDate(c.last_engaged_on)
                        : 'No activity'}
                    </TableCell>
                    {canActivate && (
                      <TableCell>
                        <Switch
                          checked={c.is_active}
                          disabled={busyStatusId === c.id}
                          onCheckedChange={() => void toggleActive(c)}
                        />
                      </TableCell>
                    )}
                    {canEdit && (
                      <TableCell>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-8"
                          aria-label="Edit company"
                          onClick={() => onEditCompany?.(c.id)}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {data && data.items.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <div className="flex items-center gap-3">
            <span className="text-muted-foreground">
              {data.total} {data.total === 1 ? 'company' : 'companies'}
            </span>
            <label className="flex items-center gap-1.5 text-muted-foreground">
              <span>Rows:</span>
              <NativeSelect
                className="h-8 w-auto"
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value))
                  setPage(1)
                }}
              >
                {[10, 25, 50, 100].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </NativeSelect>
            </label>
          </div>
          <Pagination page={page} totalPages={totalPages} onPage={setPage} />
        </div>
      )}
    </div>
  )
}

