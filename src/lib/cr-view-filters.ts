import type { Chip, CrViewRow } from './corporate-relations'

/**
 * The CR View / Management View facet state and its matcher.
 *
 * A plain module rather than part of the dialog component: the matcher is what
 * the Management View insight builders count with (so a chart segment and the
 * filtered table agree by construction), and `lib/` importing a component file
 * to get it would be backwards. It also keeps the dialog a components-only
 * module, which is what Fast Refresh wants — the same reason
 * `drive-management/chart-chrome.ts` exists.
 */
/**
 * Rows whose record has no status (or no record at all) render the master's
 * default status — this sentinel id lets the status facet select exactly those.
 * Safe because lookup ids are positive serials.
 */
export const NO_STATUS_ID = 0

export const FOLLOW_UP_PRESETS = [
  'any',
  'overdue',
  'today',
  'this_week',
  'this_month',
  'not_set',
] as const
export type FollowUpPreset = (typeof FOLLOW_UP_PRESETS)[number]

const FOLLOW_UP_LABELS: Record<FollowUpPreset, string> = {
  any: 'Any',
  overdue: 'Overdue',
  today: 'Today',
  this_week: 'This week',
  this_month: 'This month',
  not_set: 'Not set',
}

export const TRI_STATE = ['any', 'yes', 'no'] as const
export type TriState = (typeof TRI_STATE)[number]

const TRI_STATE_LABELS: Record<TriState, string> = {
  any: 'Any',
  yes: 'Yes',
  no: 'No',
}

/**
 * The committed facet state. Empty arrays / 'any' = that facet is off.
 *
 * Shared by CR View and Management View. The last two facets only make sense on
 * the unscoped Management surface — on CR View every row has the same CR (you)
 * and its company list is already yours — so their option lists are OPTIONAL
 * dialog props. An empty array is a no-op in {@link matchesCrViewFilters}, which
 * is what lets one state shape and one matcher serve both screens.
 */
export interface CrViewFilters {
  category_ids: number[]
  relationship_type_ids: number[]
  /** May contain {@link NO_STATUS_ID} for "no status recorded". */
  status_ids: number[]
  designation_ids: number[]
  programme_ids: number[]
  location_ids: number[]
  follow_up: FollowUpPreset
  has_contacts: TriState
  has_remarks: TriState
  /** Management View only — responsible employee ids. */
  cr_ids: number[]
  /** Management View only — company ids (the chart drill-down target). */
  company_ids: number[]
}

export const EMPTY_CR_VIEW_FILTERS: CrViewFilters = {
  category_ids: [],
  relationship_type_ids: [],
  status_ids: [],
  designation_ids: [],
  programme_ids: [],
  location_ids: [],
  follow_up: 'any',
  has_contacts: 'any',
  has_remarks: 'any',
  cr_ids: [],
  company_ids: [],
}

/** How many facets are active, for the Filters button / dialog badges. */
export function countActiveCrViewFilters(f: CrViewFilters): number {
  let n = 0
  if (f.category_ids.length > 0) n++
  if (f.relationship_type_ids.length > 0) n++
  if (f.status_ids.length > 0) n++
  if (f.designation_ids.length > 0) n++
  if (f.programme_ids.length > 0) n++
  if (f.location_ids.length > 0) n++
  if (f.follow_up !== 'any') n++
  if (f.has_contacts !== 'any') n++
  if (f.has_remarks !== 'any') n++
  if (f.cr_ids.length > 0) n++
  if (f.company_ids.length > 0) n++
  return n
}

/** Local calendar date as 'YYYY-MM-DD' — the format records store. */
export function localISODate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

/**
 * Does a record's follow-up date land in the chosen window? Windows look
 * FORWARD from today ("who do I call this week"), so a date already missed
 * shows under Overdue, not under This week. Compared as 'YYYY-MM-DD' strings,
 * which order lexicographically.
 *
 * The windows deliberately OVERLAP — `this_week` includes today, `this_month`
 * includes this week — because that is what a filter should mean. Anything that
 * needs mutually exclusive buckets (the group-by, the insight tiles) must not
 * reuse this; see `groupCrViewRows`.
 */
export function matchesFollowUp(
  preset: FollowUpPreset,
  date: string | null,
): boolean {
  if (preset === 'any') return true
  if (preset === 'not_set') return date === null
  if (date === null) return false
  const now = new Date()
  const today = localISODate(now)
  switch (preset) {
    case 'overdue':
      return date < today
    case 'today':
      return date === today
    case 'this_week': {
      // Monday-based week: the window runs today → the coming Sunday.
      const end = new Date(now)
      end.setDate(now.getDate() + ((7 - now.getDay()) % 7))
      return date >= today && date <= localISODate(end)
    }
    case 'this_month': {
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      return date >= today && date <= localISODate(end)
    }
  }
}

/** Empty selection = facet off; otherwise ANY selected id must be present. */
export function idsMatch(selected: number[], items: Chip[]): boolean {
  return selected.length === 0 || items.some((i) => selected.includes(i.id))
}

/**
 * One row against every facet. Record-borne facets never match a row with no
 * record — except the status facet's "No status" sentinel and the "not set" /
 * "No" branches, whose whole point is finding the blanks.
 *
 * Lives beside the facet type rather than in either page so the two surfaces
 * cannot drift: a chart on Management View computes its numbers with this exact
 * predicate, which is what makes a clicked segment and the filtered table agree.
 */
export function matchesCrViewFilters(
  r: CrViewRow & { responsible_employee?: { id: number } },
  f: CrViewFilters,
): boolean {
  if (!idsMatch(f.category_ids, r.company.categories)) return false
  if (!idsMatch(f.relationship_type_ids, r.record?.relationship_types ?? [])) {
    return false
  }
  if (!idsMatch(f.designation_ids, r.record?.designations ?? [])) return false
  if (!idsMatch(f.programme_ids, r.record?.programmes ?? [])) return false
  if (!idsMatch(f.location_ids, r.record?.job_locations ?? [])) return false
  if (f.status_ids.length > 0) {
    const cur = r.record?.current_status ?? null
    const ok = cur
      ? f.status_ids.includes(cur.id)
      : f.status_ids.includes(NO_STATUS_ID)
    if (!ok) return false
  }
  // Management-only facets. Both are no-ops when empty, and a CR View row simply
  // has no `responsible_employee` to test — it can never reach a non-empty set.
  if (f.cr_ids.length > 0) {
    const id = r.responsible_employee?.id
    if (id === undefined || !f.cr_ids.includes(id)) return false
  }
  if (f.company_ids.length > 0 && !f.company_ids.includes(r.company.id)) {
    return false
  }
  if (!matchesFollowUp(f.follow_up, r.record?.next_follow_up_date ?? null)) {
    return false
  }
  if (f.has_contacts !== 'any') {
    const has = (r.record?.contacts.length ?? 0) > 0
    if (has !== (f.has_contacts === 'yes')) return false
  }
  if (f.has_remarks !== 'any') {
    const has = Boolean(r.record?.remarks?.trim())
    if (has !== (f.has_remarks === 'yes')) return false
  }
  return true
}

export function followUpLabel(p: FollowUpPreset): string {
  return FOLLOW_UP_LABELS[p]
}

export function triStateLabel(t: TriState): string {
  return TRI_STATE_LABELS[t]
}
