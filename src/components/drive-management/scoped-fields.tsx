import {
  Field,
  NativeSelect,
  SearchableMultiSelect,
  SearchableSelect,
} from '@/components/corporate-relations/bits'
import { Input } from '@/components/ui/input'
import type {
  Chip,
  DriveAmountMode,
  DriveLookupValue,
} from '@/lib/drive-management'
import { cn } from '@/lib/utils'

/**
 * The draft shape for the switchable fields, shared by the drive form and each
 * designation block. Money is a string here (raw `<input>` text) and converted at
 * submit — typing "1" into a number field shouldn't become the number 1 before
 * the user finishes typing "12".
 */
export interface ScopedDraft {
  offer_type_id: number | null
  job_location_ids: number[]
  placement_category_ids: number[]
  has_bond: boolean | null
  bond_years: string
  bond_desc: unknown | null
  stipend_mode: DriveAmountMode | null
  stipend_min: string
  stipend_max: string
  ctc_mode: DriveAmountMode | null
  ctc_min: string
  ctc_max: string
}

export function emptyScoped(): ScopedDraft {
  return {
    offer_type_id: null,
    job_location_ids: [],
    placement_category_ids: [],
    has_bond: null,
    bond_years: '',
    bond_desc: null,
    stipend_mode: null,
    stipend_min: '',
    stipend_max: '',
    ctc_mode: null,
    ctc_min: '',
    ctc_max: '',
  }
}

export interface DriveLookups {
  designations: DriveLookupValue[]
  jobLocations: DriveLookupValue[]
  offerTypes: DriveLookupValue[]
  placementCategories: DriveLookupValue[]
}

export const toChips = (rows: DriveLookupValue[]): Chip[] =>
  rows.map((r) => ({ id: r.id, name: r.name }))

/**
 * Which package fields the chosen offer type implies — the client half of the
 * server's rule 1. Derived from the offer type's `is_internship`/`is_full_time`
 * flags, NEVER from its name, so a renamed offer type keeps working.
 *
 * With no offer type chosen, neither applies: there's nothing to say whether a
 * figure would be a stipend or a CTC.
 */
export function packageApplicability(
  offerTypeId: number | null,
  offerTypes: DriveLookupValue[],
): { stipend: boolean; ctc: boolean } {
  const offer = offerTypes.find((o) => o.id === offerTypeId)
  return {
    stipend: !!offer?.is_internship,
    ctc: !!offer?.is_full_time,
  }
}

/** The offer type + its package. Rendered on whichever side `offer_type_scope` names. */
export function OfferTypeFields({
  draft,
  patch,
  lookups,
  idPrefix,
}: {
  draft: ScopedDraft
  patch: (p: Partial<ScopedDraft>) => void
  lookups: DriveLookups
  idPrefix: string
}) {
  const applies = packageApplicability(draft.offer_type_id, lookups.offerTypes)

  return (
    <>
      <Field label="Offer type" htmlFor={`${idPrefix}-offer-type`}>
        <SearchableSelect
          id={`${idPrefix}-offer-type`}
          options={toChips(lookups.offerTypes)}
          value={draft.offer_type_id}
          onChange={(id) => {
            const next = packageApplicability(id, lookups.offerTypes)
            // Clear a package the new offer type no longer implies, rather than
            // leaving a stale figure the server would reject on save.
            patch({
              offer_type_id: id,
              ...(next.stipend
                ? {}
                : { stipend_mode: null, stipend_min: '', stipend_max: '' }),
              ...(next.ctc ? {} : { ctc_mode: null, ctc_min: '', ctc_max: '' }),
              ...(next.stipend && !draft.stipend_mode
                ? { stipend_mode: 'fixed' as const }
                : {}),
              ...(next.ctc && !draft.ctc_mode ? { ctc_mode: 'fixed' as const } : {}),
            })
          }}
          placeholder="Select…"
          searchPlaceholder="Search offer types…"
        />
      </Field>

      {applies.stipend && (
        <AmountField
          label="Internship stipend"
          unit="per month"
          idPrefix={`${idPrefix}-stipend`}
          mode={draft.stipend_mode}
          min={draft.stipend_min}
          max={draft.stipend_max}
          onMode={(m) => patch({ stipend_mode: m, ...(m === 'fixed' ? { stipend_max: '' } : {}) })}
          onMin={(v) => patch({ stipend_min: v })}
          onMax={(v) => patch({ stipend_max: v })}
        />
      )}

      {applies.ctc && (
        <AmountField
          label="CTC"
          unit="LPA"
          idPrefix={`${idPrefix}-ctc`}
          mode={draft.ctc_mode}
          min={draft.ctc_min}
          max={draft.ctc_max}
          onMode={(m) => patch({ ctc_mode: m, ...(m === 'fixed' ? { ctc_max: '' } : {}) })}
          onMin={(v) => patch({ ctc_min: v })}
          onMax={(v) => patch({ ctc_max: v })}
        />
      )}
    </>
  )
}

