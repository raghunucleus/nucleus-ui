import * as React from 'react'

import type { MetaAttribute } from '@/lib/student-search'

/**
 * Grouping, searching and collapse state shared by the two attribute pickers
 * (`AttributePicker` for filters, `ColumnPicker` for output columns). Both show
 * the same catalog — ~130 attributes across 14 registry groups — so the section
 * shape, the search semantics and the keyboard-nav list all live here rather
 * than being re-derived in each component.
 */

/** One attribute inside a section, carrying its index into the flat nav list. */
export interface SectionItem {
  attr: MetaAttribute
  /** Position in `flat` — avoids an `indexOf` scan per render. */
  index: number
}

export interface PickerSection {
  key: string
  label: string
  items: SectionItem[]
  /** Items in this group before the query was applied. */
  total: number
  /** The query matched the group's own label, so all its items are kept. */
  matchedByLabel: boolean
}

export interface BuiltSections {
  sections: PickerSection[]
  /** Every visible item, in section order — what Enter/arrow nav indexes into. */
  flat: MetaAttribute[]
}

/**
 * Groups `attributes` in catalog order and applies `query`. A group survives if
 * its own label matches (all its items are kept) or if individual item labels
 * match (only those are kept). Matching the group label matters: typing
 * "placement" should surface the Placement category even when no single
 * attribute happens to contain the word.
 */
export function buildSections(
  attributes: MetaAttribute[],
  groups: { key: string; label: string }[],
  query: string,
): BuiltSections {
  const q = query.trim().toLowerCase()
  const sections: PickerSection[] = []
  const flat: MetaAttribute[] = []

  for (const g of groups) {
    const inGroup = attributes.filter((a) => a.group === g.key)
    if (inGroup.length === 0) continue

    const matchedByLabel = q.length > 0 && g.label.toLowerCase().includes(q)
    const kept =
      !q || matchedByLabel
        ? inGroup
        : inGroup.filter((a) => a.label.toLowerCase().includes(q))
    if (kept.length === 0) continue

    sections.push({
      key: g.key,
      label: g.label,
      items: kept.map((attr) => ({ attr, index: flat.push(attr) - 1 })),
      total: inGroup.length,
      matchedByLabel,
    })
  }

  return { sections, flat }
}

/** Above this many sections the dropdown opens fully collapsed. */
const COLLAPSE_THRESHOLD = 4

export interface CollapsibleSections {
  isOpen: (key: string) => boolean
  toggle: (key: string) => void
  expandAll: () => void
  collapseAll: () => void
  /** True when at least one section is currently rendered open. */
  anyOpen: boolean
  /**
   * Items reachable by keyboard right now — a subset of `flat` excluding
   * collapsed sections, so arrows never highlight something off-screen. Entries
   * hold the item's index into `flat` for `pick`/`aria-selected` lookups.
   */
  visible: SectionItem[]
  /** Which section a given `flat` index sits in, for ArrowLeft/ArrowRight. */
  sectionOf: (flatIndex: number) => string | undefined
}

/**
 * Collapse state keyed by section. While a query is active every matching
 * section renders open — the collapse map is *ignored*, not mutated, so
 * clearing the search restores whatever the user had opened by hand.
 */
export function useCollapsibleSections(
  sections: PickerSection[],
  query: string,
  /** Reset to the default open set when this flips (e.g. dropdown re-opened). */
  resetKey?: unknown,
): CollapsibleSections {
  const searching = query.trim().length > 0

  const defaultOpen = React.useCallback(
    (list: PickerSection[]) =>
      list.length > COLLAPSE_THRESHOLD
        ? new Set<string>()
        : new Set(list.map((s) => s.key)),
    [],
  )

  // Seeded lazily and re-seeded when `resetKey` changes. This is the
  // adjust-state-during-render pattern rather than an effect: the reset lands
  // in the same commit, so the list never flashes the previous fold. Only
  // `resetKey` triggers it — typing rebuilds `sections` but must not wipe the
  // user's manual toggles.
  const [openKeys, setOpenKeys] = React.useState<Set<string>>(() =>
    defaultOpen(sections),
  )
  const [seeded, setSeeded] = React.useState(resetKey)
  if (seeded !== resetKey) {
    setSeeded(resetKey)
    setOpenKeys(defaultOpen(sections))
  }

  const isOpen = React.useCallback(
    (key: string) => searching || openKeys.has(key),
    [searching, openKeys],
  )

  const toggle = React.useCallback((key: string) => {
    setOpenKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const expandAll = React.useCallback(
    () => setOpenKeys(new Set(sections.map((s) => s.key))),
    [sections],
  )
  const collapseAll = React.useCallback(() => setOpenKeys(new Set()), [])

  const { visible, sectionOf } = React.useMemo(() => {
    const visible: SectionItem[] = []
    const owner = new Map<number, string>()
    for (const s of sections) {
      for (const item of s.items) owner.set(item.index, s.key)
      if (searching || openKeys.has(s.key)) visible.push(...s.items)
    }
    return {
      visible,
      sectionOf: (flatIndex: number) => owner.get(flatIndex),
    }
  }, [sections, searching, openKeys])

  const anyOpen = sections.some((s) => searching || openKeys.has(s.key))

  return { isOpen, toggle, expandAll, collapseAll, anyOpen, visible, sectionOf }
}
