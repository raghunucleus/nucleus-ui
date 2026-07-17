import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import {
  Award,
  Camera,
  CircleAlert,
  CircleCheck,
  ClipboardList,
  Copy,
  ExternalLink,
  FileText,
  Hourglass,
  Link2,
  Lock,
  Mail,
  Pencil,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Upload,
  UserRound,
} from 'lucide-react'
import { toast } from 'sonner'

import { PhotoLightbox } from '@/components/photo-lightbox'
import { PhotoUploadDialog } from '@/components/photo-upload-dialog'
import { PageHeader } from '@/components/portal-layout'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { ApiError } from '@/lib/api'
import {
  cancelPendingPersonalEmail,
  clearResumeExternalUrl,
  deleteResume,
  fetchFullProfile,
  requestPersonalEmailOtp,
  setResumeExternalUrl,
  uploadResume,
  verifyPersonalEmailOtp,
  type ProfileFieldView,
  type ProfileGroupView,
  type StudentFullProfile,
} from '@/lib/student-profile'
import { PROFILE_FIELD_LABELS } from '@/lib/student-requests'
import { studentMe, type StudentProfile } from '@/lib/student-auth'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'

function errMsg(err: unknown, fallback: string): string {
  return err instanceof ApiError || err instanceof Error
    ? err.message
    : fallback
}

export default function Profile() {
  const signOut = useAuthStore((state) => state.signOut)
  const navigate = useNavigate()
  const [me, setMe] = useState<StudentProfile | null>(null)
  const [profile, setProfile] = useState<StudentFullProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    document.title = 'Profile — Nucleus'
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [meData, full] = await Promise.all([studentMe(), fetchFullProfile()])
      setMe(meData)
      setProfile(full)
    } catch (err) {
      // Session gone → straight back to login. Anything else → offer a retry.
      if (err instanceof ApiError && err.status === 401) {
        signOut()
        return
      }
      setError(
        err instanceof Error ? err.message : 'Could not load your profile.',
      )
    } finally {
      setLoading(false)
    }
  }, [signOut])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <>
      <PageHeader
        title="Profile"
        subtitle="Your personal and academic details."
        icon={UserRound}
        accent="violet"
      />
      {/* Most fields aren't directly editable — the profile module raises an
          approval request, reviewed by the batch's profile verifiers and
          tracked on the My Requests screen. */}
      <div className="-mt-2 mb-4 flex justify-end">
        <Button
          size="sm"
          onClick={() => void navigate({ to: '/profile/request-changes' })}
        >
          <ClipboardList className="size-4" /> Request changes
        </Button>
      </div>
      {loading ? (
        <ProfileSkeleton />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : me && profile ? (
        <div className="space-y-4">
          <IdentityCard
            me={me}
            profile={profile}
            onPhotoChange={(photoUrl) =>
              setMe((p) => (p ? { ...p, photo_url: photoUrl } : p))
            }
          />
          <CompletenessCard completeness={profile.completeness} />
          {profile.groups.map((group) => (
            <GroupCard
              key={group.key}
              group={group}
              profile={profile}
              onChanged={() => void load()}
            />
          ))}
        </div>
      ) : null}
    </>
  )
}

// --- identity + completeness ---------------------------------------------------

