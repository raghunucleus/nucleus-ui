import { apiFetch } from './api'
import {
  FOLLOW_UP_PRESETS,
  NO_STATUS_ID,
  matchesFollowUp,
  type FollowUpPreset,
} from './cr-view-filters'
import { withEmployeeAuth } from './employee-auth'
import type {
  Chip,
  CrViewGroupContext,
  CrViewRow,
  CrViewScope,
  CrViewStatusLogEntry,
  CrViewYearOption,
} from './corporate-relations'

/**
 * Data layer for Management View — CR View's read-only, institution-wide twin.
 *
 * The endpoints are the same shapes CR View serves, minus the self-scoping and
 * plus the CR on every row, so the types here are deliberately expressed as
 * *extensions* of the CR View ones rather than fresh copies: a `ManagementRow`
 * IS a `CrViewRow`, which is what lets the shared table cells, filter matcher,
 * grouping helpers and dialogs be reused verbatim.
 *
 * Everything below the API calls is a PURE derivation over the loaded rows. That
 * is the whole design of the insights tab: because the list is unpaginated,
 * every chart is computed from the same in-memory row set the table filters, so
 * a clicked chart segment and the resulting filtered list can never disagree.
 */
const ROOT = '/employee/corporate-relations/management-view'

function qs(params: Record<string, string | number | undefined>): string {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === '') continue
    sp.set(k, String(v))
  }
  const s = sp.toString()
  return s ? `?${s}` : ''
}

/** The employee accountable for a job role. */
export interface CrOption {
  id: number
  emp_code: string
  emp_display_name: string
}

/** CR View's scope plus the CR facet's options (every CR, not just visible ones). */
export type ManagementScope = CrViewScope & { crs: CrOption[] }

/** A CR View row plus who owns it. */
export type ManagementRow = CrViewRow & { responsible_employee: CrOption }

export interface ManagementList {
  passout_year: CrViewYearOption
  items: ManagementRow[]
}

/** The one server-side aggregate — history the list payload cannot carry. */
export interface ManagementActivity {
  /** 12 months, oldest first, zero-filled. */
  months: { month: string; changes: number; records: number }[]
  top_movers: { employee: CrOption | null; changes: number }[]
}

export function getManagementScope(): Promise<ManagementScope> {
  return withEmployeeAuth((token) => apiFetch(`${ROOT}/scope`, { token }))
}

/** Unpaginated — every company, every job role, one passout year. */
export function listManagementView(params: {
  passout_year_id: number
  search?: string
}): Promise<ManagementList> {
  return withEmployeeAuth((token) =>
    apiFetch(`${ROOT}${qs(params)}`, { token }),
  )
}

/** The unscoped status history — same viewer, any job role. */
export function getManagementStatusHistory(
  jobRoleId: number,
  passoutYearId: number,
): Promise<CrViewStatusLogEntry[]> {
  return withEmployeeAuth((token) =>
    apiFetch(`${ROOT}/records/${jobRoleId}/${passoutYearId}/status-history`, {
      token,
    }),
  )
}

export function getManagementActivity(
  passoutYearId: number,
): Promise<ManagementActivity> {
  return withEmployeeAuth((token) =>
    apiFetch(`${ROOT}/activity${qs({ passout_year_id: passoutYearId })}`, {
      token,
    }),
  )
}

// --- Insight derivations ----------------------------------------------------
// All pure, all over the ALREADY FILTERED rows, and all keyed by the same ids
// the filter facets take — so every chart segment can hand its id straight back
// as a filter patch.

/** One clickable chart datum: the filter id, its label, and the row count. */
export interface InsightSlice {
  id: number
  label: string
  count: number
}

/**
 * The status a row DISPLAYS: what was recorded, else the master default. `null`
 * only when there is no default either — which is exactly the `NO_STATUS_ID`
 * sentinel's meaning, so a chart click maps onto the status facet unchanged.
 */
export function effectiveStatus(
  row: CrViewRow,
  ctx: CrViewGroupContext,
): Chip | null {
  return row.record?.current_status ?? ctx.defaultStatus
}

/** The id the status facet needs for a row — the sentinel when it has none. */
function statusFilterId(row: CrViewRow, ctx: CrViewGroupContext): number {
  return effectiveStatus(row, ctx)?.id ?? NO_STATUS_ID
}

/** Headline counts for the KPI row. */
export interface ManagementSummary {
  companies: number
  roles: number
  /** Roles with a record for this year (`record !== null`). */
  recorded: number
  /** Roles with nothing recorded for this year at all. */
  not_started: number
  /** Records whose follow-up date has passed. */
  overdue: number
  /** Distinct CRs across the rows. */
  crs: number
}

export function buildManagementSummary(
  rows: ManagementRow[],
): ManagementSummary {
  const companies = new Set<number>()
  const crs = new Set<number>()
  let recorded = 0
  let overdue = 0
  for (const r of rows) {
    companies.add(r.company.id)
    crs.add(r.responsible_employee.id)
    if (r.record) recorded++
    if (matchesFollowUp('overdue', r.record?.next_follow_up_date ?? null)) {
      overdue++
    }
  }
  return {
    companies: companies.size,
    roles: rows.length,
    recorded,
    not_started: rows.length - recorded,
    overdue,
    crs: crs.size,
  }
}

/**
 * Rows per effective status, in the master's configured order with the
 * "no status" bucket last. Zero-count statuses are dropped — a donut slice of
 * nothing is noise, and the legend doubles as the click target.
 */
