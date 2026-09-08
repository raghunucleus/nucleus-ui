export type AppVariant = 'employee' | 'parent' | 'member'

// `employee.*` → employee portal, `parent.*` → parent/guardian portal,
// `student.*` (or `app.*`) → student portal. Each audience gets its own
// subdomain so sessions (and their localStorage namespaces) never overlap —
// that isolation comes from the browser origin, not from the key names, so the
// separate hostnames are a requirement rather than a convenience.
//
// On localhost the leftmost label matches nothing, so allow
// `?app=employee` / `?app=parent` to flip variants during local dev.
//
// Anything unrecognised falls through to the student portal. That is the safest
// default (students are the largest, least-privileged audience) but it does mean
// a typo'd or unconfigured hostname renders the student portal rather than an
// error — worth remembering when a new subdomain "mysteriously shows students".
export function detectAppVariant(): AppVariant {
  const firstLabel = window.location.hostname.split('.')[0].toLowerCase()
  if (firstLabel === 'employee') return 'employee'
  if (firstLabel === 'parent') return 'parent'
  if (firstLabel === 'student' || firstLabel === 'app') return 'member'

  const override = new URLSearchParams(window.location.search).get('app')
  if (override === 'employee') return 'employee'
  if (override === 'parent') return 'parent'
  return 'member'
}
