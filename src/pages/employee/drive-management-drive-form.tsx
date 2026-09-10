import { useParams } from '@tanstack/react-router'
import { ArrowLeft, Paperclip, Plus, Trash2, Upload, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import {
  CompanyLogo,
  Field,
  NativeSelect,
  SearchableMultiSelect,
  SearchableSelect,
} from '@/components/corporate-relations/bits'
import {
  BondFields,
  JobLocationField,
  OfferTypeFields,
  PlacementCategoryField,
  emptyScoped,
  type DriveLookups,
  type ScopedDraft,
} from '@/components/drive-management/scoped-fields'
import { NoAccessEmptyState } from '@/components/employee/empty-states'
import { Button } from '@/components/ui/button'
import { DatePicker } from '@/components/ui/date-picker'
import { Input } from '@/components/ui/input'
import { LazyRichTextEditor } from '@/components/ui/lazy-rich-text-editor'
import type { RichTextValue } from '@/components/ui/lazy-rich-text-editor'
import { useScreenAccess } from '@/hooks/use-screen-access'
import { ApiError } from '@/lib/api'
import { employeeNavigateTo } from '@/lib/employee-navigate'
import {
  createDrive,
  deleteDriveAttachment,
  getDrive,
  getDriveCompanyDefaults,
  listDriveAttributes,
  listDriveCompanyCategoryOptions,
  listDriveCompanyOptions,
  updateDrive,
  uploadDriveAttachment,
  type Chip,
  type DriveAttachment,
  type DriveFieldScope,
  type DriveProfileWrite,
  type DriveWrite,
} from '@/lib/drive-management'
import { cn } from '@/lib/utils'

const SCREEN_KEY = 'drive_management.drives.manage'
const LIST_ROUTE = '/drive-management/drives'
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024

function errMsg(e: unknown, fallback: string): string {
  return e instanceof ApiError || e instanceof Error ? e.message : fallback
}

/**
 * Union two option lists by id, keeping `base`'s order first. Lets an inactive
 * category cited by an existing drive (or a company tag missing from the active
 * master list) stay visible without duplicating the ones already offered.
 */
function mergeById(base: Chip[], extra: Chip[]): Chip[] {
  const seen = new Set(base.map((o) => o.id))
  return [...base, ...extra.filter((o) => !seen.has(o.id))]
}

/** One designation block's draft. */
interface ProfileDraft extends ScopedDraft {
  /** Server id — absent until the profile is saved. */
  id?: number
  /** Stable local key, so React and the file staging map survive reordering. */
  uid: string
  designation_id: number | null
  jd: RichTextValue | null
  /** Already-uploaded files (edit mode only). */
  attachments: DriveAttachment[]
  /** Picked but not yet uploaded — needs a saved profile id. */
  staged: File[]
}

let uidCounter = 0
const nextUid = () => `p${++uidCounter}`

function emptyProfile(): ProfileDraft {
  return {
    ...emptyScoped(),
    uid: nextUid(),
    designation_id: null,
    jd: null,
    attachments: [],
    staged: [],
  }
}

/** "" for a blank input; the server treats null as "clear this". */
const numOrNull = (s: string): number | null =>
  s.trim() === '' ? null : Number(s)

const pad2 = (n: number): string => String(n).padStart(2, '0')

/** ISO instant → the `YYYY-MM-DDTHH:mm` a datetime-local input expects (local). */
function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

/** datetime-local value (local wall time) → an absolute ISO instant. */
function localInputToIso(local: string): string | null {
  if (!local) return null
  const d = new Date(local)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

export default function EmployeeDriveFormPage() {
  const access = useScreenAccess(SCREEN_KEY)
  const params = useParams({ strict: false }) as { driveId?: string }
  const driveId = params.driveId ? Number(params.driveId) : null
  const isEdit = driveId !== null

  useEffect(() => {
    document.title = `${isEdit ? 'Edit' : 'New'} drive — Nucleus`
  }, [isEdit])

  // --- form state -------------------------------------------------------
  const [companyId, setCompanyId] = useState<number | null>(null)
  const [company, setCompany] = useState<{
    name: string
    logo_url: string | null
  } | null>(null)
  const [companyCategoryIds, setCompanyCategoryIds] = useState<number[]>([])
  const [companyCategoryOptions, setCompanyCategoryOptions] = useState<
    { id: number; name: string }[]
  >([])
  const [driveName, setDriveName] = useState('')
  const [profileType, setProfileType] = useState<'single' | 'multi'>('single')

  const [offerTypeScope, setOfferTypeScope] = useState<DriveFieldScope>('drive')
  const [jobLocationScope, setJobLocationScope] = useState<DriveFieldScope>('drive')
  const [placementCategoryScope, setPlacementCategoryScope] =
    useState<DriveFieldScope>('drive')
  const [bondScope, setBondScope] = useState<DriveFieldScope>('drive')

  const [driveScoped, setDriveScoped] = useState<ScopedDraft>(emptyScoped)
  const [profiles, setProfiles] = useState<ProfileDraft[]>([emptyProfile()])

  const [spocEmail, setSpocEmail] = useState('')
  const [spocContact, setSpocContact] = useState('')
  const [registrationEnd, setRegistrationEnd] = useState('')
  const [driveDate, setDriveDate] = useState('')

  const [lookups, setLookups] = useState<DriveLookups | null>(null)
  const [companies, setCompanies] = useState<Chip[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  // --- load lookups + companies ----------------------------------------
  useEffect(() => {
    let cancelled = false
    Promise.all([
      listDriveAttributes('designations'),
      listDriveAttributes('job-locations'),
      listDriveAttributes('offer-types'),
      listDriveAttributes('placement-categories'),
      listDriveCompanyOptions(),
      listDriveCompanyCategoryOptions(),
    ])
      .then(
        ([
          designations,
          jobLocations,
          offerTypes,
          placementCategories,
          comps,
          categoryOptions,
        ]) => {
          if (cancelled) return
          // Inactive values stay selectable on an existing drive that already
          // cites them, but must never be offered for a new one.
          const active = (rows: typeof designations) =>
            rows.filter((r) => r.is_active)
          setLookups({
            designations: active(designations),
            jobLocations: active(jobLocations),
            offerTypes: active(offerTypes),
            placementCategories: active(placementCategories),
          })
          setCompanies(comps)
          // The full category master list is always offered as options; a
          // company's own tags (or an existing drive's) only pre-fill/augment it.
          setCompanyCategoryOptions((prev) => mergeById(categoryOptions, prev))
        },
      )
      .catch((e: unknown) => {
        if (!cancelled) setLoadError(errMsg(e, 'Could not load the form options.'))
      })
      .finally(() => {
        if (!cancelled && !isEdit) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [isEdit])

  // --- load the drive being edited -------------------------------------
  useEffect(() => {
    if (!isEdit || driveId === null) return
    let cancelled = false
    setLoading(true)
    getDrive(driveId)
      .then((d) => {
        if (cancelled) return
        setCompanyId(d.company.id)
        setCompany({ name: d.company.name, logo_url: d.company.logo_url })
        setCompanyCategoryIds(d.company_categories.map((c) => c.id))
        // Keep the master-list options; just make sure any category this drive
        // already cites (e.g. one since deactivated) stays visible.
        setCompanyCategoryOptions((prev) => mergeById(prev, d.company_categories))
        setDriveName(d.drive_name)
        setProfileType(d.profile_type)
        setOfferTypeScope(d.offer_type_scope)
        setJobLocationScope(d.job_location_scope)
        setPlacementCategoryScope(d.placement_category_scope)
        setBondScope(d.bond_scope)
        setDriveScoped({
          offer_type_id: d.offer_type?.id ?? null,
          job_location_ids: d.job_locations.map((l) => l.id),
          placement_category_ids: d.placement_categories.map((c) => c.id),
          has_bond: d.has_bond,
          bond_years: d.bond_years == null ? '' : String(d.bond_years),
          bond_desc: d.bond_desc,
          stipend_mode: d.stipend_mode,
          stipend_min: d.stipend_min ?? '',
          stipend_max: d.stipend_max ?? '',
          ctc_mode: d.ctc_mode,
          ctc_min: d.ctc_min ?? '',
          ctc_max: d.ctc_max ?? '',
        })
        setProfiles(
          d.profiles.map((p) => ({
            id: p.id,
            uid: nextUid(),
            designation_id: p.designation.id,
            jd: p.jd,
            attachments: p.attachments,
            staged: [],
            offer_type_id: p.offer_type?.id ?? null,
            job_location_ids: p.job_locations.map((l) => l.id),
            placement_category_ids: p.placement_categories.map((c) => c.id),
            has_bond: p.has_bond,
            bond_years: p.bond_years == null ? '' : String(p.bond_years),
            bond_desc: p.bond_desc,
            stipend_mode: p.stipend_mode,
            stipend_min: p.stipend_min ?? '',
            stipend_max: p.stipend_max ?? '',
            ctc_mode: p.ctc_mode,
            ctc_min: p.ctc_min ?? '',
            ctc_max: p.ctc_max ?? '',
          })),
        )
        setSpocEmail(d.spoc_email ?? '')
        setSpocContact(d.spoc_contact ?? '')
        setRegistrationEnd(isoToLocalInput(d.registration_end_date))
        setDriveDate(d.drive_date ?? '')
        setLoadError(null)
      })
      .catch((e: unknown) => {
        if (!cancelled) setLoadError(errMsg(e, 'Could not load the drive.'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [isEdit, driveId])

  // --- company selection seeds the categories ---------------------------
  const onPickCompany = async (id: number | null) => {
    setCompanyId(id)
    if (id === null) {
      setCompany(null)
      // Keep the master-list options so the field stays editable; just clear
      // the (company-derived) selection.
      setCompanyCategoryIds([])
      return
    }
    try {
      const d = await getDriveCompanyDefaults(id)
      setCompany({ name: d.name, logo_url: d.logo_url })
      // Pre-fill the selection from the CRM's classification (patch if any) —
      // the full master list stays available so the manager can freely edit.
      setCompanyCategoryIds(d.categories.map((c) => c.id))
      // Surface any company tag not in the active master list (e.g. deactivated)
      // so its chip still renders while selected.
      setCompanyCategoryOptions((prev) => mergeById(prev, d.categories))
    } catch (e) {
      toast.error(errMsg(e, 'Could not load the company.'))
    }
  }

  // --- profile helpers ---------------------------------------------------
  const patchProfile = (uid: string, p: Partial<ProfileDraft>) =>
    setProfiles((prev) =>
      prev.map((x) => (x.uid === uid ? { ...x, ...p } : x)),
    )

  const addProfile = () => setProfiles((prev) => [...prev, emptyProfile()])

  const removeProfile = (uid: string) =>
    setProfiles((prev) => prev.filter((x) => x.uid !== uid))

  // Switching to single-profile keeps only the first block. Done here on the
  // click, never inside a setState updater — strict mode double-invokes those,
  // which would fire the toast twice.
  const onProfileTypeChange = (next: 'single' | 'multi') => {
    if (next === 'single' && profiles.length > 1) {
      if (
        !window.confirm(
          `Switching to a single profile drops ${profiles.length - 1} designation(s). Continue?`,
        )
      ) {
        return
      }
      setProfiles((prev) => prev.slice(0, 1))
    }
    setProfileType(next)
  }

  // --- submit -------------------------------------------------------------
  const buildScopedPayload = (d: ScopedDraft, side: DriveFieldScope) => ({
    // Each field is sent only on the side its scope names — the other side must
    // be null/absent or the server rejects the whole drive.
    offer_type_id: offerTypeScope === side ? d.offer_type_id : null,
    job_location_ids: jobLocationScope === side ? d.job_location_ids : [],
    placement_category_ids:
      placementCategoryScope === side ? d.placement_category_ids : [],
    has_bond: bondScope === side ? d.has_bond : null,
    bond_years: bondScope === side ? numOrNull(d.bond_years) : null,
    bond_desc: bondScope === side ? (d.bond_desc as RichTextValue | null) : null,
    // Packages follow the offer type's scope — they have no switch of their own.
    stipend_mode: offerTypeScope === side ? d.stipend_mode : null,
    stipend_min: offerTypeScope === side ? numOrNull(d.stipend_min) : null,
    stipend_max: offerTypeScope === side ? numOrNull(d.stipend_max) : null,
    ctc_mode: offerTypeScope === side ? d.ctc_mode : null,
    ctc_min: offerTypeScope === side ? numOrNull(d.ctc_min) : null,
    ctc_max: offerTypeScope === side ? numOrNull(d.ctc_max) : null,
  })

  /** Client-side pre-checks — cheap, and they name the field rather than the row. */
  const validate = (): string | null => {
    if (!companyId) return 'Pick a company.'
    if (!driveName.trim()) return 'Give the drive a name.'
    if (profiles.some((p) => p.designation_id === null))
      return 'Every designation block needs a designation.'
    const ids = profiles.map((p) => p.designation_id)
    if (new Set(ids).size !== ids.length)
      return 'The same designation is listed twice.'
    if (profileType === 'single' && profiles.length !== 1)
      return 'A single-profile drive has exactly one designation.'
    return null
  }

  const onSubmit = async () => {
    const problem = validate()
    if (problem) {
      toast.info(problem)
      return
    }
    setSaving(true)
    try {
      const body: DriveWrite = {
        company_id: companyId!,
        drive_name: driveName.trim(),
        profile_type: profileType,
        offer_type_scope: offerTypeScope,
        job_location_scope: jobLocationScope,
        placement_category_scope: placementCategoryScope,
        bond_scope: bondScope,
        company_category_ids: companyCategoryIds,
        spoc_email: spocEmail.trim() || null,
        spoc_contact: spocContact.trim() || null,
        registration_end_date: localInputToIso(registrationEnd),
        drive_date: driveDate || null,
        ...buildScopedPayload(driveScoped, 'drive'),
        profiles: profiles.map((p, i) => ({
          ...(p.id ? { id: p.id } : {}),
          designation_id: p.designation_id!,
          jd: p.jd,
          sort_order: i,
          ...buildScopedPayload(p, 'designation'),
        })) as DriveProfileWrite[],
      }

      const saved = isEdit
        ? await updateDrive(driveId!, body)
        : await createDrive(body)

      // Attachments need a saved profile id, so they upload after the drive
      // round-trips. A failed upload must NOT read as "the drive didn't save".
      const staged = profiles.filter((p) => p.staged.length > 0)
      if (staged.length > 0) {
        const fresh = await getDrive(saved.id)
        let failures = 0
        for (const [i, p] of profiles.entries()) {
          if (!p.staged.length) continue
          const profileId = p.id ?? fresh.profiles[i]?.id
          if (!profileId) {
            failures += p.staged.length
            continue
          }
          for (const file of p.staged) {
            try {
              await uploadDriveAttachment(profileId, file)
            } catch {
              failures++
            }
          }
        }
        if (failures > 0) {
          toast.error(
            `Drive saved, but ${failures} attachment(s) failed to upload. Re-add them from the edit screen.`,
          )
          employeeNavigateTo(`${LIST_ROUTE}/${saved.id}`)
          return
        }
      }

      toast.success(isEdit ? 'Drive updated.' : 'Drive created.')
      employeeNavigateTo(`${LIST_ROUTE}/${saved.id}`)
    } catch (e) {
      toast.error(errMsg(e, 'Could not save the drive.'))
    } finally {
      setSaving(false)
    }
  }

  if (!access) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <NoAccessEmptyState />
      </div>
    )
  }
  if (loading || !lookups) {
    return (
      <div className="mx-auto max-w-4xl rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
        Loading…
      </div>
    )
  }
  if (loadError) {
    return (
      <div className="mx-auto max-w-4xl rounded-xl border bg-card p-8 text-center text-sm text-destructive">
        {loadError}
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5 pb-16">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => employeeNavigateTo(LIST_ROUTE)}
        >
          <ArrowLeft className="size-4" /> Back
        </Button>
        <h1 className="text-lg font-semibold tracking-tight">
          {isEdit ? 'Edit drive' : 'New drive'}
        </h1>
      </div>

      {/* --- Company & identity --- */}
      <Section title="Company & drive">
        <Field label="Company" htmlFor="drive-company">
          <div className="flex items-center gap-3">
            {company && (
              <CompanyLogo
                name={company.name}
                logoUrl={company.logo_url}
                className="size-10 shrink-0"
              />
            )}
            <div className="flex-1">
              <SearchableSelect
                id="drive-company"
                options={companies}
                value={companyId}
                onChange={onPickCompany}
                placeholder="Select a company…"
                searchPlaceholder="Search companies…"
              />
            </div>
          </div>
        </Field>

        <Field
          label="Company category"
          hint="Pre-filled from the company's Corporate Relations tags — edit if this drive is pitched differently."
        >
          <SearchableMultiSelect
            options={companyCategoryOptions}
            selected={companyCategoryIds}
            onChange={setCompanyCategoryIds}
            placeholder="Select categories…"
            searchPlaceholder="Search categories…"
            noOptions="No company categories configured yet."
          />
        </Field>

        <Field label="Drive name" htmlFor="drive-name">
          <Input
            id="drive-name"
            value={driveName}
            onChange={(e) => setDriveName(e.target.value)}
          />
        </Field>

        <Field label="Drive profile" htmlFor="drive-profile-type">
          <NativeSelect
            id="drive-profile-type"
            value={profileType}
            onChange={(e) =>
              onProfileTypeChange(e.target.value as 'single' | 'multi')
            }
          >
            <option value="single">Single profile</option>
            <option value="multi">Multi profile</option>
          </NativeSelect>
        </Field>
      </Section>

      {/* --- Scope switches --- */}
      <Section
        title="Where each field is captured"
        hint="Drive-wise asks once for the whole drive. Designation-wise asks inside each designation block."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <ScopeSwitch
            label="Offer type & package"
            value={offerTypeScope}
            onChange={setOfferTypeScope}
            hint="The stipend/CTC follows the offer type."
          />
          <ScopeSwitch
            label="Job location"
            value={jobLocationScope}
            onChange={setJobLocationScope}
          />
          <ScopeSwitch
            label="Placement category"
            value={placementCategoryScope}
            onChange={setPlacementCategoryScope}
          />
          <ScopeSwitch label="Bond" value={bondScope} onChange={setBondScope} />
        </div>
      </Section>

      {/* --- Drive-wise fields --- */}
      {(offerTypeScope === 'drive' ||
        jobLocationScope === 'drive' ||
        placementCategoryScope === 'drive' ||
        bondScope === 'drive') && (
        <Section title="Drive-wise details">
          {offerTypeScope === 'drive' && (
            <OfferTypeFields
              draft={driveScoped}
              patch={(p) => setDriveScoped((d) => ({ ...d, ...p }))}
              lookups={lookups}
              idPrefix="drive"
            />
          )}
          {jobLocationScope === 'drive' && (
            <JobLocationField
              draft={driveScoped}
              patch={(p) => setDriveScoped((d) => ({ ...d, ...p }))}
              lookups={lookups}
            />
          )}
          {placementCategoryScope === 'drive' && (
            <PlacementCategoryField
              draft={driveScoped}
              patch={(p) => setDriveScoped((d) => ({ ...d, ...p }))}
              lookups={lookups}
              idPrefix="drive"
            />
          )}
          {bondScope === 'drive' && (
            <BondFields
              draft={driveScoped}
              patch={(p) => setDriveScoped((d) => ({ ...d, ...p }))}
              idPrefix="drive"
              renderDescription={() => (
                <LazyRichTextEditor
                  value={(driveScoped.bond_desc as RichTextValue | null) ?? null}
                  onChange={(v) => setDriveScoped((d) => ({ ...d, bond_desc: v }))}
                />
              )}
            />
          )}
        </Section>
      )}

      {/* --- Designations --- */}
      <Section
        title={profileType === 'single' ? 'Designation' : 'Designations'}
        action={
          profileType === 'multi' ? (
            <Button variant="outline" size="sm" onClick={addProfile}>
              <Plus className="size-4" /> Add designation
            </Button>
          ) : null
        }
      >
        <div className="space-y-4">
          {profiles.map((p, i) => (
            <ProfileBlock
              key={p.uid}
              index={i}
              profile={p}
              patch={(x) => patchProfile(p.uid, x)}
              onRemove={
                profiles.length > 1 ? () => removeProfile(p.uid) : undefined
              }
              lookups={lookups}
              scopes={{
                offerTypeScope,
                jobLocationScope,
                placementCategoryScope,
                bondScope,
              }}
            />
          ))}
        </div>
      </Section>

      {/* --- SPOC & dates --- */}
      <Section title="SPOC & dates">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Drive SPOC email" htmlFor="drive-spoc-email">
            <Input
              id="drive-spoc-email"
              type="email"
              value={spocEmail}
              onChange={(e) => setSpocEmail(e.target.value)}
            />
          </Field>
          <Field label="Drive SPOC contact" htmlFor="drive-spoc-contact">
            <Input
              id="drive-spoc-contact"
              value={spocContact}
              onChange={(e) => setSpocContact(e.target.value)}
            />
          </Field>
          {/* The app's calendar, not native date/datetime-local inputs —
              Chromium dismisses the native popup on month navigation. The
              deadline splits into a date picker + a time input; a first date
              pick defaults the time to 23:59 (it is a deadline). */}
          <Field label="Registration end (date & time)">
            <div className="flex gap-2">
              <DatePicker
                value={registrationEnd.slice(0, 10)}
                clearable
                onChange={(iso) =>
                  setRegistrationEnd(
                    iso
                      ? `${iso}T${registrationEnd.slice(11, 16) || '23:59'}`
                      : '',
                  )
                }
                aria-label="Registration end date"
                className="flex-1 [&>button]:h-9 [&>button]:w-full [&>button]:justify-start"
              />
              <Input
                type="time"
                value={registrationEnd.slice(11, 16)}
                disabled={!registrationEnd}
                onChange={(e) =>
                  setRegistrationEnd(
                    `${registrationEnd.slice(0, 10)}T${e.target.value || '23:59'}`,
                  )
                }
                aria-label="Registration end time"
                className="w-28"
              />
            </div>
          </Field>
          <Field label="Drive date">
            <DatePicker
              value={driveDate}
              onChange={setDriveDate}
              clearable
              aria-label="Drive date"
              className="[&>button]:h-9 [&>button]:w-full [&>button]:justify-start"
            />
          </Field>
        </div>
      </Section>

      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          onClick={() => employeeNavigateTo(LIST_ROUTE)}
          disabled={saving}
        >
          Cancel
        </Button>
        <Button onClick={onSubmit} disabled={saving}>
          {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create drive'}
        </Button>
      </div>
    </div>
  )
}

function Section({
  title,
  hint,
  action,
  children,
}: {
  title: string
  hint?: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="space-y-3 rounded-xl border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

function ScopeSwitch({
  label,
  value,
  onChange,
  hint,
}: {
  label: string
  value: DriveFieldScope
  onChange: (v: DriveFieldScope) => void
  hint?: string
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{label}</span>
        <div className="inline-flex overflow-hidden rounded-md border bg-background text-xs">
          {(['drive', 'designation'] as const).map((s, i) => (
            <button
              key={s}
              type="button"
              onClick={() => onChange(s)}
              aria-pressed={value === s}
              className={cn(
                'px-2.5 py-1 transition-colors',
                i > 0 && 'border-l',
                value === s
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-accent/40',
              )}
            >
              {s === 'drive' ? 'Drive-wise' : 'Designation-wise'}
            </button>
          ))}
        </div>
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

function ProfileBlock({
  index,
  profile,
  patch,
  onRemove,
  lookups,
  scopes,
}: {
  index: number
  profile: ProfileDraft
  patch: (p: Partial<ProfileDraft>) => void
  onRemove?: () => void
  lookups: DriveLookups
  scopes: {
    offerTypeScope: DriveFieldScope
    jobLocationScope: DriveFieldScope
    placementCategoryScope: DriveFieldScope
    bondScope: DriveFieldScope
  }
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const idPrefix = `p-${profile.uid}`

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? [])
    // Reset immediately so re-picking the same file fires `change` again.
    e.target.value = ''
    const ok = picked.filter((f) => {
      if (f.size > MAX_ATTACHMENT_BYTES) {
        toast.error(`"${f.name}" is over 10 MB.`)
        return false
      }
      return true
    })
    if (ok.length) patch({ staged: [...profile.staged, ...ok] })
  }

  const removeStaged = (i: number) =>
    patch({ staged: profile.staged.filter((_, x) => x !== i) })

  const removeUploaded = async (a: DriveAttachment) => {
    try {
      await deleteDriveAttachment(a.id)
      patch({ attachments: profile.attachments.filter((x) => x.id !== a.id) })
      toast.success(`Removed "${a.file_name}".`)
    } catch (e) {
      toast.error(errMsg(e, 'Could not remove the attachment.'))
    }
  }

  return (
    <div className="space-y-3 rounded-lg border bg-background p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Designation {index + 1}
        </span>
        {onRemove && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRemove}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="size-4" />
          </Button>
        )}
      </div>

      <Field label="Designation" htmlFor={`${idPrefix}-designation`}>
        <SearchableSelect
          id={`${idPrefix}-designation`}
          options={lookups.designations.map((d) => ({ id: d.id, name: d.name }))}
          value={profile.designation_id ?? null}
          onChange={(id) => patch({ designation_id: id })}
          placeholder="Select…"
          searchPlaceholder="Search designations…"
        />
      </Field>

      {scopes.offerTypeScope === 'designation' && (
        <OfferTypeFields
          draft={profile}
          patch={patch}
          lookups={lookups}
          idPrefix={idPrefix}
        />
      )}
      {scopes.jobLocationScope === 'designation' && (
        <JobLocationField draft={profile} patch={patch} lookups={lookups} />
      )}
      {scopes.placementCategoryScope === 'designation' && (
        <PlacementCategoryField
          draft={profile}
          patch={patch}
          lookups={lookups}
          idPrefix={idPrefix}
        />
      )}
      {scopes.bondScope === 'designation' && (
        <BondFields
          draft={profile}
          patch={patch}
          idPrefix={idPrefix}
          renderDescription={() => (
            <LazyRichTextEditor
              // key: the editor is uncontrolled after mount, so it must remount
              // per designation or block 2 shows block 1's text.
              key={`${profile.uid}-bond`}
              value={(profile.bond_desc as RichTextValue | null) ?? null}
              onChange={(v) => patch({ bond_desc: v })}
            />
          )}
        />
      )}

      <Field label="Job description">
        <LazyRichTextEditor
          // Same remount contract as the bond editor above.
          key={`${profile.uid}-jd`}
          value={profile.jd}
          onChange={(v) => patch({ jd: v })}
        />
      </Field>

      <Field label="JD attachments" hint="PDF or DOC, up to 10 MB each.">
        <div className="space-y-2">
          <input
            ref={fileRef}
            type="file"
            multiple
            className="hidden"
            onChange={onPick}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="size-4" /> Add files
          </Button>

          {(profile.attachments.length > 0 || profile.staged.length > 0) && (
            <ul className="space-y-1">
              {profile.attachments.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center gap-2 rounded border bg-card px-2 py-1 text-sm"
                >
                  <Paperclip className="size-3.5 shrink-0 text-muted-foreground" />
                  <a
                    href={a.file_url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 truncate hover:underline"
                  >
                    {a.file_name}
                  </a>
                  <button
                    type="button"
                    onClick={() => removeUploaded(a)}
                    aria-label={`Remove ${a.file_name}`}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="size-3.5" />
                  </button>
                </li>
              ))}
              {profile.staged.map((f, i) => (
                <li
                  key={`${f.name}-${i}`}
                  className="flex items-center gap-2 rounded border border-dashed bg-card px-2 py-1 text-sm"
                >
                  <Paperclip className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate">{f.name}</span>
                  <span className="text-xs text-muted-foreground">
                    uploads on save
                  </span>
                  <button
                    type="button"
                    onClick={() => removeStaged(i)}
                    aria-label={`Remove ${f.name}`}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Field>
    </div>
  )
}