export function buildStatusBreakdown(
  rows: ManagementRow[],
  ctx: CrViewGroupContext,
): InsightSlice[] {
  const counts = new Map<number, number>()
  for (const r of rows) {
    const id = statusFilterId(r, ctx)
    counts.set(id, (counts.get(id) ?? 0) + 1)
  }
  const out: InsightSlice[] = []
  for (const s of ctx.statuses) {
    const count = counts.get(s.id) ?? 0
    if (count > 0) out.push({ id: s.id, label: s.name, count })
  }
  // Statuses no longer in the master (deactivated after being recorded) still
  // own rows; they follow the known ones rather than vanishing from the total.
  for (const [id, count] of counts) {
    if (id === NO_STATUS_ID) continue
    if (!ctx.statuses.some((s) => s.id === id)) {
      const label =
        rows.find((r) => statusFilterId(r, ctx) === id)?.record?.current_status
          ?.name ?? 'Unknown status'
      out.push({ id, label, count })
    }
  }
  const none = counts.get(NO_STATUS_ID) ?? 0
  if (none > 0) out.push({ id: NO_STATUS_ID, label: 'No status', count: none })
  return out
}

/** One CR's load: how many roles, how far along, how much is untouched. */
export interface CrWorkload {
  cr: CrOption
  total: number
  recorded: number
  overdue: number
  /** Effective-status id → count, for the stacked bar. */
  by_status: Record<number, number>
}

/**
 * Per-CR workload, heaviest first. This is the "CR level" view: who is carrying
 * how many roles and what state those roles are in.
 */
export function buildCrWorkload(
  rows: ManagementRow[],
  ctx: CrViewGroupContext,
): CrWorkload[] {
  const byCr = new Map<number, CrWorkload>()
  for (const r of rows) {
    const cr = r.responsible_employee
    let hit = byCr.get(cr.id)
    if (!hit) {
      hit = { cr, total: 0, recorded: 0, overdue: 0, by_status: {} }
      byCr.set(cr.id, hit)
    }
    hit.total++
    if (r.record) hit.recorded++
    if (matchesFollowUp('overdue', r.record?.next_follow_up_date ?? null)) {
      hit.overdue++
    }
    const sid = statusFilterId(r, ctx)
    hit.by_status[sid] = (hit.by_status[sid] ?? 0) + 1
  }
  return [...byCr.values()].sort(
    (a, b) =>
      b.total - a.total || a.cr.emp_display_name.localeCompare(b.cr.emp_display_name),
  )
}

/** One company's footprint: how many job roles, how many of them recorded. */
export interface CompanyCoverage {
  id: number
  name: string
  roles: number
  recorded: number
  crs: number
}

/** Companies by job-role count, biggest first. */
export function buildCompanyCoverage(rows: ManagementRow[]): CompanyCoverage[] {
  const byCompany = new Map<
    number,
    CompanyCoverage & { crIds: Set<number> }
  >()
  for (const r of rows) {
    let hit = byCompany.get(r.company.id)
    if (!hit) {
      hit = {
        id: r.company.id,
        name: r.company.name,
        roles: 0,
        recorded: 0,
        crs: 0,
        crIds: new Set(),
      }
      byCompany.set(r.company.id, hit)
    }
    hit.roles++
    if (r.record) hit.recorded++
    hit.crIds.add(r.responsible_employee.id)
  }
  return [...byCompany.values()]
    .map(({ crIds, ...c }) => ({ ...c, crs: crIds.size }))
    .sort((a, b) => b.roles - a.roles || a.name.localeCompare(b.name))
}

/**
 * Rows per chip for one multi-select dimension, biggest first.
 *
 * A row carrying two chips counts once under EACH — these are "how many roles
 * mention this", not parts of a whole, which is why they render as bars rather
 * than as a pie.
 */
export function buildChipMix(
  rows: ManagementRow[],
  pick: (r: ManagementRow) => Chip[],
): InsightSlice[] {
  const counts = new Map<number, InsightSlice>()
  for (const r of rows) {
    for (const c of pick(r)) {
      const hit = counts.get(c.id)
      if (hit) hit.count++
      else counts.set(c.id, { id: c.id, label: c.name, count: 1 })
    }
  }
  return [...counts.values()].sort(
    (a, b) => b.count - a.count || a.label.localeCompare(b.label),
  )
}

/** The chip accessors the mix cards use — each maps to its own filter facet. */
export const CHIP_DIMENSIONS = [
  {
    key: 'category_ids',
    label: 'Company categories',
    pick: (r: ManagementRow) => r.company.categories,
  },
  {
    key: 'relationship_type_ids',
    label: 'Relationship types',
    pick: (r: ManagementRow) => r.record?.relationship_types ?? [],
  },
  {
    key: 'designation_ids',
    label: 'Designations',
    pick: (r: ManagementRow) => r.record?.designations ?? [],
  },
  {
    key: 'location_ids',
    label: 'Job locations',
    pick: (r: ManagementRow) => r.record?.job_locations ?? [],
  },
  {
    key: 'programme_ids',
    label: 'Programmes',
    pick: (r: ManagementRow) => r.record?.programmes ?? [],
  },
] as const

/**
 * How many rows each follow-up preset selects — counted with the SAME predicate
 * the filter uses, so a tile's number is exactly what clicking it will show.
 *
 * `any` is included for completeness but never rendered as a tile.
 */
export function buildFollowUpCounts(
  rows: ManagementRow[],
): Record<FollowUpPreset, number> {
  const out = {} as Record<FollowUpPreset, number>
  for (const p of FOLLOW_UP_PRESETS) out[p] = 0
  for (const r of rows) {
    const date = r.record?.next_follow_up_date ?? null
    for (const p of FOLLOW_UP_PRESETS) {
      if (matchesFollowUp(p, date)) out[p]++
    }
  }
  return out
}
