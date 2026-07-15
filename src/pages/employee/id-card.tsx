import { useCallback, useEffect, useState } from 'react'
import { CircleAlert, IdCard as IdCardIcon, RefreshCw } from 'lucide-react'

import { ExpiringQr } from '@/components/expiring-qr'
import { Button } from '@/components/ui/button'
import { ApiError } from '@/lib/api'
import {
  employeeIdCard,
  employeeIdCardPass,
  type EmployeeIdCard,
} from '@/lib/employee-id-card'
import { useEmployeeAuthStore } from '@/stores/employee-auth-store'

export default function EmployeeIdCardPage() {
  const signOut = useEmployeeAuthStore((s) => s.signOut)
  const [card, setCard] = useState<EmployeeIdCard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    document.title = 'ID Card — Nucleus'
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setCard(await employeeIdCard())
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        signOut()
        return
      }
      setError(
        err instanceof Error ? err.message : 'Could not load your ID card.',
      )
    } finally {
      setLoading(false)
    }
  }, [signOut])

  useEffect(() => {
    void load()
  }, [load])

  const header = (
    <div className="flex items-start gap-3">
      <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-icon-violet/10 text-icon-violet">
        <IdCardIcon className="size-5" />
      </div>
      <div className="min-w-0">
        <h1 className="text-lg font-semibold tracking-tight">ID Card</h1>
        <p className="text-sm text-muted-foreground">
          Your digital employee identity card.
        </p>
      </div>
    </div>
  )

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {header}
      {loading ? (
        <CardSkeleton />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : card ? (
        <IdentityCard card={card} />
      ) : null}
    </div>
  )
}

function IdentityCard({ card }: { card: EmployeeIdCard }) {
  const { employee, institution, designation, department } = card

  return (
    <section className="mx-auto max-w-3xl overflow-hidden rounded-2xl border bg-card text-card-foreground shadow-sm">
      {/* College header band */}
      <div className="flex items-center gap-3 bg-gradient-to-br from-primary to-secondary p-4 text-primary-foreground">
        {institution.logo_url ? (
          <img
            src={institution.logo_url}
            alt=""
            className="size-12 shrink-0 rounded-md bg-white/10 object-contain"
          />
        ) : null}
        <div className="min-w-0">
          <h2 className="truncate text-base font-bold leading-tight">
            {institution.name}
          </h2>
          {institution.affiliation_code ? (
            <p className="truncate text-[11px] text-primary-foreground/80">
              {institution.affiliation_code}
            </p>
          ) : null}
        </div>
      </div>

      {/* Landscape body: details column | QR column */}
      <div className="grid sm:grid-cols-[1fr_auto]">
        {/* Details column */}
        <div className="min-w-0">
          {/* Photo + identity */}
          <div className="flex gap-4 p-5">
            <EmployeePhoto
              name={employee.emp_display_name}
              photoUrl={employee.photo_url}
            />
            <div className="min-w-0 flex-1 space-y-1.5 self-center">
              <h3 className="text-lg font-semibold leading-tight">
                {employee.emp_display_name}
              </h3>
              <span className="inline-block rounded-md bg-primary/10 px-2 py-0.5 font-mono text-xs font-medium text-primary">
                {employee.emp_code}
              </span>
              {designation ? (
                <p className="text-sm text-muted-foreground">
                  {designation.name}
                  {department ? ` · ${department.name}` : ''}
                </p>
              ) : null}
            </div>
          </div>

          {/* Detail grid */}
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-t px-5 py-5">
            <Field label="Designation" value={designation?.name} />
            <Field label="Department" value={department?.name} />
            <Field label="Employee code" value={employee.emp_code} />
            <Field label="Gender" value={formatGender(employee.gender)} />
            <Field label="Date of birth" value={formatDate(employee.dob)} />
            <Field label="Mobile" value={formatMobile(employee)} />
            <Field label="Email" value={employee.email} />
          </dl>
        </div>

        {/* QR column — single-use, expires in 60s, refreshed manually */}
        <div className="flex flex-col items-center justify-center gap-3 border-t bg-muted/40 p-6 sm:w-56 sm:border-l sm:border-t-0">
          <ExpiringQr
            initialToken={card.qr_token}
            ttlSeconds={card.ttl_seconds}
            caption={employee.emp_code}
            fetchPass={employeeIdCardPass}
          />
        </div>
      </div>

      <p className="border-t px-5 py-3 text-center text-xs text-muted-foreground">
        If a physical copy of any ID card is found, please return it to the
        college administration office.
      </p>
    </section>
  )
}

/**
 * Photo slot with graceful degradation: render the photo when a URL is present
 * and loads, but fall back to an initials avatar when there's no photo OR the
 * image fails to load. No broken-image icon ever shows. Employees have no photo
 * upload path yet, so today this always renders initials.
 */
function EmployeePhoto({
  name,
  photoUrl,
}: {
  name: string
  photoUrl: string | null
}) {
  const [errored, setErrored] = useState(false)
  const showPhoto = !!photoUrl && !errored

  if (showPhoto) {
    return (
      <img
        src={photoUrl}
        alt={name}
        onError={() => setErrored(true)}
        className="h-28 w-24 shrink-0 rounded-lg border bg-muted object-cover"
      />
    )
  }

  const initials = name
    .trim()
    .split(/\s+/)
    .map((part) => part[0] ?? '')
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <div className="grid h-28 w-24 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-primary to-secondary text-2xl font-semibold text-primary-foreground shadow-md shadow-primary/30">
      {initials || '—'}
    </div>
  )
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 break-words text-sm font-medium">{value || '—'}</dd>
    </div>
  )
}

function formatGender(value: string): string {
  if (!value) return ''
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function formatMobile(employee: EmployeeIdCard['employee']): string {
  if (!employee.mobile_number) return ''
  const code = employee.country_code?.trim()
  return code ? `+${code} ${employee.mobile_number}` : employee.mobile_number
}

/** Formats an ISO date (YYYY-MM-DD) without a timezone shift. */
function formatDate(value: string | null): string {
  if (!value) return ''
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (!match) return value
  const [, year, month, day] = match
  return new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
  ).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function CardSkeleton() {
  return (
    <div className="mx-auto max-w-3xl overflow-hidden rounded-2xl border bg-card">
      <div className="h-20 animate-pulse bg-muted" />
      <div className="grid sm:grid-cols-[1fr_auto]">
        <div className="min-w-0">
          <div className="flex gap-4 p-5">
            <div className="h-28 w-24 shrink-0 animate-pulse rounded-lg bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-5 w-40 animate-pulse rounded bg-muted" />
              <div className="h-4 w-24 animate-pulse rounded bg-muted" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 border-t p-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-9 animate-pulse rounded bg-muted" />
            ))}
          </div>
        </div>
        <div className="flex items-center justify-center border-t bg-muted/40 p-6 sm:w-56 sm:border-l sm:border-t-0">
          <div className="size-[150px] animate-pulse rounded-xl bg-muted" />
        </div>
      </div>
    </div>
  )
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border bg-card p-10 text-center text-card-foreground">
      <div className="grid size-12 place-items-center rounded-full bg-destructive/10 text-destructive">
        <CircleAlert className="size-6" />
      </div>
      <div className="space-y-1">
        <h2 className="text-sm font-semibold">Couldn&rsquo;t load your ID card</h2>
        <p className="max-w-sm text-xs text-muted-foreground">{message}</p>
      </div>
      <Button size="sm" onClick={onRetry}>
        <RefreshCw />
        Try again
      </Button>
    </div>
  )
}
