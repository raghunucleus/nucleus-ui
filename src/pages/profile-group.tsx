import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from '@tanstack/react-router'
import {
  ArrowLeft,
  CircleAlert,
  ClipboardList,
  RefreshCw,
  type LucideIcon,
} from 'lucide-react'

import { ProfileGroupContent } from '@/components/profile/profile-group-content'
import { PageHeader } from '@/components/portal-layout'
import { Button } from '@/components/ui/button'
import { ApiError } from '@/lib/api'
import { groupCounts, profileGroupMeta } from '@/lib/profile-groups'
import {
  fetchFullProfile,
  type StudentFullProfile,
} from '@/lib/student-profile'
import { useAuthStore } from '@/stores/auth-store'

/**
 * One profile group's fields. The Profile page lists the groups as cards and
 * each opens here — the flat page carried ~45 fields at once.
 */
export default function ProfileGroup() {
  const { group: groupKey } = useParams({ strict: false }) as {
    group?: string
  }
  const signOut = useAuthStore((state) => state.signOut)
  const navigate = useNavigate()
  const [profile, setProfile] = useState<StudentFullProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const group = profile?.groups.find((g) => g.key === groupKey)

  useEffect(() => {
    document.title = 'Profile — Nucleus'
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setProfile(await fetchFullProfile())
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

  const meta = profileGroupMeta(groupKey ?? '')
  const counts = group ? groupCounts(group) : null

  // PageHeader is deliberately title-only, so the counts go in the toolbar row.
  const summary =
    group && counts
      ? group.key === 'certifications'
        ? `${profile!.certifications.length} added`
        : counts.required > 0
          ? `${counts.filled} of ${counts.required} required fields filled`
          : `${group.fields.length} field${group.fields.length === 1 ? '' : 's'}`
      : null

  return (
    <>
      <PageHeader
        title={group?.label ?? 'Profile details'}
        icon={meta.icon}
        accent={meta.color}
        backTo="/profile"
        backLabel="Back to profile"
      />
      {/* Most fields aren't directly editable — the profile module raises an
          approval request, reviewed by the batch's profile verifiers and
          tracked on the My Requests screen. */}
      <div className="-mt-2 mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{summary}</p>
        <Button
          size="sm"
          className="ms-auto"
          onClick={() => void navigate({ to: '/profile/request-changes' })}
        >
          <ClipboardList className="size-4" /> Request changes
        </Button>
      </div>

      {loading && !profile ? (
        <GroupSkeleton />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : group && profile ? (
        <section className="rounded-xl border bg-card p-5 text-card-foreground shadow-sm">
          <ProfileGroupContent
            group={group}
            profile={profile}
            onChanged={() => void load()}
          />
        </section>
      ) : (
        // Groups are filtered by entry type server-side (a lateral-entry student
        // has no 12th group, and empty groups are dropped), so a stale link can
        // land on a key this student doesn't have.
        <ErrorState
          title="Section not found"
          message="That section isn’t part of your profile."
          onRetry={() => void navigate({ to: '/profile' })}
          retryLabel="Back to profile"
          retryIcon={ArrowLeft}
        />
      )}
    </>
  )
}

function GroupSkeleton() {
  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-10 animate-pulse rounded bg-muted" />
        ))}
      </div>
    </div>
  )
}

function ErrorState({
  title = "Couldn't load your profile",
  message,
  onRetry,
  retryLabel = 'Try again',
  retryIcon: RetryIcon = RefreshCw,
}: {
  title?: string
  message: string
  onRetry: () => void
  retryLabel?: string
  retryIcon?: LucideIcon
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border bg-card p-10 text-center text-card-foreground">
      <div className="grid size-12 place-items-center rounded-full bg-destructive/10 text-destructive">
        <CircleAlert className="size-6" />
      </div>
      <div className="space-y-1">
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="max-w-sm text-xs text-muted-foreground">{message}</p>
      </div>
      <Button size="sm" onClick={onRetry}>
        <RetryIcon />
        {retryLabel}
      </Button>
    </div>
  )
}
