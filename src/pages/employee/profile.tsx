import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useSearch } from '@tanstack/react-router'
import {
  Bell,
  ChevronRight,
  KeyRound,
  type LucideIcon,
  MonitorSmartphone,
  Palette,
  User,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import { DevicesList } from '@/components/devices-list'
import { ThemePanel } from '@/components/settings/theme-panel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { ApiError } from '@/lib/api'
import {
  employeeChangePassword,
  employeeListSessions,
  employeeMe,
  employeeRevokeSession,
  getEmployeeAccessToken,
  storeEmployeeTokens,
  type EmployeeProfile,
} from '@/lib/employee-auth'
import {
  fetchNotificationPreferences,
  setNotificationPreference,
  type EmployeeNotificationModuleKey,
  type EmployeeNotificationPreference,
} from '@/lib/employee-notifications'
import { cn } from '@/lib/utils'
import { useEmployeeAuthStore } from '@/stores/employee-auth-store'

// Every member must also be accepted by `validateSearch` on the /profile route
// in employee-router.tsx — anything it doesn't recognise silently falls back to
// 'profile'.
export type EmployeeProfileSection =
  | 'profile'
  | 'theme'
  | 'password'
  | 'notifications'
  | 'devices'

type NavItem = {
  key: EmployeeProfileSection
  label: string
  description: string
  icon: LucideIcon
}

const navItems: NavItem[] = [
  {
    key: 'profile',
    label: 'Profile',
    description: 'Your account details',
    icon: User,
  },
  {
    key: 'theme',
    label: 'Theme',
    description: 'Colour accent for the portal',
    icon: Palette,
  },
  {
    key: 'password',
    label: 'Change password',
    description: 'Update your password',
    icon: KeyRound,
  },
  {
    key: 'notifications',
    label: 'Notifications',
    description: 'Choose how each module reaches you',
    icon: Bell,
  },
  {
    key: 'devices',
    label: 'Devices',
    description: 'Where your account is signed in',
    icon: MonitorSmartphone,
  },
]

export default function EmployeeProfilePage() {
  const search = useSearch({ strict: false }) as {
    section?: EmployeeProfileSection
  }
  const section: EmployeeProfileSection = search.section ?? 'profile'
  const active = navItems.find((n) => n.key === section) ?? navItems[0]

  return (
    <div className="mx-auto max-w-5xl space-y-4 py-2">
      <div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <User className="size-4" /> Account
        </div>
        <h1 className="mt-2 text-xl font-semibold tracking-tight">Profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your account and security preferences.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
        <SideNav activeKey={section} />
        <div className="min-w-0 rounded-lg border bg-card p-6 text-card-foreground">
          <header className="mb-5 flex items-start gap-3">
            <div className="grid size-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
              <active.icon className="size-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold">{active.label}</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {active.description}
              </p>
            </div>
          </header>

          {section === 'profile' && <ProfileDetails />}
          {section === 'theme' && <ThemePanel />}
          {section === 'password' && <ChangePasswordForm />}
          {section === 'notifications' && <NotificationPreferences />}
          {section === 'devices' && <SignedInDevices />}
        </div>
      </div>
    </div>
  )
}

// --- Devices section --------------------------------------------------------

/**
 * Every device this employee is signed in on (two by default; an admin can
 * raise it per person), with a per-device sign-out. Signing out this device
 * is a logout — straight back to the login screen.
 */
function SignedInDevices() {
  const signOut = useEmployeeAuthStore((s) => s.signOut)
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Sign out any device you don&apos;t recognise — it takes effect
        immediately.
      </p>
      <DevicesList
        load={employeeListSessions}
        revoke={employeeRevokeSession}
        onCurrentRevoked={signOut}
      />
    </div>
  )
}

