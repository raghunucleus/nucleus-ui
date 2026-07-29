import { Check, Loader2, Pencil, Plus, Search, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { formatDate } from '@/components/corporate-relations/bits'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import type { PassoutYearValue } from '@/lib/corporate-relations'

/**
 * The list-and-edit half of the Passout Years list — the same shell as
 * `LookupEditor` (add row, search, fixed-height scroll box, inline edit,
 * activate switch) for a row shape that one can't express: no free-text name, a
 * derived label, and two date columns.
 *
 * The dates auto-fill from the year as it is typed and stop doing so the moment
 * the user edits one, so the common case is "type 2026, hit Add" while a custom
 * academic window is still one keystroke away.
 *
 * Mount it with a stable `key` so switching lists resets its state.
 */

/** 2026 → "2025-2026". Mirrors the server's derivation. */
const deriveDisplayYear = (year: number) => `${year - 1}-${year}`
/** 2026 → "2025-01-01". */
const defaultStartDate = (year: number) => `${year - 1}-01-01`
/** 2026 → "2026-12-31". */
const defaultEndDate = (year: number) => `${year}-12-31`

const MIN_YEAR = 2001
const MAX_YEAR = 2099

/** The three editable fields, held as raw input text until add/save. */
interface Draft {
  year: string
  start: string
  end: string
  /** Once true, the year no longer rewrites the dates. */
  datesTouched: boolean
}

const emptyDraft: Draft = { year: '', start: '', end: '', datesTouched: false }

function draftOf(row: PassoutYearValue): Draft {
  return {
    year: String(row.passout_year),
    start: row.start_date,
    end: row.end_date,
    // The year can't change on an existing row, so nothing will rewrite these.
    datesTouched: true,
  }
}

function msg(e: unknown, fallback: string): string {
  return e instanceof Error ? e.message : fallback
}

/** The parsed year, or null when the box isn't a whole number yet. */
function parseYear(text: string): number | null {
  const raw = text.trim()
  if (!/^\d+$/.test(raw)) return null
  return Number(raw)
}

/** A constraint message to show, or null when the draft is submittable. */
function validate(draft: Draft): string | null {
  const year = parseYear(draft.year)
  if (year === null) return 'Enter a passout year.'
  if (year < MIN_YEAR || year > MAX_YEAR) {
    return `Passout year must be between ${MIN_YEAR} and ${MAX_YEAR}.`
  }
  if (!draft.start || !draft.end) return 'Both dates are required.'
  // ISO 'YYYY-MM-DD' sorts lexicographically, so a string compare is enough.
  if (draft.end < draft.start) {
    return 'End date must be on or after the start date.'
  }
  return null
}

/** Typing a year refills the dates until the user takes them over. */
function withYear(draft: Draft, year: string): Draft {
  const parsed = parseYear(year)
  if (draft.datesTouched || parsed === null) return { ...draft, year }
  return {
    ...draft,
    year,
    start: defaultStartDate(parsed),
    end: defaultEndDate(parsed),
  }
}

function DraftFields({
  draft,
  onChange,
  onSubmit,
  autoFocus,
  yearLocked = false,
}: {
  draft: Draft
  onChange: (next: Draft) => void
  onSubmit: () => void
  autoFocus?: boolean
  /** On an existing row the year is fixed — only the window can move. */
  yearLocked?: boolean
}) {
  const year = parseYear(draft.year)
  return (
    <>
      {yearLocked ? (
        // Spans the year box + its preview (8rem + gap + 6rem) so an editing
        // row's dates stay aligned with the add row's.
        <span className="flex w-[14.5rem] items-baseline gap-2 text-sm">
          <span className="w-32 font-medium tabular-nums">{draft.year}</span>
          <span className="w-24 whitespace-nowrap text-xs text-muted-foreground">
            {year === null ? '—' : deriveDisplayYear(year)}
          </span>
        </span>
      ) : (
        <>
          <Input
            type="number"
            inputMode="numeric"
            min={MIN_YEAR}
            max={MAX_YEAR}
            step="1"
            value={draft.year}
            autoFocus={autoFocus}
            onChange={(e) => onChange(withYear(draft, e.target.value))}
            onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
            placeholder="Passout year"
            aria-label="Passout year"
            className="h-8 w-32"
          />
          <span className="w-24 whitespace-nowrap text-xs text-muted-foreground">
            {year === null ? '—' : deriveDisplayYear(year)}
          </span>
        </>
      )}
      <Input
        type="date"
        value={draft.start}
        autoFocus={autoFocus && yearLocked}
        onChange={(e) =>
          onChange({ ...draft, start: e.target.value, datesTouched: true })
        }
        onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
        aria-label="Start date"
        className="h-8 w-40"
      />
      <Input
        type="date"
        value={draft.end}
        onChange={(e) =>
          onChange({ ...draft, end: e.target.value, datesTouched: true })
        }
        onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
        aria-label="End date"
        className="h-8 w-40"
      />
    </>
  )
}

/** The academic window — the only thing an edit can move. */
export interface PassoutYearWindowPayload {
  start_date: string
  end_date: string
}

interface PassoutYearsEditorProps {
  load: () => Promise<PassoutYearValue[]>
  create: (
    body: { passout_year: number } & PassoutYearWindowPayload,
  ) => Promise<unknown>
  save: (id: number, body: PassoutYearWindowPayload) => Promise<unknown>
  setStatus: (id: number, isActive: boolean) => Promise<unknown>
  canCreate: boolean
  canEdit: boolean
  canActivate: boolean
}

export default function PassoutYearsEditor({
  load,
  create,
  save,
  setStatus,
  canCreate,
  canEdit,
  canActivate,
}: PassoutYearsEditorProps) {
  const [values, setValues] = useState<PassoutYearValue[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [busy, setBusy] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [editDraft, setEditDraft] = useState<Draft>(emptyDraft)

  async function reload() {
    setValues(null)
    setError(null)
    try {
      setValues(await load())
    } catch (e) {
      setError(msg(e, 'Could not load passout years.'))
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
    return values.filter(
      (v) =>
        v.display_year.toLowerCase().includes(q) ||
        String(v.passout_year).includes(q),
    )
  }, [values, search])

  /** A validated draft's window, or null with a toast fired. */
  function windowFrom(d: Draft): PassoutYearWindowPayload | null {
    const invalid = validate(d)
    if (invalid) {
      // A rule the server would reject anyway is a constraint, not a failure —
      // say so instead of firing a request.
      toast.info(invalid)
      return null
    }
    return { start_date: d.start, end_date: d.end }
  }

  async function add() {
    const body = windowFrom(draft)
    if (!body) return
    setBusy(true)
    try {
      await create({ passout_year: parseYear(draft.year)!, ...body })
      setDraft(emptyDraft)
      toast.success('Added.')
      await reload()
    } catch (e) {
      toast.error(msg(e, 'Could not add.'))
    } finally {
      setBusy(false)
    }
  }

  async function saveEdit(row: PassoutYearValue) {
    const body = windowFrom(editDraft)
    if (!body) return
    try {
      await save(row.id, body)
      setEditId(null)
      toast.success('Saved.')
      await reload()
    } catch (e) {
      toast.error(msg(e, 'Could not save.'))
    }
  }

  function startEdit(row: PassoutYearValue) {
    setEditId(row.id)
    setEditDraft(draftOf(row))
  }

  async function toggleActive(row: PassoutYearValue) {
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
          <DraftFields
            draft={draft}
            onChange={setDraft}
            onSubmit={() => void add()}
          />
          <Button onClick={() => void add()} disabled={busy}>
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
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
              placeholder="Search years…"
              className="pl-8"
            />
          </div>
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            {searching ? `${filtered.length} of ${total}` : `${total} years`}
          </span>
        </div>
      )}

      {/* Fixed height, so the box scrolls instead of the page and switching
          lists never jumps the layout. Every state renders inside it. */}
      <div className="h-[30rem] overflow-y-auto rounded-xl border bg-card scrollbar-themed">
        {values === null ? (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <Loader2 className="mr-2 size-4 animate-spin" /> Loading…
          </div>
        ) : error ? (
          <p className="p-4 text-sm text-destructive">{error}</p>
        ) : total === 0 ? (
          <p className="flex h-full items-center justify-center p-8 text-center text-sm text-muted-foreground">
            No passout years yet.
          </p>
        ) : filtered.length === 0 ? (
          <p className="flex h-full items-center justify-center p-8 text-center text-sm text-muted-foreground">
            No years match your search.
          </p>
        ) : (
          <ul className="divide-y">
            {filtered.map((v) => (
              <li key={v.id} className="flex items-center gap-2 px-4 py-2.5">
                {editId === v.id ? (
                  <>
                    <DraftFields
                      draft={editDraft}
                      onChange={setEditDraft}
                      onSubmit={() => void saveEdit(v)}
                      autoFocus
                      yearLocked
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-8"
                      onClick={() => void saveEdit(v)}
                    >
                      <Check className="size-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-8"
                      onClick={() => setEditId(null)}
                    >
                      <X className="size-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    {/* The passout year is what the rest of the system keys
                        off, so it leads; the academic span it derives to
                        follows it. Widths mirror the add row's year box and
                        preview so every column lines up. */}
                    <span className="flex flex-1 items-baseline gap-2 text-sm">
                      <span className="w-32 font-medium tabular-nums">
                        {v.passout_year}
                      </span>
                      <span className="w-24 whitespace-nowrap text-xs text-muted-foreground">
                        {v.display_year}
                      </span>
                      <span>
                        <Badge variant="secondary" className="font-normal">
                          {formatDate(v.start_date)} → {formatDate(v.end_date)}
                        </Badge>
                        {!v.is_active && (
                          <Badge variant="muted" className="ml-2">
                            Inactive
                          </Badge>
                        )}
                      </span>
                    </span>
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
