import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Combobox } from '@/components/ui/combobox'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  Field,
  NativeSelect,
  SearchableMultiSelect,
  Textarea,
  titleCase,
} from '@/components/corporate-relations/bits'
import { ApiError } from '@/lib/api'
import {
  createCompany,
  updateCompany,
  type AssignableEmployee,
  type CompanyDetail,
  type CompanyPayload,
  type FormOptions,
  type Surface,
} from '@/lib/corporate-relations'

interface FS {
  name: string
  short_name: string
  website: string
  linkedin_url: string
  description: string
  founded_year: string
  glassdoor_rating: string
  general_email: string
  general_phone: string
  ownership_type: string
  tier: string
  relationship_status: string
  partnership_since: string
  gstin: string
  cin: string
  pan: string
  registration_number: string
  package_min: string
  package_max: string
  offers_internships: boolean
  offers_ppo: boolean
  responsible_employee_id: string
  address_line1: string
  address_line2: string
  city: string
  state: string
  country: string
  pincode: string
  category_ids: number[]
  industry_ids: number[]
  type_ids: number[]
  size_ids: number[]
  source_ids: number[]
  hiring_mode_ids: number[]
  role_ids: number[]
  tag_ids: number[]
  eligible_branch_ids: number[]
}

const ids = (list: { id: number }[] | undefined) => (list ?? []).map((x) => x.id)

function initial(c: CompanyDetail | null): FS {
  return {
    name: c?.name ?? '',
    short_name: c?.short_name ?? '',
    website: c?.website ?? '',
    linkedin_url: c?.linkedin_url ?? '',
    description: c?.description ?? '',
    founded_year: c?.founded_year ? String(c.founded_year) : '',
    glassdoor_rating: c?.glassdoor_rating ?? '',
    general_email: c?.general_email ?? '',
    general_phone: c?.general_phone ?? '',
    ownership_type: c?.ownership_type ?? '',
    tier: c?.tier ?? '',
    relationship_status: c?.relationship_status ?? 'prospect',
    partnership_since: c?.partnership_since ?? '',
    gstin: c?.gstin ?? '',
    cin: c?.cin ?? '',
    pan: c?.pan ?? '',
    registration_number: c?.registration_number ?? '',
    package_min: c?.package_min ?? '',
    package_max: c?.package_max ?? '',
    offers_internships: c?.offers_internships ?? false,
    offers_ppo: c?.offers_ppo ?? false,
    responsible_employee_id: c?.responsible_employee
      ? String(c.responsible_employee.id)
      : '',
    address_line1: c?.address_line1 ?? '',
    address_line2: c?.address_line2 ?? '',
    city: c?.city ?? '',
    state: c?.state ?? '',
    country: c?.country ?? '',
    pincode: c?.pincode ?? '',
    category_ids: ids(c?.categories),
    industry_ids: ids(c?.industries),
    type_ids: ids(c?.types),
    size_ids: ids(c?.sizes),
    source_ids: ids(c?.sources),
    hiring_mode_ids: ids(c?.hiring_modes),
    role_ids: ids(c?.roles),
    tag_ids: ids(c?.tags),
    eligible_branch_ids: ids(c?.eligible_branches),
  }
}

const s = (v: string) => (v.trim() === '' ? null : v.trim())
const n = (v: string) => (v.trim() === '' ? null : Number(v))

/**
 * Full-width company create/edit form body. Create vs edit is keyed on whether
 * a `company` is passed. Rendered inside the dedicated full-screen form route
 * (see `corporate-relations-company-form.tsx`) and inline on the Overview tab.
 *
 * `surface` routes the save (manager vs officer endpoint). On the officer
 * surface the name is locked (`lockName`) and the responsible-officer field is
 * hidden (`showAssignment=false`) — the server enforces both regardless.
 * `embedded` drops the sticky full-bleed footer so it sits inside a card.
 */
