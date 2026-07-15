import type { LucideIcon } from 'lucide-react'
import { Hammer } from 'lucide-react'

/**
 * Placeholder page body for employee screens that are wired into the RBAC
 * catalog and router but whose real UI hasn't been built yet. Renders the
 * standard page header (icon chip + title + subtitle) followed by a centered
 * dashed-border "coming soon" card — mirroring the look of
 * `empty-states.tsx` so placeholders sit naturally in the portal.
 */
export default function ComingSoon({
  title,
  subtitle,
  icon: Icon,
}: {
  title: string
  subtitle: string
  icon: LucideIcon
}) {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-start gap-3">
        <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-icon-orange/12 text-icon-orange">
          <Icon className="size-5" />
        </div>
        <div className="min-w-0">
          <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
      </div>

      <div className="flex flex-col items-center justify-center rounded-md border border-dashed bg-muted/20 px-6 py-14 text-center">
        <div className="mb-3 grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
          <Hammer className="size-5" />
        </div>
        <h3 className="text-sm font-medium">Coming soon</h3>
        <p className="mt-1 max-w-sm text-xs text-muted-foreground">
          This screen is under construction and will be available shortly.
        </p>
      </div>
    </div>
  )
}
