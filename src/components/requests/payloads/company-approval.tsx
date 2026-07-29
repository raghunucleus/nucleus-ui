import { ArrowRight } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { CompanyLogo } from '@/components/corporate-relations/bits'
import { EmployeePicker } from '@/components/employee/employee-picker'
import type { ApprovalRow } from '@/lib/employee-requests'
import type { PayloadRenderer, PayloadRendererProps } from './types'

interface RolePayload {
  key: string
  id: number | null
  role_name: string
  responsible_employee_id: number
  responsible_employee_name: string
  responsible_employee_code: string
}

interface Snapshot {
  name: string
  website: string | null
  logo_url?: string | null
  categories: { id: number; name: string }[]
  is_active: boolean | null
  roles: RolePayload[]
}

interface CompanyPayload {
  kind: 'create' | 'update'
  company_id: number
  current: Snapshot | null
  proposed: Snapshot
  applied_roles?: RolePayload[]
}

const payloadOf = (row: ApprovalRow | null): CompanyPayload | null =>
  (row?.payload as unknown as CompanyPayload) ?? null

const statusText = (v: boolean | null) =>
  v === null ? 'Awaiting approval' : v ? 'Active' : 'Inactive'

/** One field, with its previous value struck through when it changed. */
function FieldRow({
  label,
  from,
  to,
}: {
  label: string
  from?: string | null
  to: string
}) {
  const changed = from !== undefined && from !== to
  return (
    <div className="flex flex-wrap items-start gap-2 rounded-md bg-muted/30 px-3 py-2 text-sm">
      <span className="w-28 shrink-0 pt-0.5 text-xs font-medium text-muted-foreground">
        {label}
      </span>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-0.5">
        {changed && (
          <>
            <span className="min-w-0 break-words text-muted-foreground line-through">
              {from || '—'}
            </span>
            <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" />
          </>
        )}
        <span className="min-w-0 break-words font-medium">{to || '—'}</span>
      </div>
    </div>
  )
}

function Body({ row, detail, editable, overrides, setOverrides }: PayloadRendererProps) {
  // Prefer the detail payload: the logo URLs are presigned only there.
  const p = payloadOf(detail ?? row)
  if (!p) return null

  const { current, proposed } = p
  // Once decided, show what was actually written — including whoever the
  // approver substituted, which is the whole point of letting them edit.
  const roles = p.applied_roles ?? proposed.roles
  const officers = (overrides.role_officers ?? []) as {
    key: string
    responsible_employee_id: number
  }[]

  const officerFor = (r: RolePayload) =>
    officers.find((o) => o.key === r.key)?.responsible_employee_id ??
    r.responsible_employee_id

  const setOfficer = (key: string, id: number | null) => {
    if (id === null) return
    const rest = officers.filter((o) => o.key !== key)
    setOverrides({
      ...overrides,
      role_officers: [...rest, { key, responsible_employee_id: id }],
    })
  }

  // The server presigns the CURRENT logo too, so a replacement reads the same
  // way as every other changed field: old, arrow, new.
  const logoChanged =
    current !== null && (current.logo_url ?? null) !== (proposed.logo_url ?? null)

  return (
    <div className="max-h-[32rem] space-y-4 overflow-y-auto p-3">
      <div className="flex items-center gap-3">
        {logoChanged && (
          <>
            <CompanyLogo
              name={current.name}
              logoUrl={current.logo_url ?? null}
              className="size-12 shrink-0 opacity-60"
            />
            <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
          </>
        )}
        <CompanyLogo
          name={proposed.name}
          logoUrl={proposed.logo_url ?? null}
          className="size-12 shrink-0"
        />
        <div>
          <p className="font-medium">{proposed.name}</p>
          <p className="text-xs text-muted-foreground">
            {p.kind === 'create'
              ? 'New company awaiting approval'
              : 'Change to an approved company'}
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        <FieldRow label="Name" from={current?.name} to={proposed.name} />
        <FieldRow
          label="URL"
          from={current === null ? undefined : (current.website ?? '—')}
          to={proposed.website ?? '—'}
        />
        <FieldRow
          label="Categories"
          from={
            current === null
              ? undefined
              : current.categories.map((c) => c.name).join(', ') || '—'
          }
          to={proposed.categories.map((c) => c.name).join(', ') || '—'}
        />
        <FieldRow
          label="Status"
          from={current === null ? undefined : statusText(current.is_active)}
          to={statusText(proposed.is_active)}
        />
      </div>

      <div className="space-y-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Job roles{' '}
          {editable && (
            <span className="font-normal normal-case">
              — you can reassign the responsible person before approving
            </span>
          )}
        </p>
        <div className="space-y-1.5">
          {roles.map((r) => (
            <div
              key={r.key}
              className="flex flex-wrap items-center gap-2 rounded-md bg-muted/30 px-3 py-2 text-sm"
            >
              <span className="min-w-32 flex-1 font-medium">{r.role_name}</span>
              {editable ? (
                <div className="w-64">
                  <EmployeePicker
                    id={`officer-${r.key}`}
                    value={officerFor(r)}
                    onChange={(v) => setOfficer(r.key, v)}
                  />
                </div>
              ) : (
                <Badge variant="muted">
                  {r.responsible_employee_name} · {r.responsible_employee_code}
                </Badge>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/**
 * A company is approved or rejected whole — approving half a company is not a
 * thing, so there are no per-item verdicts. The one thing an approver may
 * change is who owns each job role, which rides along as `overrides`.
 */
export const companyApprovalRenderer: PayloadRenderer = {
  perItem: false,
  title: 'Company',
  initialOverrides: () => ({}),
  summary: (row) => {
    const p = payloadOf(row)
    if (!p) return 'Company'
    const n = p.proposed.roles.length
    return `${p.proposed.name} · ${n} role${n === 1 ? '' : 's'}`
  },
  Avatar: ({ row }) => {
    const p = payloadOf(row)
    return (
      <CompanyLogo
        name={p?.proposed.name ?? '?'}
        logoUrl={p?.proposed.logo_url ?? null}
      />
    )
  },
  Body,
}