export function CompanyForm({
  company,
  options,
  employees,
  onSaved,
  onCancel,
  surface = 'management',
  lockName = false,
  showAssignment = surface === 'management',
  embedded = false,
}: {
  company: CompanyDetail | null
  options: FormOptions
  employees: AssignableEmployee[]
  onSaved: (saved: CompanyDetail) => void
  onCancel: () => void
  surface?: Surface
  lockName?: boolean
  showAssignment?: boolean
  embedded?: boolean
}) {
  const [f, setF] = useState<FS>(() => initial(company))
  const [busy, setBusy] = useState(false)
  const set = <K extends keyof FS>(k: K, v: FS[K]) =>
    setF((prev) => ({ ...prev, [k]: v }))

  function payload(): CompanyPayload {
    return {
      name: f.name.trim(),
      short_name: s(f.short_name),
      website: s(f.website),
      linkedin_url: s(f.linkedin_url),
      description: s(f.description),
      founded_year: n(f.founded_year),
      glassdoor_rating: n(f.glassdoor_rating),
      general_email: s(f.general_email),
      general_phone: s(f.general_phone),
      ownership_type: s(f.ownership_type),
      tier: s(f.tier),
      relationship_status: f.relationship_status,
      partnership_since: s(f.partnership_since),
      gstin: s(f.gstin),
      cin: s(f.cin),
      pan: s(f.pan),
      registration_number: s(f.registration_number),
      package_min: n(f.package_min),
      package_max: n(f.package_max),
      offers_internships: f.offers_internships,
      offers_ppo: f.offers_ppo,
      responsible_employee_id: f.responsible_employee_id
        ? Number(f.responsible_employee_id)
        : null,
      address_line1: s(f.address_line1),
      address_line2: s(f.address_line2),
      city: s(f.city),
      state: s(f.state),
      country: s(f.country),
      pincode: s(f.pincode),
      category_ids: f.category_ids,
      industry_ids: f.industry_ids,
      type_ids: f.type_ids,
      size_ids: f.size_ids,
      source_ids: f.source_ids,
      hiring_mode_ids: f.hiring_mode_ids,
      role_ids: f.role_ids,
      tag_ids: f.tag_ids,
      eligible_branch_ids: f.eligible_branch_ids,
    }
  }

  async function save() {
    if (!f.name.trim()) {
      toast.error('Company name is required.')
      return
    }
    setBusy(true)
    try {
      const saved = company
        ? await updateCompany(company.id, payload(), surface)
        : await createCompany(payload())
      toast.success(company ? 'Company updated.' : 'Company created.')
      onSaved(saved)
    } catch (err) {
      toast.error(
        err instanceof ApiError || err instanceof Error
          ? err.message
          : 'Could not save the company.',
      )
    } finally {
      setBusy(false)
    }
  }

  const officerOptions = employees.map((e) => ({
    value: e.id,
    label: e.name,
    sublabel: e.emp_code,
  }))

  return (
    <div className="space-y-6">
      <Section title="Identity">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label={lockName ? 'Name' : 'Name *'} htmlFor="f-name">
            <Input
              id="f-name"
              value={f.name}
              onChange={(e) => set('name', e.target.value)}
              disabled={lockName}
            />
          </Field>
          <Field label="Short name" htmlFor="f-short">
            <Input
              id="f-short"
              value={f.short_name}
              onChange={(e) => set('short_name', e.target.value)}
            />
          </Field>
          <Field label="Website" htmlFor="f-web">
            <Input
              id="f-web"
              value={f.website}
              onChange={(e) => set('website', e.target.value)}
            />
          </Field>
          <Field label="LinkedIn" htmlFor="f-li">
            <Input
              id="f-li"
              value={f.linkedin_url}
              onChange={(e) => set('linkedin_url', e.target.value)}
            />
          </Field>
          <Field label="Founded year" htmlFor="f-founded">
            <Input
              id="f-founded"
              type="number"
              value={f.founded_year}
              onChange={(e) => set('founded_year', e.target.value)}
            />
          </Field>
          <Field label="Glassdoor rating" htmlFor="f-gd">
            <Input
              id="f-gd"
              type="number"
              step="0.1"
              value={f.glassdoor_rating}
              onChange={(e) => set('glassdoor_rating', e.target.value)}
            />
          </Field>
          <Field label="General email" htmlFor="f-gemail">
            <Input
              id="f-gemail"
              value={f.general_email}
              onChange={(e) => set('general_email', e.target.value)}
            />
          </Field>
          <Field label="General phone" htmlFor="f-gphone">
            <Input
              id="f-gphone"
              value={f.general_phone}
              onChange={(e) => set('general_phone', e.target.value)}
            />
          </Field>
        </div>
        <Field label="Description" htmlFor="f-desc">
          <Textarea
            id="f-desc"
            value={f.description}
            onChange={(e) => set('description', e.target.value)}
          />
        </Field>
      </Section>

      <Section title="Relationship & ownership">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {showAssignment && (
            <Field label="Responsible officer" htmlFor="f-resp">
              <Combobox
                id="f-resp"
                value={
                  f.responsible_employee_id
                    ? Number(f.responsible_employee_id)
                    : null
                }
                options={officerOptions}
                onChange={(v) =>
                  set('responsible_employee_id', v === null ? '' : String(v))
                }
                placeholder="— unassigned —"
                searchPlaceholder="Search officers…"
                clearLabel="— unassigned —"
                emptyMessage="No officers found"
              />
            </Field>
          )}
          <Field label="Relationship status" htmlFor="f-rel">
            <NativeSelect
              id="f-rel"
              value={f.relationship_status}
              onChange={(e) => set('relationship_status', e.target.value)}
            >
              {options.relationship_statuses.map((r) => (
                <option key={r} value={r}>
                  {titleCase(r)}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Partner since" htmlFor="f-psince">
            <Input
              id="f-psince"
              type="date"
              value={f.partnership_since}
              onChange={(e) => set('partnership_since', e.target.value)}
            />
          </Field>
          <Field label="Ownership" htmlFor="f-own">
            <NativeSelect
              id="f-own"
              value={f.ownership_type}
              onChange={(e) => set('ownership_type', e.target.value)}
            >
              <option value="">—</option>
              {options.ownership_types.map((o) => (
                <option key={o} value={o}>
                  {titleCase(o)}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Tier" htmlFor="f-tier">
            <NativeSelect
              id="f-tier"
              value={f.tier}
              onChange={(e) => set('tier', e.target.value)}
            >
              <option value="">—</option>
              {options.tiers.map((t) => (
                <option key={t} value={t}>
                  Tier {t}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </div>
      </Section>

      <Section title="Placement">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="CTC min (LPA)" htmlFor="f-pmin">
            <Input
              id="f-pmin"
              type="number"
              step="0.1"
              value={f.package_min}
              onChange={(e) => set('package_min', e.target.value)}
            />
          </Field>
          <Field label="CTC max (LPA)" htmlFor="f-pmax">
            <Input
              id="f-pmax"
              type="number"
              step="0.1"
              value={f.package_max}
              onChange={(e) => set('package_max', e.target.value)}
            />
          </Field>
        </div>
        <div className="flex flex-wrap gap-6">
          <label className="flex items-center gap-2 text-sm">
            <Switch
              checked={f.offers_internships}
              onCheckedChange={(v) => set('offers_internships', v)}
            />
            Offers internships
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Switch
              checked={f.offers_ppo}
              onCheckedChange={(v) => set('offers_ppo', v)}
            />
            Offers PPO
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Multi label="Roles offered" options={options.roles} value={f.role_ids} onChange={(v) => set('role_ids', v)} />
          <Multi label="Hiring modes" options={options.hiring_modes} value={f.hiring_mode_ids} onChange={(v) => set('hiring_mode_ids', v)} />
          <Multi label="Eligible branches" options={options.departments} value={f.eligible_branch_ids} onChange={(v) => set('eligible_branch_ids', v)} />
        </div>
      </Section>

      <Section title="Classification">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Multi label="Categories" options={options.categories} value={f.category_ids} onChange={(v) => set('category_ids', v)} />
          <Multi label="Industries" options={options.industries} value={f.industry_ids} onChange={(v) => set('industry_ids', v)} />
          <Multi label="Company types" options={options.types} value={f.type_ids} onChange={(v) => set('type_ids', v)} />
          <Multi label="Company sizes" options={options.sizes} value={f.size_ids} onChange={(v) => set('size_ids', v)} />
          <Multi label="Sources" options={options.sources} value={f.source_ids} onChange={(v) => set('source_ids', v)} />
          <Multi label="Tags" options={options.tags} value={f.tag_ids} onChange={(v) => set('tag_ids', v)} />
        </div>
      </Section>

      <Section title="Legal & registration">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="GSTIN" htmlFor="f-gst">
            <Input id="f-gst" value={f.gstin} onChange={(e) => set('gstin', e.target.value)} />
          </Field>
          <Field label="CIN" htmlFor="f-cin">
            <Input id="f-cin" value={f.cin} onChange={(e) => set('cin', e.target.value)} />
          </Field>
          <Field label="PAN" htmlFor="f-pan">
            <Input id="f-pan" value={f.pan} onChange={(e) => set('pan', e.target.value)} />
          </Field>
          <Field label="Registration no." htmlFor="f-reg">
            <Input id="f-reg" value={f.registration_number} onChange={(e) => set('registration_number', e.target.value)} />
          </Field>
        </div>
      </Section>

      <Section title="Address">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Line 1" htmlFor="f-a1">
            <Input id="f-a1" value={f.address_line1} onChange={(e) => set('address_line1', e.target.value)} />
          </Field>
          <Field label="Line 2" htmlFor="f-a2">
            <Input id="f-a2" value={f.address_line2} onChange={(e) => set('address_line2', e.target.value)} />
          </Field>
          <Field label="City" htmlFor="f-city">
            <Input id="f-city" value={f.city} onChange={(e) => set('city', e.target.value)} />
          </Field>
          <Field label="State" htmlFor="f-state">
            <Input id="f-state" value={f.state} onChange={(e) => set('state', e.target.value)} />
          </Field>
          <Field label="Country" htmlFor="f-country">
            <Input id="f-country" value={f.country} onChange={(e) => set('country', e.target.value)} />
          </Field>
          <Field label="Pincode" htmlFor="f-pin">
            <Input id="f-pin" value={f.pincode} onChange={(e) => set('pincode', e.target.value)} />
          </Field>
        </div>
      </Section>

      <div
        className={
          embedded
            ? 'flex justify-end gap-2 border-t pt-4'
            : 'sticky -bottom-6 z-10 -mx-4 -mb-6 flex justify-end gap-2 border-t bg-background px-4 pb-6 pt-4 sm:-mx-6 sm:px-6'
        }
      >
        <Button variant="outline" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button onClick={() => void save()} disabled={busy}>
          {busy && <Loader2 className="size-4 animate-spin" />}
          {company ? 'Save changes' : 'Create company'}
        </Button>
      </div>
    </div>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      {children}
    </section>
  )
}

function Multi({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: { id: number; name: string }[]
  value: number[]
  onChange: (ids: number[]) => void
}) {
  return (
    <Field label={label}>
      <SearchableMultiSelect
        options={options}
        selected={value}
        onChange={onChange}
        placeholder="Select…"
        searchPlaceholder={`Search ${label.toLowerCase()}…`}
      />
    </Field>
  )
}
