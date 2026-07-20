import * as React from 'react'
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  GripVertical,
  Loader2,
  Search,
  X,
} from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  buildSections,
  useCollapsibleSections,
} from '@/components/employee/student-search/picker-sections'
import { ApiError } from '@/lib/api'
import type {
  DriveStudentsExportApi,
  DriveStudentsExportBody,
  DriveStudentsExportColumn,
  DriveStudentsExportColumns,
} from '@/lib/drive-management'
import { employeeNavigateTo } from '@/lib/employee-navigate'
import type { ExportFormat } from '@/lib/student-search'
import { cn } from '@/lib/utils'

/**
 * Column picker + order editor for the drive Students tab export.
 *
 * Two panes: the catalog on the left (drive lifecycle fields, then every
 * student attribute, grouped and searchable) and the ORDERED selection on the
 * right. The right pane is the point — the array it holds is literally the
 * spreadsheet's left-to-right column layout, so it is reorderable by drag and
 * by arrow buttons (arrows matter: dragging is awkward with 40 rows, and it's
 * the only keyboard-reachable path).
 *
 * Shared by the Drive Management and Placement Coordinator drive-detail
 * screens; only `api` differs, so scoping stays entirely server-side.
 */

const MAX_COLUMNS = 60
const STORAGE_KEY = 'drive-students-export-columns'

/** Remember the last picked columns — repeat exports shouldn't re-pick. */
function loadRemembered(): string[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) && parsed.every((k) => typeof k === 'string')
      ? (parsed as string[])
      : null
  } catch {
    return null
  }
}

function remember(columns: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(columns))
  } catch {
    // Private mode / quota — the picker still works, it just won't persist.
  }
}

