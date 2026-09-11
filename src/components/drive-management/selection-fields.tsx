import { Field, NativeSelect } from '@/components/corporate-relations/bits'
import { Input } from '@/components/ui/input'
import type {
  DriveAmountMode,
  DriveDetail,
  DriveProfileRead,
  DriveSelectionWrite,
} from '@/lib/drive-management'

/**
 * The designation + package form shown when marking a student Selected and
 * when editing a recorded selection. Money is a string here (raw `<input>`
 * text) and converted at submit, matching the drive form's convention.
 *
 * There is no fixed/range mode picker: the main figure is the fixed value or
 * the range MAX, and filling the optional lower bound is what makes it a
 * range — mirroring how the columns are stored on `drive_students`.
 */
export interface SelectionDraft {
  drive_profile_id: number | null
  ctc: string
  ctc_min: string
  stipend: string
  stipend_min: string
}

interface PackageBand {
  mode: DriveAmountMode | null
  min: string | null
  max: string | null
}

/**
 * The package the drive/designation advertises — the prefill source. The
 * stipend/CTC columns follow `offer_type_scope`, so the effective side is the
 * profile's when that scope is `designation`, else the drive's. A side whose
 * `*_mode` is null does not apply (the offer type doesn't imply it).
 */
export function effectivePackage(
  drive: DriveDetail,
  profile: DriveProfileRead | undefined,
): { ctc: PackageBand | null; stipend: PackageBand | null } {
  const side = drive.offer_type_scope === 'designation' ? profile : drive
  if (!side) return { ctc: null, stipend: null }
  return {
    ctc: side.ctc_mode
      ? { mode: side.ctc_mode, min: side.ctc_min, max: side.ctc_max }
      : null,
    stipend: side.stipend_mode
      ? { mode: side.stipend_mode, min: side.stipend_min, max: side.stipend_max }
      : null,
  }
}

/** Draft prefilled from the advertised package: range → main=max + lower=min,
 *  fixed → main only (fixed stores its figure in `*_min`). */
export function prefillSelectionDraft(
  drive: DriveDetail,
  profileId: number | null,
): SelectionDraft {
  const profile = drive.profiles.find((p) => p.id === profileId)
  const pkg = effectivePackage(drive, profile)
  const main = (b: PackageBand | null) =>
    b ? (b.mode === 'range' ? (b.max ?? '') : (b.min ?? '')) : ''
  const lower = (b: PackageBand | null) =>
    b && b.mode === 'range' ? (b.min ?? '') : ''
  return {
    drive_profile_id: profileId,
    ctc: main(pkg.ctc),
    ctc_min: lower(pkg.ctc),
    stipend: main(pkg.stipend),
    stipend_min: lower(pkg.stipend),
  }
}

/**
 * Strip lower bounds the drive no longer offers.
 *
 * Needed when a draft is seeded from a STORED selection rather than from the
 * drive's package: a row written before the range-only rule (or on a drive
 * since switched from range to fixed) can carry a `_min` that now has no input
 * to show it. Without this the form would hold a value the user can't see or
 * clear, and `selectionDraftValid` would disable Save with no visible cause.
 */
export function sanitizeSelectionDraft(
  drive: DriveDetail,
  draft: SelectionDraft,
): SelectionDraft {
  const profile = drive.profiles.find((p) => p.id === draft.drive_profile_id)
  const pkg = effectivePackage(drive, profile)
  return {
    ...draft,
    ctc_min: pkg.ctc?.mode === 'range' ? draft.ctc_min : '',
    stipend_min: pkg.stipend?.mode === 'range' ? draft.stipend_min : '',
  }
}

/**
 * One amount pair is valid when its main figure is positive and any lower bound
 * sits below it; an inapplicable pair must simply stay empty.
 *
 * A lower bound only exists against an advertised `range` — a fixed drive has
 * exactly one figure, so a bound there would record a band nobody configured.
 * The server enforces the same rule in `assertSelection`.
 */
function pairValid(band: PackageBand | null, main: string, min: string): boolean {
  if (!band) return main === '' && min === ''
  if (min !== '' && band.mode !== 'range') return false
  const m = Number(main)
  if (!(m > 0)) return false
  if (min !== '' && !(Number(min) > 0 && Number(min) < m)) return false
  return true
}

