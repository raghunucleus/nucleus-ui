import { useEffect } from 'react'
import { MonitorSmartphone } from 'lucide-react'

import { DevicesList } from '@/components/devices-list'
import { PageHeader } from '@/components/portal-layout'
import { studentListSessions, studentRevokeSession } from '@/lib/student-auth'
import { useAuthStore } from '@/stores/auth-store'

/**
 * Account → Devices: everywhere this student is signed in (at most two devices
 * at a time), with a per-device sign-out. Signing out this device is a logout.
 */
export default function DevicesPage() {
  const signOut = useAuthStore((state) => state.signOut)

  useEffect(() => {
    document.title = 'Devices — Nucleus'
  }, [])

  return (
    <div className="space-y-6">
      <PageHeader title="Devices" icon={MonitorSmartphone} accent="blue" />

      <section className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Everywhere your account is signed in. Sign out any device you
          don&apos;t recognise — it takes effect immediately.
        </p>

        <DevicesList
          load={studentListSessions}
          revoke={studentRevokeSession}
          onCurrentRevoked={signOut}
        />
      </section>
    </div>
  )
}
