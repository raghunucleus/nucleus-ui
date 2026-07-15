import {
  Building2,
  CalendarClock,
  CalendarDays,
  Handshake,
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
import ComingSoon from '@/components/employee/coming-soon'
import {
  ChipRow,
  Field,
  NativeSelect,
  TabBar,
  Textarea,
  formatDate,
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
  getCompany,
  getFormOptions,
  listInteractions,
  listMilestones,
  setCompanyStatus,
  updateContact,
  updateInteraction,
  uploadCompanyLogo,
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
import { ApiError } from '@/lib/api'

const TABS: TabDef[] = [
  { key: 'overview', label: 'Overview', icon: Building2 },
  { key: 'drives', label: 'Drives', icon: CalendarDays },
  { key: 'relationship', label: 'Relationship', icon: Handshake },
  { key: 'interactions', label: 'Interactions', icon: CalendarClock },
]

function errMsg(e: unknown, fallback: string): string {
  return e instanceof ApiError || e instanceof Error ? e.message : fallback
}

export interface CompanyDetailProps {
  surface: Surface
  companyId: number
  /** Manager surface only: company master fields are editable. */
  canEditCompany: boolean
  /** May record interactions / milestones / contacts. */
  canRecord: boolean
  onBack: () => void
  /** Manager: open the company edit form (owned by the page). */
  onEditCompany?: (company: Company) => void
  /** Bumped by the page after an external save to force a reload. */
  reloadToken?: number
}

export function CompanyDetail({
  surface,
  companyId,
  canEditCompany,
  canRecord,
  onBack,
  onEditCompany,
  reloadToken = 0,
}: CompanyDetailProps) {
  const [company, setCompany] = useState<Company | null>(null)
  const [options, setOptions] = useState<FormOptions | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState('overview')
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
    <div className="space-y-5">
      <CompanyHeader
        company={company}
        canEditCompany={canEditCompany}
        onBack={onBack}
        onEdit={() => onEditCompany?.(company)}
        onChanged={refresh}
      />

      <TabBar tabs={TABS} active={tab} onChange={setTab} />

      {tab === 'overview' && (
        <OverviewTab
          surface={surface}
          company={company}
          canRecord={canRecord}
          onContactsChanged={refresh}
        />
      )}
      {tab === 'drives' && (
        <ComingSoon
          title="Placement drives"
          subtitle="Drive management ships as a dedicated screen soon. You'll be able to plan and track each drive conducted by this company here."
          icon={CalendarDays}
        />
      )}
      {tab === 'relationship' && (
        <RelationshipTab
          surface={surface}
          company={company}
          canRecord={canRecord}
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
      <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2">
        ← Back to companies
      </Button>
      <div className="flex flex-wrap items-start gap-4 rounded-xl border bg-card p-4">
        <div className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-lg border bg-muted">
          {company.logo_url ? (
            <img
              src={company.logo_url}
              alt=""
              className="size-full object-cover"
            />
          ) : (
            <Building2 className="size-6 text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-semibold tracking-tight">
              {company.name}
            </h1>
            <Badge variant={relationshipVariant(company.relationship_status)}>
              {titleCase(company.relationship_status)}
            </Badge>
            {!company.is_active && <Badge variant="destructive">Inactive</Badge>}
            {company.tier && <Badge variant="outline">Tier {company.tier}</Badge>}
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {[company.short_name, company.city].filter(Boolean).join(' · ') ||
              'No short name'}
          </p>
          {company.responsible_employee && (
            <p className="mt-1 text-xs text-muted-foreground">
              Responsible officer:{' '}
              <span className="font-medium text-foreground">
                {company.responsible_employee.name}
              </span>
            </p>
          )}
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
  canRecord,
  onContactsChanged,
}: {
  surface: Surface
  company: Company
  canRecord: boolean
  onContactsChanged: () => void
}) {
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
          <h2 className="mb-3 text-sm font-semibold">Profile</h2>
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
  canRecord,
}: {
  surface: Surface
  company: Company
  canRecord: boolean
}) {
  const [items, setItems] = useState<CompanyMilestone[] | null>(null)
  const [adding, setAdding] = useState(false)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let cancelled = false
    listMilestones(surface, company.id)
      .then((m) => !cancelled && setItems(m))
      .catch(() => !cancelled && setItems([]))
    return () => {
      cancelled = true
    }
  }, [surface, company.id, reload])

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
      </div>

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