function IdentityCard({
  me,
  profile,
  onPhotoChange,
}: {
  me: StudentProfile
  profile: StudentFullProfile
  onPhotoChange: (photoUrl: string | null) => void
}) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)

  return (
    <section className="overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm">
      <div className="flex flex-col gap-4 bg-gradient-to-br from-primary/8 to-secondary/8 p-5 sm:flex-row sm:items-center">
        <div className="relative size-16 shrink-0 self-start sm:self-auto">
          {me.photo_url ? (
            <>
              <button
                type="button"
                aria-label="View photo full size"
                onClick={() => setLightboxOpen(true)}
                className="block cursor-zoom-in rounded-full"
              >
                {/* Keyed by URL so a fresh presigned link resets the fallback. */}
                <ProfileAvatar
                  key={me.photo_url}
                  name={me.display_name}
                  photoUrl={me.photo_url}
                />
              </button>
              <PhotoLightbox
                open={lightboxOpen}
                onOpenChange={setLightboxOpen}
                src={me.photo_url}
                name={me.display_name}
              />
            </>
          ) : (
            <ProfileAvatar
              key="no-photo"
              name={me.display_name}
              photoUrl={null}
            />
          )}
          <button
            type="button"
            aria-label="Change profile photo"
            onClick={() => setDialogOpen(true)}
            className="absolute -bottom-0.5 -right-0.5 grid size-6 place-items-center rounded-full border bg-card text-muted-foreground shadow-sm transition-colors hover:text-foreground"
          >
            <Camera className="size-3.5" />
          </button>
          <PhotoUploadDialog
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            hasPhoto={!!me.photo_url}
            onUploaded={onPhotoChange}
          />
        </div>
        <div className="min-w-0 flex-1 space-y-1.5">
          <h2 className="truncate text-lg font-semibold">{me.display_name}</h2>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-primary/10 px-2 py-0.5 font-mono text-xs font-medium text-primary">
              {profile.student_id}
            </span>
            <Badge variant="secondary">{profile.entry_type_label}</Badge>
            <StatusBadge active={me.is_active} />
          </div>
          <p className="text-xs text-muted-foreground">
            {profile.programme_name} · Admitted {profile.admission_year_display}
            {profile.pass_out_year ? ` · Passes out ${profile.pass_out_year}` : ''}
          </p>
        </div>
      </div>
    </section>
  )
}

function CompletenessCard({
  completeness,
}: {
  completeness: StudentFullProfile['completeness']
}) {
  const { required, filled, missing } = completeness
  const pct = required > 0 ? (filled / required) * 100 : 100
  const done = missing.length === 0
  return (
    <section className="rounded-xl border bg-card p-4 text-card-foreground shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold">
          {done ? (
            <CircleCheck className="size-4 text-success" />
          ) : (
            <CircleAlert className="size-4 text-warning" />
          )}
          Profile completeness
        </h3>
        <span className="text-xs font-medium tabular-nums text-muted-foreground">
          {filled} / {required} required fields
        </span>
      </div>
      <Progress
        className="mt-2.5"
        value={pct}
        indicatorClassName={done ? 'bg-success' : undefined}
      />
      {!done && (
        <p className="mt-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Missing:</span>{' '}
          {missing.map((k) => PROFILE_FIELD_LABELS[k] ?? k).join(', ')}
        </p>
      )}
    </section>
  )
}

// --- group cards -----------------------------------------------------------------

/**
 * One server-declared group. Three fields get richer blocks instead of a
 * plain value row: the resume (direct upload), the certifications list
 * (repeatable, with files) and the personal email (inline OTP flow).
 */
function GroupCard({
  group,
  profile,
  onChanged,
}: {
  group: ProfileGroupView
  profile: StudentFullProfile
  onChanged: () => void
}) {
  if (group.key === 'certifications') {
    return (
      <section className="rounded-xl border bg-card p-5 text-card-foreground shadow-sm">
        <GroupTitle label={group.label} />
        <CertificationsBlock certifications={profile.certifications} />
      </section>
    )
  }

  const plainFields = group.fields.filter(
    (f) => f.key !== 'resume' && f.key !== 'personal_email',
  )
  const hasResume = group.fields.some((f) => f.key === 'resume')
  const hasPersonalEmail = group.fields.some((f) => f.key === 'personal_email')

  return (
    <section className="rounded-xl border bg-card p-5 text-card-foreground shadow-sm">
      <GroupTitle label={group.label} />
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
    </section>
  )
}

function GroupTitle({ label }: { label: string }) {
  return (
    <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {label}
    </h3>
  )
}

