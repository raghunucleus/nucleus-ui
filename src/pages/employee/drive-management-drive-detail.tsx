import { useParams } from '@tanstack/react-router'
import {
  ArrowLeft,
  Filter,
  GraduationCap,
  LayoutDashboard,
  Pencil,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import {
  CompanyLogo,
  Field,
  NativeSelect,
  SearchableMultiSelect,
  TabBar,
  type TabDef,
} from '@/components/corporate-relations/bits'
import ComingSoon from '@/components/employee/coming-soon'
import { NoAccessEmptyState } from '@/components/employee/empty-states'
import { StudentSearchPanel } from '@/components/employee/student-search/student-search-panel'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useScreenAccess } from '@/hooks/use-screen-access'
import { ApiError } from '@/lib/api'
import { employeeNavigateTo } from '@/lib/employee-navigate'
import {
  DRIVE_STATUSES,
  DRIVE_STATUS_LABELS,
  ENTRY_TYPE_OPTIONS,
  GENDER_OPTIONS,
  driveStatusVariant,
  driveStudentsSearchApi,
  getDrive,
  getDriveEligibility,
  getDriveStudentsFilterPrefill,
  listDriveEligibilityOptions,
  saveDriveEligibility,
  updateDriveStatus,
  type Chip,
  type DriveDetail,
  type DriveEligibility,
  type DriveEligibilityOptions,
  type DriveStatus,
} from '@/lib/drive-management'
import type { SearchCondition, SearchGroup } from '@/lib/student-search'
import { cn } from '@/lib/utils'

const SCREEN_KEY = 'drive_management.drives.manage'
const LIST_ROUTE = '/drive-management/drives'

function errMsg(e: unknown, fallback: string): string {
  return e instanceof ApiError || e instanceof Error ? e.message : fallback
}

const TABS: TabDef[] = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'eligibility', label: 'Eligibility', icon: GraduationCap },
  { key: 'filter', label: 'Filter', icon: Filter },
]

