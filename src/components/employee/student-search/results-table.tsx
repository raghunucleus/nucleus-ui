import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react'

import { NativeSelect } from '@/components/corporate-relations/bits'
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
}: {
  meta: SearchMeta
  result: StudentSearchResult
  sort: { by: string; dir: 'asc' | 'desc' } | undefined
  onSort: (by: string) => void
  onPage: (page: number) => void
  onPageSize: (size: number) => void
}) {
  const byKey = new Map(meta.attributes.map((a) => [a.key, a]))

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
              {result.columns.map((key) => {
                const canSort = sortable(key)
                const active = sort?.by === key
                return (
                  <TableHead key={key}>
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
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={result.columns.length}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  No students match these filters.
                </TableCell>
              </TableRow>
            ) : (
              result.rows.map((row, i) => (
                <TableRow key={typeof row.id === 'number' ? row.id : i}>
                  {result.columns.map((key) => (
                    <TableCell key={key} className="whitespace-nowrap text-sm">
                      {renderCell(key, row[key])}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
