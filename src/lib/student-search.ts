/**
 * Shared contract for the registry-driven student search engine
 * (`src/student-query` on the server). The UI is meta-driven: the server's
 * `meta` endpoint describes every attribute (kind, operators, enum values, fk
 * lookup), and the components render from that — adding an attribute on the
 * server needs no client change.
 *
 * The engine is mounted per feature (today: under a drive's Filter tab), so
 * the components take a {@link StudentSearchApi} adapter rather than fixed
 * endpoints — a future students-directory page reuses everything with a
 * different adapter.
 */

// --- filter AST (mirror of the server's SearchGroup/SearchCondition) --------

export type SearchOperator =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'in'
  | 'not_in'
  | 'between'
  | 'is_null'
  | 'not_null'

export interface SearchCondition {
  attr: string
  op: SearchOperator
  value?: unknown
}

export interface SearchGroup {
  and?: SearchNode[]
  or?: SearchNode[]
}

export type SearchNode = SearchCondition | SearchGroup

export function isGroupNode(node: SearchNode): node is SearchGroup {
  return ('and' in node || 'or' in node) && !('attr' in node)
}

// --- meta -------------------------------------------------------------------

export type AttrKind = 'string' | 'number' | 'boolean' | 'date' | 'enum' | 'fk'

export interface MetaAttribute {
  key: string
  label: string
  group: string
  kind: AttrKind
  operators: SearchOperator[]
  filterable: boolean
  selectable: boolean
  sortable: boolean
  enumValues: (string | number)[] | null
  enumLabels: Record<string, string> | null
  fkLookup: string | null
}

export interface SearchMeta {
  groups: { key: string; label: string }[]
  attributes: MetaAttribute[]
  searchFields: string[]
  implicitColumns: string[]
  defaultColumns: string[]
  defaultSort: { by: string; dir: 'asc' | 'desc' }
  maxPageSize: number
  maxPage: number
  nql: {
    operators: Record<string, string>
    examples: string[]
  }
}

// --- search request/response ------------------------------------------------

export interface StudentSearchBody {
  filters?: SearchGroup
  nql?: string
  columns?: string[]
  search?: string
  sort?: { by: string; dir: 'asc' | 'desc' }
  page?: number
  pageSize?: number
}

export interface StudentSearchResult {
  rows: Record<string, unknown>[]
  total: number
  page: number
  pageSize: number
  pageCount: number
  /** Resolved output column keys, in order (implicit columns first). */
  columns: string[]
}

export interface FkOption {
  id: number
  label: string
}

export type ExportFormat = 'csv' | 'xlsx'

/**
 * How the search components reach the server — one implementation per mount
 * point (the drive Filter tab binds these to the drive-scoped endpoints).
 */
export interface StudentSearchApi {
  meta(): Promise<SearchMeta>
  search(body: StudentSearchBody): Promise<StudentSearchResult>
  options(lookup: string, q?: string): Promise<FkOption[]>
  /** Starts an async export job; completion arrives as a notification. */
  createExport(
    body: StudentSearchBody,
    format: ExportFormat,
  ): Promise<{ job_id: number }>
}

/** Labels for the implicit columns every result carries. */
export const IMPLICIT_COLUMN_LABELS: Record<string, string> = {
  id: 'ID',
  student_id: 'Roll number',
  display_name: 'Full name',
}
