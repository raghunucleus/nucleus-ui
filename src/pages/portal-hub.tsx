import { Briefcase, GraduationCap, Users, type LucideIcon } from 'lucide-react'

import { NucleusMark, NucleusWordmark } from '@/components/brand'
import { HubBackdrop } from '@/components/hub/hub-backdrop'
import { LegacySessionNotice } from '@/components/hub/legacy-session-notice'
import { PortalCard } from '@/components/hub/portal-card'
import { useHubChrome } from '@/components/hub/use-hub-chrome'
import { portalUrl, type PortalVariant } from '@/lib/subdomain'

type Portal = {
  role: PortalVariant
  label: string
  title: string
  description: string
  icon: LucideIcon
}

// One line each, and no feature list. A visitor here already knows which of the
// three they are; naming screens they cannot see yet only adds reading, and any
// such list would need policing against what each portal actually ships.
const PORTALS: readonly Portal[] = [
  {
    role: 'member',
    label: 'Students',
    title: 'Student portal',
    description: 'Timetable, attendance, marks and announcements.',
    icon: GraduationCap,
  },
  {
    role: 'employee',
    label: 'Faculty & staff',
    title: 'Employee portal',
    description: 'Classes, attendance marking, marks upload and approvals.',
    icon: Briefcase,
  },
  {
    role: 'parent',
    label: 'Parents & guardians',
    title: 'Parent portal',
    description: "Your child's attendance, timetable and exam results.",
    icon: Users,
  },
]

/**
 * The portal hub (`app.*`) — a signed-out launcher that points each audience at
 * its own portal.
 *
 * It holds no auth state and makes no API calls: sessions are isolated per
 * browser origin, so every card is a plain cross-origin link to a portal that
 * owns its own login (see lib/subdomain.ts). That is the whole design — the hub
 * is a signpost, not a gate.
 *
 * Laid out as two columns rather than a centred hero so the three logins are
 * the first thing on screen. Brand and explanation take the left column, which
 * spends horizontal space the page has to spare instead of vertical space the
 * choices need.
 */
export default function PortalHub() {
  useHubChrome()

  // A password-reset or invite link issued while `app.*` was still the student
  // portal carries its token in the query. Showing a chooser to someone holding
  // a one-time token would strand it, so forward straight to the student portal
  // with the query intact. Cross-origin, so this cannot go through the router.
  const params = new URLSearchParams(window.location.search)
  if (params.has('reset-token') || params.has('invite-token')) {
    window.location.replace(portalUrl('member', { keepPath: true }))
    return null
  }

  return (
    <div className="hub-canvas relative isolate min-h-svh overflow-hidden">
      <HubBackdrop />

      <a
        href="#portals"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-hub-bg-soft focus:px-4 focus:py-2 focus:text-hub-ink focus:ring-2 focus:ring-hub-role-member"
      >
        Skip to portals
      </a>

      <div className="mx-auto grid min-h-svh w-full max-w-6xl items-center gap-10 px-5 py-10 sm:px-8 lg:grid-cols-[minmax(0,23rem)_minmax(0,1fr)] lg:gap-14 lg:py-14">
        <aside className="flex flex-col gap-5 lg:h-full lg:justify-center">
          <div className="flex items-center gap-2.5">
            <NucleusMark size={44} animated />
            <NucleusWordmark height={21} />
          </div>

          {/* The <br> is deliberate: the two halves are a pair, and letting the
              line break fall wherever the column width puts it reads as an
              accident. Sized so "Three front doors." fits the column on one line. */}
          <h1 className="text-balance text-3xl font-semibold leading-[1.1] tracking-tight lg:text-[2.35rem]">
            One campus.
            <br />
            <span className="hub-gradient-text">Three front doors.</span>
          </h1>

          <p className="max-w-sm text-pretty text-sm text-hub-ink-dim sm:text-base">
            Nucleus is the campus platform of Raghu Engineering College — timetables,
            attendance, marks and placements in one place.
          </p>

          <p className="mt-2 hidden text-xs text-hub-ink-faint lg:block">
            &copy; {new Date().getFullYear()} Raghu Engineering College
          </p>
        </aside>

        <main className="flex flex-col gap-4">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-hub-ink-faint">
            Choose your portal
          </p>

          <LegacySessionNotice />

          <ul id="portals" className="grid gap-4">
            {PORTALS.map((portal) => (
              <PortalCard
                key={portal.role}
                {...portal}
                // Only the student card forwards the current path: `app.*` was
                // the student portal, so only its deep links can be stale.
                href={portalUrl(portal.role, { keepPath: portal.role === 'member' })}
              />
            ))}
          </ul>

          <p className="mt-2 text-xs text-hub-ink-faint lg:hidden">
            &copy; {new Date().getFullYear()} Raghu Engineering College
          </p>
        </main>
      </div>
    </div>
  )
}
