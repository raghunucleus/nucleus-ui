import {
  Building2,
  CalendarClock,
  CalendarDays,
  Handshake,
  History,
  Loader2,
  Pencil,
  Plus,
  Power,
  Trash2,
  Upload,
  Users,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'

import { BackButton } from '@/components/ui/back-button'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  ChipRow,
  Field,
  NativeSelect,
  TabBar,
  Textarea,
  formatDate,
  formatDateTime,
  relationshipVariant,
  titleCase,
  type TabDef,
} from '@/components/corporate-relations/bits'
import {
  createContact,
  createInteraction,
  createMilestone,
  deleteContact,
  deleteInteraction,
  deleteMilestone,
  getAssignableEmployees,
  getCompany,
  getFormOptions,
  listActivity,
  listCompanyDrives,
  listInteractions,
  listMilestones,
  setCompanyStatus,
  updateCompany,
  updateContact,
  updateInteraction,
  uploadCompanyLogo,
  type AssignableEmployee,
  type CompanyActivity,
  type CompanyContact,
  type CompanyDetail as Company,
  type CompanyInteraction,
  type CompanyMilestone,
  type ContactPayload,
  type FormOptions,
  type InteractionPayload,
  type MilestonePayload,
  type Surface,
} from '@/lib/corporate-relations'
import { CompanyForm } from '@/components/corporate-relations/company-form'
import { ApiError } from '@/lib/api'
import {
  DRIVE_STATUS_LABELS,
  driveStatusVariant,
  type DriveListItem,
} from '@/lib/drive-management'
import { employeeNavigateTo } from '@/lib/employee-navigate'

const TABS: TabDef[] = [
  { key: 'overview', label: 'Overview', icon: Building2 },
  { key: 'drives', label: 'Drives', icon: CalendarDays },
  { key: 'relationship', label: 'Relationship', icon: Handshake },
  { key: 'interactions', label: 'Interactions', icon: CalendarClock },
  { key: 'activity', label: 'Activity', icon: History },
]

function errMsg(e: unknown, fallback: string): string {
  return e instanceof ApiError || e instanceof Error ? e.message : fallback
}

export interface CompanyDetailProps {
  surface: Surface
  companyId: number
  /** Manager surface only: header logo/status controls + full-screen edit. */
  canEditCompany: boolean
  /** May record interactions / milestones / contacts. */
  canRecord: boolean
  /** May inline-edit the company detail fields on the Overview tab. */
  canEditDetails?: boolean
  /** Whether the company name is editable in the inline editor. */
  nameEditable?: boolean
  onBack: () => void
  /** Manager: open the company edit form (owned by the page). */
  onEditCompany?: (company: Company) => void
  /** Bumped by the page after an external save to force a reload. */
  reloadToken?: number
  /** Tab to open on first render (e.g. when restored from a deep link). */
  initialTab?: string
}

