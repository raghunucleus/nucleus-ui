import type {
  FkOption,
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

// --- AST -> NQL text --------------------------------------------------------

/**
 * The inverse of the server parser's `OP_MAP` (`nql/parser.ts`): each infix
 * operator's NQL symbol. `in`/`not_in`/`between`/`is_null`/`not_null` have
 * their own keyword syntax and are handled in {@link conditionToNql}, so they
 * are absent here. Keep this in step with the server's `OP_MAP`.
 */
const OP_SYMBOL: Partial<Record<SearchOperator, string>> = {
  eq: '=',
  neq: '!=',
  gt: '>',
  gte: '>=',
  lt: '<',
  lte: '<=',
  contains: '~',
  not_contains: '!~',
  starts_with: '^=',
}

/** One AST value -> an NQL literal (quoted string, bare number, true/false). */
function valueToNql(value: unknown): string {
  if (typeof value === 'number') return String(value)
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  // Everything else renders as a double-quoted string with `"`/`\` escaped —
  // fk ids stored as numbers stay numeric above, so labels round-trip too.
  const s = String(value ?? '')
  return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

function conditionToNql(c: SearchCondition): string {
  const { attr, op, value } = c
  if (op === 'is_null') return `${attr} IS NULL`
  if (op === 'not_null') return `${attr} IS NOT NULL`
  if (op === 'in' || op === 'not_in') {
    const list = (Array.isArray(value) ? value : []).map(valueToNql).join(', ')
    return `${attr} ${op === 'in' ? 'IN' : 'NOT IN'} (${list})`
  }
  if (op === 'between') {
    const [lo, hi] = Array.isArray(value) ? value : [undefined, undefined]
    return `${attr} BETWEEN ${valueToNql(lo)} AND ${valueToNql(hi)}`
  }
  const sym = OP_SYMBOL[op]
  return `${attr} ${sym} ${valueToNql(value)}`
}

function nodeToNql(node: SearchNode): string {
  if (!isGroupNode(node)) return conditionToNql(node)
  // A group carries exactly one of and/or; parenthesize OR groups so they read
  // as one term inside the surrounding AND.
  if (node.or) return `(${node.or.map(nodeToNql).join(' OR ')})`
  return (node.and ?? []).map(nodeToNql).join(' AND ')
}

/**
 * Server AST -> NQL text — the counterpart to the server's `parseNql`, so the
 * Filters builder can project its current rows into the NQL editor. Mirrors
 * `composeFilters`'s shape (root AND of conditions / single-level OR groups),
 * but walks any AST the builder can produce. Empty/undefined -> ''.
 */
export function filtersToNql(root: SearchGroup | undefined): string {
  if (!root) return ''
  return nodeToNql(root)
}

// --- AST -> plain English ---------------------------------------------------

/**
 * One value -> its human label, resolving fk ids to labels (from the loaded
 * option lists), enum codes to their display labels, and booleans to Yes/No.
 * Shared by the filter chips' summary and the "Explain" panel so both read the
 * same. `…` when the value isn't set yet or an fk label hasn't loaded.
 */
export function formatValueLabel(
  attr: MetaAttribute | undefined,
  value: unknown,
  fkOptions: Record<string, FkOption[] | undefined>,
): string {
  if (value === null || value === undefined || value === '') return '…'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (attr?.kind === 'fk') {
    const opts = attr.fkLookup ? fkOptions[attr.fkLookup] : undefined
    return opts?.find((o) => o.id === value)?.label ?? String(value)
  }
  return attr?.enumLabels?.[String(value)] ?? String(value)
}

/** Full-sentence operator phrasing (distinct from the terse picker labels). */
const OPERATOR_ENGLISH: Record<SearchOperator, string> = {
  eq: 'is',
  neq: 'is not',
  gt: 'is greater than',
  gte: 'is at least',
  lt: 'is less than',
  lte: 'is at most',
  contains: 'contains',
  not_contains: 'does not contain',
  starts_with: 'starts with',
  in: 'is any of',
  not_in: 'is none of',
  between: 'is between',
  is_null: 'is empty',
  not_null: 'is set',
}

function explainCondition(
  c: SearchCondition,
  attrByKey: Map<string, MetaAttribute>,
  fkOptions: Record<string, FkOption[] | undefined>,
): string {
  const attr = attrByKey.get(c.attr)
  const label = attr?.label ?? c.attr
  const fmt = (v: unknown) => formatValueLabel(attr, v, fkOptions)
  switch (c.op) {
    case 'is_null':
      return `${label} is empty (not set)`
    case 'not_null':
      return `${label} is set`
    case 'between': {
      const [lo, hi] = Array.isArray(c.value) ? c.value : [undefined, undefined]
      return `${label} is between ${fmt(lo)} and ${fmt(hi)}`
    }
    case 'in':
    case 'not_in': {
      const list = (Array.isArray(c.value) ? c.value : []).map(fmt).join(', ')
      return `${label} ${OPERATOR_ENGLISH[c.op]}: ${list}`
    }
    default:
      return `${label} ${OPERATOR_ENGLISH[c.op]} ${fmt(c.value)}`
  }
}

function explainNode(
  node: SearchNode,
  attrByKey: Map<string, MetaAttribute>,
  fkOptions: Record<string, FkOption[] | undefined>,
  depth: number,
): string {
  if (!isGroupNode(node)) return explainCondition(node, attrByKey, fkOptions)
  const children = node.or ?? node.and ?? []
  const joiner = node.or ? ', or ' : ' and '
  const parts = children.map((child) =>
    explainNode(child, attrByKey, fkOptions, depth + 1),
  )
  const joined = parts.join(joiner)
  // Parenthesize a nested group so precedence stays legible inside a line.
  return depth > 0 && children.length > 1 ? `(${joined})` : joined
}

/**
 * Server AST -> plain-English lines, one per top-level condition/group, so the
 * "Explain" panel can read filters back line by line. Top-level `and` nodes
 * each become their own line (they're implicitly all-must-be-true); a root that
 * is a single OR renders as one line. Empty/undefined -> [].
 */
export function explainFilters(
  root: SearchGroup | undefined,
  attrByKey: Map<string, MetaAttribute>,
  fkOptions: Record<string, FkOption[] | undefined>,
): string[] {
  if (!root) return []
  if (root.and) {
    return root.and.map((node) => explainNode(node, attrByKey, fkOptions, 0))
  }
  // A root OR (or a stray bare group) -> a single line.
  return [explainNode(root, attrByKey, fkOptions, 0)]
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