export default function EmployeeDriveDetailPage() {
  const access = useScreenAccess(SCREEN_KEY)
  const actions = access?.actions ?? []
  const canEdit = actions.includes('edit')

  const params = useParams({ strict: false }) as { driveId?: string }
  const driveId = params.driveId ? Number(params.driveId) : null

  const [drive, setDrive] = useState<DriveDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [tab, setTab] = useState('overview')
  const [savingStatus, setSavingStatus] = useState(false)
  // The Filter tab mounts lazily on first visit and then STAYS mounted (just
  // hidden), so built-up filters and results survive tab switches.
  const [filterVisited, setFilterVisited] = useState(false)

  useEffect(() => {
    if (tab === 'filter') setFilterVisited(true)
  }, [tab])

  useEffect(() => {
    document.title = 'Drive — Nucleus'
  }, [])

  useEffect(() => {
    if (driveId === null) return
    let cancelled = false
    setLoading(true)
    getDrive(driveId)
      .then((d) => {
        if (cancelled) return
        setDrive(d)
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
  }, [driveId])

  const onStatusChange = async (status: DriveStatus) => {
    if (!drive) return
    const prev = drive.status
    setDrive({ ...drive, status })
    setSavingStatus(true)
    try {
      await updateDriveStatus(drive.id, status)
      toast.success(`Status set to ${DRIVE_STATUS_LABELS[status]}.`)
    } catch (e) {
      setDrive({ ...drive, status: prev })
      toast.error(errMsg(e, 'Could not update the status.'))
    } finally {
      setSavingStatus(false)
    }
  }

  if (!access) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <NoAccessEmptyState />
      </div>
    )
  }
  if (loading || !drive) {
    return (
      <div className="mx-auto max-w-4xl rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
        {loadError ?? 'Loading…'}
      </div>
    )
  }

  return (
    <div className="mx-auto flex h-full max-w-7xl flex-col gap-4 pb-4">
      <div className="shrink-0 space-y-3 pt-1">
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => employeeNavigateTo(LIST_ROUTE)}
          >
            <ArrowLeft className="size-4" /> Back
          </Button>
          <CompanyLogo
            name={drive.company.name}
            logoUrl={drive.company.logo_url}
            className="size-10 shrink-0"
          />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-semibold tracking-tight">
              {drive.drive_name}
            </h1>
            <p className="truncate text-sm text-muted-foreground">
              {drive.company.name}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant={driveStatusVariant(drive.status)}>
              {DRIVE_STATUS_LABELS[drive.status]}
            </Badge>
            {canEdit && (
              <NativeSelect
                aria-label="Drive status"
                value={drive.status}
                disabled={savingStatus}
                onChange={(e) => onStatusChange(e.target.value as DriveStatus)}
                className="w-44"
              >
                {DRIVE_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {DRIVE_STATUS_LABELS[s]}
                  </option>
                ))}
              </NativeSelect>
            )}
            {canEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  employeeNavigateTo(`${LIST_ROUTE}/${drive.id}/edit`)
                }
              >
                <Pencil className="size-4" /> Edit drive
              </Button>
            )}
          </div>
        </div>

        <TabBar tabs={TABS} active={tab} onChange={setTab} />
      </div>

      <div className="scrollbar-themed min-h-0 flex-1 overflow-y-auto">
        {tab === 'overview' && (
          <ComingSoon
            title="Overview"
            subtitle="A summary of this drive — company, designations, package and dates — lands here soon."
            icon={LayoutDashboard}
          />
        )}
        {tab === 'eligibility' && (
          <EligibilityTab driveId={drive.id} canEdit={canEdit} />
        )}
        {filterVisited && (
          <div className={tab === 'filter' ? 'h-full' : 'hidden'}>
            <DriveFilterTab driveId={drive.id} />
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------

/**
 * Recommended placement defaults every drive Filter tab opens with: only
 * active students the department has cleared and who opted into placements.
 * They render locked in the builder — the user is warned before changing them.
 */
const PLACEMENT_DEFAULTS: SearchCondition[] = [
  { attr: 'is_active', op: 'eq', value: true },
  { attr: 'allowed_by_dept_for_placements', op: 'eq', value: true },
  { attr: 'interested_in_placements_self', op: 'eq', value: true },
]
const LOCKED_ATTRS = PLACEMENT_DEFAULTS.map((c) => c.attr)

/**
 * The Filter tab: the full student search, seeded with the placement defaults
 * above plus this drive's eligibility criteria (editable). A failed prefill
 * degrades to just the defaults — the search itself still works.
 */
function DriveFilterTab({ driveId }: { driveId: number }) {
  const api = useMemo(() => driveStudentsSearchApi(driveId), [driveId])
  // undefined = still loading the prefill; null = none / failed.
  const [prefill, setPrefill] = useState<SearchGroup | null | undefined>(
    undefined,
  )

  useEffect(() => {
    let cancelled = false
    getDriveStudentsFilterPrefill(driveId)
      .then((r) => {
        if (!cancelled) setPrefill(r.filters)
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setPrefill(null)
        toast.info(errMsg(e, 'Could not pre-fill from eligibility.'))
      })
    return () => {
      cancelled = true
    }
  }, [driveId])

  // Placement defaults first, then the eligibility conditions.
  const seeded = useMemo<SearchGroup>(
    () => ({ and: [...PLACEMENT_DEFAULTS, ...(prefill?.and ?? [])] }),
    [prefill],
  )

  if (prefill === undefined) {
    return (
      <div className="space-y-3 py-2">
        <div className="h-9 w-64 animate-pulse rounded-md bg-muted" />
        <div className="h-24 animate-pulse rounded-xl bg-muted" />
        <div className="h-64 animate-pulse rounded-xl bg-muted" />
      </div>
    )
  }

  return (
    <StudentSearchPanel
      api={api}
      initialFilters={seeded}
      lockedAttrs={LOCKED_ATTRS}
    />
  )
}

// ---------------------------------------------------------------------------
// Eligibility tab
// ---------------------------------------------------------------------------

/** "" for a blank input; the server treats null as "no restriction". */
const numOrNull = (s: string): number | null =>
  s.trim() === '' ? null : Number(s)
const strOf = (n: number | null): string => (n == null ? '' : String(n))

/** Local editable shape — numeric fields held as input strings. */
interface EligibilityForm {
  programme_ids: number[]
  entry_types: number[]
  genders: string[]
  passout_years: number[]
  allow_backlog_history: boolean
  max_current_backlogs: string
  min_tenth_percentage: string
  min_twelfth_or_diploma_percentage: string
  min_btech_cgpa: string
}

function toForm(e: DriveEligibility): EligibilityForm {
  return {
    programme_ids: e.programme_ids,
    entry_types: e.entry_types,
    genders: e.genders,
    passout_years: e.passout_years,
    allow_backlog_history: e.allow_backlog_history,
    max_current_backlogs: strOf(e.max_current_backlogs),
    min_tenth_percentage: strOf(e.min_tenth_percentage),
    min_twelfth_or_diploma_percentage: strOf(
      e.min_twelfth_or_diploma_percentage,
    ),
    min_btech_cgpa: strOf(e.min_btech_cgpa),
  }
}

function EligibilityTab({
  driveId,
  canEdit,
}: {
  driveId: number
  canEdit: boolean
}) {
  const [form, setForm] = useState<EligibilityForm | null>(null)
  const [options, setOptions] = useState<DriveEligibilityOptions | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([getDriveEligibility(driveId), listDriveEligibilityOptions()])
      .then(([elig, opts]) => {
        if (cancelled) return
        setForm(toForm(elig))
        setOptions(opts)
        setError(null)
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(errMsg(e, 'Could not load eligibility.'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [driveId])

  const patch = (p: Partial<EligibilityForm>) =>
    setForm((f) => (f ? { ...f, ...p } : f))

  const onSave = async () => {
    if (!form) return
    setSaving(true)
    try {
      await saveDriveEligibility(driveId, {
        programme_ids: form.programme_ids,
        entry_types: form.entry_types,
        genders: form.genders,
        passout_years: form.passout_years,
        allow_backlog_history: form.allow_backlog_history,
        max_current_backlogs: numOrNull(form.max_current_backlogs),
        min_tenth_percentage: numOrNull(form.min_tenth_percentage),
        min_twelfth_or_diploma_percentage: numOrNull(
          form.min_twelfth_or_diploma_percentage,
        ),
        min_btech_cgpa: numOrNull(form.min_btech_cgpa),
      })
      toast.success('Eligibility saved.')
    } catch (e) {
      toast.error(errMsg(e, 'Could not save eligibility.'))
    } finally {
      setSaving(false)
    }
  }

  if (loading || !form || !options) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
        {error ?? 'Loading…'}
      </div>
    )
  }

  // Year options, unioned with any already-saved year not in the option set.
  const yearChips: Chip[] = mergeYears(
    options.passout_years,
    form.passout_years,
  )

  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-6">
      <p className="text-sm text-muted-foreground">
        Who this drive is open to. Leave an axis empty for "no restriction".
      </p>

      <Field label="Passout year" hint="Graduating batches this drive accepts.">
        <SearchableMultiSelect
          options={yearChips}
          selected={form.passout_years}
          onChange={(ids) => patch({ passout_years: ids })}
          placeholder="Any passout year"
          searchPlaceholder="Search years…"
        />
      </Field>

      <Field label="Programs" hint="Programmes eligible to apply.">
        <SearchableMultiSelect
          options={options.programmes}
          selected={form.programme_ids}
          onChange={(ids) => patch({ programme_ids: ids })}
          placeholder="Any programme"
          searchPlaceholder="Search programmes…"
        />
      </Field>

      <Field label="Entry type">
        <PillGroup
          options={ENTRY_TYPE_OPTIONS}
          selected={form.entry_types}
          onChange={(v) => patch({ entry_types: v })}
        />
      </Field>

      <Field label="Gender">
        <PillGroup
          options={GENDER_OPTIONS}
          selected={form.genders}
          onChange={(v) => patch({ genders: v })}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Allow with history of backlogs">
          <NativeSelect
            value={form.allow_backlog_history ? 'yes' : 'no'}
            onChange={(e) =>
              patch({ allow_backlog_history: e.target.value === 'yes' })
            }
          >
            <option value="no">No</option>
            <option value="yes">Yes</option>
          </NativeSelect>
        </Field>

        <Field
          label="Allow current backlogs upto"
          hint="Blank = no limit."
        >
          <Input
            type="number"
            min={0}
            max={99}
            value={form.max_current_backlogs}
            onChange={(e) => patch({ max_current_backlogs: e.target.value })}
            placeholder="No limit"
          />
        </Field>
      </div>

      <div className="space-y-1.5">
        <p className="text-sm font-medium">Academic criteria</p>
        <p className="text-xs text-muted-foreground">
          Minimums; blank means no minimum for that stage.
        </p>
        <div className="grid gap-4 pt-1 sm:grid-cols-3">
          <Field label="Xth (min %)">
            <Input
              type="number"
              min={0}
              max={100}
              step="any"
              value={form.min_tenth_percentage}
              onChange={(e) => patch({ min_tenth_percentage: e.target.value })}
              placeholder="e.g. 60"
            />
          </Field>
          <Field label="12th / Diploma (min %)">
            <Input
              type="number"
              min={0}
              max={100}
              step="any"
              value={form.min_twelfth_or_diploma_percentage}
              onChange={(e) =>
                patch({ min_twelfth_or_diploma_percentage: e.target.value })
              }
              placeholder="e.g. 60"
            />
          </Field>
          <Field label="Btech (min CGPA /10)">
            <Input
              type="number"
              min={0}
              max={10}
              step="any"
              value={form.min_btech_cgpa}
              onChange={(e) => patch({ min_btech_cgpa: e.target.value })}
              placeholder="e.g. 6.5"
            />
          </Field>
        </div>
      </div>

      {canEdit && (
        <div className="flex justify-end pt-2">
          <Button onClick={onSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save eligibility'}
          </Button>
        </div>
      )}
    </div>
  )
}

/** Union option years with any saved year missing from them, newest first. */
function mergeYears(optionYears: number[], selected: number[]): Chip[] {
  const all = [...new Set([...optionYears, ...selected])].sort((a, b) => b - a)
  return all.map((y) => ({ id: y, name: String(y) }))
}

/** A toggle-chip multi-select over a small fixed value set (string or number). */
function PillGroup<T extends string | number>({
  options,
  selected,
  onChange,
}: {
  options: { value: T; name: string }[]
  selected: T[]
  onChange: (next: T[]) => void
}) {
  const toggle = (v: T) =>
    onChange(
      selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v],
    )
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = selected.includes(o.value)
        return (
          <button
            key={String(o.value)}
            type="button"
            aria-pressed={on}
            onClick={() => toggle(o.value)}
            className={cn(
              'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
              on
                ? 'border-primary bg-primary text-primary-foreground'
                : 'bg-card hover:bg-accent hover:text-accent-foreground',
            )}
          >
            {o.name}
          </button>
        )
      })}
    </div>
  )
}
