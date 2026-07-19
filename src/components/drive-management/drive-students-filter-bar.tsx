import { ChevronDown, ChevronRight, SlidersHorizontal } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { TableCell, TableRow } from '@/components/ui/table'
import {
  Field,
  NativeSelect,
  SearchableMultiSelect,
} from '@/components/corporate-relations/bits'
import type {
  DriveStudentDisplayItem,
  DriveStudentsFilterOptions,
  DriveStudentsFilters,
  DriveStudentsGroupBy,
} from '@/lib/drive-management'
import {
  EMPTY_DRIVE_STUDENTS_FILTERS,
  STUDENT_ENTRY_TYPE_LABELS,
} from '@/lib/drive-management'

/**
 * The Students tab's attribute filters, as a collapsible left rail laid out
 * like the Filter tab's editor panel. Shared by the manage and coordinator
 * drive-detail pages; search, status chips and group-by stay in the header.
 */
export function DriveStudentsFilterPanel({
  options,
  value,
  onChange,
}: {
  /** null while the options request is in flight. */
  options: DriveStudentsFilterOptions | null
  value: DriveStudentsFilters
  onChange: (next: DriveStudentsFilters) => void
}) {
  const hasFilters =
    value.programmeIds.length > 0 ||
    value.passoutYears.length > 0 ||
    value.entryType !== null

  return (
    <aside className="flex min-h-0 flex-col lg:h-full">
      <div className="flex min-h-0 max-h-[60vh] flex-1 flex-col rounded-xl border bg-card lg:max-h-none">
        <div className="scrollbar-themed min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
          <Field label="Programmes">
            <SearchableMultiSelect
              options={options?.programmes ?? []}
              selected={value.programmeIds}
              onChange={(ids) => onChange({ ...value, programmeIds: ids })}
              placeholder="All programmes"
              searchPlaceholder="Search programmes…"
              noOptions="No programmes yet."
              showSelectAll
            />
          </Field>
          <Field label="Passout year">
            <SearchableMultiSelect
              options={(options?.passout_years ?? []).map((y) => ({
                id: y,
                name: String(y),
              }))}
              selected={value.passoutYears}
              onChange={(ids) => onChange({ ...value, passoutYears: ids })}
              placeholder="All passout years"
              searchPlaceholder="Search years…"
              noOptions="No passout years yet."
              showSelectAll
            />
          </Field>
          <Field label="Entry type" htmlFor="drive-students-entry-type">
            <NativeSelect
              id="drive-students-entry-type"
              disabled={!options}
              value={value.entryType == null ? '' : String(value.entryType)}
              onChange={(e) =>
                onChange({
                  ...value,
                  entryType:
                    e.target.value === '' ? null : Number(e.target.value),
                })
              }
            >
              <option value="">All entry types</option>
              {(options?.entry_types ?? []).map((t) => (
                <option key={t} value={t}>
                  {STUDENT_ENTRY_TYPE_LABELS[t] ?? String(t)}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </div>
        <div className="shrink-0 border-t p-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full"
            disabled={!hasFilters}
            onClick={() =>
              onChange({
                ...EMPTY_DRIVE_STUDENTS_FILTERS,
                groupBy: value.groupBy,
              })
            }
          >
            Clear filters
          </Button>
        </div>
      </div>
    </aside>
  )
}

/** The header-row group-by select — sits beside the Students tab search box. */
export function DriveStudentsGroupBySelect({
  value,
  onChange,
}: {
  value: DriveStudentsGroupBy
  onChange: (next: DriveStudentsGroupBy) => void
}) {
  return (
    <NativeSelect
      aria-label="Group by"
      className="w-44"
      value={value}
      onChange={(e) => onChange(e.target.value as DriveStudentsGroupBy)}
    >
      <option value="none">No grouping</option>
      <option value="programme">Group: Programme</option>
      <option value="passout_year">Group: Passout year</option>
      <option value="entry_type">Group: Entry type</option>
    </NativeSelect>
  )
}

/** Opens/closes the filter rail. While closed, a badge keeps active filters
 *  visible so a narrowed list never looks like the full one. */
export function DriveStudentsFilterToggle({
  open,
  activeCount,
  onToggle,
}: {
  open: boolean
  activeCount: number
  onToggle: () => void
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className="relative size-9 shrink-0"
      aria-pressed={open}
      aria-label={open ? 'Hide filters' : 'Show filters'}
      title="Filters"
      onClick={onToggle}
    >
      <SlidersHorizontal className="size-4" />
      {!open && activeCount > 0 ? (
        <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-medium leading-none text-primary-foreground">
          {activeCount}
        </span>
      ) : null}
    </Button>
  )
}

/** The collapsible full-width group header row of the grouped Students view. */
export function DriveStudentGroupHeaderRow({
  item,
  colSpan,
  onToggle,
}: {
  item: Extract<DriveStudentDisplayItem, { kind: 'header' }>
  colSpan: number
  onToggle: () => void
}) {
  return (
    <TableRow className="bg-muted/50 hover:bg-muted/50">
      <TableCell colSpan={colSpan} className="py-1.5">
        <button
          type="button"
          aria-expanded={item.open}
          onClick={onToggle}
          className="flex w-full items-center gap-2 text-sm font-medium"
        >
          {item.open ? (
            <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          )}
          <span className="truncate">{item.label}</span>
          <span className="text-xs font-normal text-muted-foreground">
            {item.count} student{item.count === 1 ? '' : 's'}
          </span>
        </button>
      </TableCell>
    </TableRow>
  )
}
