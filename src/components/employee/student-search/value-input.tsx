import { Input } from '@/components/ui/input'
import {
  NativeSelect,
  SearchableMultiSelect,
  SearchableSelect,
} from '@/components/corporate-relations/bits'
import type {
  FkOption,
  MetaAttribute,
  SearchOperator,
} from '@/lib/student-search'
import { cn } from '@/lib/utils'

/**
 * The value editor for one filter condition, chosen by attribute kind and
 * operator. Kept dumb: value in, value out — the row owns the condition.
 *
 * Value shapes match what the server expects per operator: scalar for the
 * comparison ops, an array for in/not_in, a [min, max] pair for between, and
 * nothing at all for is_null/not_null.
 */
export function ValueInput({
  attr,
  op,
  value,
  onChange,
  fkOptions,
}: {
  attr: MetaAttribute
  op: SearchOperator
  value: unknown
  onChange: (value: unknown) => void
  /** Loaded id/label rows for this attribute's fkLookup (undefined = loading). */
  fkOptions?: FkOption[]
}) {
  if (op === 'is_null' || op === 'not_null') return null

  const multi = op === 'in' || op === 'not_in'

  if (attr.kind === 'fk') {
    const options = (fkOptions ?? []).map((o) => ({ id: o.id, name: o.label }))
    if (fkOptions === undefined) {
      return (
        <div className="h-9 w-full animate-pulse rounded-md border bg-muted" />
      )
    }
    if (multi) {
      const selected = Array.isArray(value)
        ? value.filter((v): v is number => typeof v === 'number')
        : []
      return (
        <SearchableMultiSelect
          options={options}
          selected={selected}
          onChange={(ids) => onChange(ids)}
          placeholder={`Select ${attr.label.toLowerCase()}…`}
        />
      )
    }
    return (
      <SearchableSelect
        options={options}
        value={typeof value === 'number' ? value : null}
        onChange={(id) => onChange(id)}
        placeholder={`Select ${attr.label.toLowerCase()}…`}
      />
    )
  }

  if (attr.kind === 'enum') {
    const enumValues = attr.enumValues ?? []
    const labelOf = (v: string | number) =>
      attr.enumLabels?.[String(v)] ?? String(v)
    if (multi) {
      const selected = Array.isArray(value) ? value : []
      const toggle = (v: string | number) =>
        onChange(
          selected.includes(v)
            ? selected.filter((x) => x !== v)
            : [...selected, v],
        )
      return (
        <div className="flex flex-wrap gap-1.5">
          {enumValues.map((v) => {
            const on = selected.includes(v)
            return (
              <button
                key={String(v)}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(v)}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                  on
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'bg-card hover:bg-accent hover:text-accent-foreground',
                )}
              >
                {labelOf(v)}
              </button>
            )
          })}
        </div>
      )
    }
    return (
      <NativeSelect
        value={value === undefined || value === null ? '' : String(value)}
        onChange={(e) => {
          const raw = e.target.value
          if (raw === '') return onChange(undefined)
          // Preserve the enum's declared value type (entry_type is numeric).
          const match = enumValues.find((v) => String(v) === raw)
          onChange(match ?? raw)
        }}
      >
        <option value="">Select…</option>
        {enumValues.map((v) => (
          <option key={String(v)} value={String(v)}>
            {labelOf(v)}
          </option>
        ))}
      </NativeSelect>
    )
  }

  if (attr.kind === 'boolean') {
    return (
      <NativeSelect
        value={value === true ? 'true' : value === false ? 'false' : ''}
        onChange={(e) =>
          onChange(e.target.value === '' ? undefined : e.target.value === 'true')
        }
      >
        <option value="">Select…</option>
        <option value="true">Yes</option>
        <option value="false">No</option>
      </NativeSelect>
    )
  }

  const inputType =
    attr.kind === 'number' ? 'number' : attr.kind === 'date' ? 'date' : 'text'

  if (op === 'between') {
    const pair = Array.isArray(value) ? value : [undefined, undefined]
    const setAt = (i: 0 | 1, raw: string) => {
      const next = [pair[0], pair[1]]
      next[i] = parseScalar(raw, attr.kind)
      onChange(next)
    }
    return (
      <div className="flex items-center gap-2">
        <Input
          type={inputType}
          value={displayScalar(pair[0])}
          onChange={(e) => setAt(0, e.target.value)}
        />
        <span className="text-xs text-muted-foreground">and</span>
        <Input
          type={inputType}
          value={displayScalar(pair[1])}
          onChange={(e) => setAt(1, e.target.value)}
        />
      </div>
    )
  }

  if (multi) {
    // Free-typed multi values (number/string/date IN) — comma-separated.
    const list = Array.isArray(value) ? value : []
    return (
      <Input
        type="text"
        value={list.map((v) => String(v)).join(', ')}
        onChange={(e) => {
          const parts = e.target.value
            .split(',')
            .map((p) => p.trim())
            .filter((p) => p !== '')
          onChange(parts.map((p) => parseScalar(p, attr.kind)))
        }}
      />
    )
  }

  return (
    <Input
      type={inputType}
      value={displayScalar(value)}
      onChange={(e) => onChange(parseScalar(e.target.value, attr.kind))}
    />
  )
}

function parseScalar(raw: string, kind: MetaAttribute['kind']): unknown {
  if (raw === '') return undefined
  if (kind === 'number') {
    const n = Number(raw)
    return Number.isFinite(n) ? n : undefined
  }
  return raw
}

function displayScalar(v: unknown): string {
  return v === undefined || v === null ? '' : String(v)
}
