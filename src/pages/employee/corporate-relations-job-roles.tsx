import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Briefcase,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Info,
  LayoutGrid,
  List,
  Loader2,
  Pencil,
  Plus,
  Search,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
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
import { CompanyForm } from '@/components/corporate-relations/company-form'
import {
  ChipRow,
  CompanyLogo,
  formatDate,
} from '@/components/corporate-relations/bits'
import { useEmployeeAccess, useScreenAccess } from '@/hooks/use-screen-access'
import { ApiError } from '@/lib/api'
import {
  getJobRoleCompany,
  getJobRoleCompanyRequest,
  getJobRolesFormOptions,
  jobRolesCompanyApi,
  listMyJobRoles,
  type CompanyDetail,
  type FormOptions,
  type JobRoleCompany,
  type MyJobRole,
} from '@/lib/corporate-relations'
import { cn } from '@/lib/utils'

const SCREEN_KEY = 'corporate_relations.job_roles.manage'
const VIEW_STORAGE_KEY = 'nucleus.job-roles.view'

type ViewMode = 'flat' | 'grouped'
type SortField = 'company' | 'role' | 'updated_at'

/** The action bar bled out to the sheet's own gutters, not the page's. */
const SHEET_FOOTER =
  'sticky bottom-0 z-10 -mx-4 -mb-4 flex justify-end gap-2 border-t bg-background px-4 pb-4 pt-4 sm:-mx-6 sm:px-6'

function errMsg(e: unknown, fallback: string): string {
  return e instanceof ApiError || e instanceof Error ? e.message : fallback
}

/** Read the saved view once, defensively — a stale value must not throw. */
function initialView(): ViewMode {
  if (typeof window === 'undefined') return 'flat'
  return window.localStorage.getItem(VIEW_STORAGE_KEY) === 'grouped'
    ? 'grouped'
    : 'flat'
}

/**
 * The company's status: Active or Inactive, the same two words Company
 * Management uses.
 *
 * `is_active` is a tri-state in the data — NULL means the company has never
 * been approved, so it has no status yet rather than a third one. That case
 * reads "Awaiting approval" (or "Rejected") because an em-dash next to a
 * company nobody has signed off on says nothing useful.
 */
function StatusBadge({ company }: { company: JobRoleCompany }) {
  if (company.approval_status === 'rejected') {
    return <Badge variant="destructive">Rejected</Badge>
  }
  if (company.is_active === null) {
    return <Badge variant="warning">Awaiting approval</Badge>
  }
  return (
    <Badge variant={company.is_active ? 'success' : 'destructive'}>
      {company.is_active ? 'Active' : 'Inactive'}
    </Badge>
  )
}

/**
 * Whatever is awaiting approval on the company, reviewable right here — the
 * same affordance Company Management puts next to the name.
 */
function OpenRequestBadge({
  company,
  onOpen,
}: {
  company: JobRoleCompany
  onOpen: () => void
}) {
  if (!company.open_request) return null
  return (
    <button
      type="button"
      onClick={onOpen}
      title="View the request awaiting approval"
    >
      <Badge variant="muted" className="cursor-pointer hover:bg-accent">
        {company.open_request.status === 'sent_back'
          ? 'Sent back'
          : company.open_request.kind === 'create'
            ? 'Approval pending'
            : 'Change pending'}
      </Badge>
    </button>
  )
}

