import * as React from 'react'

import { Combobox, type ComboboxOption } from '@/components/ui/combobox'
import {
  useEmployeeNames,
  useEmployeeSearch,
  type DirectoryEmployee,
} from '@/lib/employee-directory'

export interface EmployeePickerProps {
  value: number | null
  onChange: (value: number | null) => void
  /** The full row, when the caller wants the name/code and not just the id. */
  onSelect?: (employee: DirectoryEmployee | null) => void
  /** Ids to hide from the results (e.g. already picked elsewhere in a list). */
  excludeIds?: number[]
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
  clearLabel?: string
  disabled?: boolean
  invalid?: boolean
  id?: string
  className?: string
}

/**
 * Searchable employee picker over the staff directory.
 *
 * Server-side search, not a preloaded list — the directory is far larger than
 * one page and every screen that needs a person would otherwise pay to load
 * all of it. A selected employee who isn't in the current result page (the
 * normal case for a saved value) is resolved by id so the trigger still shows
 * their name.
 */
export function EmployeePicker({
  value,
  onChange,
  onSelect,
  excludeIds,
  placeholder = 'Select an employee…',
  searchPlaceholder = 'Search by name or code…',
  emptyMessage = 'No employees found',
  clearLabel,
  disabled,
  invalid,
  id,
  className,
}: EmployeePickerProps) {
  const [query, setQuery] = React.useState('')
  const { rows, loading } = useEmployeeSearch(query)

  // Resolve the current value when the search page doesn't contain it.
  const inRows = rows.some((r) => r.id === value)
  const names = useEmployeeNames(value !== null && !inRows ? [value] : [])
  const resolved = value !== null ? names.get(value) : undefined

  // Depend on the contents, not the array identity, so an inline literal
  // doesn't rebuild the set on every render.
  const excludeKey = (excludeIds ?? []).join(',')
  const excluded = React.useMemo(
    () => new Set(excludeKey ? excludeKey.split(',').map(Number) : []),
    [excludeKey],
  )

  const toOption = (e: DirectoryEmployee): ComboboxOption => ({
    value: e.id,
    label: e.emp_display_name,
    sublabel: e.emp_code,
  })

  const options = rows
    // Never hide what is currently selected — it would blank the trigger.
    .filter((e) => e.id === value || !excluded.has(e.id))
    .map(toOption)

  return (
    <Combobox
      id={id}
      className={className}
      value={value}
      options={options}
      selectedOption={resolved ? toOption(resolved) : undefined}
      onQueryChange={setQuery}
      loading={loading}
      onChange={(v) => {
        onChange(v)
        if (onSelect) {
          onSelect(v === null ? null : (rows.find((r) => r.id === v) ?? null))
        }
      }}
      placeholder={placeholder}
      searchPlaceholder={searchPlaceholder}
      emptyMessage={emptyMessage}
      clearLabel={clearLabel}
      disabled={disabled}
      invalid={invalid}
    />
  )
}