/** Small chip describing why a field can't simply be edited right now. */
function PolicyChip({ field }: { field: ProfileFieldView }) {
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

// --- resume (direct — hosted PDF and/or external link, no approval) ---------------

const RESUME_MAX_BYTES = 2 * 1024 * 1024

/**
 * Two INDEPENDENT ways to point recruiters at a resume: a HOSTED PDF (with a
 * permanent tokenized link that survives re-uploads) and an EXTERNAL https://
 * link. Recruiters get both — neither masks the other, so if one fails the
 * other still works. Only opens of the hosted (Nucleus) link are counted.
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
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [editingExternal, setEditingExternal] = useState(false)
  const [externalDraft, setExternalDraft] = useState('')

  // A file is currently uploaded; the permanent link exists once EVER uploaded.
  const uploadedAt = resume.uploaded_at
  const hasFile = uploadedAt !== null
  const hostedUrl = resume.hosted_url
  const externalUrl = resume.external_url
  // Exactly one of the two peers is set — suggest adding the other as a backup.
  const showBackupNudge = hasFile !== (externalUrl !== null)

  async function onPick(file: File | undefined) {
    if (!file) return
    if (file.type !== 'application/pdf') {
      toast.info('The resume must be a PDF file.')
      return
    }
    if (file.size >= RESUME_MAX_BYTES) {
      toast.info('The resume must be smaller than 2 MB.')
      return
    }
    setBusy(true)
    try {
      await uploadResume(file)
      toast.success('Resume uploaded.')
      onChanged()
    } catch (err) {
      toast.error(errMsg(err, 'Could not upload the resume.'))
    } finally {
      setBusy(false)
    }
  }

  async function onDelete() {
    setBusy(true)
    try {
      await deleteResume()
      toast.success('Resume file removed.')
      onChanged()
    } catch (err) {
      toast.error(errMsg(err, 'Could not remove the resume.'))
    } finally {
      setBusy(false)
      setConfirmDelete(false)
    }
  }

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
      toast.success('External resume link saved.')
      setExternalDraft('')
      setEditingExternal(false)
      onChanged()
    } catch (err) {
      toast.error(errMsg(err, 'Could not save the external link.'))
    } finally {
      setBusy(false)
    }
  }

  async function onClearExternal() {
    setBusy(true)
    try {
      await clearResumeExternalUrl()
      toast.success('External link removed.')
      setExternalDraft('')
      setEditingExternal(false)
      onChanged()
    } catch (err) {
      toast.error(errMsg(err, 'Could not remove the external link.'))
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
            {hasFile && externalUrl
              ? 'Both links are live — recruiters get each one'
              : hasFile || externalUrl
                ? 'One link is live'
                : 'Not set yet — upload a PDF or add a link below'}
          </p>
        </div>
      </div>

      {showBackupNudge && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3">
          <CircleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
          <p className="text-sm">
            Add a backup link so recruiters always have a working copy — if one
            link fails, the other still works.
          </p>
        </div>
      )}

      {/* Peer 1 — hosted PDF with its permanent link. */}
      <div className="mt-3 rounded-lg border bg-muted/20 p-3">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Upload className="size-3.5" /> Hosted PDF
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <p className="min-w-0 flex-1 text-sm">
            {uploadedAt
              ? `Uploaded ${formatDate(uploadedAt)}`
              : hostedUrl
                ? 'No file right now — the permanent link stays yours and works again after the next upload.'
                : 'No file uploaded yet.'}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {hostedUrl && hasFile && (
              <a
                href={hostedUrl}
                target="_blank"
                rel="noreferrer"
                className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
              >
                <ExternalLink className="size-4" /> Open
              </a>
            )}
            {hostedUrl && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => void onCopy(hostedUrl, 'Permanent link')}
              >
                <Copy className="size-4" /> Copy link
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
            >
              <Upload className="size-4" /> {hasFile ? 'Replace' : 'Upload PDF'}
            </Button>
            {hasFile &&
              (confirmDelete ? (
                <>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={busy}
                    onClick={() => void onDelete()}
                  >
                    Yes, delete
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => setConfirmDelete(false)}
                  >
                    Keep it
                  </Button>
                </>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 className="size-4" /> Delete
                </Button>
              ))}
          </div>
        </div>
        {hostedUrl && (
          <p className="mt-2 text-sm">
            {resume.download_count > 0 ? (
              <>
                <span className="font-medium">
                  Opened {resume.download_count}{' '}
                  {resume.download_count === 1 ? 'time' : 'times'}
                </span>
                {resume.last_downloaded_at
                  ? ` · last ${formatDate(resume.last_downloaded_at)}`
                  : ''}
              </>
            ) : (
              <span className="text-muted-foreground">Not opened yet.</span>
            )}
          </p>
        )}
        <p className="mt-1.5 text-xs text-muted-foreground">
          PDF only, under 2 MB. Your permanent link never changes — even after
          you replace the file — so it&rsquo;s safe to put on applications.
          It&rsquo;s public: anyone with it can open your resume.
          {hostedUrl
            ? ' Opens are counted for this Nucleus link only — traffic on your external link isn’t visible to us.'
            : ''}
        </p>
      </div>

      {/* Peer 2 — external link, independent of the hosted PDF. */}
      <div className="mt-2 rounded-lg border bg-muted/20 p-3">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Link2 className="size-3.5" /> External link
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
                onClick={() => void onCopy(externalUrl, 'External link')}
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
              placeholder="https://drive.google.com/…"
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
          A link you host elsewhere (Google Drive, a portfolio…), https:// only.
          It sits alongside your hosted PDF — recruiters get both links, and
          neither replaces the other.
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          void onPick(e.target.files?.[0])
          e.target.value = ''
        }}
      />
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
            placeholder="you@example.com"
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
              placeholder="6-digit code"
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

