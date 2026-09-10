import { useState } from 'react'
import {
  Award,
  Copy,
  ExternalLink,
  FileText,
  Hourglass,
  Link2,
  Lock,
  Mail,
  Pencil,
  ShieldCheck,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'

import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ApiError } from '@/lib/api'
import {
  cancelPendingPersonalEmail,
  clearResumeExternalUrl,
  requestPersonalEmailOtp,
  setResumeExternalUrl,
  verifyPersonalEmailOtp,
  type ProfileFieldView,
  type ProfileGroupView,
  type StudentFullProfile,
} from '@/lib/student-profile'
import { cn } from '@/lib/utils'

function errMsg(err: unknown, fallback: string): string {
  return err instanceof ApiError || err instanceof Error
    ? err.message
    : fallback
}

/**
 * The fields of one server-declared group. Three of them get richer blocks
 * instead of a plain value row: the resume (a direct link, no approval), the
 * certifications list (repeatable, with files) and the personal email (inline
 * OTP flow).
 *
 * The Profile page lists the groups as cards — ~45 fields across a dozen groups
 * was one unreadable scroll — and each opens its own `/profile/$group` page.
 */
export function ProfileGroupContent({
  group,
  profile,
  onChanged,
}: {
  group: ProfileGroupView
  profile: StudentFullProfile
  onChanged: () => void
}) {
  if (group.key === 'certifications') {
    return <CertificationsBlock certifications={profile.certifications} />
  }

  const plainFields = group.fields.filter(
    (f) => f.key !== 'resume' && f.key !== 'personal_email',
  )
  const hasResume = group.fields.some((f) => f.key === 'resume')
  const hasPersonalEmail = group.fields.some((f) => f.key === 'personal_email')

  return (
    <>
      {plainFields.length > 0 && (
        <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
          {plainFields.map((f) => (
            <FieldRow key={f.key} field={f} />
          ))}
        </dl>
      )}
      {hasPersonalEmail && (
        <PersonalEmailBlock
          // Keyed by the server's pending state so a refetch resets the local
          // OTP flow without a sync-setState effect.
          key={profile.personal_email.pending_email ?? 'none'}
          state={profile.personal_email}
          pending={
            group.fields.find((f) => f.key === 'personal_email')?.pending ??
            false
          }
          onChanged={onChanged}
          className={plainFields.length > 0 ? 'mt-4 border-t pt-4' : undefined}
        />
      )}
      {hasResume && (
        <ResumeBlock
          resume={profile.resume}
          onChanged={onChanged}
          className={plainFields.length > 0 ? 'mt-4 border-t pt-4' : undefined}
        />
      )}
    </>
  )
}

/** Small chip describing why a field can't simply be edited right now. */
export function PolicyChip({ field }: { field: ProfileFieldView }) {
  if (field.pending) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-warning">
        <Hourglass className="size-3" /> Pending
      </span>
    )
  }
  switch (field.policy) {
    case 'OTP_VERIFY':
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
          <ShieldCheck className="size-3" /> Verify email
        </span>
      )
    case 'AUTO':
    case 'AUTO_REQUESTABLE':
      return (
        <span className="text-[11px] font-medium text-muted-foreground">
          Auto
        </span>
      )
    case 'SYSTEM_LOCKED':
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
          <Lock className="size-3" /> Locked
        </span>
      )
    case 'ADMIN_ONLY':
      return (
        <span className="text-[11px] font-medium text-muted-foreground">
          Admin only
        </span>
      )
    case 'EXISTING_READONLY':
      return (
        <span className="text-[11px] font-medium text-muted-foreground">
          Read only
        </span>
      )
    default:
      return null
  }
}

function FieldRow({ field }: { field: ProfileFieldView }) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center justify-between gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <span className="truncate">{field.label}</span>
        <PolicyChip field={field} />
      </dt>
      <dd className="mt-0.5 break-words text-sm font-medium">
        {field.key === 'date_of_birth' && field.display
          ? formatDate(field.display)
          : (field.display ?? '—')}
      </dd>
    </div>
  )
}

// --- certifications --------------------------------------------------------------