function SideNav({ activeKey }: { activeKey: EmployeeProfileSection }) {
  return (
    <nav className="flex flex-col gap-1 rounded-lg border bg-card p-2 text-card-foreground lg:self-start">
      {navItems.map((item) => {
        const Icon = item.icon
        const isActive = item.key === activeKey
        return (
          <Link
            key={item.key}
            to="/profile"
            search={{ section: item.key }}
            className={cn(
              'group flex items-center gap-3 rounded-md border-l-2 px-3 py-2 text-sm transition-colors',
              isActive
                ? 'border-primary bg-accent text-foreground'
                : 'border-transparent text-muted-foreground hover:bg-accent hover:text-foreground',
            )}
          >
            <Icon className="size-4 shrink-0" />
            <span className="flex-1">
              <span className="block font-medium">{item.label}</span>
              <span className="block text-xs text-muted-foreground">
                {item.description}
              </span>
            </span>
            <ChevronRight
              className={cn(
                'size-4 shrink-0 transition-opacity',
                isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-50',
              )}
            />
          </Link>
        )
      })}
    </nav>
  )
}

// --- Notifications section -------------------------------------------------

/**
 * Per-module delivery switches. In-app is deliberately not listed: it is the
 * bell/notifications page itself and can't be turned off — only email and OS
 * push are mutable, which is exactly what the server stores.
 *
 * The server returns every module with its effective values, so this never
 * needs to know the defaults.
 */
function NotificationPreferences() {
  const [prefs, setPrefs] = useState<EmployeeNotificationPreference[] | null>(
    null,
  )
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState<EmployeeNotificationModuleKey | null>(
    null,
  )

  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const list = await fetchNotificationPreferences()
        if (alive) setPrefs(list)
      } catch (err) {
        if (!alive) return
        setError(
          err instanceof Error
            ? err.message
            : 'Could not load your notification preferences.',
        )
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  async function toggle(
    module: EmployeeNotificationModuleKey,
    patch: { email_enabled?: boolean; push_enabled?: boolean },
  ) {
    // Optimistic: a switch that lags the click feels broken. Snapshot so a
    // failed write rolls back instead of lying about the saved state.
    const previous = prefs
    setPrefs((prev) =>
      prev?.map((p) => (p.module === module ? { ...p, ...patch } : p)) ?? prev,
    )
    setSaving(module)
    try {
      await setNotificationPreference(module, patch)
    } catch {
      setPrefs(previous)
      toast.info('Could not save that change. Try again.')
    } finally {
      setSaving(null)
    }
  }

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>
  }

  if (!prefs) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
        In-app notifications are always on — they are the bell itself. These
        switches control email and push only.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="pb-2 font-medium">Module</th>
              <th className="pb-2 pl-4 font-medium">Email</th>
              <th className="pb-2 pl-4 font-medium">Push</th>
            </tr>
          </thead>
          <tbody>
            {prefs.map((p) => (
              <tr key={p.module} className="border-b last:border-0">
                <td className="py-3 pr-4 font-medium">{p.label}</td>
                <td className="py-3 pl-4">
                  <Switch
                    checked={p.email_enabled}
                    disabled={saving === p.module}
                    onCheckedChange={(email_enabled) =>
                      void toggle(p.module, { email_enabled })
                    }
                    aria-label={`Email notifications for ${p.label}`}
                  />
                </td>
                <td className="py-3 pl-4">
                  <Switch
                    checked={p.push_enabled}
                    disabled={saving === p.module}
                    onCheckedChange={(push_enabled) =>
                      void toggle(p.module, { push_enabled })
                    }
                    aria-label={`Push notifications for ${p.label}`}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// --- Profile section ------------------------------------------------------

function ProfileDetails() {
  const [profile, setProfile] = useState<EmployeeProfile | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const p = await employeeMe()
        if (alive) setProfile(p)
      } catch (err) {
        if (!alive) return
        setError(
          err instanceof Error ? err.message : 'Could not load your profile.',
        )
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  if (error) {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
        {error}
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-9 animate-pulse rounded-md bg-muted/60" />
        ))}
      </div>
    )
  }

  const initials = computeInitials(
    profile.emp_display_name || profile.email || '?',
  )
  const mobile = profile.mobile_number
    ? `+${profile.country_code || '91'} ${profile.mobile_number}`
    : '—'

  return (
    <div>
      <div className="flex items-center gap-4">
        <div className="grid size-12 place-items-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
          {initials}
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">
            {profile.emp_display_name || 'Unknown'}
          </div>
          <div className="truncate text-xs text-muted-foreground">
            {profile.email}
          </div>
        </div>
      </div>

      <dl className="mt-6 grid max-w-2xl grid-cols-1 gap-y-4 sm:grid-cols-2 sm:gap-x-6">
        <DetailRow label="Employee code" value={profile.emp_code} mono />
        <DetailRow label="Display name" value={profile.emp_display_name} />
        <DetailRow label="Email" value={profile.email} />
        <DetailRow label="Mobile" value={mobile} />
        <DetailRow label="Department" value={profile.department?.name ?? '—'} />
        <DetailRow
          label="Designation"
          value={profile.designation?.name ?? '—'}
        />
      </dl>

      <p className="mt-6 text-xs text-muted-foreground">
        These details are managed by your administrator. Contact your campus
        admin to request a correction.
      </p>
    </div>
  )
}

