import { useCallback, useEffect, useState } from 'react'
import {
  Cake,
  CalendarDays,
  Camera,
  CircleAlert,
  Droplet,
  GraduationCap,
  Mail,
  Phone,
  RefreshCw,
  UserRound,
  VenusAndMars,
  type LucideIcon,
} from 'lucide-react'

import { PhotoLightbox } from '@/components/photo-lightbox'
import { PhotoUploadDialog } from '@/components/photo-upload-dialog'
import { PageHeader } from '@/components/portal-layout'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ApiError } from '@/lib/api'
import { MODULE_SOFT, type ModuleColor } from '@/lib/modules'
import { studentMe, type StudentProfile } from '@/lib/student-auth'
import { useAuthStore } from '@/stores/auth-store'

export default function Profile() {
  const signOut = useAuthStore((state) => state.signOut)
  const [profile, setProfile] = useState<StudentProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    document.title = 'Profile — Nucleus'
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setProfile(await studentMe())
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
      {loading ? (
        <ProfileSkeleton />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : profile ? (
        <IdentityCard
          profile={profile}
          onPhotoChange={(photoUrl) =>
            setProfile((p) => (p ? { ...p, photo_url: photoUrl } : p))
          }
        />
      ) : null}
    </>
  )
}

function IdentityCard({
  profile,
  onPhotoChange,
}: {
  profile: StudentProfile
  onPhotoChange: (photoUrl: string | null) => void
}) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)

  return (
    <section className="overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm">
      <div className="flex flex-col gap-4 border-b bg-gradient-to-br from-primary/8 to-secondary/8 p-5 sm:flex-row sm:items-center">
        <div className="relative size-16 shrink-0 self-start sm:self-auto">
          {profile.photo_url ? (
            <>
              <button
                type="button"
                aria-label="View photo full size"
                onClick={() => setLightboxOpen(true)}
                className="block cursor-zoom-in rounded-full"
              >
                {/* Keyed by URL so a fresh presigned link resets the fallback. */}
                <ProfileAvatar
                  key={profile.photo_url}
                  name={profile.display_name}
                  photoUrl={profile.photo_url}
                />
              </button>
              <PhotoLightbox
                open={lightboxOpen}
                onOpenChange={setLightboxOpen}
                src={profile.photo_url}
                name={profile.display_name}
              />
            </>
          ) : (
            <ProfileAvatar
              key="no-photo"
              name={profile.display_name}
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
            hasPhoto={!!profile.photo_url}
            onUploaded={onPhotoChange}
          />
        </div>
        <div className="min-w-0 space-y-1.5">
          <h2 className="truncate text-lg font-semibold">
            {profile.display_name}
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-primary/10 px-2 py-0.5 font-mono text-xs font-medium text-primary">
              {profile.student_id}
            </span>
            <StatusBadge active={profile.is_active} />
          </div>
        </div>
      </div>

      <div className="space-y-6 p-5">
        <DetailGroup title="Academic">
          <InfoRow
            icon={GraduationCap}
            color="blue"
            label="Programme"
            value={
              profile.programme
                ? `${profile.programme.name} (${profile.programme.code})`
                : '—'
            }
          />
          <InfoRow
            icon={CalendarDays}
            color="amber"
            label="Admission year"
            value={profile.admission_year?.display_year ?? '—'}
          />
        </DetailGroup>

        <DetailGroup title="Personal">
          <InfoRow
            icon={Mail}
            color="cyan"
            label="Email"
            value={profile.email}
          />
          <InfoRow
            icon={Phone}
            color="emerald"
            label="Mobile"
            value={profile.mobile_number}
          />
          <InfoRow
            icon={VenusAndMars}
            color="violet"
            label="Gender"
            value={titleCase(profile.gender)}
          />
          <InfoRow
            icon={Cake}
            color="rose"
            label="Date of birth"
            value={formatDate(profile.dob)}
          />
          <InfoRow
            icon={Droplet}
            color="orange"
            label="Blood group"
            value={profile.blood_group ?? '—'}
          />
        </DetailGroup>
      </div>
    </section>
  )
}

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

function DetailGroup({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">{children}</dl>
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

function InfoRow({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: LucideIcon
  label: string
  value: string
  color: ModuleColor
}) {
  return (
    <div className="flex items-start gap-3">
      <div
        className={cn(
          'mt-0.5 grid size-8 shrink-0 place-items-center rounded-md',
          MODULE_SOFT[color],
        )}
      >
        <Icon className="size-4" />
      </div>
      <div className="min-w-0">
        <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </dt>
        <dd className="mt-0.5 break-words text-sm font-medium">{value}</dd>
      </div>
    </div>
  )
}

/** Capitalises the first letter, lower-cases the rest — for enum-ish values. */
function titleCase(value: string): string {
  if (!value) return '—'
  return value[0].toUpperCase() + value.slice(1).toLowerCase()
}

/** Formats an ISO date (YYYY-MM-DD) without a timezone shift. */
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
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="flex items-center gap-4 border-b bg-muted/40 p-5">
        <div className="size-16 shrink-0 animate-pulse rounded-full bg-muted" />
        <div className="space-y-2">
          <div className="h-5 w-48 animate-pulse rounded bg-muted" />
          <div className="h-4 w-32 animate-pulse rounded bg-muted" />
        </div>
      </div>
      <div className="grid gap-x-8 gap-y-5 p-5 sm:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-10 animate-pulse rounded bg-muted" />
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
