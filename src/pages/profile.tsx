import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import {
  Camera,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  ClipboardList,
  Hourglass,
  RefreshCw,
  UserRound,
} from 'lucide-react'

import { PhotoLightbox } from '@/components/photo-lightbox'
import { PhotoUploadDialog } from '@/components/photo-upload-dialog'
import { PageHeader } from '@/components/portal-layout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { ApiError } from '@/lib/api'
import { MODULE_SOFT } from '@/lib/modules'
import { groupCounts, profileGroupMeta } from '@/lib/profile-groups'
import {
  fetchFullProfile,
  type ProfileGroupView,
  type StudentFullProfile,
} from '@/lib/student-profile'
import { PROFILE_FIELD_LABELS } from '@/lib/student-requests'
import { studentMe, type StudentProfile } from '@/lib/student-auth'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'

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
          {/* ~45 fields across a dozen groups is one unreadable scroll, so each
              group opens its own page and this is just the index. */}
          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Profile details
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {profile.groups.map((group) => (
                <GroupLinkCard
                  key={group.key}
                  group={group}
                  certificationCount={profile.certifications.length}
                />
              ))}
            </div>
          </section>
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

// --- group index ------------------------------------------------------------------

/**
 * One group as a card on the hub. Counts are derived client-side from the
 * fields the server already sent (`completeness` is global, not per group).
 */
function GroupLinkCard({
  group,
  certificationCount,
}: {
  group: ProfileGroupView
  certificationCount: number
}) {
  const meta = profileGroupMeta(group.key)
  const { required, filled, pending } = groupCounts(group)
  const isCerts = group.key === 'certifications'
  const incomplete = !isCerts && required > 0 && filled < required

  return (
    <Link
      to="/profile/$group"
      params={{ group: group.key }}
      className="group flex items-center gap-3 rounded-xl border bg-card p-4 text-card-foreground shadow-sm transition-colors hover:bg-muted/40"
    >
      <span
        className={cn(
          'grid size-9 shrink-0 place-items-center rounded-lg',
          MODULE_SOFT[meta.color],
        )}
      >
        <meta.icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{group.label}</span>
        <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
          {isCerts ? (
            certificationCount > 0 ? (
              `${certificationCount} certification${certificationCount === 1 ? '' : 's'} added`
            ) : (
              'None added yet'
            )
          ) : pending ? (
            <span className="inline-flex items-center gap-1 font-medium text-warning">
              <Hourglass className="size-3" /> Change awaiting approval
            </span>
          ) : incomplete ? (
            <span className="font-medium text-warning">
              {required - filled} required field
              {required - filled === 1 ? '' : 's'} missing
            </span>
          ) : required > 0 ? (
            'Up to date'
          ) : (
            `${group.fields.length} field${group.fields.length === 1 ? '' : 's'}`
          )}
        </span>
      </span>
      {!isCerts && required > 0 && (
        <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
          {filled}/{required}
        </span>
      )}
      <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
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
      <div className="rounded-xl border bg-card p-4">
        <div className="h-3 w-40 animate-pulse rounded bg-muted" />
        <div className="mt-3 h-2 w-full animate-pulse rounded bg-muted" />
      </div>
      {/* Shaped like the group cards below the completeness bar. */}
      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-xl border bg-card p-4"
          >
            <div className="size-9 shrink-0 animate-pulse rounded-lg bg-muted" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="h-3 w-2/5 animate-pulse rounded bg-muted" />
              <div className="h-2.5 w-3/5 animate-pulse rounded bg-muted" />
            </div>
          </div>
        ))}
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
