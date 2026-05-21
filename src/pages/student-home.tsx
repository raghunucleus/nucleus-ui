import { useCallback, useEffect, useState } from 'react'
import {
  Award,
  BookOpen,
  CalendarDays,
  CircleAlert,
  ClipboardCheck,
  CreditCard,
  GraduationCap,
  LogOut,
  Mail,
  Megaphone,
  Phone,
  RefreshCw,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/theme-toggle'
import { cn } from '@/lib/utils'
import { ApiError } from '@/lib/api'
import { studentLogout, studentMe, type StudentProfile } from '@/lib/student-auth'
import { withGlobalLoader } from '@/stores/loader-store'

export default function StudentHome({ onSignOut }: { onSignOut: () => void }) {
  const [profile, setProfile] = useState<StudentProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [signingOut, setSigningOut] = useState(false)

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
        onSignOut()
        return
      }
      setError(
        err instanceof Error ? err.message : 'Could not load your dashboard.',
      )
    } finally {
      setLoading(false)
    }
  }, [onSignOut])

  useEffect(() => {
    void load()
  }, [load])

  async function handleSignOut() {
    if (signingOut) return
    setSigningOut(true)
    try {
      await withGlobalLoader(() => studentLogout(), 'Signing out…')
    } finally {
      onSignOut()
    }
  }

  return (
    <div className="min-h-svh bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <div className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground">
              <GraduationCap className="size-5" />
            </div>
            <span className="text-base font-semibold tracking-tight">
              Nucleus
            </span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button
              variant="outline"
              size="sm"
              onClick={handleSignOut}
              disabled={signingOut}
            >
              <LogOut />
              {signingOut ? 'Signing out…' : 'Sign out'}
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
        {loading ? (
          <DashboardSkeleton />
        ) : error ? (
          <ErrorState message={error} onRetry={() => void load()} />
        ) : profile ? (
          <>
            <GreetingHeader name={profile.display_name} />
            <IdentityCard profile={profile} />
            <FeatureGrid />
          </>
        ) : null}
      </main>
    </div>
  )
}

function GreetingHeader({ name }: { name: string }) {
  const hour = new Date().getHours()
  const part =
    hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const firstName = name.trim().split(/\s+/)[0]
  return (
    <div className="space-y-1">
      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-primary">
        <Sparkles className="size-3.5" />
        {part}
      </p>
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        Welcome back, {firstName}
      </h1>
      <p className="text-sm text-muted-foreground">
        Here&rsquo;s your student dashboard.
      </p>
    </div>
  )
}

function IdentityCard({ profile }: { profile: StudentProfile }) {
  const initials = profile.display_name
    .trim()
    .split(/\s+/)
    .map((part) => part[0] ?? '')
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <section className="overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm">
      <div className="flex flex-col gap-4 border-b bg-muted/40 p-5 sm:flex-row sm:items-center">
        <div className="grid size-16 shrink-0 place-items-center rounded-full bg-primary text-xl font-semibold text-primary-foreground">
          {initials || '—'}
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
      <dl className="grid gap-x-8 gap-y-5 p-5 sm:grid-cols-2">
        <InfoRow
          icon={GraduationCap}
          label="Programme"
          value={
            profile.programme
              ? `${profile.programme.name} (${profile.programme.code})`
              : '—'
          }
        />
        <InfoRow
          icon={CalendarDays}
          label="Admission year"
          value={profile.admission_year?.display_year ?? '—'}
        />
        <InfoRow icon={Mail} label="Email" value={profile.email} />
        <InfoRow icon={Phone} label="Mobile" value={profile.mobile_number} />
      </dl>
    </section>
  )
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium',
        active
          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
          : 'bg-red-500/10 text-red-600 dark:text-red-400',
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'size-1.5 rounded-full',
          active ? 'bg-emerald-500' : 'bg-red-500',
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
}: {
  icon: LucideIcon
  label: string
  value: string
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
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

const FEATURES: { icon: LucideIcon; title: string; description: string }[] = [
  {
    icon: CalendarDays,
    title: 'Timetable',
    description: 'Your weekly class schedule.',
  },
  {
    icon: ClipboardCheck,
    title: 'Attendance',
    description: 'Track your attendance percentage.',
  },
  { icon: Award, title: 'Results', description: 'Semester grades and marks.' },
  {
    icon: CreditCard,
    title: 'Fees',
    description: 'Dues, payments and receipts.',
  },
  {
    icon: BookOpen,
    title: 'Library',
    description: 'Borrowed books and due dates.',
  },
  {
    icon: Megaphone,
    title: 'Announcements',
    description: 'Notices from your department.',
  },
]

function FeatureGrid() {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-muted-foreground">
        Quick access
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((feature) => {
          const Icon = feature.icon
          return (
            <div
              key={feature.title}
              className="rounded-xl border bg-card p-4 text-card-foreground shadow-sm"
            >
              <div className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
                <Icon className="size-5" />
              </div>
              <h3 className="mt-3 text-sm font-semibold">{feature.title}</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {feature.description}
              </p>
              <span className="mt-3 inline-block rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Coming soon
              </span>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-3 w-28 animate-pulse rounded bg-muted" />
        <div className="h-8 w-64 animate-pulse rounded bg-muted" />
      </div>
      <div className="h-56 animate-pulse rounded-xl bg-muted" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-32 animate-pulse rounded-xl bg-muted" />
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
      <div className="grid size-12 place-items-center rounded-full bg-red-500/10 text-red-600 dark:text-red-400">
        <CircleAlert className="size-6" />
      </div>
      <div className="space-y-1">
        <h2 className="text-sm font-semibold">Couldn&rsquo;t load your dashboard</h2>
        <p className="max-w-sm text-xs text-muted-foreground">{message}</p>
      </div>
      <Button size="sm" onClick={onRetry}>
        <RefreshCw />
        Try again
      </Button>
    </div>
  )
}
