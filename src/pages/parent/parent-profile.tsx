import { useEffect, useState } from 'react'
import { LogOut, Phone, Users, UserRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'

import { DevicesList, type DevicesListStrings } from '@/components/devices-list'
import { PageHeader } from '@/components/portal-layout'
import { Button } from '@/components/ui/button'
import {
  clearParentTokens,
  parentListSessions,
  parentLogout,
  parentRevokeSession,
  type LinkedStudent,
} from '@/lib/parent-auth'
import { formatRelativeTime } from '@/lib/sessions'
import { cn } from '@/lib/utils'
import { useParentAuthStore } from '@/stores/parent-auth-store'
import { withGlobalLoader } from '@/stores/loader-store'

function initials(source: string): string {
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

export default function ParentProfile() {
  const { t } = useTranslation()
  const guardian = useParentAuthStore((s) => s.guardian)
  const students = useParentAuthStore((s) => s.students)
  const selectedStudentId = useParentAuthStore((s) => s.selectedStudentId)
  const switchChild = useParentAuthStore((s) => s.switchChild)
  const signOut = useParentAuthStore((s) => s.signOut)
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => {
    document.title = 'Profile — Nucleus'
  }, [])

  const child =
    students.find((s) => s.id === selectedStudentId) ?? students[0] ?? null
  const canSwitch = students.length > 1

  async function handleSignOut() {
    if (signingOut) return
    setSigningOut(true)
    try {
      await withGlobalLoader(() => parentLogout(), 'Signing out…')
    } finally {
      signOut()
    }
  }

  return (
    <>
      <PageHeader
        title={t('nav.profile')}
        icon={UserRound}
        accent="violet"
      />

      <section className="overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm">
        <div className="flex flex-col gap-4 border-b bg-gradient-to-br from-primary/8 to-secondary/8 p-5 sm:flex-row sm:items-center">
          <div className="brand-gradient grid size-16 shrink-0 place-items-center rounded-full text-xl font-semibold shadow-md shadow-primary/30">
            {initials(guardian?.display_name || 'Parent')}
          </div>
          <div className="min-w-0 space-y-1.5">
            <h2 className="truncate text-lg font-semibold">
              {guardian?.display_name ?? 'Parent'}
            </h2>
            {guardian?.mobile_number && (
              <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                <Phone className="size-3.5" />
                {guardian.mobile_number}
              </p>
            )}
          </div>
        </div>

        <div className="space-y-5 p-5">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t('profile.viewingStudent')}
              </h3>
              {canSwitch && (
                <Button variant="outline" size="sm" onClick={switchChild}>
                  <Users className="size-4" />
                  {t('account.switchStudent')}
                </Button>
              )}
            </div>
            {child ? (
              <ChildRow student={child} />
            ) : (
              <p className="text-sm text-muted-foreground">
                {t('profile.noStudent')}
              </p>
            )}
          </div>

          {students.length > 1 && (
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t('profile.allLinked')}
              </h3>
              <div className="grid gap-2 sm:grid-cols-2">
                {students.map((s) => (
                  <ChildRow
                    key={s.id}
                    student={s}
                    active={s.id === child?.id}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="border-t pt-5">
            <Button
              variant="outline"
              disabled={signingOut}
              onClick={() => void handleSignOut()}
            >
              <LogOut className="size-4" />
              {signingOut ? t('common.signingOut') : t('common.signOut')}
            </Button>
          </div>
        </div>
      </section>

      <SignedInDevices />
    </>
  )
}

/** DevicesList copy, translated — the shared component never calls t. */
function devicesStringsT(t: TFunction, lang: string): DevicesListStrings {
  const when = (iso: string) => formatRelativeTime(iso, lang)
  return {
    thisDevice: t('devices.thisDevice'),
    lastActive: (iso) => t('devices.lastActive', { when: when(iso) }),
    signedIn: (iso) => t('devices.signedIn', { when: when(iso) }),
    signOut: t('common.signOut'),
    signingOut: t('common.signingOut'),
    cancel: t('common.cancel'),
    empty: t('devices.empty'),
    loadError: t('devices.loadError'),
    retry: t('common.tryAgain'),
    confirmTitle: (s) =>
      s.current
        ? t('devices.confirmTitleCurrent')
        : t('devices.confirmTitleOther', { name: s.device_name }),
    confirmDescription: (s) =>
      s.current ? t('devices.confirmDescCurrent') : t('devices.confirmDescOther'),
    signedOutToast: (s) => t('devices.signedOutToast', { name: s.device_name }),
    alreadySignedOut: t('devices.alreadySignedOut'),
    revokeError: t('devices.revokeError'),
  }
}

/**
 * Every device this guardian is signed in on, with a per-device sign-out.
 * Signing out this device ends the session here too — back to the login.
 */
function SignedInDevices() {
  const { t, i18n } = useTranslation()
  const signOut = useParentAuthStore((s) => s.signOut)

  function onCurrentRevoked() {
    // The store's signOut only drops the gate; the tokens are dead
    // server-side already, so clear them here (parentLogout would too).
    clearParentTokens()
    signOut()
  }

  return (
    <section className="space-y-4 rounded-xl border bg-card p-5 text-card-foreground shadow-sm">
      <header className="space-y-1">
        <h2 className="text-base font-semibold">{t('devices.title')}</h2>
        <p className="text-sm text-muted-foreground">{t('devices.subtitle')}</p>
      </header>
      <DevicesList
        load={parentListSessions}
        revoke={parentRevokeSession}
        onCurrentRevoked={onCurrentRevoked}
        strings={devicesStringsT(t, i18n.language)}
      />
    </section>
  )
}

function ChildRow({
  student,
  active,
}: {
  student: LinkedStudent
  active?: boolean
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-xl border p-3',
        active ? 'border-primary/40 bg-primary/5' : 'bg-card',
      )}
    >
      <div className="brand-gradient grid size-10 shrink-0 place-items-center rounded-lg text-sm font-semibold">
        {initials(student.display_name)}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{student.display_name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {student.student_id}
          {student.programme ? ` · ${student.programme.name}` : ''}
        </p>
      </div>
      {student.relationship && (
        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium capitalize text-muted-foreground">
          {student.relationship}
        </span>
      )}
    </div>
  )
}
