import { useEffect } from 'react'

import { Card, CardContent } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/page-header'
import { LAST_DEPLOYED_ON } from '@/config/deployment'

/**
 * Shows when this build was last deployed, and nothing else.
 *
 * Shared by all three portals (student, employee, parent), so it uses the
 * shared `ui/page-header` (no router link) rather than the student shell's
 * `PageHeader` wrapper, whose typed TanStack `<Link>` is only registered with
 * the student router. That keeps this one file portal-agnostic.
 *
 * The value is free text from `@/config/deployment` and is printed verbatim:
 * never parsed, reformatted, or turned into a relative age.
 */
export default function Deployment() {
  useEffect(() => {
    document.title = 'Deployment — Nucleus'
  }, [])

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader title="Deployment" />
      <Card>
        <CardContent className="space-y-1 p-4">
          <p className="text-sm text-muted-foreground">Last deployed on</p>
          <p className="text-base font-medium">{LAST_DEPLOYED_ON}</p>
        </CardContent>
      </Card>
    </div>
  )
}
