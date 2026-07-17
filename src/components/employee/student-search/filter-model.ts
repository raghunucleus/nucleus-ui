import type {
  MetaAttribute,
  SearchCondition,
  SearchGroup,
  SearchNode,
  SearchOperator,
} from '@/lib/student-search'
import { isGroupNode } from '@/lib/student-search'

/**
 * The builder's editable model — deliberately flatter than the server AST:
 * a root AND of rows, where a row with one condition is a plain condition and
 * a row with several is a single-level OR group. That exactly covers the
 * eligibility prefill (whose only nesting is the "12th OR diploma" pair);
 * anything deeper is still expressible through NQL mode.
 */

export interface BuilderCondition {
  uid: string
  attr: string
  op: SearchOperator
  value: unknown
  /**
   * A recommended default the user is warned before changing (e.g. the drive
   * placement filters). Cleared once they confirm an override — from then on
   * it's an ordinary condition.
   */
  protected?: boolean
}

export interface BuilderRow {
  uid: string
  /** One condition = plain AND row; several = OR group. */
  conditions: BuilderCondition[]
}

let uidCounter = 0
export function uid(): string {
  uidCounter += 1
  return `f${uidCounter}`
}

export function newCondition(attr: MetaAttribute): BuilderCondition {
  // Dropdown fields (fk / enum) default to "is any of" so picking several values
  // (an implicit OR) is the one-click path; other kinds keep their first operator.
  const preferMulti =
    (attr.kind === 'fk' || attr.kind === 'enum') && attr.operators.includes('in')
  const op = preferMulti ? 'in' : attr.operators[0]
  return { uid: uid(), attr: attr.key, op, value: undefined }
}

/**
 * Server AST → builder rows. Returns null when the AST uses shapes the builder
 * cannot represent (nested groups beyond one OR level, OR at the root) — the
 * panel then starts from an empty builder instead of silently dropping parts.
 *
 * Conditions whose attr is in `lockedAttrs` are marked `protected` (the caller
 * warns before they're changed).
 */
export function decomposeFilters(
  root: SearchGroup,
  lockedAttrs: string[] = [],
): BuilderRow[] | null {
  const locked = new Set(lockedAttrs)
  if (!root.and || root.or) return null
  const rows: BuilderRow[] = []
  for (const node of root.and) {
    if (!isGroupNode(node)) {
      rows.push({ uid: uid(), conditions: [conditionOf(node, locked)] })
      continue
    }
    if (!node.or || node.and) return null
    const conditions: BuilderCondition[] = []
    for (const child of node.or) {
      if (isGroupNode(child)) return null
      conditions.push(conditionOf(child, locked))
    }
    if (conditions.length === 0) return null
    rows.push({ uid: uid(), conditions })
  }
  return rows
}

function conditionOf(
  node: SearchCondition,
  locked: Set<string>,
): BuilderCondition {
  return {
    uid: uid(),
    attr: node.attr,
    op: node.op,
    value: node.value,
    protected: locked.has(node.attr) || undefined,
  }
}

/**
 * Builder rows → server AST. Conditions with no usable value are dropped (an
 * untouched "add condition" row shouldn't 400 the search); is_null/not_null
 * need none. Returns undefined when nothing effective remains.
 */
export function composeFilters(rows: BuilderRow[]): SearchGroup | undefined {
  const nodes: SearchNode[] = []
  for (const row of rows) {
    const usable = row.conditions.filter(conditionComplete)
    if (usable.length === 0) continue
    const conds = usable.map<SearchCondition>((c) => ({
      attr: c.attr,
      op: c.op,
      value: c.value,
    }))
    nodes.push(conds.length === 1 ? conds[0] : { or: conds })
  }
  return nodes.length > 0 ? { and: nodes } : undefined
}

export function conditionComplete(c: BuilderCondition): boolean {
  if (c.op === 'is_null' || c.op === 'not_null') return true
  if (c.op === 'between') {
    return (
      Array.isArray(c.value) &&
      c.value.length === 2 &&
      c.value[0] !== undefined &&
      c.value[0] !== null &&
      c.value[1] !== undefined &&
      c.value[1] !== null
    )
  }
  if (c.op === 'in' || c.op === 'not_in') {
    return Array.isArray(c.value) && c.value.length > 0
  }
  return c.value !== undefined && c.value !== null && c.value !== ''
}

/** Human labels for the operator picker. */
export const OPERATOR_LABELS: Record<SearchOperator, string> = {
  eq: 'is',
  neq: 'is not',
  gt: '>',
  gte: '≥',
  lt: '<',
  lte: '≤',
  contains: 'contains',
  not_contains: "doesn't contain",
  starts_with: 'starts with',
  in: 'is any of',
  not_in: 'is none of',
  between: 'is between',
  is_null: 'is empty',
  not_null: 'is not empty',
}
