import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  errMsg,
  readStored,
  writeStored,
} from '@/components/employee/attendance-analytics/format'
import {
  EMPTY_SELECTION,
  fetchInsightsScope,
  scopeQs,
  type ScopeBatch,
  type ScopeDepartment,
  type ScopeGroup,
  type ScopeProgramme,
  type ScopeSelection,
  type ScopeTree,
} from '@/lib/insights'
import {
  readScopeFromUrl,
  replaceSearch,
  scopeToSearchPatch,
} from './scope-url'

/**
 * One key for every insights screen, so the scope a dean narrowed to on the
 * overview is still in force when they follow an attention link into a domain
 * screen. Ids that aren't in the new screen's tree are dropped on load.
 *
 * The address is the other copy: a link that carries scope keys wins over
 * storage on arrival, and every change is written to both.
 */
const LS_SCOPE = 'nucleus.insights.scope'

function readStoredSelection(): ScopeSelection {
  try {
    const raw = readStored(LS_SCOPE)
    if (!raw) return EMPTY_SELECTION
    const v = JSON.parse(raw) as Partial<ScopeSelection>
    const ids = (x: unknown) =>
      Array.isArray(x) ? x.map(Number).filter(Number.isFinite) : []
    return {
      department_ids: ids(v.department_ids),
      programme_ids: ids(v.programme_ids),
      programme_admission_year_ids: ids(v.programme_admission_year_ids),
      attendance_group_ids: ids(v.attendance_group_ids),
    }
  } catch {
    return EMPTY_SELECTION
  }
}

function readSelection(): ScopeSelection {
  return readScopeFromUrl() ?? readStoredSelection()
}

function persistSelection(sel: ScopeSelection): void {
  writeStored(LS_SCOPE, JSON.stringify(sel))
  replaceSearch(scopeToSearchPatch(sel))
}

export interface InsightsScopeState {
  tree: ScopeTree | null
  loading: boolean
  error: string | null
  /** The selection after dropping ids the tree doesn't carry. */
  sel: ScopeSelection
  setSel: (patch: Partial<ScopeSelection>) => void
  /** Query string for every insights read; changes only when `sel` does. */
  qs: string
  /** What the pickers offer at each level, cascaded from the level above. */
  visible: {
    departments: ScopeDepartment[]
    programmes: ScopeProgramme[]
    batches: ScopeBatch[]
    groups: ScopeGroup[]
  }
  /** The batches the current selection resolves to — for labels and group-bys. */
  batches: ScopeBatch[]
  groups: ScopeGroup[]
  batchById: Map<number, ScopeBatch>
  groupById: Map<number, ScopeGroup>
  multiDepartment: boolean
}

/**
 * The scope bar's state for one insights screen. Fetches the caller's tree for
 * that screen key once, keeps the four narrowing lists, and cascades them:
 * picking departments limits the programmes offered, and so on down.
 *
 * Every derived value is a `useMemo` over (tree, raw selection) — never an
 * effect writing state it reads, the loop this repo has been bitten by.
 */
export function useInsightsScope(screenKey: string): InsightsScopeState {
  // Keyed on the screen so a stale tree from another screen never renders —
  // derived rather than reset in the effect, which would be a setState in an
  // effect body.
  const [loaded, setLoaded] = useState<{
    key: string
    tree: ScopeTree | null
    error: string | null
  }>({ key: '', tree: null, error: null })
  const [raw, setRaw] = useState<ScopeSelection>(readSelection)
  const tree = loaded.key === screenKey ? loaded.tree : null
  const error = loaded.key === screenKey ? loaded.error : null

  useEffect(() => {
    let cancelled = false
    fetchInsightsScope(screenKey)
      .then((t) => {
        if (!cancelled) setLoaded({ key: screenKey, tree: t, error: null })
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setLoaded({
            key: screenKey,
            tree: null,
            error: errMsg(e, 'Could not load your scope.'),
          })
        }
      })
    return () => {
      cancelled = true
    }
  }, [screenKey])

  // Persisting is a side effect, so it runs in an effect keyed on the value —
  // never inside the updater (strict mode double-invokes updaters). This also
  // covers first mount: a link without scope keys gets the stored scope
  // written into the address, so copying it reproduces the view.
  useEffect(() => {
    persistSelection(raw)
  }, [raw])

  const setSel = useCallback((patch: Partial<ScopeSelection>) => {
    setRaw((prev) => ({ ...prev, ...patch }))
  }, [])

  return useMemo<InsightsScopeState>(() => {
    if (!tree) {
      return {
        tree: null,
        loading: !error,
        error,
        sel: raw,
        setSel,
        qs: scopeQs(raw),
        visible: { departments: [], programmes: [], batches: [], groups: [] },
        batches: [],
        groups: [],
        batchById: new Map(),
        groupById: new Map(),
        multiDepartment: false,
      }
    }
    // Only departments that actually hold batches are worth offering.
    const deptIds = new Set(tree.batches.map((b) => b.department_id))
    const departments = tree.departments.filter((d) => deptIds.has(d.id))
    const selDepts = raw.department_ids.filter((id) => deptIds.has(id))
    const deptFilter = new Set(selDepts.length ? selDepts : [...deptIds])

    const programmes = tree.programmes.filter(
      (p) =>
        deptFilter.has(p.department_id) &&
        tree.batches.some((b) => b.programme_id === p.id),
    )
    const progIds = new Set(programmes.map((p) => p.id))
    const selProgs = raw.programme_ids.filter((id) => progIds.has(id))
    const progFilter = new Set(selProgs.length ? selProgs : [...progIds])

    const batches = tree.batches.filter((b) => progFilter.has(b.programme_id))
    const payIds = new Set(batches.map((b) => b.pay_id))
    const selBatches = raw.programme_admission_year_ids.filter((id) =>
      payIds.has(id),
    )
    const batchFilter = new Set(selBatches.length ? selBatches : [...payIds])

    const groups = tree.groups.filter((g) => batchFilter.has(g.pay_id))
    const groupIds = new Set(groups.map((g) => g.id))
    const selGroups = raw.attendance_group_ids.filter((id) => groupIds.has(id))

    const sel: ScopeSelection = {
      department_ids: selDepts,
      programme_ids: selProgs,
      programme_admission_year_ids: selBatches,
      attendance_group_ids: selGroups,
    }
    const effectiveBatches = batches.filter((b) => batchFilter.has(b.pay_id))
    const effectiveGroups = selGroups.length
      ? groups.filter((g) => selGroups.includes(g.id))
      : groups
    return {
      tree,
      loading: false,
      error,
      sel,
      setSel,
      qs: scopeQs(sel),
      visible: { departments, programmes, batches, groups },
      batches: effectiveBatches,
      groups: effectiveGroups,
      batchById: new Map(tree.batches.map((b) => [b.pay_id, b])),
      groupById: new Map(tree.groups.map((g) => [g.id, g])),
      multiDepartment:
        new Set(effectiveBatches.map((b) => b.department_id)).size > 1,
    }
  }, [tree, raw, error, setSel])
}

/** `CSE · 2022` — the batch label every insights table uses. */
export function batchLabel(b: ScopeBatch | undefined): string {
  return b ? `${b.programme_code} · ${b.display_year}` : '—'
}
