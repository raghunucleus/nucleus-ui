import * as React from 'react'
import { Check, Copy, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { DatePicker } from '@/components/ui/date-picker'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  CompanyLogo,
  ChipRow,
  Field,
  SearchableMultiSelect,
  SearchableSelect,
  Textarea,
  formatDate,
} from '@/components/corporate-relations/bits'
import { ContactRows } from '@/components/corporate-relations/contact-rows'
import {
  emptyContact,
  fromSaved,
  keptDrafts,
  toWrites,
  validateDrafts,
  type ContactDraft,
} from '@/lib/cr-view-contacts'
import { ApiError } from '@/lib/api'
import {
  getCrViewRecord,
  type Chip,
  type CrViewRecordPayload,
  type CrViewRow,
  type CrViewScope,
  type CrViewYearOption,
} from '@/lib/corporate-relations'

function errMsg(e: unknown, fallback: string): string {
  return e instanceof ApiError || e instanceof Error ? e.message : fallback
}

/**
 * The pickers only carry ACTIVE values, so a value saved before someone
 * deactivated it would silently vanish from its own form — and then vanish from
 * the record on the next save. Folding what the record already holds back into
 * the list keeps it visible and re-savable, which is exactly what the server
 * allows (`assertSelectable` accepts an inactive value a record already has).
 */
function withSaved(options: Chip[], saved: Chip[]): Chip[] {
  const known = new Set(options.map((o) => o.id))
  const missing = saved.filter((s) => !known.has(s.id))
  return missing.length === 0 ? options : [...options, ...missing]
}

/**
 * The record's reference code (`CR-2027-00042`) with copy-to-clipboard — the
 * stable key for this exact (role × year) conversation, quotable in drive
 * management and anywhere else. Shown ONLY in a full-row sheet — never in the
 * table — which is why Management View's read-only sheet imports this one rather
 * than growing its own.
 */
export function RecordCodePill({ code }: { code: string }) {
  const [copied, setCopied] = React.useState(false)
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  React.useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current)
    },
    [],
  )

  async function copy() {
    try {
      await navigator.clipboard.writeText(code)
      toast.success('Code copied.')
      setCopied(true)
      if (timer.current !== null) clearTimeout(timer.current)
      timer.current = setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error('Could not copy — select the code and copy it manually.')
    }
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-md border bg-muted/60 py-0.5 pl-2 pr-1">
      <span className="font-mono text-xs">{code}</span>
      <button
        type="button"
        title="Copy record code"
        aria-label="Copy record code"
        onClick={() => void copy()}
        className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {copied ? (
          <Check className="size-3.5 text-primary" />
        ) : (
          <Copy className="size-3.5" />
        )}
      </button>
    </span>
  )
}

/**
 * The FULL editor for one (job role × passout year) — every recorded field in
 * one form with one Save, for when a row is being filled in wholesale rather
 * than nudged one cell at a time. The inline cells stay the fast path; this is
 * the thorough one.
 *
 * Opens by fetching the row fresh: the list behind it can be minutes stale,
 * and a whole-form save is exactly the case where writing over somebody
 * else's newer edit matters. The save sends EVERY key — deliberately, that is
 * what "edit the whole row" means.
 */
export function CrViewRecordSheet({
  row,
  ...props
}: {
  /** The row to edit; `null` closes the sheet. */
  row: CrViewRow | null
  year: CrViewYearOption
  scope: CrViewScope
  onOpenChange: (open: boolean) => void
  /** One PATCH with every key; resolves `true` on success. */
  onSave: (jobRoleId: number, payload: CrViewRecordPayload) => Promise<boolean>
}) {
  // Unmounted while closed (and keyed by row), so every open MOUNTS fresh —
  // state seeds in initializers and the fetch effect, with nothing to reset.
  if (!row) return null
  return <RecordSheetBody key={row.job_role_id} row={row} {...props} />
}

