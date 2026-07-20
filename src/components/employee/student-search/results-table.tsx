import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronsUpDown,
  Eye,
  Loader2,
  Plus,
} from 'lucide-react'

import type { ReactNode } from 'react'

import { NativeSelect } from '@/components/corporate-relations/bits'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Pagination } from '@/components/ui/pagination'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type {
  SearchMeta,
  StudentSearchResult,
} from '@/lib/student-search'
import { IMPLICIT_COLUMN_LABELS } from '@/lib/student-search'
import { cn } from '@/lib/utils'

const PAGE_SIZES = [25, 50, 100]

/** One caller-rendered leading column. See {@link ResultsTable}'s `rowColumns`. */
export interface RowColumnDef {
  key: string
  header: string
  /** Width / alignment classes, applied to both the header and the cells. */
  className?: string
  render: (row: Record<string, unknown>) => ReactNode
}

/**
 * Table-shaped loading state — a results bar plus a header and shimmer rows,
 * matching {@link ResultsTable}'s frame so a search-in-flight reads as "this
 * table is reloading" rather than a plain grey slab.
 */
export function ResultsSkeleton({ columns }: { columns: number }) {
  const cols = Math.max(3, Math.min(columns, 8))
  return (
    <div className="flex h-full min-h-0 flex-col space-y-3">
      <div className="flex shrink-0 items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2">
        <div className="h-5 w-40 animate-pulse rounded bg-muted" />
        <div className="h-5 w-48 animate-pulse rounded bg-muted" />
      </div>
      <div className="min-h-0 flex-1 overflow-hidden rounded-lg border">
        <Table>
          <TableHeader className="bg-card">
            <TableRow>
              {Array.from({ length: cols }).map((_, i) => (
                <TableHead key={i}>
                  <div className="h-3.5 w-20 animate-pulse rounded bg-muted" />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 8 }).map((_, r) => (
              <TableRow key={r}>
                {Array.from({ length: cols }).map((_, c) => (
                  <TableCell key={c}>
                    <div
                      className="h-3.5 animate-pulse rounded bg-muted"
                      style={{ width: `${60 + ((r + c) % 4) * 12}%` }}
                    />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

/**
 * The result grid: columns exactly as the server resolved them (implicit
 * first), header sort on sortable attributes, and a footer with total +
 * pager + page-size select. Cell rendering leans on meta (enum labels,
 * booleans, arrays) the same way the server's file export does.
 */
export function ResultsTable({
  meta,
  result,
  sort,
  onSort,
  onPage,
  onPageSize,
  onImportRow,
  importingId,
  rowColumns,
  onRowOpen,
  appendColumns,
  hideColumns,
  stickyColumn,
  cellRenderers,
}: {
  meta: SearchMeta
  result: StudentSearchResult
  sort: { by: string; dir: 'asc' | 'desc' } | undefined
  onSort: (by: string) => void
  onPage: (page: number) => void
  onPageSize: (size: number) => void
  /**
   * When set, a leading action column renders per row: an Import button, or a
   * disabled "In drive" badge when the row's `in_drive` flag is true. Omitted
   * by the plain search consumers (e.g. the student directory).
   */
  onImportRow?: (row: Record<string, unknown>) => void
  /** Student id currently being imported (its button spins). */
  importingId?: number | null
  /**
   * Caller-rendered leading columns, before the resolved result columns — for
   * per-row controls the registry can't express (the placement coordinator's
   * allowed toggle and profile-completion bar). Each def gets its own header,
   * so two unrelated controls are never crammed under one label. The row is
   * the raw server object, so a consumer can read fields its own endpoint
   * attached beyond the resolved columns.
   */
  rowColumns?: RowColumnDef[]
  /**
   * When set, the row becomes openable: the name cell turns into a button and a
   * trailing View column appears. Opt-in, so surfaces with no detail view (the
   * plain directory, the drive Filter tab) render exactly as before.
   */
  onRowOpen?: (row: Record<string, unknown>) => void
  /**
   * Caller-rendered columns AFTER the resolved ones — for a column the registry
   * can't express because it isn't a value at all (the eligibility screen's
   * Academics hover card). Same def shape as {@link rowColumns}.
   */
  appendColumns?: RowColumnDef[]
  /**
   * Resolved columns to drop before rendering — the row object still carries
   * them. For keys the server always returns but a surface has no use for
   * (`id`, the raw database key, which would otherwise sit left of the roll
   * number and break a left-pinned column).
   */
  hideColumns?: string[]
  /**
   * Key of the column pinned to the left edge while the table scrolls
   * horizontally. Only meaningful for the first rendered column — anything to
   * its left would scroll out from under it.
   */
  stickyColumn?: string
  /**
   * Per-column cell overrides, keyed by column key. Used for cells that are
   * more than a value — the eligibility screen's hover cards. Everything not
   * listed renders through the default value formatter.
   */
  cellRenderers?: Record<string, (row: Record<string, unknown>) => ReactNode>
}) {
  const byKey = new Map(meta.attributes.map((a) => [a.key, a]))
  const showImport = !!onImportRow
  const showOpen = !!onRowOpen
  const extraCols = rowColumns ?? []
  const trailingCols = appendColumns ?? []
  const hidden = hideColumns
  const shownColumns = hidden?.length
    ? result.columns.filter((c) => !hidden.includes(c))
    : result.columns
  const colSpan =
    shownColumns.length +
    extraCols.length +
    trailingCols.length +
    (showImport ? 1 : 0) +
    (showOpen ? 1 : 0)

  // The pinned cell must also out-rank the sticky header row (z-10) so the
  // corner stays on top of both axes.
  const stickyCell = 'sticky left-0 z-10 border-r bg-card'
  const stickyHead = 'sticky left-0 z-20 border-r bg-card'

  const labelOf = (key: string) =>
    IMPLICIT_COLUMN_LABELS[key] ?? byKey.get(key)?.label ?? key

  const sortable = (key: string) =>
    key === 'display_name' || key === 'student_id' || !!byKey.get(key)?.sortable

  const renderCell = (key: string, value: unknown): string => {
    if (value === null || value === undefined || value === '') return '—'
    if (Array.isArray(value)) return value.map(String).join('; ')
    if (typeof value === 'boolean') return value ? 'Yes' : 'No'
    const labels = byKey.get(key)?.enumLabels
    if (labels && labels[String(value)]) return labels[String(value)]
    return String(value)
  }

  return (
    <div className="flex h-full min-h-0 flex-col space-y-3">
      {/* Results bar — pinned above the table so the total + controls stay
          visible instead of sitting below a tall scroll box. */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2">
        <div className="flex items-baseline gap-2">
          <span className="text-base font-semibold">
            {result.total.toLocaleString()}
          </span>
          <span className="text-sm text-muted-foreground">
            student{result.total === 1 ? '' : 's'}
            {result.pageCount > 1
              ? ` · page ${result.page} of ${result.pageCount}`
              : ''}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Pagination
            page={result.page}
            totalPages={result.pageCount}
            onPage={onPage}
          />
          <NativeSelect
            className="h-8 w-auto"
            value={String(result.pageSize)}
            onChange={(e) => onPageSize(Number(e.target.value))}
            aria-label="Rows per page"
          >
            {PAGE_SIZES.map((s) => (
              <option key={s} value={s}>
                {s} / page
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden rounded-lg border">
        <Table containerClassName="h-full max-h-[62vh] overflow-y-auto scrollbar-themed lg:max-h-none">
          <TableHeader className="sticky top-0 z-10 bg-card">
            <TableRow>
              {showImport ? (
                <TableHead className="w-24 whitespace-nowrap" />
              ) : null}
              {extraCols.map((c) => (
                <TableHead
                  key={c.key}
                  className={cn('whitespace-nowrap', c.className)}
                >
                  {c.header}
                </TableHead>
              ))}
              {shownColumns.map((key) => {
                const canSort = sortable(key)
                const active = sort?.by === key
                return (
                  <TableHead
                    key={key}
                    className={cn(key === stickyColumn && stickyHead)}
                  >
                    {canSort ? (
                      <button
                        type="button"
                        onClick={() => onSort(key)}
                        className={cn(
                          'inline-flex items-center gap-1 hover:text-foreground',
                          active && 'text-foreground',
                        )}
                      >
                        {labelOf(key)}
                        {active ? (
                          sort?.dir === 'asc' ? (
                            <ArrowUp className="size-3" />
                          ) : (
                            <ArrowDown className="size-3" />
                          )
                        ) : (
                          <ChevronsUpDown className="size-3 opacity-40" />
                        )}
                      </button>
                    ) : (
                      labelOf(key)
                    )}
                  </TableHead>
                )
              })}
              {trailingCols.map((c) => (
                <TableHead
                  key={c.key}
                  className={cn('whitespace-nowrap', c.className)}
                >
                  {c.header}
                </TableHead>
              ))}
              {showOpen ? (
                <TableHead className="w-20 whitespace-nowrap" />
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={colSpan}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  No students match these filters.
                </TableCell>
              </TableRow>
            ) : (
              result.rows.map((row, i) => {
                const rowId = typeof row.id === 'number' ? row.id : undefined
                const inDrive = row.in_drive === true
                return (
                  <TableRow key={rowId ?? i}>
                    {showImport ? (
                      <TableCell className="whitespace-nowrap">
                        {inDrive ? (
                          <Badge variant="secondary" className="gap-1">
                            <Check className="size-3" /> In drive
                          </Badge>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7"
                            disabled={importingId != null}
                            onClick={() => onImportRow?.(row)}
                          >
                            {importingId === rowId ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              <Plus className="size-3.5" />
                            )}
                            Import
                          </Button>
                        )}
                      </TableCell>
                    ) : null}
                    {extraCols.map((c) => (
                      <TableCell
                        key={c.key}
                        className={cn('whitespace-nowrap', c.className)}
                      >
                        {c.render(row)}
                      </TableCell>
                    ))}
                    {shownColumns.map((key) => {
                      const custom = cellRenderers?.[key]
                      return (
                        <TableCell
                          key={key}
                          className={cn(
                            'whitespace-nowrap text-sm',
                            key === stickyColumn && stickyCell,
                          )}
                        >
                          {custom ? (
                            custom(row)
                          ) : showOpen && key === 'display_name' ? (
                            <button
                              type="button"
                              onClick={() => onRowOpen?.(row)}
                              className="font-medium text-primary underline-offset-2 hover:underline"
                            >
                              {renderCell(key, row[key])}
                            </button>
                          ) : (
                            renderCell(key, row[key])
                          )}
                        </TableCell>
                      )
                    })}
                    {trailingCols.map((c) => (
                      <TableCell
                        key={c.key}
                        className={cn('whitespace-nowrap', c.className)}
                      >
                        {c.render(row)}
                      </TableCell>
                    ))}
                    {showOpen ? (
                      <TableCell className="whitespace-nowrap">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7"
                          onClick={() => onRowOpen?.(row)}
                        >
                          <Eye className="size-3.5" />
                          View
                        </Button>
                      </TableCell>
                    ) : null}
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