function DetailRow({
  label,
  value,
  mono,
}: {
  label: string
  value: string | number
  mono?: boolean
}) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd
        className={cn(
          'mt-1 truncate text-sm text-foreground',
          mono && 'font-mono',
        )}
      >
        {value || '—'}
      </dd>
    </div>
  )
}

// --- Change password section ----------------------------------------------

const passwordSchema = z
  .object({
    oldPassword: z
      .string()
      .min(1, 'Enter your current password')
      .max(128, 'Too long'),
    newPassword: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(128, 'Too long'),
    confirmPassword: z.string().min(1, 'Confirm your new password'),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })
  .refine((d) => d.oldPassword !== d.newPassword, {
    message: 'New password must differ from the old password',
    path: ['newPassword'],
  })

type PasswordValues = z.infer<typeof passwordSchema>
type Feedback = { kind: 'success' | 'error'; message: string }

function ChangePasswordForm() {
  const [feedback, setFeedback] = useState<Feedback | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { oldPassword: '', newPassword: '', confirmPassword: '' },
  })

  const onSubmit = handleSubmit(async (values) => {
    setFeedback(null)
    const token = getEmployeeAccessToken()
    if (!token) {
      setFeedback({
        kind: 'error',
        message: 'Your session has ended. Please sign in again.',
      })
      return
    }
    try {
      const tokens = await employeeChangePassword(
        token,
        values.oldPassword,
        values.newPassword,
      )
      // Server rotates tokens on a successful password change.
      storeEmployeeTokens(tokens)
      setFeedback({
        kind: 'success',
        message: 'Password updated successfully.',
      })
      reset({ oldPassword: '', newPassword: '', confirmPassword: '' })
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.status === 401
            ? 'Current password is incorrect.'
            : err.message
          : 'Could not change password. Please try again.'
      setFeedback({ kind: 'error', message })
    }
  })

  return (
    <form noValidate onSubmit={onSubmit} className="grid max-w-md gap-4">
      {feedback && (
        <div
          role="status"
          className={
            feedback.kind === 'success'
              ? 'rounded-md border border-success/40 bg-success/10 px-3 py-2 text-sm text-success'
              : 'rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive'
          }
        >
          {feedback.message}
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="oldPassword">Current password</Label>
        <Input
          id="oldPassword"
          type="password"
          autoComplete="current-password"
          aria-invalid={!!errors.oldPassword}
          {...register('oldPassword')}
        />
        {errors.oldPassword && (
          <p className="text-xs text-destructive">
            {errors.oldPassword.message}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="newPassword">New password</Label>
        <Input
          id="newPassword"
          type="password"
          autoComplete="new-password"
          aria-invalid={!!errors.newPassword}
          {...register('newPassword')}
        />
        {errors.newPassword && (
          <p className="text-xs text-destructive">
            {errors.newPassword.message}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="confirmPassword">Confirm new password</Label>
        <Input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          aria-invalid={!!errors.confirmPassword}
          {...register('confirmPassword')}
        />
        {errors.confirmPassword && (
          <p className="text-xs text-destructive">
            {errors.confirmPassword.message}
          </p>
        )}
      </div>

      <div>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Updating…' : 'Update password'}
        </Button>
      </div>
    </form>
  )
}

function computeInitials(source: string): string {
  return (
    source
      .replace(/[^A-Za-z0-9 ]/g, '')
      .split(/\s+/)
      .filter(Boolean)
      .map((p) => p[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?'
  )
}
