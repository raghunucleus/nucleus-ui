export type AppVariant = 'employee' | 'parent' | 'member'

// `employee.*` → employee portal, `parent.*` → parent/guardian portal,
// `app.*` → student portal. Each audience gets its own subdomain so sessions
// (and their localStorage namespaces) never overlap. On localhost the leftmost
// label matches nothing, so allow `?app=employee` / `?app=parent` to flip
// variants during local dev. Defaults to the student (member) portal.
export function detectAppVariant(): AppVariant {
  const firstLabel = window.location.hostname.split('.')[0].toLowerCase()
  if (firstLabel === 'employee') return 'employee'
  if (firstLabel === 'parent') return 'parent'
  if (firstLabel === 'app') return 'member'

  const override = new URLSearchParams(window.location.search).get('app')
  if (override === 'employee') return 'employee'
  if (override === 'parent') return 'parent'
  return 'member'
}