export function CompanyDetail({
  surface,
  companyId,
  canEditCompany,
  canRecord,
  canEditDetails = false,
  nameEditable = true,
  onBack,
  onEditCompany,
  reloadToken = 0,
  initialTab,
}: CompanyDetailProps) {
  const [company, setCompany] = useState<Company | null>(null)
  const [options, setOptions] = useState<FormOptions | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState(initialTab ?? 'overview')
  const [localReload, setLocalReload] = useState(0)
  const refresh = () => setLocalReload((n) => n + 1)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    getCompany(surface, companyId)
      .then((c) => {
        if (!cancelled) setCompany(c)
      })
      .catch((e) => {
        if (!cancelled) setError(errMsg(e, 'Could not load the company.'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [surface, companyId, reloadToken, localReload])

  useEffect(() => {
    let cancelled = false
    getFormOptions(surface)
      .then((o) => !cancelled && setOptions(o))
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [surface])

  if (loading && !company) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin" /> Loading…
      </div>
    )
  }
  if (error || !company) {
    return (
      <div className="space-y-4">
        <Button variant="outline" size="sm" onClick={onBack}>
          Back
        </Button>
        <p className="text-sm text-destructive">{error ?? 'Not found.'}</p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="shrink-0 space-y-3 pt-1">
        <CompanyHeader
          company={company}
          canEditCompany={canEditCompany}
          onBack={onBack}
          onEdit={() => onEditCompany?.(company)}
          onChanged={refresh}
        />

        <TabBar tabs={TABS} active={tab} onChange={setTab} />
      </div>

      <div className="scrollbar-themed min-h-0 flex-1 overflow-y-auto">
        {tab === 'overview' && (
          <OverviewTab
            surface={surface}
            company={company}
            options={options}
            canRecord={canRecord}
            canEditDetails={canEditDetails}
            nameEditable={nameEditable}
            onContactsChanged={refresh}
            onSaved={refresh}
          />
        )}
        {tab === 'drives' && (
          <DrivesTab surface={surface} company={company} />
        )}
        {tab === 'relationship' && (
          <RelationshipTab
            surface={surface}
            company={company}
            options={options}
            canRecord={canRecord}
            canEditDetails={canEditDetails}
            onSaved={refresh}
          />
        )}
        {tab === 'interactions' && (
          <InteractionsTab
            surface={surface}
            company={company}
            options={options}
            canRecord={canRecord}
          />
        )}
        {tab === 'activity' && (
          <ActivityTab surface={surface} company={company} />
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

function CompanyHeader({
  company,
  canEditCompany,
  onBack,
  onEdit,
  onChanged,
}: {
  company: Company
  canEditCompany: boolean
  onBack: () => void
  onEdit: () => void
  onChanged: () => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  async function onLogoPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true)
    try {
      await uploadCompanyLogo(company.id, file)
      toast.success('Logo updated.')
      onChanged()
    } catch (err) {
      toast.error(errMsg(err, 'Could not upload the logo.'))
    } finally {
      setBusy(false)
    }
  }

  async function toggleActive() {
    setBusy(true)
    try {
      await setCompanyStatus(company.id, !company.is_active)
      toast.success(company.is_active ? 'Company deactivated.' : 'Company activated.')
      onChanged()
    } catch (err) {
      toast.error(errMsg(err, 'Could not change status.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      <BackButton label="Back to companies" onClick={onBack} />
      <div className="flex flex-wrap items-start gap-3 rounded-xl border bg-card p-3">
        <div className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-lg border bg-muted">
          {company.logo_url ? (
            <img
              src={company.logo_url}
              alt=""
              className="size-full object-cover"
            />
          ) : (
            <Building2 className="size-5 text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-base font-semibold tracking-tight">
              {company.name}
            </h1>
            <Badge variant={relationshipVariant(company.relationship_status)}>
              {titleCase(company.relationship_status)}
            </Badge>
            {!company.is_active && <Badge variant="destructive">Inactive</Badge>}
            {company.tier && <Badge variant="outline">Tier {company.tier}</Badge>}
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {[
              company.short_name,
              company.city,
              company.responsible_employee &&
                `Officer: ${company.responsible_employee.name}`,
            ]
              .filter(Boolean)
              .join(' · ') || 'No short name'}
          </p>
        </div>
        {canEditCompany && (
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onLogoPicked}
            />
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="size-4" /> Logo
            </Button>
            <Button variant="outline" size="sm" disabled={busy} onClick={onEdit}>
              <Pencil className="size-4" /> Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => void toggleActive()}
            >
              <Power className="size-4" />
              {company.is_active ? 'Deactivate' : 'Activate'}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Overview tab
// ---------------------------------------------------------------------------

function DL({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="text-sm">{children ?? '—'}</dd>
    </div>
  )
}

function OverviewTab({
  surface,
  company,
  options,
  canRecord,
  canEditDetails,
  nameEditable,
  onContactsChanged,
  onSaved,
}: {
  surface: Surface
  company: Company
  options: FormOptions | null
  canRecord: boolean
  canEditDetails: boolean
  nameEditable: boolean
  onContactsChanged: () => void
  onSaved: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [officers, setOfficers] = useState<AssignableEmployee[]>([])

  // Assignable officers are a manager-only endpoint; load them lazily when the
  // manager opens the inline editor (the officer surface hides that field).
  useEffect(() => {
    if (!editing || surface !== 'management') return
    let cancelled = false
    getAssignableEmployees()
      .then((e) => !cancelled && setOfficers(e))
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [editing, surface])

  if (editing && options) {
    return (
      <section className="rounded-xl border bg-card p-4">
        <h2 className="mb-4 text-sm font-semibold">Edit company details</h2>
        <CompanyForm
          company={company}
          options={options}
          employees={officers}
          surface={surface}
          lockName={!nameEditable}
          showAssignment={surface === 'management'}
          embedded
          onSaved={() => {
            setEditing(false)
            onSaved()
          }}
          onCancel={() => setEditing(false)}
        />
      </section>
    )
  }

  const link = (url: string | null) =>
    url ? (
      <a
        href={url.startsWith('http') ? url : `https://${url}`}
        target="_blank"
        rel="noreferrer"
        className="text-primary hover:underline"
      >
        {url}
      </a>
    ) : (
      '—'
    )

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <section className="rounded-xl border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Profile</h2>
            {canEditDetails && (
              <Button
                size="sm"
                variant="outline"
                disabled={!options}
                onClick={() => setEditing(true)}
              >
                <Pencil className="size-4" /> Edit details
              </Button>
            )}
          </div>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <DL label="Website">{link(company.website)}</DL>
            <DL label="LinkedIn">{link(company.linkedin_url)}</DL>
            <DL label="Founded">{company.founded_year ?? '—'}</DL>
            <DL label="Glassdoor">{company.glassdoor_rating ?? '—'}</DL>
            <DL label="General email">{company.general_email ?? '—'}</DL>
            <DL label="General phone">{company.general_phone ?? '—'}</DL>
            <DL label="Ownership">
              {company.ownership_type ? titleCase(company.ownership_type) : '—'}
            </DL>
            <DL label="CTC range">
              {company.package_min || company.package_max
                ? `${company.package_min ?? '?'} – ${company.package_max ?? '?'} LPA`
                : '—'}
            </DL>
            <DL label="Offers">
              {[
                company.offers_internships ? 'Internships' : null,
                company.offers_ppo ? 'PPO' : null,
              ]
                .filter(Boolean)
                .join(', ') || '—'}
            </DL>
          </dl>
          {company.description && (
            <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">
              {company.description}
            </p>
          )}
        </section>

        <section className="rounded-xl border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold">Classification</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <DL label="Categories"><ChipRow items={company.categories} /></DL>
            <DL label="Industries"><ChipRow items={company.industries} /></DL>
            <DL label="Types"><ChipRow items={company.types} /></DL>
            <DL label="Sizes"><ChipRow items={company.sizes} /></DL>
            <DL label="Sources"><ChipRow items={company.sources} /></DL>
            <DL label="Hiring modes"><ChipRow items={company.hiring_modes} /></DL>
            <DL label="Roles offered"><ChipRow items={company.roles} /></DL>
            <DL label="Tags"><ChipRow items={company.tags} /></DL>
            <DL label="Eligible branches">
              <ChipRow items={company.eligible_branches} />
            </DL>
          </div>
        </section>

        <section className="rounded-xl border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold">Legal &amp; registration</h2>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <DL label="GSTIN">{company.gstin ?? '—'}</DL>
            <DL label="CIN">{company.cin ?? '—'}</DL>
            <DL label="PAN">{company.pan ?? '—'}</DL>
            <DL label="Reg. no.">{company.registration_number ?? '—'}</DL>
          </dl>
        </section>

        <section className="rounded-xl border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold">Address</h2>
          <p className="text-sm text-muted-foreground">
            {[
              company.address_line1,
              company.address_line2,
              company.city,
              company.state,
              company.country,
              company.pincode,
            ]
              .filter(Boolean)
              .join(', ') || 'No address on file.'}
          </p>
        </section>
      </div>

      <ContactsCard
        surface={surface}
        companyId={company.id}
        contacts={company.contacts}
        canRecord={canRecord}
        onChanged={onContactsChanged}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Contacts (SPOCs)
// ---------------------------------------------------------------------------

function ContactsCard({
  surface,
  companyId,
  contacts,
  canRecord,
  onChanged,
}: {
  surface: Surface
  companyId: number
  contacts: CompanyContact[]
  canRecord: boolean
  onChanged: () => void
}) {
  const [editing, setEditing] = useState<CompanyContact | null>(null)
  const [creating, setCreating] = useState(false)

  async function remove(c: CompanyContact) {
    try {
      await deleteContact(surface, companyId, c.id)
      toast.success('Contact removed.')
      onChanged()
    } catch (err) {
      toast.error(errMsg(err, 'Could not remove the contact.'))
    }
  }

  return (
    <section className="rounded-xl border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <Users className="size-4" /> SPOC contacts
        </h2>
        {canRecord && (
          <Button size="sm" variant="outline" onClick={() => setCreating(true)}>
            <Plus className="size-4" /> Add
          </Button>
        )}
      </div>
      {contacts.length === 0 ? (
        <p className="text-sm text-muted-foreground">No contacts yet.</p>
      ) : (
        <ul className="space-y-2">
          {contacts.map((c) => (
            <li key={c.id} className="rounded-lg border p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-sm font-medium">
                    {c.name}
                    {c.is_primary && <Badge variant="success">Primary</Badge>}
                  </p>
                  {c.designation && (
                    <p className="text-xs text-muted-foreground">
                      {c.designation}
                    </p>
                  )}
                  <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                    {c.email && <p>{c.email}</p>}
                    {c.phone && <p>{c.phone}</p>}
                  </div>
                </div>
                {canRecord && (
                  <div className="flex shrink-0 gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7"
                      onClick={() => setEditing(c)}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7 text-destructive"
                      onClick={() => void remove(c)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {(creating || editing) && (
        <ContactSheet
          surface={surface}
          companyId={companyId}
          contact={editing}
          onClose={() => {
            setCreating(false)
            setEditing(null)
          }}
          onSaved={() => {
            setCreating(false)
            setEditing(null)
            onChanged()
          }}
        />
      )}
    </section>
  )
}

function ContactSheet({
  surface,
  companyId,
  contact,
  onClose,
  onSaved,
}: {
  surface: Surface
  companyId: number
  contact: CompanyContact | null
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState<ContactPayload>({
    name: contact?.name ?? '',
    designation: contact?.designation ?? '',
    email: contact?.email ?? '',
    phone: contact?.phone ?? '',
    linkedin_url: contact?.linkedin_url ?? '',
    is_primary: contact?.is_primary ?? false,
    notes: contact?.notes ?? '',
  })
  const [busy, setBusy] = useState(false)
  const set = <K extends keyof ContactPayload>(k: K, v: ContactPayload[K]) =>
    setForm((f) => ({ ...f, [k]: v }))

  async function save() {
    if (!form.name.trim()) {
      toast.error('Name is required.')
      return
    }
    setBusy(true)
    try {
      if (contact) await updateContact(surface, companyId, contact.id, form)
      else await createContact(surface, companyId, form)
      toast.success('Contact saved.')
      onSaved()
    } catch (err) {
      toast.error(errMsg(err, 'Could not save the contact.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="flex w-full max-w-md flex-col">
        <SheetHeader>
          <SheetTitle>{contact ? 'Edit contact' : 'Add contact'}</SheetTitle>
          <SheetDescription>Point of contact at this company.</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-2">
          <Field label="Name" htmlFor="c-name">
            <Input
              id="c-name"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
            />
          </Field>
          <Field label="Designation" htmlFor="c-desig">
            <Input
              id="c-desig"
              value={form.designation ?? ''}
              onChange={(e) => set('designation', e.target.value)}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Email" htmlFor="c-email">
              <Input
                id="c-email"
                value={form.email ?? ''}
                onChange={(e) => set('email', e.target.value)}
              />
            </Field>
            <Field label="Phone" htmlFor="c-phone">
              <Input
                id="c-phone"
                value={form.phone ?? ''}
                onChange={(e) => set('phone', e.target.value)}
              />
            </Field>
          </div>
          <Field label="LinkedIn" htmlFor="c-li">
            <Input
              id="c-li"
              value={form.linkedin_url ?? ''}
              onChange={(e) => set('linkedin_url', e.target.value)}
            />
          </Field>
          <Field label="Notes" htmlFor="c-notes">
            <Textarea
              id="c-notes"
              value={form.notes ?? ''}
              onChange={(e) => set('notes', e.target.value)}
            />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <Switch
              checked={!!form.is_primary}
              onCheckedChange={(v) => set('is_primary', v)}
            />
            Primary contact (SPOC)
          </label>
        </div>
        <SheetFooter className="flex-row gap-2">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={busy} className="flex-1">
            {busy && <Loader2 className="size-4 animate-spin" />} Save
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

// ---------------------------------------------------------------------------
// Relationship tab
// ---------------------------------------------------------------------------

function RelationshipTab({
  surface,
  company,
  options,
  canRecord,
  canEditDetails,
  onSaved,
}: {
  surface: Surface
  company: Company
  options: FormOptions | null
  canRecord: boolean
  canEditDetails: boolean
  onSaved: () => void
}) {
  const [items, setItems] = useState<CompanyMilestone[] | null>(null)
  const [adding, setAdding] = useState(false)
  const [reload, setReload] = useState(0)

  // Inline edit of the two company-level relationship fields.
  const [editingStatus, setEditingStatus] = useState(false)
  const [status, setStatus] = useState(company.relationship_status)
  const [since, setSince] = useState(company.partnership_since ?? '')
  const [savingStatus, setSavingStatus] = useState(false)

  useEffect(() => {
    let cancelled = false
    listMilestones(surface, company.id)
      .then((m) => !cancelled && setItems(m))
      .catch(() => !cancelled && setItems([]))
    return () => {
      cancelled = true
    }
  }, [surface, company.id, reload])

  function startEditStatus() {
    setStatus(company.relationship_status)
    setSince(company.partnership_since ?? '')
    setEditingStatus(true)
  }

  async function saveStatus() {
    setSavingStatus(true)
    try {
      await updateCompany(
        company.id,
        { relationship_status: status, partnership_since: since || null },
        surface,
      )
      toast.success('Relationship updated.')
      setEditingStatus(false)
      onSaved()
    } catch (err) {
      toast.error(errMsg(err, 'Could not update.'))
    } finally {
      setSavingStatus(false)
    }
  }

  async function remove(m: CompanyMilestone) {
    try {
      await deleteMilestone(surface, company.id, m.id)
      toast.success('Milestone removed.')
      setReload((n) => n + 1)
    } catch (err) {
      toast.error(errMsg(err, 'Could not remove.'))
    }
  }

  return (
    <div className="space-y-4">
      {editingStatus ? (
        <div className="space-y-3 rounded-xl border bg-card p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Relationship status" htmlFor="rel-status">
              <NativeSelect
                id="rel-status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                {(options?.relationship_statuses ?? [company.relationship_status]).map(
                  (r) => (
                    <option key={r} value={r}>
                      {titleCase(r)}
                    </option>
                  ),
                )}
              </NativeSelect>
            </Field>
            <Field label="Partner since" htmlFor="rel-since">
              <Input
                id="rel-since"
                type="date"
                value={since}
                onChange={(e) => setSince(e.target.value)}
              />
            </Field>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setEditingStatus(false)}
              disabled={savingStatus}
            >
              Cancel
            </Button>
            <Button size="sm" onClick={() => void saveStatus()} disabled={savingStatus}>
              {savingStatus && <Loader2 className="size-4 animate-spin" />} Save
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4">
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              Relationship status
            </p>
            <Badge
              variant={relationshipVariant(company.relationship_status)}
              className="mt-1"
            >
              {titleCase(company.relationship_status)}
            </Badge>
          </div>
          <div className="ml-auto text-right">
            <p className="text-xs font-medium text-muted-foreground">
              Partner since
            </p>
            <p className="text-sm">{formatDate(company.partnership_since)}</p>
          </div>
          {canEditDetails && (
            <Button
              size="sm"
              variant="outline"
              disabled={!options}
              onClick={startEditStatus}
            >
              <Pencil className="size-4" /> Edit
            </Button>
          )}
        </div>
      )}

      <div className="rounded-xl border bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Milestones</h2>
          {canRecord && (
            <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
              <Plus className="size-4" /> Record milestone
            </Button>
          )}
        </div>
        {items === null ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No milestones recorded yet.
          </p>
        ) : (
          <ol className="space-y-3">
            {items.map((m) => (
              <li key={m.id} className="flex gap-3">
                <div className="mt-1 flex flex-col items-center">
                  <span className="size-2 rounded-full bg-primary" />
                  <span className="mt-1 w-px flex-1 bg-border" />
                </div>
                <div className="flex-1 pb-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium">{m.title}</p>
                    {canRecord && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-6 text-destructive"
                        onClick={() => void remove(m)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {titleCase(m.type)} · {formatDate(m.milestone_date)}
                    {m.logged_by ? ` · ${m.logged_by.name}` : ''}
                  </p>
                  {m.summary && (
                    <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                      {m.summary}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>

      {adding && (
        <MilestoneSheet
          surface={surface}
          companyId={company.id}
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false)
            setReload((n) => n + 1)
          }}
        />
      )}
    </div>
  )
}

function MilestoneSheet({
  surface,
  companyId,
  onClose,
  onSaved,
}: {
  surface: Surface
  companyId: number
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState<MilestonePayload>({
    milestone_date: new Date().toISOString().slice(0, 10),
    type: 'note',
    title: '',
    summary: '',
  })
  const [busy, setBusy] = useState(false)
  const set = <K extends keyof MilestonePayload>(k: K, v: MilestonePayload[K]) =>
    setForm((f) => ({ ...f, [k]: v }))

  async function save() {
    if (!form.title.trim()) {
      toast.error('Title is required.')
      return
    }
    setBusy(true)
    try {
      await createMilestone(surface, companyId, form)
      toast.success('Milestone recorded.')
      onSaved()
    } catch (err) {
      toast.error(errMsg(err, 'Could not save.'))
    } finally {
      setBusy(false)
    }
  }

  const types = ['mou_signed', 'partnership', 'status_change', 'note', 'other']
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="flex w-full max-w-md flex-col">
        <SheetHeader>
          <SheetTitle>Record milestone</SheetTitle>
          <SheetDescription>Add to the relationship timeline.</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date" htmlFor="m-date">
              <Input
                id="m-date"
                type="date"
                value={form.milestone_date}
                onChange={(e) => set('milestone_date', e.target.value)}
              />
            </Field>
            <Field label="Type" htmlFor="m-type">
              <NativeSelect
                id="m-type"
                value={form.type}
                onChange={(e) => set('type', e.target.value)}
              >
                {types.map((t) => (
                  <option key={t} value={t}>
                    {titleCase(t)}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </div>
          <Field label="Title" htmlFor="m-title">
            <Input
              id="m-title"
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
            />
          </Field>
          <Field label="Details" htmlFor="m-summary">
            <Textarea
              id="m-summary"
              value={form.summary ?? ''}
              onChange={(e) => set('summary', e.target.value)}
            />
          </Field>
        </div>
        <SheetFooter className="flex-row gap-2">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={busy} className="flex-1">
            {busy && <Loader2 className="size-4 animate-spin" />} Save
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

// ---------------------------------------------------------------------------
// Interactions tab
// ---------------------------------------------------------------------------

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

// ---------------------------------------------------------------------------
// Drives
// ---------------------------------------------------------------------------

/**
 * Read-only list of the placement drives raised against this company. Backed by
 * the corporate-relations surface's own `:id/drives` endpoint (governed by the
 * company grant), so it works without the separate drive-management screen.
 * Cards click through to the dedicated drive detail screen.
 */
/** The employee-portal route each surface's company detail lives on — used to
 *  build the `from` return path so the drive detail's Back comes back here. */
const RETURN_BASE: Record<Surface, string> = {
  management: '/corporate-relations/company-management',
  companies: '/corporate-relations/companies',
}

function DrivesTab({
  surface,
  company,
}: {
  surface: Surface
  company: Company
}) {
  const [items, setItems] = useState<DriveListItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Open a drive, telling its detail screen where Back should return: this same
  // company on the Drives tab. (The standalone drives list sends no `from`.)
  function openDrive(id: number) {
    const back = `${RETURN_BASE[surface]}?open=${company.id}&tab=drives`
    employeeNavigateTo(
      `/drive-management/drives/${id}?from=${encodeURIComponent(back)}`,
    )
  }

  useEffect(() => {
    let cancelled = false
    setItems(null)
    setError(null)
    listCompanyDrives(surface, company.id)
      .then((r) => !cancelled && setItems(r))
      .catch((e) => {
        if (!cancelled) {
          setError(errMsg(e, 'Could not load drives.'))
          setItems([])
        }
      })
    return () => {
      cancelled = true
    }
  }, [surface, company.id])

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>
  }
  if (items === null) {
    return <p className="text-sm text-muted-foreground">Loading…</p>
  }
  if (items.length === 0) {
    return (
      <p className="rounded-xl border border-dashed bg-muted/20 p-8 text-center text-sm text-muted-foreground">
        No drives have been raised for this company yet.
      </p>
    )
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((d) => (
        <div
          key={d.id}
          className="flex flex-col gap-3 rounded-xl border bg-card p-4 transition-shadow hover:shadow-sm"
        >
          <div className="flex items-start justify-between gap-2">
            <button
              type="button"
              onClick={() => openDrive(d.id)}
              className="line-clamp-2 min-w-0 flex-1 text-left font-medium hover:underline"
            >
              {d.drive_name}
            </button>
            <Badge variant={driveStatusVariant(d.status)}>
              {DRIVE_STATUS_LABELS[d.status]}
            </Badge>
          </div>

          <div className="flex flex-wrap gap-1.5">
            <Badge variant="muted">
              {d.offer_type ? d.offer_type.name : 'Per designation'}
            </Badge>
            <Badge variant="muted">
              {d.designation_count === 1
                ? d.designations[0]?.name
                : `${d.designation_count} designations`}
            </Badge>
            {d.placement_categories.map((c) => (
              <Badge key={c.id} variant="muted">
                {c.name}
              </Badge>
            ))}
          </div>

          <dl className="mt-auto grid grid-cols-2 gap-2 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Drive date</dt>
              <dd>{formatDate(d.drive_date)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Registration ends</dt>
              <dd>{formatDateTime(d.registration_end_date)}</dd>
            </div>
          </dl>
        </div>
      ))}
    </div>
  )
}

function InteractionsTab({
  surface,
  company,
  options,
  canRecord,
}: {
  surface: Surface
  company: Company
  options: FormOptions | null
  canRecord: boolean
}) {
  const thisYear = new Date().getFullYear()
  const [year, setYear] = useState<number | ''>(thisYear)
  const [month, setMonth] = useState<number | ''>('')
  const [items, setItems] = useState<CompanyInteraction[] | null>(null)
  const [editing, setEditing] = useState<CompanyInteraction | null>(null)
  const [adding, setAdding] = useState(false)
  const [reload, setReload] = useState(0)

  const years = useMemo(
    () => Array.from({ length: 8 }, (_, i) => thisYear + 1 - i),
    [thisYear],
  )

  useEffect(() => {
    let cancelled = false
    setItems(null)
    listInteractions(surface, company.id, {
      year: year === '' ? undefined : year,
      month: month === '' ? undefined : month,
    })
      .then((r) => !cancelled && setItems(r))
      .catch(() => !cancelled && setItems([]))
    return () => {
      cancelled = true
    }
  }, [surface, company.id, year, month, reload])

  async function remove(i: CompanyInteraction) {
    try {
      await deleteInteraction(surface, company.id, i.id)
      toast.success('Interaction deleted.')
      setReload((n) => n + 1)
    } catch (err) {
      toast.error(errMsg(err, 'Could not delete.'))
    }
  }

  return (
    <div className="space-y-4">
      <div className="sticky top-0 z-10 bg-background pb-1">
        <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-3">
          <Field label="Year" className="w-28">
            <NativeSelect
              value={year}
              onChange={(e) => setYear(e.target.value ? Number(e.target.value) : '')}
            >
              <option value="">All years</option>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Month" className="w-32">
            <NativeSelect
              value={month}
              onChange={(e) => setMonth(e.target.value ? Number(e.target.value) : '')}
            >
              <option value="">All months</option>
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </NativeSelect>
          </Field>
          {canRecord && (
            <Button
              size="sm"
              className="ml-auto"
              onClick={() => setAdding(true)}
            >
              <Plus className="size-4" /> Log interaction
            </Button>
          )}
        </div>
      </div>

      {items === null ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : items.length === 0 ? (
        <p className="rounded-xl border border-dashed bg-muted/20 p-8 text-center text-sm text-muted-foreground">
          No interactions in this period.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((i) => (
            <li key={i.id} className="rounded-xl border bg-card p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
                    <Badge variant="secondary">{titleCase(i.type)}</Badge>
                    {formatDate(i.interaction_date)}
                    {i.contact && (
                      <span className="text-muted-foreground">
                        · with {i.contact.name}
                      </span>
                    )}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm">{i.summary}</p>
                  <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                    {i.outcome && <span>Outcome: {i.outcome}</span>}
                    {i.follow_up_date && (
                      <span>Follow-up: {formatDate(i.follow_up_date)}</span>
                    )}
                    {i.logged_by && <span>By {i.logged_by.name}</span>}
                  </p>
                </div>
                {canRecord && (
                  <div className="flex shrink-0 gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7"
                      onClick={() => setEditing(i)}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7 text-destructive"
                      onClick={() => void remove(i)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {(adding || editing) && (
        <InteractionSheet
          surface={surface}
          company={company}
          options={options}
          interaction={editing}
          onClose={() => {
            setAdding(false)
            setEditing(null)
          }}
          onSaved={() => {
            setAdding(false)
            setEditing(null)
            setReload((n) => n + 1)
          }}
        />
      )}
    </div>
  )
}

function InteractionSheet({
  surface,
  company,
  options,
  interaction,
  onClose,
  onSaved,
}: {
  surface: Surface
  company: Company
  options: FormOptions | null
  interaction: CompanyInteraction | null
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState<InteractionPayload>({
    type: interaction?.type ?? 'meeting',
    interaction_date:
      interaction?.interaction_date ?? new Date().toISOString().slice(0, 10),
    contact_id: interaction?.contact?.id ?? null,
    summary: interaction?.summary ?? '',
    follow_up_date: interaction?.follow_up_date ?? '',
    outcome: interaction?.outcome ?? '',
  })
  const [busy, setBusy] = useState(false)
  const set = <K extends keyof InteractionPayload>(
    k: K,
    v: InteractionPayload[K],
  ) => setForm((f) => ({ ...f, [k]: v }))
  const types = options?.interaction_types ?? [
    'call', 'email', 'meeting', 'visit', 'event', 'other',
  ]

  async function save() {
    if (!form.summary.trim()) {
      toast.error('Summary is required.')
      return
    }
    const payload: InteractionPayload = {
      ...form,
      follow_up_date: form.follow_up_date || null,
      outcome: form.outcome || null,
      contact_id: form.contact_id || null,
    }
    setBusy(true)
    try {
      if (interaction)
        await updateInteraction(surface, company.id, interaction.id, payload)
      else await createInteraction(surface, company.id, payload)
      toast.success('Interaction saved.')
      onSaved()
    } catch (err) {
      toast.error(errMsg(err, 'Could not save.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="flex w-full max-w-md flex-col">
        <SheetHeader>
          <SheetTitle>
            {interaction ? 'Edit interaction' : 'Log interaction'}
          </SheetTitle>
          <SheetDescription>{company.name}</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type" htmlFor="i-type">
              <NativeSelect
                id="i-type"
                value={form.type}
                onChange={(e) => set('type', e.target.value)}
              >
                {types.map((t) => (
                  <option key={t} value={t}>
                    {titleCase(t)}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Date" htmlFor="i-date">
              <Input
                id="i-date"
                type="date"
                value={form.interaction_date}
                onChange={(e) => set('interaction_date', e.target.value)}
              />
            </Field>
          </div>
          <Field label="Contact" htmlFor="i-contact">
            <NativeSelect
              id="i-contact"
              value={form.contact_id ?? ''}
              onChange={(e) =>
                set('contact_id', e.target.value ? Number(e.target.value) : null)
              }
            >
              <option value="">— none —</option>
              {company.contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Summary" htmlFor="i-summary">
            <Textarea
              id="i-summary"
              value={form.summary}
              onChange={(e) => set('summary', e.target.value)}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Follow-up date" htmlFor="i-follow">
              <Input
                id="i-follow"
                type="date"
                value={form.follow_up_date ?? ''}
                onChange={(e) => set('follow_up_date', e.target.value)}
              />
            </Field>
            <Field label="Outcome" htmlFor="i-outcome">
              <Input
                id="i-outcome"
                value={form.outcome ?? ''}
                onChange={(e) => set('outcome', e.target.value)}
              />
            </Field>
          </div>
        </div>
        <SheetFooter className="flex-row gap-2">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={busy} className="flex-1">
            {busy && <Loader2 className="size-4 animate-spin" />} Save
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

// ---------------------------------------------------------------------------
// Activity (unified audit feed)
// ---------------------------------------------------------------------------

const ACTIVITY_FILTERS: { value: '' | CompanyActivity['entity_type']; label: string }[] = [
  { value: '', label: 'All activity' },
  { value: 'company', label: 'Company' },
  { value: 'interaction', label: 'Interactions' },
  { value: 'milestone', label: 'Milestones' },
  { value: 'contact', label: 'Contacts' },
]

const ACTIVITY_ICONS: Record<CompanyActivity['entity_type'], typeof Building2> = {
  company: Building2,
  interaction: CalendarClock,
  milestone: Handshake,
  contact: Users,
}

const ACTIVITY_PAGE_SIZE = 25

function displayValue(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  return String(v)
}

function ActivityTab({
  surface,
  company,
}: {
  surface: Surface
  company: Company
}) {
  const [filter, setFilter] = useState<'' | CompanyActivity['entity_type']>('')
  const [items, setItems] = useState<CompanyActivity[] | null>(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loadingMore, setLoadingMore] = useState(false)
  const [expanded, setExpanded] = useState<Set<number>>(new Set())

  useEffect(() => {
    let cancelled = false
    setItems(null)
    setPage(1)
    setExpanded(new Set())
    listActivity(surface, company.id, {
      page: 1,
      limit: ACTIVITY_PAGE_SIZE,
      entity_type: filter === '' ? undefined : filter,
    })
      .then((r) => {
        if (cancelled) return
        setItems(r.items)
        setTotal(r.total)
      })
      .catch(() => {
        if (cancelled) return
        setItems([])
        setTotal(0)
      })
    return () => {
      cancelled = true
    }
  }, [surface, company.id, filter])

  async function loadMore() {
    const next = page + 1
    setLoadingMore(true)
    try {
      const r = await listActivity(surface, company.id, {
        page: next,
        limit: ACTIVITY_PAGE_SIZE,
        entity_type: filter === '' ? undefined : filter,
      })
      setItems((prev) => [...(prev ?? []), ...r.items])
      setTotal(r.total)
      setPage(next)
    } catch (err) {
      toast.error(errMsg(err, 'Could not load more activity.'))
    } finally {
      setLoadingMore(false)
    }
  }

  const toggleExpand = (id: number) =>
    setExpanded((prev) => {
      const nextSet = new Set(prev)
      if (nextSet.has(id)) nextSet.delete(id)
      else nextSet.add(id)
      return nextSet
    })

  const canLoadMore = items !== null && items.length < total

  return (
    <div className="space-y-4">
      <div className="sticky top-0 z-10 bg-background pb-1">
        <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-3">
          <Field label="Show" className="w-44">
            <NativeSelect
              value={filter}
              onChange={(e) =>
                setFilter(e.target.value as '' | CompanyActivity['entity_type'])
              }
            >
              {ACTIVITY_FILTERS.map((f) => (
                <option key={f.value || 'all'} value={f.value}>
                  {f.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
          {items !== null && (
            <p className="ml-auto text-xs text-muted-foreground">
              {total} {total === 1 ? 'entry' : 'entries'}
            </p>
          )}
        </div>
      </div>

      {items === null ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : items.length === 0 ? (
        <p className="rounded-xl border border-dashed bg-muted/20 p-8 text-center text-sm text-muted-foreground">
          No activity recorded yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((a) => {
            const Icon = ACTIVITY_ICONS[a.entity_type] ?? Building2
            const hasChanges = !!a.changes && a.changes.length > 0
            const open = expanded.has(a.id)
            return (
              <li key={a.id} className="rounded-xl border bg-card p-3">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-1.5 text-sm">
                      <Badge variant="secondary">{titleCase(a.action)}</Badge>
                      <span className="font-medium">{a.summary}</span>
                    </p>
                    <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                      {a.actor && <span>By {a.actor.name}</span>}
                      <span>{formatDateTime(a.created_at)}</span>
                      {hasChanges && (
                        <button
                          type="button"
                          className="font-medium text-foreground/70 hover:text-foreground"
                          onClick={() => toggleExpand(a.id)}
                        >
                          {open
                            ? 'Hide changes'
                            : `${a.changes!.length} field change${a.changes!.length === 1 ? '' : 's'}`}
                        </button>
                      )}
                    </p>
                    {hasChanges && open && (
                      <ul className="mt-2 space-y-1 rounded-lg border bg-muted/20 p-2 text-xs">
                        {a.changes!.map((c, i) => (
                          <li
                            key={i}
                            className="flex flex-wrap items-baseline gap-1.5"
                          >
                            <span className="font-medium">{c.field}:</span>
                            <span className="text-muted-foreground line-through">
                              {displayValue(c.from)}
                            </span>
                            <span className="text-muted-foreground">→</span>
                            <span>{displayValue(c.to)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {canLoadMore && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadMore()}
            disabled={loadingMore}
          >
            {loadingMore && <Loader2 className="size-4 animate-spin" />} Load more
          </Button>
        </div>
      )}
    </div>
  )
}