function CertificationsBlock({
  certifications,
}: {
  certifications: StudentFullProfile['certifications']
}) {
  if (certifications.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No certifications yet — add one via{' '}
        <span className="font-medium text-foreground">Request changes</span>{' '}
        (each entry needs its certificate file and goes through approval).
      </p>
    )
  }
  return (
    <ul className="space-y-2">
      {certifications.map((c) => (
        <li
          key={c.id}
          className="flex items-center gap-3 rounded-lg border bg-muted/20 px-3 py-2"
        >
          <span className="grid size-8 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
            <Award className="size-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{c.name}</span>
            <span className="block text-xs text-muted-foreground">
              Added {formatDate(c.created_at)}
            </span>
          </span>
          {c.certificate_file_url && (
            <a
              href={c.certificate_file_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              <ExternalLink className="size-3" /> View certificate
            </a>
          )}
        </li>
      ))}
    </ul>
  )
}

// --- resume (direct — a single external link, no approval) -----------------------

/**
 * The resume is ONE link the student hosts elsewhere (Drive, portfolio…). We
 * don't host resume files: the student owns the hosting, and recruiters open the
 * link directly.
 */
function ResumeBlock({
  resume,
  onChanged,
  className,
}: {
  resume: StudentFullProfile['resume']
  onChanged: () => void
  className?: string
}) {
  const [busy, setBusy] = useState(false)
  const [editingExternal, setEditingExternal] = useState(false)
  const [externalDraft, setExternalDraft] = useState('')

  const externalUrl = resume.external_url

  async function onCopy(url: string, label: string) {
    try {
      await navigator.clipboard.writeText(url)
      toast.success(`${label} copied.`)
    } catch {
      toast.error('Could not copy the link — copy it from the Open tab instead.')
    }
  }

  async function onSaveExternal() {
    const value = externalDraft.trim()
    if (!/^https:\/\/\S+$/.test(value) || value.length > 512) {
      toast.info('Enter a valid https:// link (up to 512 characters).')
      return
    }
    setBusy(true)
    try {
      await setResumeExternalUrl(value)
      toast.success('Resume link saved.')
      setExternalDraft('')
      setEditingExternal(false)
      onChanged()
    } catch (err) {
      toast.error(errMsg(err, 'Could not save the resume link.'))
    } finally {
      setBusy(false)
    }
  }

  async function onClearExternal() {
    setBusy(true)
    try {
      await clearResumeExternalUrl()
      toast.success('Resume link removed.')
      setExternalDraft('')
      setEditingExternal(false)
      onChanged()
    } catch (err) {
      toast.error(errMsg(err, 'Could not remove the resume link.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-md bg-icon-blue/10 text-icon-blue">
          <FileText className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Resume
          </p>
          <p className="text-sm font-medium">
            {externalUrl
              ? 'Your resume link is live — recruiters open it directly'
              : 'Not set yet — add your resume link below'}
          </p>
        </div>
      </div>

      <div className="mt-3 rounded-lg border bg-muted/20 p-3">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Link2 className="size-3.5" /> Resume link
        </p>
        {externalUrl && !editingExternal ? (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <a
              href={externalUrl}
              target="_blank"
              rel="noreferrer"
              className="min-w-0 flex-1 truncate text-sm font-medium text-primary hover:underline"
            >
              {externalUrl}
            </a>
            <div className="flex flex-wrap items-center gap-2">
              <a
                href={externalUrl}
                target="_blank"
                rel="noreferrer"
                className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
              >
                <ExternalLink className="size-4" /> Open
              </a>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void onCopy(externalUrl, 'Resume link')}
              >
                <Copy className="size-4" /> Copy
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => {
                  setExternalDraft(externalUrl)
                  setEditingExternal(true)
                }}
              >
                <Pencil className="size-4" /> Edit
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => void onClearExternal()}
              >
                <Trash2 className="size-4" /> Remove
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Input
              type="url"
              maxLength={512}
              value={externalDraft}
              disabled={busy}
              onChange={(e) => setExternalDraft(e.target.value)}
              className="h-9 min-w-0 flex-1 sm:max-w-md"
            />
            <Button
              size="sm"
              disabled={busy || externalDraft.trim() === ''}
              onClick={() => void onSaveExternal()}
            >
              {editingExternal ? 'Save changes' : 'Save link'}
            </Button>
            {editingExternal && (
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => {
                  setExternalDraft('')
                  setEditingExternal(false)
                }}
              >
                Cancel
              </Button>
            )}
          </div>
        )}
        <p className="mt-1.5 text-xs text-muted-foreground">
          A link you host yourself (Google Drive, a portfolio…), https:// only.
          Keep it publicly viewable and working — recruiters open it directly,
          and a broken link means no resume.
        </p>
      </div>
    </div>
  )
}

