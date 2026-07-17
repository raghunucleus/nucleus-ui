import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  Download,
  Loader2,
  Maximize2,
  Search as SearchIcon,
} from 'lucide-react'
import { toast } from 'sonner'

import { employeeNavigate } from '@/components/employee/notification-navigate'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { ApiError } from '@/lib/api'
import type {
  ExportFormat,
  FkOption,
  SearchGroup,
  SearchMeta,
  StudentSearchApi,
  StudentSearchBody,
  StudentSearchResult,
} from '@/lib/student-search'
import { cn } from '@/lib/utils'

import { ColumnPicker } from './column-picker'
import { FilterBuilder } from './filter-builder'
import {
  type BuilderRow,
  composeFilters,
  decomposeFilters,
} from './filter-model'
import { NqlEditor } from './nql-editor'
import { ResultsTable } from './results-table'

type Mode = 'builder' | 'nql'

/**
 * The full registry-driven student search: structured filter builder or NQL
 * text (one or the other — the server rejects both), free-text search, column
 * picker, sortable paginated results, and always-async CSV/XLSX export.
 *
 * Mount-point agnostic: everything reaches the server through the `api`
 * adapter, and `initialFilters` seeds the builder (the drive Filter tab passes
 * the eligibility prefill).
 */
export function StudentSearchPanel({
  api,
  initialFilters,
  lockedAttrs,
}: {
  api: StudentSearchApi
  initialFilters?: SearchGroup | null
  /**
   * Attribute keys whose seeded conditions are "recommended defaults" — the
   * user is asked to confirm before changing or removing them.
   */
  lockedAttrs?: string[]
}) {
  const [meta, setMeta] = useState<SearchMeta | null>(null)
  const [metaError, setMetaError] = useState<string | null>(null)

  const [mode, setMode] = useState<Mode>('builder')
  const [rows, setRows] = useState<BuilderRow[]>([])
  const [nql, setNql] = useState('')
  const [freeText, setFreeText] = useState('')
  const [columns, setColumns] = useState<string[]>([])
  const [sort, setSort] = useState<
    { by: string; dir: 'asc' | 'desc' } | undefined
  >(undefined)
  const [pageSize, setPageSize] = useState(25)

  const [result, setResult] = useState<StudentSearchResult | null>(null)
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

  // The roomy "expand" view of the filter editor — a wide modal over the same
  // filter state (no duplicated data flow).
  const [expanded, setExpanded] = useState(false)

  // Confirm dialog for changing a protected default. `confirmProtectedChange`
  // returns a promise the builder awaits before applying the edit; the dialog
  // buttons resolve it.
  const [confirmOpen, setConfirmOpen] = useState(false)
  const confirmResolver = useRef<((ok: boolean) => void) | null>(null)
  const confirmProtectedChange = useCallback((): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      confirmResolver.current = resolve
      setConfirmOpen(true)
    })
  }, [])
  const settleConfirm = useCallback((ok: boolean) => {
    setConfirmOpen(false)
    confirmResolver.current?.(ok)
    confirmResolver.current = null
  }, [])

  // fk option lists, fetched once per lookup on first use. The requested-set
  // lives in a ref so a failed load writes a [] sentinel instead of retrying
  // in a render loop.
  const [fkOptions, setFkOptions] = useState<
    Record<string, FkOption[] | undefined>
  >({})
  const requestedLookups = useRef(new Set<string>())
  const ensureFkOptions = useCallback(
    (lookup: string) => {
      if (requestedLookups.current.has(lookup)) return
      requestedLookups.current.add(lookup)
      api.options(lookup).then(
        (opts) => setFkOptions((prev) => ({ ...prev, [lookup]: opts })),
        () => setFkOptions((prev) => ({ ...prev, [lookup]: [] })),
      )
    },
    [api],
  )

  // Assemble the request body from the current inputs. NQL may carry its own
  // ORDER BY — sending `sort` alongside it is a server-side 400, so drop ours.
  const buildBody = useCallback(
    (page: number, size: number): StudentSearchBody => {
      const body: StudentSearchBody = { page, pageSize: size }
      if (mode === 'nql') {
        const text = nql.trim()
        if (text) body.nql = text
        if (sort && !/\border\s+by\b/i.test(text)) body.sort = sort
      } else {
        const filters = composeFilters(rows)
        if (filters) body.filters = filters
        if (sort) body.sort = sort
      }
      if (freeText.trim()) body.search = freeText.trim()
      if (columns.length > 0) body.columns = columns
      return body
    },
    [mode, nql, rows, sort, freeText, columns],
  )

  const runSearch = useCallback(
    async (page: number, size: number) => {
      setSearching(true)
      setSearchError(null)
      try {
        const res = await api.search(buildBody(page, size))
        setResult(res)
      } catch (err) {
        setSearchError(
          err instanceof Error ? err.message : 'Search failed. Try again.',
        )
      } finally {
        setSearching(false)
      }
    },
    [api, buildBody],
  )

  // Boot: load meta, seed the builder from the prefill, run the first search.
  const booted = useRef(false)
  useEffect(() => {
    if (booted.current) return
    booted.current = true
    api
      .meta()
      .then((m) => {
        setMeta(m)
        setColumns(m.defaultColumns)
        if (initialFilters) {
          const decomposed = decomposeFilters(initialFilters, lockedAttrs)
          if (decomposed) setRows(decomposed)
        }
      })
      .catch((err) => {
        setMetaError(
          err instanceof Error ? err.message : 'Could not load search config.',
        )
      })
  }, [api, initialFilters, lockedAttrs])

  // First search once meta (and thus default columns / prefilled rows) are in.
  const searchedOnce = useRef(false)
  useEffect(() => {
    if (!meta || searchedOnce.current) return
    searchedOnce.current = true
    void runSearch(1, pageSize)
  }, [meta, runSearch, pageSize])

  const toggleSort = useCallback(
    (by: string) => {
      const next: { by: string; dir: 'asc' | 'desc' } =
        sort?.by === by
          ? { by, dir: sort.dir === 'asc' ? 'desc' : 'asc' }
          : { by, dir: 'asc' }
      setSort(next)
    },
    [sort],
  )

  // Sort / page-size changes re-run the current query immediately.
  const lastQuery = useRef({ sort, pageSize })
  useEffect(() => {
    if (!searchedOnce.current) return
    if (
      lastQuery.current.sort === sort &&
      lastQuery.current.pageSize === pageSize
    ) {
      return
    }
    lastQuery.current = { sort, pageSize }
    void runSearch(1, pageSize)
  }, [sort, pageSize, runSearch])

  const startExport = useCallback(
    async (format: ExportFormat) => {
      setExporting(true)
      try {
        await api.createExport(buildBody(1, pageSize), format)
        toast.success(
          "Export started — you'll get a notification when it's ready.",
          {
            action: {
              label: 'My exports',
              onClick: () => employeeNavigate({ to: '/exports' }),
            },
          },
        )
      } catch (err) {
        toast.error(
          err instanceof ApiError ? err.message : 'Could not start the export.',
        )
      } finally {
        setExporting(false)
      }
    },
    [api, buildBody, pageSize],
  )

  const modeTabs = useMemo(
    () =>
      [
        { key: 'builder' as Mode, label: 'Filters' },
        { key: 'nql' as Mode, label: 'Query (NQL)' },
      ] satisfies { key: Mode; label: string }[],
    [],
  )

  if (metaError) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
        {metaError}
      </div>
    )
  }

  if (!meta) {
    return (
      <div className="space-y-3 py-2">
        <div className="h-9 w-64 animate-pulse rounded-md bg-muted" />
        <div className="h-24 animate-pulse rounded-xl bg-muted" />
        <div className="h-64 animate-pulse rounded-xl bg-muted" />
      </div>
    )
  }

  // The filter editor itself, reused by both the inline rail and the expand
  // modal so edits flow through one piece of state.
  const editor =
    mode === 'builder' ? (
      <FilterBuilder
        meta={meta}
        rows={rows}
        onChange={setRows}
        fkOptions={fkOptions}
        ensureFkOptions={ensureFkOptions}
        confirmProtectedChange={confirmProtectedChange}
      />
    ) : (
      <NqlEditor meta={meta} value={nql} onChange={setNql} />
    )

  // The Search button + inline error, shared by the rail footer and the modal.
  const searchButton = (
    <Button
      type="button"
      className="w-full"
      onClick={() => void runSearch(1, pageSize)}
      disabled={searching}
    >
      {searching ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <SearchIcon className="size-4" />
      )}
      Search
    </Button>
  )

  const modeToggle = (
    <div className="inline-flex w-full rounded-lg border bg-card p-0.5">
      {modeTabs.map((t) => (
        <button
          key={t.key}
          type="button"
          onClick={() => setMode(t.key)}
          aria-pressed={mode === t.key}
          className={cn(
            'flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            mode === t.key
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  )

  return (
    <div className="grid min-h-0 gap-4 py-1 lg:h-full lg:grid-cols-[20rem_minmax(0,1fr)]">
      {/* LEFT: filter editor — a self-contained column that matches the results
          height, with its own scrolling body between a fixed header and footer. */}
      <aside className="flex min-h-0 flex-col gap-3 lg:h-full">
        <div className="flex shrink-0 items-center gap-2">
          {modeToggle}
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-9 shrink-0"
            onClick={() => setExpanded(true)}
            aria-label="Expand filters"
            title="Expand"
          >
            <Maximize2 className="size-4" />
          </Button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col rounded-xl border bg-card">
          <div className="scrollbar-themed min-h-0 flex-1 overflow-y-auto p-3">
            {editor}
          </div>
          <div className="shrink-0 space-y-2 border-t p-3">
            {searchButton}
            {searchError ? (
              <p className="text-xs text-destructive">{searchError}</p>
            ) : null}
          </div>
        </div>
      </aside>

      {/* RIGHT: results, in focus */}
      <div className="flex min-h-0 min-w-0 flex-col gap-3 lg:h-full">
        {/* Toolbar: free text · columns · export */}
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <div className="min-w-52 max-w-xs flex-1">
            <Input
              value={freeText}
              onChange={(e) => setFreeText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void runSearch(1, pageSize)
              }}
              placeholder="Search name, roll no, email…"
            />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <ColumnPicker meta={meta} columns={columns} onChange={setColumns} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" disabled={exporting}>
                  {exporting ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Download className="size-4" />
                  )}
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => void startExport('xlsx')}>
                  Excel (.xlsx)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => void startExport('csv')}>
                  CSV (.csv)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="min-h-0 flex-1">
          {result ? (
            <ResultsTable
              meta={meta}
              result={result}
              sort={sort}
              onSort={toggleSort}
              onPage={(page) => void runSearch(page, pageSize)}
              onPageSize={setPageSize}
            />
          ) : searching ? (
            <div className="h-64 animate-pulse rounded-xl bg-muted" />
          ) : null}
        </div>
      </div>

      {/* Expanded filter editor — same state, roomier surface. */}
      <Dialog open={expanded} onOpenChange={setExpanded}>
        <DialogContent className="flex h-[85vh] max-h-[85vh] w-[95vw] max-w-6xl flex-col gap-0 p-0">
          <DialogHeader className="shrink-0 border-b px-6 py-4">
            <DialogTitle>Edit filters</DialogTitle>
            <DialogDescription>
              Build your shortlist with more room. Changes here apply to the
              filter panel.
            </DialogDescription>
          </DialogHeader>
          <div className="shrink-0 px-6 pt-4">{modeToggle}</div>
          <div className="scrollbar-themed min-h-0 flex-1 overflow-y-auto px-6 py-4">
            {editor}
          </div>
          <DialogFooter className="shrink-0 items-center gap-3 border-t px-6 py-4 sm:justify-between">
            {searchError ? (
              <p className="text-xs text-destructive">{searchError}</p>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setExpanded(false)}>
                Done
              </Button>
              <Button
                type="button"
                onClick={() => void runSearch(1, pageSize)}
                disabled={searching}
              >
                {searching ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <SearchIcon className="size-4" />
                )}
                Search
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!open) settleConfirm(false)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change a recommended filter?</DialogTitle>
            <DialogDescription>
              Status is Active, Allowed by department for placements is Yes, and
              Interested in placements is Yes are recommended defaults — they
              keep results to students who can actually be placed. You can change
              this, but the shortlist may then include ineligible students.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => settleConfirm(false)}>
              Keep filter
            </Button>
            <Button onClick={() => settleConfirm(true)}>Change anyway</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
