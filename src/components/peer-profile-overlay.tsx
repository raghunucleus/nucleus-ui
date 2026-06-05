import { useEffect, useState } from 'react'
import {
  Cake,
  Droplet,
  GraduationCap,
  Loader2,
  Lock,
  Mail,
  Phone,
  User,
  X,
  type LucideIcon,
} from 'lucide-react'

import { ApiError } from '@/lib/api'
import { MODULE_SOFT } from '@/lib/modules'
import { avatarColorFor } from '@/lib/student-birthdays'
import { studentPeerProfile, type PeerProfile } from '@/lib/student-peer-profile'
import { cn } from '@/lib/utils'

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? parts[parts.length - 1][0] : ''
  return (first + last).toUpperCase() || '?'
}

function formatBirthday(b: PeerProfile['birthday']): string | null {
  if (!b) return null
  const month = MONTHS[b.month - 1]
  return month ? `${b.day} ${month}` : null
}

function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s
}

function academicLine(p: PeerProfile): string | null {
  const parts: string[] = []
  if (p.programme) parts.push(p.programme.code)
  if (p.semester) parts.push(`Sem ${p.semester.roman_format}`)
  if (p.section) parts.push(`Sec ${p.section.code}`)
  return parts.length ? parts.join(' · ') : null
}

/**
 * Centered modal showing a classmate's limited profile, opened from the chat
 * thread header. Self-contained overlay (no shared Dialog primitive): backdrop
 * dismiss, Esc to close, fetches the profile on mount keyed by `studentId`.
 * `fallbackName` is what we already know from the conversation, so the header
 * avatar/name render instantly while the rest loads.
 */
export function PeerProfileOverlay({
  studentId,
  fallbackName,
  onClose,
  onSessionEnd,
}: {
  studentId: number
  fallbackName: string
  onClose: () => void
  /** Called if the session has expired so the page can sign out. */
  onSessionEnd?: () => void
}) {
  // Mounted fresh per student (the parent keys this on `studentId`), so the
  // initial state below is the per-open reset — no synchronous setState in the
  // fetch effect, which only ever writes from its async callbacks.
  const [profile, setProfile] = useState<PeerProfile | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [photoFailed, setPhotoFailed] = useState(false)

  useEffect(() => {
    let alive = true
    studentPeerProfile(studentId)
      .then((p) => {
        if (alive) setProfile(p)
      })
      .catch((err: unknown) => {
        if (!alive) return
        if (err instanceof ApiError && err.status === 401) {
          onSessionEnd?.()
          return
        }
        setError(
          err instanceof ApiError && err.status === 403
            ? 'You can only view profiles of students in your group.'
            : err instanceof ApiError && err.status === 404
              ? 'This student is no longer available.'
              : "Couldn't load this profile. Please try again.",
        )
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [studentId, onSessionEnd])

  // Esc closes the overlay.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const name = profile?.display_name ?? fallbackName
  const showPhoto = !!profile?.photo_url && !photoFailed

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`${name}'s profile`}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm overflow-hidden rounded-2xl border bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close profile"
          className="absolute right-3 top-3 rounded-full p-1.5 text-muted-foreground hover:bg-muted"
        >
          <X className="size-5" />
        </button>

        {/* Identity header */}
        <div className="flex flex-col items-center px-6 pb-4 pt-8">
          {showPhoto ? (
            <img
              src={profile!.photo_url!}
              alt={name}
              onError={() => setPhotoFailed(true)}
              className="size-28 rounded-full object-cover"
            />
          ) : (
            <div
              className={cn(
                'grid size-28 place-items-center rounded-full text-3xl font-semibold',
                MODULE_SOFT[avatarColorFor(name)],
              )}
            >
              {initials(name)}
            </div>
          )}

          <h2 className="mt-4 text-center text-lg font-semibold">{name}</h2>
          {profile?.student_id ? (
            <p className="mt-0.5 text-center text-sm text-muted-foreground">
              {profile.student_id}
            </p>
          ) : null}
          {profile && academicLine(profile) ? (
            <span className="mt-2 rounded-full bg-secondary/10 px-3 py-0.5 text-xs font-semibold text-secondary-foreground">
              {academicLine(profile)}
            </span>
          ) : null}
        </div>

        {/* Body */}
        <div className="border-t px-6 py-4">
          {loading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : error || !profile ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              {error ?? "Couldn't load this profile."}
            </p>
          ) : (
            (() => {
              // Keys the owner hid — rendered as locked "Hidden" rows.
              const hidden = new Set(profile.hidden_fields)
              return (
                <div className="flex flex-col gap-1">
                  {profile.programme ? (
                    <InfoRow icon={GraduationCap} label="Programme">
                      <p>{profile.programme.name}</p>
                      {profile.admission_year ? (
                        <p className="text-xs text-muted-foreground">
                          Batch {profile.admission_year.display_year}
                        </p>
                      ) : null}
                    </InfoRow>
                  ) : null}

                  {hidden.has('mobile') ? (
                    <LockedRow icon={Phone} label="Mobile" />
                  ) : profile.mobile_number ? (
                    <ContactRow
                      icon={Phone}
                      label="Mobile"
                      value={profile.mobile_number}
                      href={`tel:${profile.mobile_number}`}
                    />
                  ) : null}

                  {hidden.has('email') ? (
                    <LockedRow icon={Mail} label="Email" />
                  ) : profile.email ? (
                    <ContactRow
                      icon={Mail}
                      label="Email"
                      value={profile.email}
                      href={`mailto:${profile.email}`}
                    />
                  ) : null}

                  {hidden.has('birthday') ? (
                    <LockedRow icon={Cake} label="Birthday" />
                  ) : formatBirthday(profile.birthday) ? (
                    <InfoRow icon={Cake} label="Birthday">
                      <p>{formatBirthday(profile.birthday)}</p>
                    </InfoRow>
                  ) : null}

                  {hidden.has('blood_group') ? (
                    <LockedRow icon={Droplet} label="Blood group" />
                  ) : profile.blood_group ? (
                    <InfoRow icon={Droplet} label="Blood group">
                      <p>{profile.blood_group}</p>
                    </InfoRow>
                  ) : null}

                  {hidden.has('gender') ? (
                    <LockedRow icon={User} label="Gender" />
                  ) : profile.gender ? (
                    <InfoRow icon={User} label="Gender">
                      <p>{capitalize(profile.gender)}</p>
                    </InfoRow>
                  ) : null}
                </div>
              )
            })()
          )}
        </div>
      </div>
    </div>
  )
}

/** A row for a field the owner has hidden from peers. */
function LockedRow({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <div className="flex items-start gap-3 py-2">
      <Icon className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1 text-sm">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="flex items-center gap-1 text-muted-foreground">
          <Lock className="size-3" />
          Hidden
        </p>
      </div>
    </div>
  )
}

function InfoRow({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-3 py-2">
      <Icon className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1 text-sm">
        <p className="text-xs text-muted-foreground">{label}</p>
        {children}
      </div>
    </div>
  )
}

function ContactRow({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: LucideIcon
  label: string
  value: string
  href: string
}) {
  return (
    <a
      href={href}
      className="flex items-start gap-3 rounded-lg py-2 transition-colors hover:bg-muted/60"
    >
      <Icon className="mt-0.5 size-5 shrink-0 text-primary" />
      <div className="min-w-0 flex-1 text-sm">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate text-primary">{value}</p>
      </div>
    </a>
  )
}