function WebsiteCell({ website }: { website: string | null }) {
  if (!website) return <span className="text-xs text-muted-foreground">—</span>
  return (
    <a
      href={website}
      target="_blank"
      rel="noreferrer"
      className="inline-flex max-w-full items-center gap-1 truncate text-sm text-primary hover:underline"
    >
      <span className="truncate">{website}</span>
      <ExternalLink className="size-3 shrink-0" />
    </a>
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
  field: SortField
  sort: { by: SortField; dir: 'asc' | 'desc' }
  onToggle: (field: SortField) => void
}) {
  const active = sort.by === field
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

/**
 * Roles or Designations — the job roles the signed-in employee is personally
 * accountable for, across every company, plus adding a company.
 *
 * The scope is the token's employee, applied server-side; there is no "whose
 * roles" control because there is nothing else to ask for. Roles themselves are
 * read-only here: changing a role or its owner is an edit to the company, which
 * goes through the approval flow on Company Management. The one exception is
 * the caller's own company while it is still awaiting approval — the draft they
 * just added, and the send-back they have to resubmit.
 */
export default function EmployeeJobRolesPage() {
  useEffect(() => {
    document.title = 'Roles or Designations — Nucleus'
  }, [])

  const access = useScreenAccess(SCREEN_KEY)
  const me = useEmployeeAccess()?.employee_id ?? null
  const actions = access?.actions ?? []
  const canCreate = actions.includes('create')

  const [view, setView] = useState<ViewMode>(initialView)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<{ by: SortField; dir: 'asc' | 'desc' }>({
    by: 'company',
    dir: 'asc',
  })
  const [rows, setRows] = useState<MyJobRole[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reload, setReload] = useState(0)

  /** The company whose pending request is open in the dialog. */
  const [requestFor, setRequestFor] = useState<number | null>(null)

  // The add/edit slide-over. `editing` is null for a new company; options load
  // lazily on first open so a view-only holder never fires that call.
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<CompanyDetail | null>(null)
  const [options, setOptions] = useState<FormOptions | null>(null)
  const [sheetLoading, setSheetLoading] = useState(false)
  const [sheetError, setSheetError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    listMyJobRoles()
      .then((r) => {
        if (!cancelled) setRows(r)
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(errMsg(e, 'Could not load your job roles.'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [reload])

  const changeView = (next: ViewMode) => {
    setView(next)
    window.localStorage.setItem(VIEW_STORAGE_KEY, next)
  }

  function toggleSort(field: SortField) {
    setSort((cur) =>
      cur.by === field
        ? { by: field, dir: cur.dir === 'asc' ? 'desc' : 'asc' }
        : { by: field, dir: field === 'updated_at' ? 'desc' : 'asc' },
    )
  }

  // Search and sort are client-side: the list is bounded to one employee's own
  // roles, so it is already in memory and re-fetching per keystroke would only
  // add latency.
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    const filtered = q
      ? (rows ?? []).filter(
          (r) =>
            r.role_name.toLowerCase().includes(q) ||
            r.company.name.toLowerCase().includes(q),
        )
      : (rows ?? [])
    const dir = sort.dir === 'asc' ? 1 : -1
    return [...filtered].sort((a, b) => {
      if (sort.by === 'updated_at') {
        return (
          dir * (new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime())
        )
      }
      const key =
        sort.by === 'role'
          ? ([a.role_name, b.role_name] as const)
          : ([a.company.name, b.company.name] as const)
      const cmp = key[0].localeCompare(key[1])
      // Companies tie constantly — fall back to the role name so the grouped
      // view and the flat view agree on the order within a company.
      return dir * (cmp !== 0 ? cmp : a.role_name.localeCompare(b.role_name))
    })
  }, [rows, search, sort])

  /** The same rows folded by company, preserving the sorted order. */
  const groups = useMemo(() => {
    const byCompany = new Map<
      number,
      { company: JobRoleCompany; roles: MyJobRole[] }
    >()
    for (const r of visible) {
      const g = byCompany.get(r.company.id)
      if (g) g.roles.push(r)
      else byCompany.set(r.company.id, { company: r.company, roles: [r] })
    }
    return [...byCompany.values()]
  }, [visible])

  // Collapsed rather than expanded state, so companies that arrive after the
  // first render (a newly added one) start open like everything else.
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set())
  const toggleGroup = (companyId: number) =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(companyId)) next.delete(companyId)
      else next.add(companyId)
      return next
    })

  /** Your own not-yet-live company is the only one this screen can edit. */
  const canEditCompany = (c: JobRoleCompany) =>
    canCreate &&
    me !== null &&
    c.created_by_employee_id === me &&
    c.approval_status !== 'approved' &&
    c.open_request?.status !== 'pending'

  async function openSheet(companyId: number | null) {
    setSheetOpen(true)
    setSheetError(null)
    setEditing(null)
    setSheetLoading(true)
    try {
      const [opts, detail] = await Promise.all([
        options ? Promise.resolve(options) : getJobRolesFormOptions(),
        companyId === null
          ? Promise.resolve(null)
          : getJobRoleCompany(companyId),
      ])
      setOptions(opts)
      setEditing(detail)
    } catch (e: unknown) {
      setSheetError(errMsg(e, 'Could not open the form.'))
    } finally {
      setSheetLoading(false)
    }
  }

  // Deep link from My Requests: a sent-back company whose raiser only holds
  // this screen has nowhere else to resubmit from.
  //
  // Waits for `canCreate` rather than firing on mount — the access payload is
  // still in flight on the first render, so a mount-only effect would always
  // see "no grant" and drop the link.
  const deepLinkedRef = useRef(false)
  useEffect(() => {
    if (deepLinkedRef.current || !canCreate) return
    const raw = new URLSearchParams(window.location.search).get('edit')
    const id = raw ? Number(raw) : NaN
    if (!Number.isInteger(id) || id <= 0) return
    deepLinkedRef.current = true
    // Consume the param so a refresh (or closing the sheet) doesn't reopen it.
    window.history.replaceState({}, '', window.location.pathname)
    void openSheet(id)
    // `openSheet` is recreated every render; the ref is what makes this once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canCreate])

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
            Roles or Designations
          </h1>
          <p className="text-sm text-muted-foreground">
            The job roles you are accountable for, company by company.
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => void openSheet(null)}>
            <Plus className="size-4" /> Add company
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search roles or companies…"
            className="pl-8"
          />
        </div>
        <div className="inline-flex overflow-hidden rounded-md border bg-background text-xs">
          <ViewButton
            active={view === 'flat'}
            onClick={() => changeView('flat')}
            icon={List}
            label="Flat"
          />
          <ViewButton
            active={view === 'grouped'}
            onClick={() => changeView('grouped')}
            icon={LayoutGrid}
            label="Grouped"
            bordered
          />
        </div>
      </div>

      {loading && !rows ? (
        <div className="flex min-h-[62vh] items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 size-4 animate-spin" /> Loading…
        </div>
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : visible.length === 0 ? (
        <div className="flex min-h-[62vh] flex-col items-center justify-center rounded-xl border border-dashed bg-muted/20 px-6 py-14 text-center">
          <Briefcase className="mb-2 size-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {rows && rows.length > 0
              ? 'No roles match your search.'
              : 'No job roles are assigned to you yet.'}
          </p>
          {canCreate && rows && rows.length === 0 && (
            <p className="mt-1 text-xs text-muted-foreground">
              Adding a company lists you against the roles you own on it.
            </p>
          )}
        </div>
      ) : view === 'flat' ? (
        <div className="min-h-[62vh] overflow-hidden rounded-xl border bg-card">
          <Table containerClassName="max-h-[62vh] overflow-y-auto">
            <TableHeader>
              <TableRow className="sticky top-0 z-10 [&>th]:bg-card">
                <TableHead className="w-10"></TableHead>
                <SortableHead
                  label="Company"
                  field="company"
                  sort={sort}
                  onToggle={toggleSort}
                />
                <SortableHead
                  label="Job role"
                  field="role"
                  sort={sort}
                  onToggle={toggleSort}
                />
                <TableHead>URL</TableHead>
                <TableHead>Categories</TableHead>
                <TableHead>Status</TableHead>
                <SortableHead
                  label="Updated"
                  field="updated_at"
                  sort={sort}
                  onToggle={toggleSort}
                />
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <CompanyLogo
                      name={r.company.name}
                      logoUrl={r.company.logo_url}
                    />
                  </TableCell>
                  <TableCell>
                    <span className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
                      {r.company.name}
                      <OpenRequestBadge
                        company={r.company}
                        onOpen={() => setRequestFor(r.company.id)}
                      />
                    </span>
                  </TableCell>
                  <TableCell className="text-sm">{r.role_name}</TableCell>
                  <TableCell className="max-w-56">
                    <WebsiteCell website={r.company.website} />
                  </TableCell>
                  <TableCell>
                    <ChipRow items={r.company.categories} />
                  </TableCell>
                  <TableCell>
                    <StatusBadge company={r.company} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {formatDate(r.updated_at)}
                  </TableCell>
                  <TableCell>
                    {canEditCompany(r.company) && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-8"
                        aria-label={`Edit ${r.company.name}`}
                        onClick={() => void openSheet(r.company.id)}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="min-h-[62vh] space-y-3">
          {groups.map(({ company, roles }) => {
            const open = !collapsed.has(company.id)
            const Chevron = open ? ChevronDown : ChevronRight
            return (
              <div
                key={company.id}
                className="overflow-hidden rounded-xl border bg-card"
              >
                <div className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                  <button
                    type="button"
                    onClick={() => toggleGroup(company.id)}
                    aria-expanded={open}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <Chevron className="size-4 shrink-0 text-muted-foreground" />
                    <CompanyLogo
                      name={company.name}
                      logoUrl={company.logo_url}
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">
                        {company.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {roles.length} {roles.length === 1 ? 'role' : 'roles'}
                      </span>
                    </span>
                  </button>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <ChipRow items={company.categories} />
                    <OpenRequestBadge
                      company={company}
                      onOpen={() => setRequestFor(company.id)}
                    />
                    <StatusBadge company={company} />
                    {canEditCompany(company) && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-8"
                        aria-label={`Edit ${company.name}`}
                        onClick={() => void openSheet(company.id)}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
                {open && (
                  <ul className="border-t">
                    {roles.map((r) => (
                      <li
                        key={r.id}
                        className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2 pl-10 last:border-b-0"
                      >
                        <span className="text-sm">{r.role_name}</span>
                        <span className="text-xs text-muted-foreground">
                          Updated {formatDate(r.updated_at)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )
          })}
        </div>
      )}

      {visible.length > 0 && (
        <p className="text-sm text-muted-foreground">
          {visible.length} {visible.length === 1 ? 'role' : 'roles'} across{' '}
          {groups.length} {groups.length === 1 ? 'company' : 'companies'}
        </p>
      )}

      <Sheet
        open={sheetOpen}
        onOpenChange={(o) => {
          setSheetOpen(o)
          if (!o) {
            setEditing(null)
            setSheetError(null)
          }
        }}
      >
        <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-2xl">
          <SheetHeader className="px-4 sm:px-6">
            <SheetTitle>{editing ? 'Edit company' : 'Add company'}</SheetTitle>
            <SheetDescription>
              {editing
                ? editing.name
                : 'Name the company and the roles it recruits for, with who is accountable for each.'}
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-4 sm:px-6">
            {sheetLoading ? (
              <div className="flex items-center justify-center py-24 text-muted-foreground">
                <Loader2 className="mr-2 size-4 animate-spin" /> Loading…
              </div>
            ) : sheetError || !options ? (
              <p className="py-6 text-sm text-destructive">
                {sheetError ?? 'Could not open the form.'}
              </p>
            ) : (
              <div className="space-y-5">
                <div className="flex items-start gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                  <Info className="mt-0.5 size-4 shrink-0" />
                  <p>
                    {editing
                      ? 'This company is not live yet. Saving updates it and re-sends it for approval.'
                      : 'New companies need approval before they appear in the live catalog.'}
                  </p>
                </div>
                <CompanyForm
                  company={editing}
                  options={options}
                  api={jobRolesCompanyApi}
                  // No `activate` grant on this screen — the switch stays
                  // display-only and the company goes live on approval.
                  canEditStatus={false}
                  footerClassName={SHEET_FOOTER}
                  onCancel={() => setSheetOpen(false)}
                  onSaved={() => {
                    toast.success(
                      editing
                        ? 'Saved and sent for approval.'
                        : 'Company created and sent for approval.',
                    )
                    setSheetOpen(false)
                    setEditing(null)
                    setReload((t) => t + 1)
                  }}
                />
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <CompanyRequestDialog
        companyId={requestFor}
        fetchRequest={getJobRoleCompanyRequest}
        onOpenChange={(open) => !open && setRequestFor(null)}
        onDecided={() => setReload((t) => t + 1)}
      />
    </div>
  )
}
