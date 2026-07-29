import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Building2,
  ExternalLink,
  Loader2,
  Pencil,
  Plus,
  Search,
} from 'lucide-react'
import { useEffect, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import { CompanyRequestDialog } from '@/components/requests/company-request-dialog'
import {
  ChipRow,
  CompanyLogo,
  NativeSelect,
  SearchableMultiSelect,
  formatDate,
} from '@/components/corporate-relations/bits'
import { useScreenAccess } from '@/hooks/use-screen-access'
import {
  getFormOptions,
  listCompanies,
  type CompanyApprovalStatus,
  type CompanyJobRole,
  type CompanyListItem,
  type CompanyListParams,
  type CompanySortField,
  type FormOptions,
} from '@/lib/corporate-relations'

const SCREEN_KEY = 'corporate_relations.company_management.manage'
const BASE_ROUTE = '/corporate-relations/company-management'

type StatusFilter = 'all' | 'active' | 'inactive' | 'pending'
type ApprovalFilter = 'all' | CompanyApprovalStatus

const APPROVAL_BADGE: Record<
  CompanyApprovalStatus,
  { label: string; variant: 'success' | 'warning' | 'destructive' }
> = {
  approved: { label: 'Approved', variant: 'success' },
  pending: { label: 'Awaiting approval', variant: 'warning' },
  rejected: { label: 'Rejected', variant: 'destructive' },
}

/** Job roles as `role — owner` chips, two deep with an overflow count. */
function RolesCell({ roles }: { roles: CompanyJobRole[] }) {
  if (roles.length === 0) {
    return <span className="text-xs text-muted-foreground">—</span>
  }
  const shown = roles.slice(0, 2)
  const overflow = roles.length - shown.length
  return (
    <div className="flex max-w-64 flex-wrap gap-1">
      {shown.map((r) => (
        <Badge key={r.id} variant="muted" className="max-w-full">
          <span className="truncate">
            {r.role_name}
            {r.responsible_employee
              ? ` — ${r.responsible_employee.emp_display_name}`
              : ''}
          </span>
        </Badge>
      ))}
      {overflow > 0 && <Badge variant="muted">+{overflow}</Badge>}
    </div>
  )
}

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
        <div>
          <h1 className="text-lg font-semibold tracking-tight">
            Company Management
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage the recruiting-company catalog.
          </p>
        </div>
        {actions.includes('create') && (
          <Button onClick={() => navigateTo(`${BASE_ROUTE}/new`)}>
            <Plus className="size-4" /> New company
          </Button>
        )}
      </div>

      {/* Status is read-only here — activating/deactivating is an edit like any
          other now, so it lives in the form and goes through approval. */}
      <CompanyList canEdit={actions.includes('edit')} />
    </div>
  )
}

