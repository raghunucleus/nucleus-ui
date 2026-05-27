import {
  NoAccessEmptyState,
  NoScopeEmptyState,
} from '@/components/employee/empty-states'
import {
  SCOPE_ALL,
  scopeIds,
  useScreenAccess,
} from '@/hooks/use-screen-access'

/**
 * Sample employee screen demonstrating the standard rendering contract:
 *   1. `useScreenAccess(key)` returns null when the employee lacks access —
 *      render the no-access empty state.
 *   2. `scopeIds(attributes, key)` collapses the merged `AttributeAccess`
 *      into either `'all'` (wildcard, render everything) or `number[]`
 *      (filter to these). An empty array means the attribute is required
 *      but unset — render the no-scope empty state.
 *   3. Real data fetching uses the ids to constrain queries — the
 *      server-side ScreenAccessGuard + PermissionsService helpers enforce
 *      the same scope, so this is a UX shortcut, not the security boundary.
 */
export default function EmployeeTimetablePage() {
  const access = useScreenAccess('academics.timetable.view')

  if (!access) return <NoAccessEmptyState />

  const programmeScope = scopeIds(access.attributes, 'programme_ids')
  if (programmeScope !== SCOPE_ALL && programmeScope.length === 0) {
    return <NoScopeEmptyState attributeLabel="programmes" />
  }

  const scopeDescription =
    programmeScope === SCOPE_ALL
      ? 'all programmes'
      : `programmes ${programmeScope.join(', ')}`

  return (
    <section className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">My timetable</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Scope: {scopeDescription}
        </p>
      </header>

      <div className="rounded-md border bg-card p-6 text-card-foreground shadow-xs">
        <p className="text-sm text-muted-foreground">
          (Timetable rendering would go here. When scope is{' '}
          <code className="font-mono">'all'</code>, skip the programme filter
          entirely; otherwise constrain to{' '}
          <code className="font-mono">{JSON.stringify(programmeScope)}</code>.)
        </p>
      </div>
    </section>
  )
}
