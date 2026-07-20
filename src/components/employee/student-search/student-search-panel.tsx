import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  CheckCircle2,
  Download,
  Info,
  Loader2,
  Search as SearchIcon,
  SlidersHorizontal,
  UserPlus,
  X,
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
  SearchNode,
  StudentImportApi,
  StudentImportSummary,
  StudentSearchApi,
  StudentSearchBody,
  StudentSearchResult,
} from '@/lib/student-search'
import { isGroupNode } from '@/lib/student-search'
import { cn } from '@/lib/utils'

import { ColumnPicker } from './column-picker'
import { FilterBuilder } from './filter-builder'
import { FilterHelpButton } from './filter-help'
import {
  type BuilderRow,
  composeFilters,
  decomposeFilters,
  explainFilters,
  filtersToNql,
} from './filter-model'
import { NqlEditor } from './nql-editor'
import {
  ResultsSkeleton,
  ResultsTable,
  type RowColumnDef,
} from './results-table'

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
  importApi,
  showFilterHelp,
  hiddenAttrs,
  rowColumns,
  onRowOpen,
  toolbarExtra,
  searchNonce,
}: {
  api: StudentSearchApi
  initialFilters?: SearchGroup | null
  /**
   * Attribute keys whose seeded conditions are "recommended defaults" — the
   * user is asked to confirm before changing or removing them.
   */
  lockedAttrs?: string[]
  /**
   * When set, the panel gains an import affordance: a per-row Import button and
   * an "Import all matched" action, with a post-import summary. Omitted by
   * search-only consumers.
   */
  importApi?: StudentImportApi
  /** Renders the "Help with filters" documentation button in the filter rail. */
  showFilterHelp?: boolean
  /**
   * Attribute keys removed from the pickers, the filter help and the default
   * column set — for surfaces where an outer control already pins that axis
   * (the placement coordinator's batch dropdown fixes programme, department
   * and pass-out year). Purely presentational: the server's scope decides what
   * is actually reachable, so hiding an attribute cannot widen a result set.
   */
  hiddenAttrs?: string[]
  /** Caller-rendered leading result columns. See ResultsTable. */
  rowColumns?: RowColumnDef[]
  /** Opens a row's detail — adds a clickable name and a View column. */
  onRowOpen?: (row: Record<string, unknown>) => void
  /**
   * Extra toolbar control, rendered just left of the column picker. The panel
   * never needs to know what it does — pair it with `searchNonce` to re-run
   * the search once the control has changed something the panel doesn't own.
   */
  toolbarExtra?: ReactNode
  /**
   * Bump to re-run the current search from page 1. For callers whose search
   * adapter reads state the panel can't see (e.g. a scope switch): change the
   * state, then bump this. Ignored before the first search has run.
   */
  searchNonce?: number
}) {
  const [meta, setMeta] = useState<SearchMeta | null>(null)
  const [metaError, setMetaError] = useState<string | null>(null)

  // Stable across renders when the caller passes a constant array, so the
  // boot effect's dep on it never re-fires.
  const hidden = useMemo(() => new Set(hiddenAttrs ?? []), [hiddenAttrs])

  const [mode, setMode] = useState<Mode>('builder')
  const [rows, setRows] = useState<BuilderRow[]>([])
  const [nql, setNql] = useState('')
  // Switching Filters <-> NQL translates one into the other. `switchNote`
  // holds why a switch to the builder was blocked (query too advanced / a
  // parser error); `switching` guards the async NQL->builder round-trip.
  const [switchNote, setSwitchNote] = useState<string | null>(null)
  const [switching, setSwitching] = useState(false)
  // "Explain" panel (expanded editor only): the current filters read back as
  // plain-English lines. Builder rows explain live; NQL is parsed on demand.
  const [explainOpen, setExplainOpen] = useState(false)
  const [nqlExplainAst, setNqlExplainAst] = useState<SearchGroup | undefined>(
    undefined,
  )
  const [nqlExplainErr, setNqlExplainErr] = useState<string | null>(null)
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

  // Toggle Filters <-> NQL, keeping the two in sync. builder -> nql serializes
  // the current rows into query text (instant); nql -> builder parses the text
  // server-side (one authoritative grammar) and rebuilds the rows. A query the
  // shallow builder can't represent — or one that won't parse — leaves us on
  // the NQL tab with an explanatory note instead of silently dropping parts.
  const switchMode = useCallback(
    async (next: Mode) => {
      if (next === mode || switching) return
      setSwitchNote(null)
      if (next === 'nql') {
        setNql(filtersToNql(composeFilters(rows)))
        setMode('nql')
        return
      }
      const text = nql.trim()
      if (!text) {
        setRows([])
        setMode('builder')
        return
      }
      setSwitching(true)
      try {
        const parsed = await api.parseNql(text)
        if (parsed.sort) setSort(parsed.sort)
        if (!parsed.filters) {
          setRows([])
          setMode('builder')
          return
        }
        const decomposed = decomposeFilters(parsed.filters, lockedAttrs)
        if (!decomposed) {
          setSwitchNote(
            "This query is too advanced for the visual builder — keep editing it here.",
          )
          return
        }
        setRows(decomposed)
        setMode('builder')
      } catch (err) {
        setSwitchNote(
          err instanceof ApiError
            ? err.message
            : 'Could not read this query. Fix it, then switch.',
        )
      } finally {
        setSwitching(false)
      }
    },
    [mode, switching, rows, nql, api, lockedAttrs],
  )

  // --- Explain: current filters -> plain-English lines --------------------
  // Deliberately built from the UNFILTERED meta: a seeded or parsed condition
  // on a hidden attribute must still explain with its proper label.
  const attrByKey = useMemo(
    () => new Map((meta?.attributes ?? []).map((a) => [a.key, a] as const)),
    [meta],
  )

  /**
   * Meta as the *pickers* see it. Hidden attributes are dropped so they can't
   * be added as filters or columns, but ResultsTable keeps the full `meta` —
   * it needs every attribute for header labels and enum rendering, including
   * any hidden column a saved query still selects.
   */
  const visibleMeta = useMemo(
    () =>
      meta && hidden.size > 0
        ? { ...meta, attributes: meta.attributes.filter((a) => !hidden.has(a.key)) }
        : meta,
    [meta, hidden],
  )

  // Builder rows explain live; NQL is parsed (debounced) while the panel is open.
  const builderAst = useMemo(() => composeFilters(rows), [rows])

  /**
   * How many conditions are actually in force, for the Filters button's badge.
   * `composeFilters` already drops incomplete conditions and empty rows, so the
   * builder count is exact. NQL has no condition count — a non-empty query
   * simply reads as one active filter.
   */
  const activeFilters =
    mode === 'nql' ? (nql.trim() ? 1 : 0) : (builderAst?.and?.length ?? 0)

  useEffect(() => {
    if (!explainOpen || mode !== 'nql') return
    const text = nql.trim()
    let cancelled = false
    // All state writes happen inside the timer (async), never synchronously in
    // the effect body. Empty query clears immediately; a query is debounced.
    const t = setTimeout(
      () => {
        if (cancelled) return
        if (!text) {
          setNqlExplainAst(undefined)
          setNqlExplainErr(null)
          return
        }
        api.parseNql(text).then(
          (parsed) => {
            if (cancelled) return
            setNqlExplainAst(parsed.filters)
            setNqlExplainErr(null)
          },
          () => {
            if (!cancelled)
              setNqlExplainErr('Fix the query to see the explanation.')
          },
        )
      },
      text ? 400 : 0,
    )
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [explainOpen, mode, nql, api])

  const explainAst = mode === 'builder' ? builderAst : nqlExplainAst

  // Load fk option lists the breakdown references so ids resolve to labels
  // (an NQL-derived AST may name lookups the chips never triggered).
  useEffect(() => {
    if (!explainOpen || !explainAst) return
    const visit = (node: SearchNode) => {
      if (isGroupNode(node)) {
        ;(node.and ?? node.or ?? []).forEach(visit)
        return
      }
      const attr = attrByKey.get(node.attr)
      if (attr?.kind === 'fk' && attr.fkLookup) ensureFkOptions(attr.fkLookup)
    }
    visit(explainAst)
  }, [explainOpen, explainAst, attrByKey, ensureFkOptions])

  const explainLines = useMemo(
    () => explainFilters(explainAst, attrByKey, fkOptions),
    [explainAst, attrByKey, fkOptions],
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
        // The default set contains `programme`, so a surface that hides it
        // must not request it as a column.
        setColumns(m.defaultColumns.filter((c) => !hidden.has(c)))
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
  }, [api, initialFilters, lockedAttrs, hidden])

  // First search once meta (and thus default columns / prefilled rows) are in.
  const searchedOnce = useRef(false)
  useEffect(() => {
    if (!meta || searchedOnce.current) return
    searchedOnce.current = true
    void runSearch(1, pageSize)
  }, [meta, runSearch, pageSize])

  // Caller-requested refetch. Runs after render, so `runSearch` has already
  // closed over whatever new adapter the caller's state change produced.
  // Skipped before the first search, which the effect above owns.
  const lastNonce = useRef(searchNonce)
  useEffect(() => {
    if (lastNonce.current === searchNonce) return
    lastNonce.current = searchNonce
    if (!searchedOnce.current) return
    void runSearch(1, pageSize)
  }, [searchNonce, runSearch, pageSize])

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

  // --- import (only wired when `importApi` is provided) --------------------
  const [importingId, setImportingId] = useState<number | null>(null)
  const [importingAll, setImportingAll] = useState(false)
  const [confirmImportAll, setConfirmImportAll] = useState(false)
  const [importSummary, setImportSummary] =
    useState<StudentImportSummary | null>(null)

  const afterImport = useCallback(
    (summary: StudentImportSummary) => {
      setImportSummary(summary)
      const { imported, already_existed } = summary
      toast.success(
        `${imported} imported${
          already_existed > 0 ? ` · ${already_existed} already in drive` : ''
        }.`,
      )
      importApi?.onChanged?.()
      // Refresh the current page so `in_drive` badges reflect the new members.
      void runSearch(result?.page ?? 1, pageSize)
    },
    [importApi, runSearch, result?.page, pageSize],
  )

  const importRow = useCallback(
    async (row: Record<string, unknown>) => {
      if (!importApi || typeof row.id !== 'number') return
      setImportingId(row.id)
      try {
        afterImport(await importApi.importSelected([row.id]))
      } catch (err) {
        toast.error(
          err instanceof ApiError ? err.message : 'Could not import the student.',
        )
      } finally {
        setImportingId(null)
      }
    },
    [importApi, afterImport],
  )

  const importAll = useCallback(async () => {
    if (!importApi) return
    setConfirmImportAll(false)
    setImportingAll(true)
    try {
      afterImport(await importApi.importAll(buildBody(1, pageSize)))
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : 'Could not import the students.',
      )
    } finally {
      setImportingAll(false)
    }
  }, [importApi, afterImport, buildBody, pageSize])

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

  // `meta` is non-null past the guard above; the pickers get the hidden-attr
  // filtered view, everything else keeps the full set.
  const pickerMeta = visibleMeta ?? meta

  // The filter editor itself, rendered by both the inline rail and the expand
  // modal. It stays a function rather than a single shared element because the
  // two surfaces pass different `expanded` values — chips spell values out in
  // full in the roomy modal. Filter state still lives here, so both copies read
  // and write one piece of state.
  const editorFor = (expanded: boolean) =>
    mode === 'builder' ? (
      <FilterBuilder
        meta={pickerMeta}
        rows={rows}
        onChange={setRows}
        fkOptions={fkOptions}
        ensureFkOptions={ensureFkOptions}
        confirmProtectedChange={confirmProtectedChange}
        expanded={expanded}
      />
    ) : (
      <NqlEditor
        meta={pickerMeta}
        value={nql}
        onChange={(v) => {
          setNql(v)
          if (switchNote) setSwitchNote(null)
        }}
      />
    )

  const modeToggle = (
    <div className="inline-flex w-full rounded-lg border bg-card p-0.5">
      {modeTabs.map((t) => (
        <button
          key={t.key}
          type="button"
          onClick={() => void switchMode(t.key)}
          disabled={switching}
          aria-pressed={mode === t.key}
          className={cn(
            'flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-60',
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

  // Shown under the toggle when a switch to the builder was blocked — the NQL
  // stays put so nothing is lost.
  const switchNoteBanner = switchNote ? (
    <p className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
      {switchNote}
    </p>
  ) : null

  // "Explain" affordance — expanded editor only. The button toggles a panel
  // that reads the current filters back as plain-English lines.
  const explainToggle = (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="shrink-0"
      onClick={() => setExplainOpen((v) => !v)}
      aria-pressed={explainOpen}
    >
      <Info className="size-4" />
      Explain
    </Button>
  )

  const explainPanel = explainOpen ? (
    <div className="scrollbar-themed max-h-48 overflow-y-auto rounded-lg border bg-muted/30 p-3 text-sm">
      {mode === 'nql' && nqlExplainErr ? (
        <p className="text-muted-foreground">{nqlExplainErr}</p>
      ) : explainLines.length === 0 ? (
        <p className="text-muted-foreground">
          No filters yet — every student matches.
        </p>
      ) : (
        <>
          {explainLines.length > 1 ? (
            <p className="mb-2 font-medium text-foreground">
              All of the following must be true:
            </p>
          ) : null}
          <ol className="list-decimal space-y-1 pl-5 text-foreground">
            {explainLines.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ol>
        </>
      )}
    </div>
  ) : null

  return (
    <div className="flex min-h-0 min-w-0 flex-col gap-3 py-1 lg:h-full">
      {/* Results take the full width; the filter editor lives behind the
          toolbar's Filters button, in the modal the expand affordance used to
          open. The host supplies the height bound this stretches into. */}
      <>
        {/* Toolbar: free text · filters · columns · export */}
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
          {/* The only way into the filter editor. Badged with the number of
              conditions actually in force, so a closed panel never hides
              state the user forgot they applied. */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setExpanded(true)}
            aria-label="Filters"
          >
            <SlidersHorizontal className="size-4" />
            Filters
            {activeFilters > 0 ? (
              <span className="ml-1 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold leading-none text-primary-foreground">
                {activeFilters}
              </span>
            ) : null}
          </Button>
          {searchError ? (
            <p className="text-xs text-destructive">{searchError}</p>
          ) : null}
          <div className="ml-auto flex items-center gap-2">
            {importApi && result ? (
              <Button
                variant="default"
                size="sm"
                disabled={importingAll || searching || result.total === 0}
                onClick={() => setConfirmImportAll(true)}
              >
                {importingAll ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <UserPlus className="size-4" />
                )}
                Import all ({result.total.toLocaleString()})
              </Button>
            ) : null}
            {toolbarExtra}
            <ColumnPicker
              meta={pickerMeta}
              columns={columns}
              onChange={setColumns}
              onApply={() => void runSearch(1, pageSize)}
            />
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

        {/* Post-import summary — dismissible, sits above the table. */}
        {importSummary ? (
          <div className="flex shrink-0 items-center gap-3 rounded-lg border border-success/30 bg-success/5 px-3 py-2 text-sm">
            <CheckCircle2 className="size-4 shrink-0 text-success" />
            <span>
              <span className="font-semibold tabular-nums">
                {importSummary.imported.toLocaleString()}
              </span>{' '}
              imported
              {importSummary.already_existed > 0 ? (
                <>
                  {' · '}
                  <span className="font-semibold tabular-nums">
                    {importSummary.already_existed.toLocaleString()}
                  </span>{' '}
                  already in drive
                </>
              ) : null}
            </span>
            <button
              type="button"
              onClick={() => setImportSummary(null)}
              className="ml-auto text-muted-foreground hover:text-foreground"
              aria-label="Dismiss"
            >
              <X className="size-4" />
            </button>
          </div>
        ) : null}

        <div className="min-h-0 flex-1">
          {/* Shimmer whenever a search is in flight — including refetches after
              a column / filter change — so the stale table never sits there
              looking final while new data loads. */}
          {searching ? (
            <ResultsSkeleton
              columns={
                (result?.columns.length ?? columns.length) ||
                meta.implicitColumns.length
              }
            />
          ) : result ? (
            <ResultsTable
              meta={meta}
              result={result}
              sort={sort}
              onSort={toggleSort}
              onPage={(page) => void runSearch(page, pageSize)}
              onPageSize={setPageSize}
              onImportRow={importApi ? (row) => void importRow(row) : undefined}
              importingId={importingId}
              rowColumns={rowColumns}
              onRowOpen={onRowOpen}
            />
          ) : null}
        </div>
      </>

      {/* The filter editor — now the only surface for it, opened from the
          toolbar's Filters button. Same state as before; the rail that used to
          mirror it is gone. */}
      <Dialog open={expanded} onOpenChange={setExpanded}>
        <DialogContent className="flex h-[85vh] max-h-[85vh] w-[95vw] max-w-6xl flex-col gap-0 p-0">
          <DialogHeader className="shrink-0 border-b px-6 py-4">
            <DialogTitle>Filters</DialogTitle>
            <DialogDescription>
              Build your shortlist, then apply it to the results.
            </DialogDescription>
          </DialogHeader>
          <div className="shrink-0 space-y-2 px-6 pt-4">
            <div className="flex items-center gap-2">
              <div className="flex-1">{modeToggle}</div>
              {/* Both moved here from the deleted rail. */}
              {showFilterHelp ? <FilterHelpButton meta={pickerMeta} /> : null}
              {explainToggle}
            </div>
            {switchNoteBanner}
            {explainPanel}
          </div>
          <div className="scrollbar-themed min-h-0 flex-1 overflow-y-auto px-6 py-4">
            {editorFor(true)}
          </div>
          <DialogFooter className="shrink-0 items-center gap-3 border-t px-6 py-4 sm:justify-between">
            {searchError ? (
              <p className="text-xs text-destructive">{searchError}</p>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setExpanded(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => {
                  // Close optimistically: runSearch surfaces any failure in the
                  // toolbar's error slot, which is visible behind the modal.
                  setExpanded(false)
                  void runSearch(1, pageSize)
                }}
                disabled={searching}
              >
                {searching ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <SearchIcon className="size-4" />
                )}
                Apply filters
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {importApi ? (
        <Dialog open={confirmImportAll} onOpenChange={setConfirmImportAll}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Import all matched students?</DialogTitle>
              <DialogDescription>
                This imports the{' '}
                <span className="font-semibold">
                  {result?.total.toLocaleString() ?? 0}
                </span>{' '}
                students currently matched into this drive. Students already in
                the drive are skipped — nothing is duplicated.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setConfirmImportAll(false)}
              >
                Cancel
              </Button>
              <Button onClick={() => void importAll()} disabled={importingAll}>
                {importingAll ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <UserPlus className="size-4" />
                )}
                Import all
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}

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