/** Whether the draft is submittable for this drive. */
export function selectionDraftValid(
  drive: DriveDetail,
  draft: SelectionDraft,
): boolean {
  if (draft.drive_profile_id == null) return false
  const profile = drive.profiles.find((p) => p.id === draft.drive_profile_id)
  const pkg = effectivePackage(drive, profile)
  return (
    pairValid(pkg.ctc, draft.ctc, draft.ctc_min) &&
    pairValid(pkg.stipend, draft.stipend, draft.stipend_min)
  )
}

/** The submit payload — empty strings become omitted/null figures. */
export function selectionDraftToWrite(draft: SelectionDraft): DriveSelectionWrite {
  const num = (v: string) => (v === '' ? null : Number(v))
  return {
    drive_profile_id: draft.drive_profile_id!,
    ctc: num(draft.ctc),
    ctc_min: num(draft.ctc_min),
    stipend: num(draft.stipend),
    stipend_min: num(draft.stipend_min),
  }
}

export function SelectionFields({
  drive,
  draft,
  onChange,
  idPrefix,
}: {
  drive: DriveDetail
  draft: SelectionDraft
  onChange: (draft: SelectionDraft) => void
  idPrefix: string
}) {
  const profile = drive.profiles.find((p) => p.id === draft.drive_profile_id)
  const pkg = effectivePackage(drive, profile)

  return (
    <div className="space-y-3">
      <Field label="Designation" htmlFor={`${idPrefix}-designation`}>
        {drive.profiles.length === 1 ? (
          <p className="text-sm font-medium">
            {drive.profiles[0].designation.name}
          </p>
        ) : (
          <NativeSelect
            id={`${idPrefix}-designation`}
            value={draft.drive_profile_id ?? ''}
            onChange={(e) => {
              const id = e.target.value === '' ? null : Number(e.target.value)
              // Switching designation re-prefills the amounts from its package.
              onChange(prefillSelectionDraft(drive, id))
            }}
          >
            <option value="">Select…</option>
            {drive.profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.designation.name}
              </option>
            ))}
          </NativeSelect>
        )}
      </Field>

      {pkg.ctc && (
        <SelectionAmount
          label="CTC"
          unit="LPA"
          idPrefix={`${idPrefix}-ctc`}
          main={draft.ctc}
          min={draft.ctc_min}
          showLower={pkg.ctc.mode === 'range'}
          onMain={(v) => onChange({ ...draft, ctc: v })}
          onMin={(v) => onChange({ ...draft, ctc_min: v })}
        />
      )}

      {pkg.stipend && (
        <SelectionAmount
          label="Internship stipend"
          unit="per month"
          idPrefix={`${idPrefix}-stipend`}
          main={draft.stipend}
          min={draft.stipend_min}
          showLower={pkg.stipend.mode === 'range'}
          onMain={(v) => onChange({ ...draft, stipend: v })}
          onMin={(v) => onChange({ ...draft, stipend_min: v })}
        />
      )}
    </div>
  )
}

/**
 * Main figure, plus an optional lower bound only on a drive that advertises a
 * range. Filling the bound records a range whose max is the main figure; leaving
 * it empty (or not being offered it) records a single final amount.
 */
function SelectionAmount({
  label,
  unit,
  idPrefix,
  main,
  min,
  showLower,
  onMain,
  onMin,
}: {
  label: string
  unit: string
  idPrefix: string
  main: string
  min: string
  /** False on a fixed-amount drive, where a bound would be meaningless. */
  showLower: boolean
  onMain: (v: string) => void
  onMin: (v: string) => void
}) {
  return (
    <Field
      label={`${label} (${unit})`}
      htmlFor={`${idPrefix}-amount`}
      hint={
        showLower
          ? 'Add a lower bound only to record a range — the main figure is its maximum and is what student filters compare.'
          : undefined
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <Input
          id={`${idPrefix}-amount`}
          type="number"
          min={0}
          step="any"
          value={main}
          onChange={(e) => onMain(e.target.value)}
          className="w-32"
        />
        {showLower && (
          <>
            <span className="text-sm text-muted-foreground">lower bound</span>
            <Input
              aria-label={`${label} lower bound`}
              type="number"
              min={0}
              step="any"
              value={min}
              onChange={(e) => onMin(e.target.value)}
              className="w-32"
            />
          </>
        )}
      </div>
    </Field>
  )
}
