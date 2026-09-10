export type AppVariant = 'employee' | 'parent' | 'member' | 'hub'

/** The audience portals a hub card can link out to — everything but the hub. */
export type PortalVariant = Exclude<AppVariant, 'hub'>

// `employee.*` → employee portal, `parent.*` → parent/guardian portal,
// `student.*` → student portal, `app.*` → the portal hub (a launcher that shows
// all three logins and sends the visitor to the right one). Each audience gets
// its own subdomain so sessions (and their localStorage namespaces) never
// overlap — that isolation comes from the browser origin, not from the key
// names, so the separate hostnames are a requirement rather than a convenience.
// It is also why the hub links OUT to the portals instead of hosting their
// login forms: a shared origin would collapse the isolation.
//
// NOTE: `app.*` used to be an alias for the student portal. It no longer is.
//
// The two maps below are inverses of each other and are the single source of
// truth for both directions. Keep them together — a label added to one and
// forgotten in the other is exactly how this drifts.
const LABEL_TO_VARIANT: Record<string, AppVariant> = {
  employee: 'employee',
  parent: 'parent',
  student: 'member',
  app: 'hub',
}

const VARIANT_TO_LABEL: Record<PortalVariant, string> = {
  employee: 'employee',
  parent: 'parent',
  member: 'student',
}

// The `app` label is also hard-coded in index.html's inline theme script, which
// has to run before this bundle loads in order to paint the right boot splash.
// If you change it here, change it there too.

/**
 * Which portal this hostname serves.
 *
 * On localhost the leftmost label matches nothing, so `?app=employee|parent|hub`
 * flips variants during local dev. Hostname wins over the query, so the override
 * is inert in production.
 *
 * Anything unrecognised falls through to the student portal. That is the safest
 * default (students are the largest, least-privileged audience) but it does mean
 * a typo'd or unconfigured hostname renders the student portal rather than an
 * error — worth remembering when a new subdomain "mysteriously shows students".
 */
export function detectAppVariant(): AppVariant {
  const firstLabel = window.location.hostname.split('.')[0].toLowerCase()
  const byHostname = LABEL_TO_VARIANT[firstLabel]
  if (byHostname) return byHostname

  const override = new URLSearchParams(window.location.search).get('app')
  if (override === 'employee') return 'employee'
  if (override === 'parent') return 'parent'
  if (override === 'hub') return 'hub'
  if (override === 'member') return 'member'
  return 'member'
}

/**
 * Absolute URL of a portal, derived from the current hostname by swapping the
 * leftmost DNS label (`app.example.in` → `student.example.in`).
 *
 * Derived rather than hard-coded because there is one `dist/` for every
 * hostname (see DEPLOYMENT.md — no build-time variant flag). A literal
 * `https://student.raghuenggcollege.in` would make a staging or preview hub
 * push users into production; build-time env vars would add three more required
 * inputs for a value the hostname already carries.
 *
 * @param keepPath forward the current path/query/hash to the target. Used only
 *   by the student card, so that a bookmark or emailed link left over from when
 *   `app.*` WAS the student portal still lands where it meant to.
 */
export function portalUrl(target: PortalVariant, { keepPath = false } = {}): string {
  const { protocol, hostname, port, pathname, search, hash } = window.location
  const origin = (host: string) => `${protocol}//${host}${port ? `:${port}` : ''}`
  const tail = keepPath ? `${pathname}${search}${hash}` : '/'

  const labels = hostname.split('.')
  // Only swap a label we recognise. A blind swap would turn the apex domain
  // `raghuenggcollege.in` into `student.in`, and `localhost` into `student`.
  const isPortalHost = labels.length >= 2 && labels[0].toLowerCase() in LABEL_TO_VARIANT

  if (!isPortalHost) {
    // localhost, an IP, the apex domain, a preview host: one origin serves every
    // portal, so stay put and use the ?app= override detectAppVariant reads.
    const separator = tail.includes('?') ? '&' : '?'
    return `${origin(hostname)}${tail}${separator}app=${target}`
  }

  labels[0] = VARIANT_TO_LABEL[target]
  return `${origin(labels.join('.'))}${tail}`
}
