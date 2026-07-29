import { Check, Loader2, Pencil, Plus, Search, Star, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

/**
 * The list-and-edit half of an "attributes" configuration screen: add, search,
 * rename and activate/deactivate the values of one lookup kind, plus whatever
 * boolean `flags`, numeric `numberFields` and exclusive `defaultMarker` that
 * kind carries.
 *
 * Deliberately domain-free — it knows nothing about which screen hosts it or
 * what its lookups mean. The page owns the kind switcher and adapts its own
 * data layer into the callbacks below, so this component never imports from
 * `lib/corporate-relations` or `lib/drive-management`.
 *
 * Mount it with `key={kind}` so switching kinds remounts it: the loaded values,
 * search text and in-progress edits all reset without a synchronising effect.
 */

export interface LookupRow {
  id: number
  name: string
  is_active: boolean
}

/**
 * A boolean column a row carries beyond name/status — e.g. an offer type's
 * internship flag. Rows are read generically by `key`, so a flag is just a
 * property name the host page happens to know about.
 */
export interface LookupFlag {
  key: string
  label: string
}

/**
 * A numeric column a row carries beyond name/status — e.g. a placement
 * category's salary bound. Like flags, read generically by `key`; an empty
 * input means null, which the host is free to treat as "unset".
 */
export interface LookupNumberField {
  key: string
  label: string
  placeholder?: string
}

/**
 * The kind-specific values a row carries beyond name/status, keyed by field.
 * Flags and number fields share one bag so the host page can spread it straight
 * into a request body.
 */
export type LookupExtras = Record<string, boolean | number | null>

/**
 * An EXCLUSIVE marker: at most one value in the list carries it — e.g. the
 * current status a CR View record shows before anything is recorded.
 *
 * Deliberately not a `flag`. Flags are independent per-row booleans and
 * `toggleFlag` merges them on the one row it was given, so using one here would
 * never clear the previous holder. This one MOVES, so the host owns a single
 * "make this the default" call and the list is reloaded from the server rather
 * than patched locally. There is no unset — the marker only ever moves.
 */
export interface LookupDefaultMarker {
  /** Row property holding the flag, e.g. `is_default`. */
  key: string
  /** Badge on the row that carries it, e.g. "Default". */
  label: string
  /** Button label / tooltip on the rows that don't, e.g. "Make default". */
  actionLabel: string
  set: (id: number) => Promise<unknown>
}

interface LookupEditorProps<T extends LookupRow> {
  load: () => Promise<T[]>
  create: (name: string, extras: LookupExtras) => Promise<unknown>
  /** Saves the name and any `numberFields` together, in one request. */
  rename: (id: number, name: string, extras: LookupExtras) => Promise<unknown>
  setStatus: (id: number, isActive: boolean) => Promise<unknown>
  /** When given, a row must keep at least one of these set. Needs `setFlags`. */
  flags?: LookupFlag[]
  setFlags?: (id: number, flags: Record<string, boolean>) => Promise<unknown>
  /** Shown when an edit would leave a row with no flag set. Required with `flags`. */
  flagsMessage?: string
  /** Numeric columns edited alongside the name. Saved through `rename`. */
  numberFields?: LookupNumberField[]
  /** When given, one row in the list is marked as the kind's default. */
  defaultMarker?: LookupDefaultMarker
  /**
   * Cross-field rules the host owns (this component knows nothing about what a
   * field means). Return a message to block the add/save, or null to allow it.
   */
  validateExtras?: (extras: LookupExtras) => string | null
  /** A short summary badge beside the name — e.g. a formatted range. */
  formatRow?: (row: T) => string | null
  searchPlaceholder?: string
  canCreate: boolean
  canEdit: boolean
  canActivate: boolean
}

function msg(e: unknown, fallback: string): string {
  return e instanceof Error ? e.message : fallback
}

function flagOf(row: LookupRow, key: string): boolean {
  return !!(row as unknown as Record<string, unknown>)[key]
}

/** The row's raw value for a number field, as text for an input. */
function numberOf(row: LookupRow, key: string): string {
  const v = (row as unknown as Record<string, unknown>)[key]
  return v === null || v === undefined ? '' : String(Number(v))
}

/** Input text → the value sent up: blank is null, anything unparseable is null. */
function parseNumbers(
  fields: LookupNumberField[],
  text: Record<string, string>,
): LookupExtras {
  const out: LookupExtras = {}
  for (const f of fields) {
    const raw = (text[f.key] ?? '').trim()
    const n = raw === '' ? null : Number(raw)
    out[f.key] = n === null || Number.isNaN(n) ? null : n
  }
  return out
}

function NumberBox({
  field,
  value,
  disabled,
  onChange,
}: {
  field: LookupNumberField
  value: string
  disabled?: boolean
  onChange: (next: string) => void
}) {
  return (
    <Input
      type="number"
      inputMode="decimal"
      min={0}
      step="0.5"
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      placeholder={field.placeholder ?? field.label}
      aria-label={field.label}
      className="h-8 w-24"
    />
  )
}

function FlagBox({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string
  checked: boolean
  disabled?: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <label
      className={cn(
        'flex items-center gap-1.5 whitespace-nowrap text-xs',
        disabled ? 'text-muted-foreground' : 'cursor-pointer',
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="size-3.5"
      />
      {label}
    </label>
  )
}

export default function LookupEditor<T extends LookupRow>({
  load,
  create,
  rename,
  setStatus,
  flags,
  setFlags,
  flagsMessage,
  numberFields,
  defaultMarker,
  validateExtras,
  formatRow,
  searchPlaceholder = 'Search values…',
  canCreate,
  canEdit,
  canActivate,
}: LookupEditorProps<T>) {
  const hasFlags = !!flags?.length && !!setFlags
  const hasNumbers = !!numberFields?.length

  const [values, setValues] = useState<T[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [newName, setNewName] = useState('')
  const [newFlags, setNewFlags] = useState<Record<string, boolean>>({})
  // Number fields are held as raw input text, so a half-typed "1." survives a
  // keystroke; they're parsed once on add/save.
  const [newNumbers, setNewNumbers] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [editNumbers, setEditNumbers] = useState<Record<string, string>>({})
  const [markingId, setMarkingId] = useState<number | null>(null)

  async function reload() {
    setValues(null)
    setError(null)
    try {
      setValues(await load())
    } catch (e) {
      setError(msg(e, 'Could not load values.'))
    }
  }

  useEffect(() => {
    void reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Client-side filter: the whole list is already in memory, so there's no
  // request to debounce.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q || !values) return values ?? []
    return values.filter((v) => v.name.toLowerCase().includes(q))
  }, [values, search])

  const newFlagsSet = hasFlags && flags!.some((f) => newFlags[f.key])
  const canAdd = !!newName.trim() && (!hasFlags || newFlagsSet)

  /** Merge this row's flags and numbers into the single bag the host receives. */
  function extrasFrom(numbers: Record<string, string>, rowFlags: Record<string, boolean>): LookupExtras {
    return {
      ...(hasFlags ? rowFlags : {}),
      ...(hasNumbers ? parseNumbers(numberFields!, numbers) : {}),
    }
  }

  async function add() {
    if (!canAdd) return
    const extras = extrasFrom(newNumbers, newFlags)
    // A rule the host owns is a constraint, not a failure — say so instead of
    // firing a request the server would reject anyway.
    const invalid = validateExtras?.(extras)
    if (invalid) {
      toast.info(invalid)
      return
    }
    setBusy(true)
    try {
      await create(newName.trim(), extras)
      setNewName('')
      setNewFlags({})
      setNewNumbers({})
      toast.success('Added.')
      await reload()
    } catch (e) {
      toast.error(msg(e, 'Could not add.'))
    } finally {
      setBusy(false)
    }
  }

  async function saveEdit(row: T) {
    if (!editName.trim()) return
    const extras = hasNumbers ? parseNumbers(numberFields!, editNumbers) : {}
    const invalid = hasNumbers ? validateExtras?.(extras) : null
    if (invalid) {
      toast.info(invalid)
      return
    }
    try {
      await rename(row.id, editName.trim(), extras)
      setEditId(null)
      toast.success('Saved.')
      await reload()
    } catch (e) {
      toast.error(msg(e, 'Could not save.'))
    }
  }

  function startEdit(row: T) {
    setEditId(row.id)
    setEditName(row.name)
    if (hasNumbers) {
      const seed: Record<string, string> = {}
      for (const f of numberFields!) seed[f.key] = numberOf(row, f.key)
      setEditNumbers(seed)
    }
  }

  async function toggleFlag(row: T, key: string, next: boolean) {
    const merged: Record<string, boolean> = {}
    for (const f of flags!) merged[f.key] = flagOf(row, f.key)
    merged[key] = next
    // Clearing the last flag is a constraint, not a failure — say so instead of
    // firing a request the server would reject anyway.
    if (!Object.values(merged).some(Boolean)) {
      toast.info(flagsMessage ?? 'At least one must stay selected.')
      return
    }
    try {
      await setFlags!(row.id, merged)
      await reload()
    } catch (e) {
      toast.error(msg(e, 'Could not update.'))
    }
  }

  async function makeDefault(row: T) {
    // Both of these are constraints the server also enforces — saying so beats
    // firing a request that would come back 400.
    if (!row.is_active) {
      toast.info('Activate this value before making it the default.')
      return
    }
    setMarkingId(row.id)
    try {
      await defaultMarker!.set(row.id)
      toast.success('Default updated.')
      // A full reload rather than a local patch: the marker moved off some
      // other row too, and only the server knows which.
      await reload()
    } catch (e) {
      toast.error(msg(e, 'Could not update.'))
    } finally {
      setMarkingId(null)
    }
  }

  async function toggleActive(row: T) {
    // The marker has no unset, so deactivating its holder would leave whatever
    // reads the default pointing at a value nobody can pick.
    if (defaultMarker && row.is_active && flagOf(row, defaultMarker.key)) {
      toast.info('Make another value the default first.')
      return
    }
    try {
      await setStatus(row.id, !row.is_active)
      await reload()
    } catch (e) {
      toast.error(msg(e, 'Could not update.'))
    }
  }

  const total = values?.length ?? 0
  const searching = !!search.trim()

  return (
    <div className="space-y-3">
      {canCreate && (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void add()}
            placeholder="Add a value…"
            className="min-w-40 flex-1"
          />
          {hasFlags && (
            <div className="flex items-center gap-3 px-1">
              {flags!.map((f) => (
                <FlagBox
                  key={f.key}
                  label={f.label}
                  checked={!!newFlags[f.key]}
                  onChange={(next) =>
                    setNewFlags((prev) => ({ ...prev, [f.key]: next }))
                  }
                />
              ))}
            </div>
          )}
          {hasNumbers && (
            <div className="flex items-center gap-2">
              {numberFields!.map((f) => (
                <NumberBox
                  key={f.key}
                  field={f}
                  value={newNumbers[f.key] ?? ''}
                  onChange={(next) =>
                    setNewNumbers((prev) => ({ ...prev, [f.key]: next }))
                  }
                />
              ))}
            </div>
          )}
          <Button onClick={() => void add()} disabled={busy || !canAdd}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            Add
          </Button>
        </div>
      )}

      {total > 0 && (
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="pl-8"
            />
          </div>
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            {searching ? `${filtered.length} of ${total}` : `${total} values`}
          </span>
        </div>
      )}

      {/* Fixed height, so the box scrolls instead of the page and switching
          kinds never jumps the layout. Every state renders inside it. */}
      <div className="h-[30rem] overflow-y-auto rounded-xl border bg-card scrollbar-themed">
        {values === null ? (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <Loader2 className="mr-2 size-4 animate-spin" /> Loading…
          </div>
        ) : error ? (
          <p className="p-4 text-sm text-destructive">{error}</p>
        ) : total === 0 ? (
          <p className="flex h-full items-center justify-center p-8 text-center text-sm text-muted-foreground">
            No values yet.
          </p>
        ) : filtered.length === 0 ? (
          <p className="flex h-full items-center justify-center p-8 text-center text-sm text-muted-foreground">
            No values match your search.
          </p>
        ) : (
          <ul className="divide-y">
            {filtered.map((v) => (
              <li key={v.id} className="flex items-center gap-2 px-4 py-2.5">
                {editId === v.id ? (
                  <>
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && void saveEdit(v)}
                      className="h-8"
                      autoFocus
                    />
                    {hasNumbers &&
                      numberFields!.map((f) => (
                        <NumberBox
                          key={f.key}
                          field={f}
                          value={editNumbers[f.key] ?? ''}
                          onChange={(next) =>
                            setEditNumbers((prev) => ({ ...prev, [f.key]: next }))
                          }
                        />
                      ))}
                    <Button size="icon" variant="ghost" className="size-8" onClick={() => void saveEdit(v)}>
                      <Check className="size-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="size-8" onClick={() => setEditId(null)}>
                      <X className="size-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm">
                      {v.name}
                      {formatRow?.(v) && (
                        <Badge variant="secondary" className="ml-2 font-normal">
                          {formatRow(v)}
                        </Badge>
                      )}
                      {defaultMarker && flagOf(v, defaultMarker.key) && (
                        <Badge variant="success" className="ml-2 gap-1">
                          <Star className="size-3" />
                          {defaultMarker.label}
                        </Badge>
                      )}
                      {!v.is_active && (
                        <Badge variant="muted" className="ml-2">
                          Inactive
                        </Badge>
                      )}
                    </span>
                    {defaultMarker && canEdit && !flagOf(v, defaultMarker.key) && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-8"
                        title={defaultMarker.actionLabel}
                        aria-label={defaultMarker.actionLabel}
                        disabled={markingId !== null}
                        onClick={() => void makeDefault(v)}
                      >
                        {markingId === v.id ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Star className="size-3.5" />
                        )}
                      </Button>
                    )}
                    {hasFlags && (
                      <div className="flex items-center gap-3 pr-1">
                        {flags!.map((f) => (
                          <FlagBox
                            key={f.key}
                            label={f.label}
                            checked={flagOf(v, f.key)}
                            disabled={!canEdit}
                            onChange={(next) => void toggleFlag(v, f.key, next)}
                          />
                        ))}
                      </div>
                    )}
                    {canEdit && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-8"
                        onClick={() => startEdit(v)}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                    )}
                    {canActivate && (
                      <Switch
                        checked={v.is_active}
                        onCheckedChange={() => void toggleActive(v)}
                      />
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