/** A fixed figure or a min–max band. */
function AmountField({
  label,
  unit,
  idPrefix,
  mode,
  min,
  max,
  onMode,
  onMin,
  onMax,
}: {
  label: string
  unit: string
  idPrefix: string
  mode: DriveAmountMode | null
  min: string
  max: string
  onMode: (m: DriveAmountMode) => void
  onMin: (v: string) => void
  onMax: (v: string) => void
}) {
  return (
    <Field label={`${label} (${unit})`} htmlFor={`${idPrefix}-min`}>
      <div className="flex flex-wrap items-center gap-2">
        <NativeSelect
          aria-label={`${label} mode`}
          value={mode ?? 'fixed'}
          onChange={(e) => onMode(e.target.value as DriveAmountMode)}
          className="w-28"
        >
          <option value="fixed">Fixed</option>
          <option value="range">Range</option>
        </NativeSelect>
        <Input
          id={`${idPrefix}-min`}
          type="number"
          min={0}
          step="any"
          value={min}
          onChange={(e) => onMin(e.target.value)}
          className="w-32"
        />
        {mode === 'range' && (
          <>
            <span className="text-sm text-muted-foreground">to</span>
            <Input
              type="number"
              min={0}
              step="any"
              value={max}
              onChange={(e) => onMax(e.target.value)}
              className="w-32"
            />
          </>
        )}
      </div>
    </Field>
  )
}

export function JobLocationField({
  draft,
  patch,
  lookups,
}: {
  draft: ScopedDraft
  patch: (p: Partial<ScopedDraft>) => void
  lookups: DriveLookups
}) {
  return (
    <Field label="Job location" hint="Pick one or more.">
      <SearchableMultiSelect
        options={toChips(lookups.jobLocations)}
        selected={draft.job_location_ids}
        onChange={(ids) => patch({ job_location_ids: ids })}
        placeholder="Select locations…"
        searchPlaceholder="Search locations…"
      />
    </Field>
  )
}

export function PlacementCategoryField({
  draft,
  patch,
  lookups,
  idPrefix,
}: {
  draft: ScopedDraft
  patch: (p: Partial<ScopedDraft>) => void
  lookups: DriveLookups
  idPrefix: string
}) {
  return (
    <Field label="Placement category" htmlFor={`${idPrefix}-placement-category`}>
      <SearchableMultiSelect
        id={`${idPrefix}-placement-category`}
        options={toChips(lookups.placementCategories)}
        selected={draft.placement_category_ids}
        onChange={(ids) => patch({ placement_category_ids: ids })}
        placeholder="Select categories…"
        searchPlaceholder="Search categories…"
      />
    </Field>
  )
}

/**
 * Bond yes/no plus its details. Years and description follow the bond's own
 * scope, so they live here rather than on the drive — the two travel together.
 */
export function BondFields({
  draft,
  patch,
  idPrefix,
  renderDescription,
}: {
  draft: ScopedDraft
  patch: (p: Partial<ScopedDraft>) => void
  idPrefix: string
  /** The rich-text editor, injected so this module stays Lexical-free. */
  renderDescription: () => React.ReactNode
}) {
  return (
    <div className="space-y-3">
      <Field label="Bond" htmlFor={`${idPrefix}-bond`}>
        <NativeSelect
          id={`${idPrefix}-bond`}
          value={draft.has_bond === null ? '' : draft.has_bond ? 'yes' : 'no'}
          onChange={(e) => {
            const v = e.target.value
            const has = v === '' ? null : v === 'yes'
            // Drop the details when the answer turns to No: the server rejects
            // details without a bond, and a hidden leftover is unfixable in the UI.
            patch({
              has_bond: has,
              ...(has === true ? {} : { bond_years: '', bond_desc: null }),
            })
          }}
        >
          <option value="">Select…</option>
          <option value="yes">Yes</option>
          <option value="no">No</option>
        </NativeSelect>
      </Field>

      {draft.has_bond === true && (
        <div className={cn('space-y-3 border-l-2 border-border pl-3')}>
          <Field label="Bond years" htmlFor={`${idPrefix}-bond-years`}>
            <Input
              id={`${idPrefix}-bond-years`}
              type="number"
              min={0}
              max={99}
              value={draft.bond_years}
              onChange={(e) => patch({ bond_years: e.target.value })}
              className="w-32"
            />
          </Field>
          <Field label="Bond details">{renderDescription()}</Field>
        </div>
      )}
    </div>
  )
}
