import { useNavigate, useSearch } from '@tanstack/react-router'
import {
  KeyRound,
  Lock,
  MonitorSmartphone,
  Palette,
  Settings,
  SunMoon,
} from 'lucide-react'
import { useEffect } from 'react'

import { DevicesList } from '@/components/devices-list'
import { PageHeader } from '@/components/portal-layout'
import { ChangePasswordPanel } from '@/components/settings/change-password-panel'
import { DisplayPanel } from '@/components/settings/display-panel'
import { PrivacyPanel } from '@/components/settings/privacy-panel'
import { ThemePanel } from '@/components/settings/theme-panel'
import { TabsBar, type TabDef } from '@/components/ui/tabs-bar'
import { studentListSessions, studentRevokeSession } from '@/lib/student-auth'
import {
  DEFAULT_SETTINGS_TAB,
  isSettingsTab,
  type SettingsTab,
} from '@/lib/student-settings'
import { useAuthStore } from '@/stores/auth-store'

// Keys must match SETTINGS_TABS (src/lib/student-settings.ts), which is what
// the router accepts in `?tab=`.
const TABS: readonly TabDef[] = [
  { key: 'privacy', label: 'Privacy', icon: Lock },
  { key: 'display', label: 'Display', icon: SunMoon },
  { key: 'theme', label: 'Theme', icon: Palette },
  { key: 'password', label: 'Change password', icon: KeyRound },
  { key: 'devices', label: 'Devices', icon: MonitorSmartphone },
]

/**
 * Account → Settings: everything from the account menu except the profile
 * itself, as tabs of one page. The active tab lives in `?tab=` so each section
 * is linkable and survives a reload.
 */
export default function SettingsPage() {
  const search = useSearch({ strict: false }) as { tab?: SettingsTab }
  const navigate = useNavigate()
  const tab: SettingsTab = search.tab ?? DEFAULT_SETTINGS_TAB

  useEffect(() => {
    document.title = 'Settings — Nucleus'
  }, [])

  function setTab(next: string) {
    if (!isSettingsTab(next) || next === tab) return
    void navigate({ to: '/settings', search: { tab: next } })
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Settings"
        icon={Settings}
        accent="violet"
        tabs={
          <TabsBar
            tabs={TABS}
            value={tab}
            onChange={setTab}
            className="border-b-0"
            aria-label="Settings sections"
          />
        }
      />

      {tab === 'privacy' && <PrivacyPanel />}
      {tab === 'display' && <DisplayPanel />}
      {tab === 'theme' && <ThemePanel />}
      {tab === 'password' && <ChangePasswordPanel />}
      {tab === 'devices' && <DevicesPanel />}
    </div>
  )
}

/**
 * Everywhere this student is signed in (at most two devices at a time), with a
 * per-device sign-out. Signing out this device is a logout.
 */
function DevicesPanel() {
  const signOut = useAuthStore((state) => state.signOut)

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Everywhere your account is signed in. Sign out any device you
        don&apos;t recognise — it takes effect immediately.
      </p>

      <DevicesList
        load={studentListSessions}
        revoke={studentRevokeSession}
        onCurrentRevoked={signOut}
      />
    </div>
  )
}
