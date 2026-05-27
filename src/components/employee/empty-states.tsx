import { Lock, Sparkles } from 'lucide-react'

/**
 * Rendered when the logged-in employee has no role assignment that grants the
 * current screen — i.e. they navigated to a URL they don't have access to.
 */
export function NoAccessEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-md border border-dashed bg-muted/20 px-6 py-12 text-center">
      <div className="mb-3 grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
        <Lock className="size-5" />
      </div>
      <h3 className="text-sm font-medium">No access</h3>
      <p className="mt-1 max-w-sm text-xs text-muted-foreground">
        You don&rsquo;t have access to this screen. If you think this is a
        mistake, contact an administrator to update your roles.
      </p>
    </div>
  )
}

/**
 * Rendered when the employee has the screen but no attribute values supplied
 * on the assignment for it — e.g. an HOD screen with no department_id set. The
 * screen renders blank by design (per the RBAC spec).
 */
export function NoScopeEmptyState({
  attributeLabel = 'data scope',
}: {
  attributeLabel?: string
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-md border border-dashed bg-muted/20 px-6 py-12 text-center">
      <div className="mb-3 grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
        <Sparkles className="size-5" />
      </div>
      <h3 className="text-sm font-medium">Nothing to show</h3>
      <p className="mt-1 max-w-sm text-xs text-muted-foreground">
        Your assignment for this screen has no {attributeLabel} configured yet.
        Once an administrator fills it in, the screen will load.
      </p>
    </div>
  )
}
