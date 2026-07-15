import { useSearch } from '@tanstack/react-router'
import {
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
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
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
  const [filterSheetOpen, setFilterSheetOpen] = useState(false)
  const [draftFilters, setDraftFilters] = useState<AdvancedFilters>(EMPTY_FILTERS)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(25)
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
  }, [surface, search, status, page, limit, filtersKey, reloadToken, localReload])

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
    setFilterSheetOpen(true)
  }

  function applyFilters() {
    setPage(1)
    setFilters(draftFilters)
    setFilterSheetOpen(false)
  }

  function clearDraft() {
    setDraftFilters(EMPTY_FILTERS)
  }

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
        </div>
      )}

      <Sheet open={filterSheetOpen} onOpenChange={setFilterSheetOpen}>
        <SheetContent side="right" className="w-full gap-0 sm:max-w-md">
          <SheetHeader className="border-b">
            <SheetTitle>Filters</SheetTitle>
          </SheetHeader>

          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
            <div className="grid grid-cols-1 gap-4">
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
              <FilterField label="Tags">
                <SearchableMultiSelect
                  options={options?.tags ?? []}
                  selected={draftFilters.tag_ids}
                  onChange={(v) => patchDraft('tag_ids', v)}
                  placeholder="Any tag"
                />
              </FilterField>
              {surface === 'management' && (
                <FilterField label="Responsible officer">
                  <SearchableMultiSelect
                    options={officers.map((o) => ({ id: o.id, name: o.name }))}
                    selected={draftFilters.responsible_employee_ids}
                    onChange={(v) =>
                      patchDraft('responsible_employee_ids', v)
                    }
                    placeholder="Any officer"
                  />
                </FilterField>
              )}
            </div>

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

            <div className="flex flex-wrap gap-4 pt-1">
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
          </div>

          <SheetFooter className="flex-row justify-between border-t">
            <Button variant="ghost" onClick={clearDraft}>
              <X className="size-4" /> Clear all
            </Button>
            <Button onClick={applyFilters}>Apply</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

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
                <TableHead>Company</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead>Relationship</TableHead>
                <TableHead>Officer</TableHead>
                <TableHead>Industries</TableHead>
                <TableHead>Package</TableHead>
                <TableHead>Engaged</TableHead>
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

