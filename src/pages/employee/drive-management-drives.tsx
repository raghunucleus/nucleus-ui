import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CalendarDays,
  LayoutGrid,
  List,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'

import {
  CompanyLogo,
  formatDate,
  formatDateTime,
} from '@/components/corporate-relations/bits'
import { NoAccessEmptyState } from '@/components/employee/empty-states'
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
import { useScreenAccess } from '@/hooks/use-screen-access'
import { ApiError } from '@/lib/api'
import { employeeNavigateTo } from '@/lib/employee-navigate'
import {
  DRIVE_STATUS_LABELS,
  deleteDrive,
  driveStatusVariant,
  listDrives,
  type DriveListItem,
  type DriveSortField,
} from '@/lib/drive-management'
import { cn } from '@/lib/utils'

const SCREEN_KEY = 'drive_management.drives.manage'
const VIEW_STORAGE_KEY = 'nucleus.drives.view'
const LIST_ROUTE = '/drive-management/drives'
const PAGE_SIZE = 25

type ViewMode = 'table' | 'cards'

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

export default function EmployeeDrivesPage() {
  useEffect(() => {
    document.title = 'Drives — Nucleus'
  }, [])

  const access = useScreenAccess(SCREEN_KEY)
  const actions = access?.actions ?? []

  const [view, setView] = useState<ViewMode>(initialView)
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [sortBy, setSortBy] = useState<DriveSortField>('drive_date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(1)

  const [items, setItems] = useState<DriveListItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reload, setReload] = useState(0)

  // Debounce the search box so typing doesn't fire a request per keystroke.
  useEffect(() => {
    const t = window.setTimeout(() => {
      setDebounced(search)
      setPage(1)
    }, 300)
    return () => window.clearTimeout(t)
  }, [search])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    listDrives({
      search: debounced || undefined,
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
  }, [debounced, sortBy, sortDir, page, reload])

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

  const onDelete = async (drive: DriveListItem) => {
    if (
      !window.confirm(
        `Delete "${drive.drive_name}"? Its designations and JD files go with it.`,
      )
    ) {
      return
    }
    try {
      await deleteDrive(drive.id)
      toast.success(`Deleted "${drive.drive_name}".`)
      setReload((n) => n + 1)
    } catch (e) {
      toast.error(errMsg(e, 'Could not delete the drive.'))
    }
  }

  if (!access) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <NoAccessEmptyState />
      </div>
    )
  }

  const canEdit = actions.includes('edit')
  const canDelete = actions.includes('delete')

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CalendarDays className="size-5 text-muted-foreground" />
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Drives</h1>
            <p className="text-sm text-muted-foreground">
              Create and manage placement drives.
            </p>
          </div>
        </div>
        {actions.includes('create') && (
          <Button onClick={() => employeeNavigateTo(`${LIST_ROUTE}/new`)}>
            <Plus className="size-4" /> New drive
          </Button>
        )}
      </div>

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
          <p className="text-sm font-medium">No drives yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {debounced
              ? 'No drive matches that search.'
              : 'Create a drive to get started.'}
          </p>
        </div>
      ) : view === 'table' ? (
        <DriveTable
          items={items}
          sortBy={sortBy}
          sortDir={sortDir}
          onSort={toggleSort}
          onOpen={(id) => employeeNavigateTo(`${LIST_ROUTE}/${id}`)}
          onEdit={(id) => employeeNavigateTo(`${LIST_ROUTE}/${id}/edit`)}
          onDelete={onDelete}
          canEdit={canEdit}
          canDelete={canDelete}
        />
      ) : (
        <DriveCards
          items={items}
          onOpen={(id) => employeeNavigateTo(`${LIST_ROUTE}/${id}`)}
          onEdit={(id) => employeeNavigateTo(`${LIST_ROUTE}/${id}/edit`)}
          onDelete={onDelete}
          canEdit={canEdit}
          canDelete={canDelete}
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
  onEdit,
  onDelete,
  canEdit,
  canDelete,
}: {
  items: DriveListItem[]
  sortBy: DriveSortField
  sortDir: 'asc' | 'desc'
  onSort: (f: DriveSortField) => void
  onOpen: (id: number) => void
  onEdit: (id: number) => void
  onDelete: (d: DriveListItem) => void
  canEdit: boolean
  canDelete: boolean
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
            <TableHead className="w-24 text-right">Actions</TableHead>
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
              <TableCell className="text-right">
                <RowActions
                  onEdit={() => onEdit(d.id)}
                  onDelete={() => onDelete(d)}
                  canEdit={canEdit}
                  canDelete={canDelete}
                />
              </TableCell>
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
  onEdit,
  onDelete,
  canEdit,
  canDelete,
}: {
  items: DriveListItem[]
  onOpen: (id: number) => void
  onEdit: (id: number) => void
  onDelete: (d: DriveListItem) => void
  canEdit: boolean
  canDelete: boolean
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

          <div className="mt-auto flex justify-end border-t pt-2">
            <RowActions
              onEdit={() => onEdit(d.id)}
              onDelete={() => onDelete(d)}
              canEdit={canEdit}
              canDelete={canDelete}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

function RowActions({
  onEdit,
  onDelete,
  canEdit,
  canDelete,
}: {
  onEdit: () => void
  onDelete: () => void
  canEdit: boolean
  canDelete: boolean
}) {
  return (
    <div className="flex justify-end gap-1">
      {canEdit && (
        <Button variant="ghost" size="sm" onClick={onEdit} aria-label="Edit drive">
          <Pencil className="size-4" />
        </Button>
      )}
      {canDelete && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          aria-label="Delete drive"
          className="text-destructive hover:text-destructive"
        >
          <Trash2 className="size-4" />
        </Button>
      )}
    </div>
  )
}