export function DriveStudentsExportDialog({
  open,
  onOpenChange,
  api,
  filters,
  total,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  api: DriveStudentsExportApi
  /** The tab's live filter state — replayed so the file matches the screen. */
  filters: Omit<DriveStudentsExportBody, 'columns' | 'format'>
  /** Row count under those filters, for the footer hint. */
  total: number
}) {
  const [catalog, setCatalog] = React.useState<DriveStudentsExportColumns | null>(
    null,
  )
  const [loadError, setLoadError] = React.useState<string | null>(null)
  const [columns, setColumns] = React.useState<string[]>([])
  const [format, setFormat] = React.useState<ExportFormat>('xlsx')
  const [query, setQuery] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)

  // Load the catalog once per open. Remembered columns are filtered against it
  // so a column removed from the registry can't wedge the picker.
  React.useEffect(() => {
    if (!open || catalog) return
    let cancelled = false
    void api
      .columns()
      .then((c) => {
        if (cancelled) return
        setCatalog(c)
        const known = new Set(c.columns.map((col) => col.key))
        const remembered = loadRemembered()?.filter((k) => known.has(k))
        setColumns(
          remembered?.length ? remembered : c.defaultColumns.filter((k) => known.has(k)),
        )
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setLoadError(
          err instanceof ApiError ? err.message : 'Could not load the columns.',
        )
      })
    return () => {
      cancelled = true
    }
  }, [open, catalog, api])

  // Re-seeded on each open, adjusted during render rather than in an effect —
  // the reset lands in the same commit, so the list never flashes the previous
  // search. (Same pattern as ColumnPickerDialog.)
  const [wasOpen, setWasOpen] = React.useState(open)
  if (wasOpen !== open) {
    setWasOpen(open)
    if (open) setQuery('')
  }

  const byKey = React.useMemo(
    () => new Map((catalog?.columns ?? []).map((c) => [c.key, c])),
    [catalog],
  )

  const { sections } = React.useMemo(
    () => buildSections(catalog?.columns ?? [], catalog?.groups ?? [], query),
    [catalog, query],
  )
  const collapse = useCollapsibleSections(sections, query, open)

  const atLimit = columns.length >= MAX_COLUMNS

  const toggle = (key: string) =>
    setColumns((prev) =>
      prev.includes(key)
        ? prev.filter((c) => c !== key)
        : prev.length >= MAX_COLUMNS
          ? prev
          : [...prev, key],
    )

  const move = (from: number, to: number) =>
    setColumns((prev) => {
      if (to < 0 || to >= prev.length) return prev
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })

  // Native HTML5 drag — no dependency, and the arrow buttons cover the cases
  // dragging handles badly (long lists, keyboards, touch).
  const dragFrom = React.useRef<number | null>(null)

  const submit = async () => {
    if (columns.length === 0) {
      toast.info('Pick at least one column to export.')
      return
    }
    setSubmitting(true)
    try {
      await api.create({ ...filters, columns, format })
      remember(columns)
      onOpenChange(false)
      toast.success(
        "Export started — you'll get a notification when it's ready.",
        {
          action: {
            label: 'My exports',
            onClick: () => employeeNavigateTo('/exports'),
          },
        },
      )
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : 'Could not start the export.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl gap-3">
        <DialogHeader>
          <DialogTitle>Export students</DialogTitle>
        </DialogHeader>

        {loadError ? (
          <p className="py-10 text-center text-sm text-destructive">
            {loadError}
          </p>
        ) : !catalog ? (
          <p className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading columns…
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-[1fr_20rem]">
            {/* --- catalog ------------------------------------------------ */}
            <div className="min-w-0">
              <div className="mb-2 flex items-center gap-2 rounded-md border px-3 py-2">
                <Search className="size-4 shrink-0 text-muted-foreground" />
                <input
                  autoFocus
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search columns…"
                  className="h-6 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    className="text-muted-foreground hover:text-foreground"
                    aria-label="Clear search"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>

              <div className="max-h-[55vh] space-y-1 overflow-y-auto pr-1">
                {sections.length === 0 ? (
                  <div className="py-16 text-center text-sm text-muted-foreground">
                    No columns match
                  </div>
                ) : (
                  sections.map((section) => {
                    const selected = section.items.filter((i) =>
                      columns.includes(i.attr.key),
                    ).length
                    const openSection = collapse.isOpen(section.key)
                    return (
                      <div key={section.key}>
                        <button
                          type="button"
                          onClick={() => collapse.toggle(section.key)}
                          className="flex w-full items-baseline gap-2 border-b px-1 py-1.5 text-left hover:bg-accent/50"
                        >
                          {openSection ? (
                            <ChevronDown className="size-3.5 self-center text-muted-foreground" />
                          ) : (
                            <ChevronRight className="size-3.5 self-center text-muted-foreground" />
                          )}
                          <span className="text-[11px] font-semibold uppercase tracking-wide">
                            {section.label}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {selected}/{section.items.length}
                          </span>
                        </button>
                        {openSection && (
                          <div className="py-1 sm:columns-2">
                            {section.items.map(({ attr }) => {
                              const on = columns.includes(attr.key)
                              const disabled = !on && atLimit
                              return (
                                <label
                                  key={attr.key}
                                  className={cn(
                                    'flex cursor-pointer items-center gap-2 break-inside-avoid rounded px-2 py-1 text-sm hover:bg-accent',
                                    disabled &&
                                      'cursor-not-allowed opacity-50',
                                  )}
                                >
                                  <input
                                    type="checkbox"
                                    checked={on}
                                    disabled={disabled}
                                    onChange={() => toggle(attr.key)}
                                    className="accent-primary"
                                  />
                                  <span className="min-w-0 truncate">
                                    {attr.label}
                                  </span>
                                </label>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            {/* --- ordered selection -------------------------------------- */}
            <div className="min-w-0">
              <div className="mb-2 flex items-baseline justify-between border-b px-1 py-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wide">
                  Column order
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {columns.length}/{MAX_COLUMNS}
                </span>
              </div>

              <div className="max-h-[55vh] space-y-1 overflow-y-auto pr-1">
                {columns.length === 0 ? (
                  <p className="px-2 py-8 text-center text-sm text-muted-foreground">
                    Pick columns on the left. They appear here in the order
                    they'll have in the file.
                  </p>
                ) : (
                  columns.map((key, i) => (
                    <div
                      key={key}
                      draggable
                      onDragStart={() => {
                        dragFrom.current = i
                      }}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault()
                        if (dragFrom.current !== null) move(dragFrom.current, i)
                        dragFrom.current = null
                      }}
                      onDragEnd={() => {
                        dragFrom.current = null
                      }}
                      className="flex items-center gap-1 rounded border bg-card px-1.5 py-1 text-sm"
                    >
                      <GripVertical className="size-3.5 shrink-0 cursor-grab text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate">
                        {byKey.get(key)?.label ?? key}
                      </span>
                      <button
                        type="button"
                        onClick={() => move(i, i - 1)}
                        disabled={i === 0}
                        aria-label={`Move ${byKey.get(key)?.label ?? key} up`}
                        className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
                      >
                        <ArrowUp className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => move(i, i + 1)}
                        disabled={i === columns.length - 1}
                        aria-label={`Move ${byKey.get(key)?.label ?? key} down`}
                        className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
                      >
                        <ArrowDown className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => toggle(key)}
                        aria-label={`Remove ${byKey.get(key)?.label ?? key}`}
                        className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="items-center gap-3 sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex rounded-md border p-0.5">
              {(['xlsx', 'csv'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFormat(f)}
                  className={cn(
                    'rounded px-2.5 py-1 text-xs font-medium',
                    format === f
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {f === 'xlsx' ? 'Excel' : 'CSV'}
                </button>
              ))}
            </div>
            <span className="text-xs text-muted-foreground">
              {total.toLocaleString()} student{total === 1 ? '' : 's'} match the
              current filters
              {format === 'csv' ? ' — CSV shows the resume link as a raw URL' : ''}
            </span>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={() => void submit()}
            disabled={submitting || !catalog || columns.length === 0}
          >
            {submitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              'Export'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export type { DriveStudentsExportColumn }
