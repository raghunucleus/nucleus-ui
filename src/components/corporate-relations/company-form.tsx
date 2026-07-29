import { Building2, Loader2, Plus, Trash2, Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { EmployeePicker } from '@/components/employee/employee-picker'
import { Field, SearchableMultiSelect } from '@/components/corporate-relations/bits'
import { ApiError } from '@/lib/api'
import {
  createCompany,
  updateCompany,
  uploadCompanyLogo,
  type CompanyDetail,
  type CompanyPayload,
  type FormOptions,
} from '@/lib/corporate-relations'

const MAX_LOGO_BYTES = 2 * 1024 * 1024

/** A job-role row. `uid` is a stable local key so React survives reordering. */
interface RoleDraft {
  uid: string
  id: number | null
  role_name: string
  responsible_employee_id: number | null
}

let uidCounter = 0
const nextUid = () => `r${++uidCounter}`

interface FS {
  name: string
  website: string
  category_ids: number[]
  roles: RoleDraft[]
  is_active: boolean
}

function initial(c: CompanyDetail | null, defaultOwnerId: number | null): FS {
  const roles: RoleDraft[] =
    c && c.roles.length > 0
      ? c.roles.map((r) => ({
          uid: nextUid(),
          id: r.id,
          role_name: r.role_name,
          responsible_employee_id: r.responsible_employee?.id ?? null,
        }))
      : // New company (or a grandfathered one with no roles): start with one
        // row owned by whoever is filling the form in.
        [
          {
            uid: nextUid(),
            id: null,
            role_name: '',
            responsible_employee_id: defaultOwnerId,
          },
        ]

  return {
    name: c?.name ?? '',
    website: c?.website ?? '',
    category_ids: (c?.categories ?? []).map((x) => x.id),
    roles,
    // A company awaiting approval has no status yet; the first approval makes
    // it active, so that is the sensible proposal.
    is_active: c?.is_active ?? true,
  }
}

const s = (v: string) => (v.trim() === '' ? null : v.trim())

/**
 * Company create/edit form: name, URL, logo, categories, and the job roles the
 * company recruits for with the employee accountable for each.
 *
 * Nothing here is applied directly to an APPROVED company — saving stages the
 * whole proposal on an approval request and the caller says so. For a company
 * that isn't live yet the row is written immediately and re-sent for approval.
 * The form itself doesn't branch on that; the server decides, and `banner`
 * carries the right message.
 */
export function CompanyForm({
  company,
  options,
  readOnly = false,
  canEditStatus = false,
  onSaved,
  onCancel,
}: {
  company: CompanyDetail | null
  options: FormOptions
  /** A pending request is being reviewed — show the values, take no edits. */
  readOnly?: boolean
  /** The `activate` grant; without it the Active switch is display-only. */
  canEditStatus?: boolean
  onSaved: (saved: CompanyDetail) => void
  onCancel: () => void
}) {
  const [f, setF] = useState<FS>(() => initial(company, options.me?.id ?? null))
  const [busy, setBusy] = useState(false)
  const set = <K extends keyof FS>(k: K, v: FS[K]) =>
    setF((prev) => ({ ...prev, [k]: v }))

  const patchRole = (uid: string, partial: Partial<RoleDraft>) =>
    setF((prev) => ({
      ...prev,
      roles: prev.roles.map((r) => (r.uid === uid ? { ...r, ...partial } : r)),
    }))
  const addRole = () =>
    setF((prev) => ({
      ...prev,
      roles: [
        ...prev.roles,
        {
          uid: nextUid(),
          id: null,
          role_name: '',
          // Same default as the first row — the person adding the role owns it
          // until someone says otherwise.
          responsible_employee_id: options.me?.id ?? null,
        },
      ],
    }))
  const removeRole = (uid: string) =>
    setF((prev) => ({ ...prev, roles: prev.roles.filter((r) => r.uid !== uid) }))

  // Staged logo file + preview. Preview seeds from the server URL on edit; once
  // a new file is picked we show a local blob URL (revoked on replace/unmount).
  const fileRef = useRef<HTMLInputElement>(null)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(
    company?.logo_url ?? null,
  )
  const blobUrlRef = useRef<string | null>(null)
  useEffect(
    () => () => {
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current)
    },
    [],
  )

  function onLogoPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (file.size > MAX_LOGO_BYTES) {
      toast.error('Logo must be 2 MB or smaller.')
      return
    }
    if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current)
    const url = URL.createObjectURL(file)
    blobUrlRef.current = url
    setLogoFile(file)
    setLogoPreview(url)
  }

  function validate(): string | null {
    if (!f.name.trim()) return 'Company name is required.'
    if (f.roles.length === 0) return 'Add at least one job role.'
    const seen = new Set<string>()
    for (const r of f.roles) {
      if (!r.role_name.trim()) return 'Give every job role a name.'
      if (r.responsible_employee_id === null) {
        return `Pick who is responsible for "${r.role_name.trim()}".`
      }
      const key = r.role_name.trim().toLowerCase()
      if (seen.has(key)) {
        return `"${r.role_name.trim()}" is listed twice — job roles must be distinct.`
      }
      seen.add(key)
    }
    return null
  }

  function payload(logoKey?: string): CompanyPayload {
    return {
      name: f.name.trim(),
      website: s(f.website),
      category_ids: f.category_ids,
      roles: f.roles.map((r) => ({
        id: r.id,
        role_name: r.role_name.trim(),
        responsible_employee_id: r.responsible_employee_id!,
      })),
      ...(logoKey ? { logo_key: logoKey } : {}),
      is_active: f.is_active,
    }
  }

  async function save() {
    const problem = validate()
    if (problem) {
      toast.error(problem)
      return
    }
    setBusy(true)
    try {
      // A NEW company has no id to upload against, so its logo is staged after
      // the row exists. An existing one uploads first, because the returned key
      // has to ride in the payload to be approved with everything else.
      let stagedKey: string | undefined
      if (logoFile && company) {
        stagedKey = (await uploadCompanyLogo(company.id, logoFile)).logo_key
      }

      const saved = company
        ? await updateCompany(company.id, payload(stagedKey))
        : await createCompany(payload())

      if (logoFile && !company) {
        // A logo failure must not read as "company not saved" — the row (and
        // its approval request) persisted.
        try {
          await uploadCompanyLogo(saved.id, logoFile)
        } catch (logoErr) {
          toast.error(
            logoErr instanceof ApiError || logoErr instanceof Error
              ? `Company saved, but the logo failed: ${logoErr.message}`
              : 'Company saved, but the logo could not be uploaded.',
          )
          onSaved(saved)
          return
        }
      }
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

  const disabled = busy || readOnly
  const statusLocked = company !== null && company.approval_status !== 'approved'

  return (
    <div className="space-y-6">
      <section className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-lg border bg-muted">
            {logoPreview ? (
              <img src={logoPreview} alt="" className="size-full object-cover" />
            ) : (
              <Building2 className="size-6 text-muted-foreground" />
            )}
          </div>
          <div className="space-y-1">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onLogoPicked}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="size-4" /> Upload logo
            </Button>
            <p className="text-xs text-muted-foreground">
              PNG or JPG, up to 2 MB. Applied when the change is approved.
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name *" htmlFor="f-name">
            <Input
              id="f-name"
              value={f.name}
              disabled={disabled}
              onChange={(e) => set('name', e.target.value)}
            />
          </Field>
          <Field label="URL" htmlFor="f-web">
            <Input
              id="f-web"
              value={f.website}
              disabled={disabled}
              placeholder="https://…"
              onChange={(e) => set('website', e.target.value)}
            />
          </Field>
          <Field label="Categories">
            <SearchableMultiSelect
              options={options.categories}
              selected={f.category_ids}
              onChange={(v) => set('category_ids', v)}
              placeholder="Select…"
              searchPlaceholder="Search categories…"
            />
          </Field>
          <Field
            label="Status"
            hint={
              statusLocked
                ? 'Set once the company is approved.'
                : 'Deactivating also needs approval.'
            }
          >
            <label className="flex h-9 items-center gap-2 text-sm">
              <Switch
                checked={f.is_active}
                disabled={disabled || statusLocked || !canEditStatus}
                onCheckedChange={(v) => set('is_active', v)}
              />
              {f.is_active ? 'Active' : 'Inactive'}
            </label>
          </Field>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Job roles
            </h3>
            <p className="text-xs text-muted-foreground">
              Who is accountable for each role this company recruits for.
            </p>
          </div>
          {!readOnly && (
            <Button type="button" variant="outline" size="sm" onClick={addRole}>
              <Plus className="size-4" /> Add role
            </Button>
          )}
        </div>

        <div className="space-y-3">
          {f.roles.map((r, i) => (
            <div
              key={r.uid}
              className="space-y-3 rounded-lg border bg-background p-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Role {i + 1}
                </span>
                {/* The last row can't be removed — a company must always have
                    someone accountable for it. */}
                {!readOnly && f.roles.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    aria-label={`Remove role ${i + 1}`}
                    onClick={() => removeRole(r.uid)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Job role" htmlFor={`role-${r.uid}`}>
                  <Input
                    id={`role-${r.uid}`}
                    value={r.role_name}
                    disabled={disabled}
                    placeholder="e.g. Software Engineer"
                    onChange={(e) =>
                      patchRole(r.uid, { role_name: e.target.value })
                    }
                  />
                </Field>
                <Field label="Responsible person" htmlFor={`own-${r.uid}`}>
                  <EmployeePicker
                    id={`own-${r.uid}`}
                    value={r.responsible_employee_id}
                    disabled={disabled}
                    onChange={(v) =>
                      patchRole(r.uid, { responsible_employee_id: v })
                    }
                  />
                </Field>
              </div>
            </div>
          ))}
        </div>
      </section>

      {!readOnly && (
        <div className="sticky -bottom-6 z-10 -mx-4 -mb-6 flex justify-end gap-2 border-t bg-background px-4 pb-6 pt-4 sm:-mx-6 sm:px-6">
          <Button variant="outline" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={busy}>
            {busy && <Loader2 className="size-4 animate-spin" />}
            {company ? 'Send changes for approval' : 'Create and send for approval'}
          </Button>
        </div>
      )}
    </div>
  )
}