// --- shared bits ----------------------------------------------------------------

/** Circular avatar: photo when available, initials gradient otherwise. */
function ProfileAvatar({
  name,
  photoUrl,
}: {
  name: string
  photoUrl: string | null
}) {
  const [errored, setErrored] = useState(false)

  if (photoUrl && !errored) {
    return (
      <img
        src={photoUrl}
        alt={name}
        onError={() => setErrored(true)}
        className="size-16 rounded-full border bg-muted object-cover shadow-md shadow-primary/20"
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
    <div className="grid size-16 place-items-center rounded-full bg-gradient-to-br from-primary to-secondary text-xl font-semibold text-primary-foreground shadow-md shadow-primary/30">
      {initials || '—'}
    </div>
  )
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium',
        active
          ? 'bg-success/10 text-success'
          : 'bg-destructive/10 text-destructive',
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'size-1.5 rounded-full',
          active ? 'bg-success' : 'bg-destructive',
        )}
      />
      {active ? 'Active' : 'Inactive'}
    </span>
  )
}

/** Formats an ISO date (YYYY-MM-DD, possibly with a time part) for reading. */
function formatDate(value: string): string {
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

function ProfileSkeleton() {
  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="flex items-center gap-4 bg-muted/40 p-5">
          <div className="size-16 shrink-0 animate-pulse rounded-full bg-muted" />
          <div className="space-y-2">
            <div className="h-5 w-48 animate-pulse rounded bg-muted" />
            <div className="h-4 w-32 animate-pulse rounded bg-muted" />
          </div>
        </div>
      </div>
      {[0, 1, 2].map((g) => (
        <div key={g} className="rounded-xl border bg-card p-5">
          <div className="mb-4 h-3 w-40 animate-pulse rounded bg-muted" />
          <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded bg-muted" />
            ))}
          </div>
        </div>
      ))}
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
        <h2 className="text-sm font-semibold">Couldn&rsquo;t load your profile</h2>
        <p className="max-w-sm text-xs text-muted-foreground">{message}</p>
      </div>
      <Button size="sm" onClick={onRetry}>
        <RefreshCw />
        Try again
      </Button>
    </div>
  )
}
