import { useEffect } from 'react'

import { Card, CardContent } from '@/components/ui/card'
import { LAST_DEPLOYED_ON } from '@/config/deployment'

/**
 * Shows when this build was last deployed, and nothing else.
 *
 * Shared by all three portals (student, employee, parent), so it deliberately
 * avoids `PageHeader` — that renders a typed TanStack `<Link>`, and only the
 * student router is registered with the router's type system. A plain heading
 * keeps this one file portal-agnostic.
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
      <h1 className="text-xl font-semibold tracking-tight">Deployment</h1>
      <Card>
        <CardContent className="space-y-1 p-5">
          <p className="text-sm text-muted-foreground">Last deployed on</p>
          <p className="text-base font-medium">{LAST_DEPLOYED_ON}</p>
        </CardContent>
      </Card>
    </div>
  )
}
