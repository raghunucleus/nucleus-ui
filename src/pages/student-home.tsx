import { useCallback, useEffect, useState } from 'react'
import { CircleAlert, RefreshCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  AttendanceTile,
  BirthdaysTile,
  CgpaTile,
  HolidaysTile,
  MessagesAlert,
  ModulesTile,
} from '@/components/dashboard/dashboard-tiles'
import { TodayHero } from '@/components/dashboard/today-hero'
import { ApiError } from '@/lib/api'
import { studentMe, type StudentProfile } from '@/lib/student-auth'
import { useAuthStore } from '@/stores/auth-store'

export default function StudentHome() {
  const signOut = useAuthStore((state) => state.signOut)
  const [profile, setProfile] = useState<StudentProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    document.title = 'Home — Nucleus'
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
        err instanceof Error ? err.message : 'Could not load your dashboard.',
      )
    } finally {
      setLoading(false)
    }
  }, [signOut])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) return <DashboardSkeleton />
  if (error) return <ErrorState message={error} onRetry={() => void load()} />
  if (!profile) return null

  return (
    <>
      <TodayHero name={profile.display_name} />

      <MessagesAlert />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <AttendanceTile />
        <CgpaTile />
        <HolidaysTile className="col-span-2" />
      </div>

      {/* Modules sets the row height; Birthdays is absolutely positioned (at
          lg) inside its cell so it can't stretch the row — it just fills the
          Modules height and scrolls its list internally when longer. */}
      <div className="grid gap-6 lg:grid-cols-3">
        <ModulesTile className="lg:col-span-2" />
        <div className="relative">
          <BirthdaysTile className="lg:absolute lg:inset-0" />
        </div>
      </div>
    </>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-48 animate-pulse rounded-xl bg-muted" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="h-40 animate-pulse rounded-xl bg-muted" />
        <div className="h-40 animate-pulse rounded-xl bg-muted" />
        <div className="col-span-2 h-40 animate-pulse rounded-xl bg-muted" />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="h-56 animate-pulse rounded-xl bg-muted" />
        </div>
        <div className="space-y-6">
          <div className="h-64 animate-pulse rounded-xl bg-muted" />
          <div className="h-52 animate-pulse rounded-xl bg-muted" />
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
        <h2 className="text-sm font-semibold">
          Couldn&rsquo;t load your dashboard
        </h2>
        <p className="max-w-sm text-xs text-muted-foreground">{message}</p>
      </div>
      <Button size="sm" onClick={onRetry}>
        <RefreshCw />
        Try again
      </Button>
    </div>
  )
}
