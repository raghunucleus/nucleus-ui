import type { FkOption, MetaAttribute, SearchMeta } from '@/lib/student-search'

import { AttributePicker } from './attribute-picker'
import { FilterChip } from './filter-chip'
import {
  type BuilderCondition,
  type BuilderRow,
  newCondition,
  uid,
} from './filter-model'

/**
 * The structured filter editor, laid out for a narrow side rail. Filters the
 * user adds sit in a list at the top (newest first); the recommended placement
 * defaults live in their own muted section pinned to the bottom. Attributes are
 * chosen through the searchable {@link AttributePicker} rather than an inline
 * native `<select>` â€” each row's attribute is then fixed (remove + re-add to
 * change it). Everything else still renders from the server meta.
 */
export function FilterBuilder({
  meta,
  rows,
  onChange,
  fkOptions,
  ensureFkOptions,
  confirmProtectedChange,
}: {
  meta: SearchMeta
  rows: BuilderRow[]
  onChange: (rows: BuilderRow[]) => void
  /** lookup key â†’ loaded options (undefined while loading). */
  fkOptions: Record<string, FkOption[] | undefined>
  ensureFkOptions: (lookup: string) => void
  /** Ask the user to confirm changing a protected (recommended) default. */
  confirmProtectedChange: () => Promise<boolean>
}) {
  const filterable = meta.attributes.filter((a) => a.filterable)
  const byKey = new Map(meta.attributes.map((a) => [a.key, a]))

  const setRow = (rowUid: string, next: BuilderRow) =>
    onChange(rows.map((r) => (r.uid === rowUid ? next : r)))

  const removeRow = (rowUid: string) =>
    onChange(rows.filter((r) => r.uid !== rowUid))

  const writeCondition = (
    row: BuilderRow,
    condUid: string,
    next: BuilderCondition,
  ) =>
    setRow(row.uid, {
      ...row,
      conditions: row.conditions.map((c) => (c.uid === condUid ? next : c)),
    })

  const removeCondition = (row: BuilderRow, condUid: string) => {
    const remaining = row.conditions.filter((c) => c.uid !== condUid)
    if (remaining.length === 0) removeRow(row.uid)
    else setRow(row.uid, { ...row, conditions: remaining })
  }

  // Removing a protected default first asks for confirmation.
  const requestRemove = async (row: BuilderRow, cond: BuilderCondition) => {
    if (cond.protected && !(await confirmProtectedChange())) return
    removeCondition(row, cond.uid)
  }

  // Unlocking a protected default (to make it editable) asks first; on confirm
  // the condition becomes ordinary â€” it then moves up into the user list.
  const requestUnlock = async (row: BuilderRow, cond: BuilderCondition) => {
    if (await confirmProtectedChange()) {
      writeCondition(row, cond.uid, { ...cond, protected: undefined })
    }
  }

  // A picked attribute becomes a fresh row at the TOP of the user list.
  const addFilter = (attr: MetaAttribute) => {
    onChange([{ uid: uid(), conditions: [newCondition(attr)] }, ...rows])
  }

  const addOrBranch = (row: BuilderRow, attr: MetaAttribute) => {
    setRow(row.uid, {
      ...row,
      conditions: [...row.conditions, newCondition(attr)],
    })
  }

  // Split by section: a row whose every condition is a protected default is a
  // "recommended" row; everything else (added filters + the editable
  // eligibility prefill, incl. OR groups) is a user row. Root is a flat AND, so
  // this reordering is semantically neutral.
  const userRows = rows.filter((r) => !r.conditions.every((c) => c.protected))
  const recommendedRows = rows.filter((r) =>
    r.conditions.every((c) => c.protected),
  )

  const chipFor = (row: BuilderRow, cond: BuilderCondition) => (
    <FilterChip
      key={cond.uid}
      attr={byKey.get(cond.attr)}
      condition={cond}
      fkOptions={fkOptions}
      ensureFkOptions={ensureFkOptions}
      onChange={(next) => writeCondition(row, cond.uid, next)}
      onRemove={() => void requestRemove(row, cond)}
      onUnlock={() => void requestUnlock(row, cond)}
    />
  )

  const renderRow = (row: BuilderRow) => {
    // OR group: a tinted cluster of alternative chips joined by "or", with an
    // inline picker to add another choice.
    if (row.conditions.length > 1) {
      return (
        <div
          key={row.uid}
          className="inline-flex flex-wrap items-center gap-1 rounded-lg border border-dashed bg-muted/40 p-1"
        >
          {row.conditions.map((cond, i) => (
            <div key={cond.uid} className="inline-flex items-center gap-1">
              {i > 0 ? (
                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  or
                </span>
              ) : null}
              {chipFor(row, cond)}
            </div>
          ))}
          <AttributePicker
            compact
            attributes={filterable}
            groups={meta.groups}
            onPick={(attr) => addOrBranch(row, attr)}
          />
        </div>
      )
    }

    // Single condition: one chip. Editable chips can grow an OR set from their
    // popover (protected defaults can't).
    const cond = row.conditions[0]
    if (!cond) return null
    return (
      <FilterChip
        key={cond.uid}
        attr={byKey.get(cond.attr)}
        condition={cond}
        fkOptions={fkOptions}
        ensureFkOptions={ensureFkOptions}
        onChange={(next) => writeCondition(row, cond.uid, next)}
        onRemove={() => void requestRemove(row, cond)}
        onUnlock={() => void requestUnlock(row, cond)}
        onAddOr={
          cond.protected ? undefined : (attr) => addOrBranch(row, attr)
        }
        orAttributes={filterable}
        orGroups={meta.groups}
      />
    )
  }

  return (
    <div className="space-y-3">
      <AttributePicker
        attributes={filterable}
        groups={meta.groups}
        onPick={addFilter}
      />

      {userRows.length > 0 ? (
        <div className="space-y-1.5">
          <p className="text-[11px] text-muted-foreground">
            Filters below all apply together (AND).
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            {userRows.map((row) => renderRow(row))}
          </div>
        </div>
      ) : (
        <p className="px-1 text-xs text-muted-foreground">
          No filters yet — add one above.
        </p>
      )}

      {recommendedRows.length > 0 ? (
        <div className="space-y-2 border-t pt-3">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Recommended defaults
            </div>
            <p className="text-[11px] text-muted-foreground">
              Kept unless you change them.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {recommendedRows.map((row) => renderRow(row))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