// --- personal email (OTP flow) ------------------------------------------------------

function PersonalEmailBlock({
  state,
  pending,
  onChanged,
  className,
}: {
  state: StudentFullProfile['personal_email']
  /** Locked by an open approval request (shouldn't happen for OTP, but honor it). */
  pending: boolean
  onChanged: () => void
  className?: string
}) {
  const [editing, setEditing] = useState(false)
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  // Local echo of the server's pending_email so the code step appears
  // immediately after requesting an OTP, before the profile refetch (the
  // parent remounts this block — via key — when the server state changes).
  const [pendingEmail, setPendingEmail] = useState(state.pending_email)

  async function onRequestOtp() {
    const value = email.trim().toLowerCase()
    if (!/^\S+@\S+\.\S+$/.test(value) || value.length > 255) {
      toast.info('Enter a valid email address.')
      return
    }
    setBusy(true)
    try {
      const res = await requestPersonalEmailOtp(value)
      setPendingEmail(res.pending_email)
      setEditing(false)
      setEmail('')
      setCode('')
      toast.success(
        `Verification code sent to ${res.pending_email} — it expires in ${res.expires_in_minutes} minutes.`,
      )
    } catch (err) {
      toast.error(errMsg(err, 'Could not send the verification code.'))
    } finally {
      setBusy(false)
    }
  }

  async function onVerify() {
    if (!/^\d{6}$/.test(code)) {
      toast.info('Enter the 6-digit code from the email.')
      return
    }
    setBusy(true)
    try {
      await verifyPersonalEmailOtp(code)
      toast.success('Personal email verified.')
      setPendingEmail(null)
      setCode('')
      onChanged()
    } catch (err) {
      toast.error(errMsg(err, 'Could not verify the code.'))
    } finally {
      setBusy(false)
    }
  }

  async function onCancelPending() {
    setBusy(true)
    try {
      await cancelPendingPersonalEmail()
      setPendingEmail(null)
      setCode('')
      toast.success('Pending email change cancelled.')
      onChanged()
    } catch (err) {
      toast.error(errMsg(err, 'Could not cancel the pending change.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-md bg-icon-cyan/10 text-icon-cyan">
          <Mail className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Personal email
            <span className="inline-flex items-center gap-1 normal-case tracking-normal">
              <ShieldCheck className="size-3" /> Verified via OTP
            </span>
          </p>
          <p className="break-words text-sm font-medium">
            {state.value ?? '—'}
          </p>
        </div>
        {!pendingEmail && !editing && (
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => {
              setEmail(state.value ?? '')
              setEditing(true)
            }}
          >
            {state.value ? 'Change' : 'Add email'}
          </Button>
        )}
      </div>

      {editing && !pendingEmail && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Input
            type="email"
            value={email}
            disabled={busy}
            onChange={(e) => setEmail(e.target.value)}
            className="h-9 max-w-xs"
          />
          <Button size="sm" disabled={busy} onClick={() => void onRequestOtp()}>
            {busy ? 'Sending…' : 'Send code'}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => setEditing(false)}
          >
            Cancel
          </Button>
        </div>
      )}

      {pendingEmail && (
        <div className="mt-3 rounded-lg border border-warning/40 bg-warning/10 p-3">
          <p className="text-sm">
            Verification pending for{' '}
            <span className="font-medium">{pendingEmail}</span> — enter the
            6-digit code from the email.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Input
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              disabled={busy}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              className="h-9 w-32 text-center font-mono tracking-widest"
            />
            <Button
              size="sm"
              disabled={busy || code.length !== 6}
              onClick={() => void onVerify()}
            >
              {busy ? 'Verifying…' : 'Verify'}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => void onCancelPending()}
            >
              Cancel change
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

/** Formats an ISO date (YYYY-MM-DD, possibly with a time part) for reading. */
export function formatDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (!match) return value || '—'
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
