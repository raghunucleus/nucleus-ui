export type AppVariant = 'employee' | 'member'

// `employee.*` → employee portal, `app.*` → student/parent portal.
// On localhost the leftmost label matches nothing, so allow `?app=employee`
// to flip variants during local dev. Defaults to the member portal.
export function detectAppVariant(): AppVariant {
  const firstLabel = window.location.hostname.split('.')[0].toLowerCase()
  if (firstLabel === 'employee') return 'employee'
  if (firstLabel === 'app') return 'member'

  const override = new URLSearchParams(window.location.search).get('app')
  if (override === 'employee') return 'employee'
  return 'member'
}