/** A clickable table header that toggles sorting on `field`. */
function SortableHead({
  label,
  field,
  sort,
  onToggle,
}: {
  label: string
  field: CompanySortField
  sort: { by: CompanySortField; dir: 'asc' | 'desc' } | null
  onToggle: (field: CompanySortField) => void
}) {
  const active = sort?.by === field
  const Icon = !active ? ArrowUpDown : sort.dir === 'asc' ? ArrowUp : ArrowDown
  return (
    <TableHead>
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

function CompanyList({ canEdit }: { canEdit: boolean }) {
  const [search, setSearch] = useState('')
  // Default view is the live catalog: approved AND active. A newly created
  // company doesn't show up there, so the form redirects back with
  // `?approval=pending` to land the raiser on their own submission.
  const initialApproval = new URLSearchParams(window.location.search).get(
    'approval',
  )
  const [status, setStatus] = useState<StatusFilter>(
    initialApproval ? 'all' : 'active',
  )
  const [approval, setApproval] = useState<ApprovalFilter>(
    initialApproval === 'pending' || initialApproval === 'rejected'
      ? initialApproval
      : 'approved',
  )
  const [categoryIds, setCategoryIds] = useState<number[]>([])
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(25)
  // `null` = server default order (updated_at desc); a value = an active header sort.
  const [sort, setSort] = useState<{
    by: CompanySortField
    dir: 'asc' | 'desc'
  } | null>(null)
  const [data, setData] = useState<{
    items: CompanyListItem[]
    total: number
    limit: number
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [options, setOptions] = useState<FormOptions | null>(null)
  /** The company whose pending request is open in the dialog. */
  const [requestFor, setRequestFor] = useState<number | null>(null)
  // Approving a request rewrites the company it describes, so the list has to
  // be re-fetched rather than patched.
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    let cancelled = false
    getFormOptions()
      .then((o) => !cancelled && setOptions(o))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const categoryKey = categoryIds.join(',')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    const params: CompanyListParams = {
      search: search || undefined,
      status,
      approval,
      category_ids: categoryIds,
      page,
      limit,
      sort_by: sort?.by,
      sort_dir: sort?.dir,
    }
    listCompanies(params)
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
    // `categoryKey` is a stable snapshot of the selected category ids.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status, approval, categoryKey, page, limit, sort, reloadToken])

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1

  // Clicking the active column flips direction; a new column starts at its
  // natural default (A→Z for names, newest-first for recency).
  function toggleSort(field: CompanySortField) {
    setPage(1)
    setSort((cur) => {
      if (cur?.by === field) {
        return { by: field, dir: cur.dir === 'asc' ? 'desc' : 'asc' }
      }
      return { by: field, dir: field === 'name' ? 'asc' : 'desc' }
    })
  }

  return (
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
        <div className="w-52">
          <SearchableMultiSelect
            options={options?.categories ?? []}
            selected={categoryIds}
            onChange={(v) => {
              setPage(1)
              setCategoryIds(v)
            }}
            placeholder="Any category"
            searchPlaceholder="Search categories…"
          />
        </div>
        <NativeSelect
          value={approval}
          onChange={(e) => {
            setPage(1)
            setApproval(e.target.value as ApprovalFilter)
          }}
          className="w-44"
          aria-label="Approval status"
        >
          <option value="all">All approvals</option>
          <option value="approved">Approved</option>
          <option value="pending">Awaiting approval</option>
          <option value="rejected">Rejected</option>
        </NativeSelect>
        <NativeSelect
          value={status}
          onChange={(e) => {
            setPage(1)
            setStatus(e.target.value as StatusFilter)
          }}
          className="w-44"
          aria-label="Status"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="pending">Awaiting approval</option>
        </NativeSelect>
      </div>

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
                <TableHead>URL</TableHead>
                <TableHead>Job roles</TableHead>
                <TableHead>Categories</TableHead>
                <TableHead>Approval</TableHead>
                <TableHead>Status</TableHead>
                <SortableHead
                  label="Updated"
                  field="updated_at"
                  sort={sort}
                  onToggle={toggleSort}
                />
                {canEdit && <TableHead className="w-10"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <CompanyLogo name={c.name} logoUrl={c.logo_url} />
                  </TableCell>
                  <TableCell>
                    <span className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
                      {c.name}
                      {/* Whatever is awaiting approval is reviewable (and, for
                          an approver, decidable) right here — no detour via
                          the Approvals inbox. */}
                      {c.open_request && (
                        <button
                          type="button"
                          onClick={() => setRequestFor(c.id)}
                          title="View the request awaiting approval"
                        >
                          <Badge
                            variant="muted"
                            className="cursor-pointer hover:bg-accent"
                          >
                            {c.open_request.status === 'sent_back'
                              ? 'Sent back'
                              : c.open_request.kind === 'create'
                                ? 'Approval pending'
                                : 'Change pending'}
                          </Badge>
                        </button>
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="max-w-56">
                    {c.website ? (
                      <a
                        href={c.website}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex max-w-full items-center gap-1 truncate text-sm text-primary hover:underline"
                      >
                        <span className="truncate">{c.website}</span>
                        <ExternalLink className="size-3 shrink-0" />
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <RolesCell roles={c.roles} />
                  </TableCell>
                  <TableCell>
                    <ChipRow items={c.categories} />
                  </TableCell>
                  <TableCell>
                    <Badge variant={APPROVAL_BADGE[c.approval_status].variant}>
                      {APPROVAL_BADGE[c.approval_status].label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {c.is_active === null ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : (
                      <Badge variant={c.is_active ? 'success' : 'destructive'}>
                        {c.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {formatDate(c.updated_at)}
                  </TableCell>
                  {canEdit && (
                    <TableCell>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-8"
                        aria-label="Edit company"
                        onClick={() => navigateTo(`${BASE_ROUTE}/${c.id}/edit`)}
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

      <CompanyRequestDialog
        companyId={requestFor}
        onOpenChange={(open) => !open && setRequestFor(null)}
        onDecided={() => setReloadToken((t) => t + 1)}
      />
    </div>
  )
}
