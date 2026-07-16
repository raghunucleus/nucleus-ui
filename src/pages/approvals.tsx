import { useEffect } from 'react'
import { Stamp } from 'lucide-react'

import { PageHeader } from '@/components/portal-layout'
import { StateView } from '@/components/state-view'

/**
 * Student Approvals — a placeholder shell for now. Nothing is approvable by
 * students yet; the screen exists so future cases (e.g. peer/junior sign-offs)
 * land in a familiar place.
 */
export default function Approvals() {
  useEffect(() => {
    document.title = 'Approvals — Nucleus'
  }, [])

  return (
    <>
      <PageHeader
        title="Approvals"
        subtitle="Requests waiting for your decision"
        icon={Stamp}
        accent="emerald"
      />
      <StateView
        icon={Stamp}
        title="Nothing needs your approval"
        description="When something is sent to you for approval, it will show up here."
      />
    </>
  )
}