function RecordSheetBody({
  row,
  year,
  scope,
  onOpenChange,
  onSave,
}: {
  row: CrViewRow
  year: CrViewYearOption
  scope: CrViewScope
  onOpenChange: (open: boolean) => void
  onSave: (jobRoleId: number, payload: CrViewRecordPayload) => Promise<boolean>
}) {
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)
  const [showErrors, setShowErrors] = React.useState(false)
  const [loaded, setLoaded] = React.useState<CrViewRow | null>(null)

  const [typeIds, setTypeIds] = React.useState<number[]>([])
  const [statusId, setStatusId] = React.useState<number | null>(null)
  const [designationIds, setDesignationIds] = React.useState<number[]>([])
  const [programmeIds, setProgrammeIds] = React.useState<number[]>([])
  const [locationIds, setLocationIds] = React.useState<number[]>([])
  const [followUp, setFollowUp] = React.useState('')
  const [remarks, setRemarks] = React.useState('')
  const [drafts, setDrafts] = React.useState<ContactDraft[]>([])

  React.useEffect(() => {
    let cancelled = false
    getCrViewRecord(row.job_role_id, year.id)
      .then((fresh) => {
        if (cancelled) return
        setLoaded(fresh)
        const rec = fresh.record
        setTypeIds((rec?.relationship_types ?? []).map((t) => t.id))
        // NOT seeded with the default status. Preselecting it would write the
        // default into the record on save, and "the default is never stored"
        // is the whole reason a new passout year reads as it with nothing to
        // reset.
        setStatusId(rec?.current_status?.id ?? null)
        setDesignationIds((rec?.designations ?? []).map((d) => d.id))
        setProgrammeIds((rec?.programmes ?? []).map((p) => p.id))
        setLocationIds((rec?.job_locations ?? []).map((l) => l.id))
        setFollowUp(rec?.next_follow_up_date ?? '')
        setRemarks(rec?.remarks ?? '')
        setDrafts(
          rec?.contacts?.length ? rec.contacts.map(fromSaved) : [emptyContact()],
        )
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(errMsg(e, 'Could not open this record.'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [row.job_role_id, year.id])

  const typeOptions = React.useMemo(
    () =>
      withSaved(
        scope.relationship_types,
        loaded?.record?.relationship_types ?? [],
      ),
    [scope.relationship_types, loaded],
  )
  const statusOptions = React.useMemo(() => {
    const saved = loaded?.record?.current_status
    return withSaved(scope.current_statuses, saved ? [saved] : [])
  }, [scope.current_statuses, loaded])
  const designationOptions = React.useMemo(
    () => withSaved(scope.designations, loaded?.record?.designations ?? []),
    [scope.designations, loaded],
  )
  const programmeOptions = React.useMemo(
    () => withSaved(scope.programmes, loaded?.record?.programmes ?? []),
    [scope.programmes, loaded],
  )
  const locationOptions = React.useMemo(
    () => withSaved(scope.job_locations, loaded?.record?.job_locations ?? []),
    [scope.job_locations, loaded],
  )

  const validation = React.useMemo(() => validateDrafts(drafts), [drafts])

  const patchDraft = (uid: string, p: Partial<ContactDraft>) =>
    setDrafts((prev) => prev.map((d) => (d.uid === uid ? { ...d, ...p } : d)))
  const addDraft = () => setDrafts((prev) => [...prev, emptyContact()])
  const removeDraft = (uid: string) =>
    setDrafts((prev) => prev.filter((d) => d.uid !== uid))

  async function save() {
    const kept = keptDrafts(drafts)
    const { firstError } = validateDrafts(kept)
    if (firstError) {
      setShowErrors(true)
      return
    }
    setSaving(true)
    try {
      const ok = await onSave(row.job_role_id, {
        relationship_type_ids: typeIds,
        current_status_id: statusId,
        designation_ids: designationIds,
        programme_ids: programmeIds,
        job_location_ids: locationIds,
        next_follow_up_date: followUp || null,
        remarks: remarks.trim() || null,
        contacts: toWrites(kept),
      })
      if (ok) onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  const company = loaded?.company ?? row.company

  return (
    <Sheet open onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-xl">
        <SheetHeader className="px-4 sm:px-6">
          <SheetTitle>{row.role_name}</SheetTitle>
          <SheetDescription>
            {company.name} · {year.display_year}
          </SheetDescription>
        </SheetHeader>

        <div className="px-4 pb-4 sm:px-6">
          {loading ? (
            <div className="flex items-center justify-center py-24 text-muted-foreground">
              <Loader2 className="mr-2 size-4 animate-spin" /> Loading…
            </div>
          ) : error ? (
            <p className="py-6 text-sm text-destructive">{error}</p>
          ) : (
            <div className="space-y-5">
              <div className="flex items-start gap-3 rounded-lg border bg-muted/40 px-3 py-2.5">
                <CompanyLogo name={company.name} logoUrl={company.logo_url} />
                <div className="min-w-0 space-y-1.5">
                  <p className="truncate text-sm font-medium">{company.name}</p>
                  <ChipRow items={company.categories} />
                  {loaded?.record?.record_code ? (
                    <RecordCodePill code={loaded.record.record_code} />
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Record code is generated on first save.
                    </p>
                  )}
                </div>
              </div>

              {/* All four multi-selects carry Select all — bulk "this company
                  hires everywhere / everything" entries are the common case. */}
              <Field label="Relationship type">
                <SearchableMultiSelect
                  options={typeOptions}
                  selected={typeIds}
                  onChange={setTypeIds}
                  placeholder="Select…"
                  searchPlaceholder="Search relationship types…"
                  showSelectAll
                />
              </Field>

              <Field
                label="Current status"
                hint={
                  scope.default_status
                    ? `Leave empty to show the default — ${scope.default_status.name}.`
                    : undefined
                }
              >
                <SearchableSelect
                  options={statusOptions}
                  value={statusId}
                  onChange={setStatusId}
                  placeholder="Select…"
                  searchPlaceholder="Search statuses…"
                />
              </Field>

              <Field label="Designation">
                <SearchableMultiSelect
                  options={designationOptions}
                  selected={designationIds}
                  onChange={setDesignationIds}
                  placeholder="Select…"
                  searchPlaceholder="Search designations…"
                  showSelectAll
                />
              </Field>

              <Field label="Programme">
                <SearchableMultiSelect
                  options={programmeOptions}
                  selected={programmeIds}
                  onChange={setProgrammeIds}
                  placeholder="Select…"
                  searchPlaceholder="Search programmes…"
                  showSelectAll
                />
              </Field>

              <Field label="Location">
                <SearchableMultiSelect
                  options={locationOptions}
                  selected={locationIds}
                  onChange={setLocationIds}
                  placeholder="Select…"
                  searchPlaceholder="Search locations…"
                  showSelectAll
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Next follow up date">
                  {/* The app's own calendar, not `<input type="date">` — the
                      native popup dies to Chromium's focus juggling inside the
                      sheet the moment you switch months. */}
                  <DatePicker
                    value={followUp}
                    onChange={setFollowUp}
                    clearable
                    aria-label="Next follow up date"
                    className="[&>button]:w-full [&>button]:justify-start"
                  />
                </Field>
              </div>

              <Field label="Remarks" htmlFor="cr-sheet-remarks">
                <Textarea
                  id="cr-sheet-remarks"
                  value={remarks}
                  maxLength={1000}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Anything worth remembering about this year's conversation…"
                />
              </Field>

              <div className="space-y-2">
                <p className="text-sm font-medium">Contact details</p>
                <ContactRows
                  drafts={drafts}
                  errors={showErrors ? validation.byUid : {}}
                  onPatch={patchDraft}
                  onAdd={addDraft}
                  onRemove={removeDraft}
                />
              </div>

              {loaded?.record && (
                <p className="text-xs text-muted-foreground">
                  Last updated {formatDate(loaded.record.updated_at)}
                </p>
              )}

              <div className="flex items-center justify-end gap-2 border-t pt-4">
                {showErrors && validation.firstError && (
                  <p className="mr-auto text-xs text-destructive">
                    {validation.firstError}
                  </p>
                )}
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button onClick={() => void save()} disabled={saving}>
                  {saving && <Loader2 className="size-4 animate-spin" />}
                  Save
                </Button>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
