import { lazyRouteComponent } from '@tanstack/react-router'

import { detectAppVariant, type AppVariant } from '@/lib/subdomain'

/**
 * One subdomain → one audience → one portal, each with its own auth store and
 * localStorage namespace (see lib/subdomain.ts): `employee.*` → employee,
 * `parent.*` → parent/guardian, `student.*` → student. The three sessions never
 * overlap, so there is no cross-audience precedence to juggle here.
 *
 * `app.*` is the odd one out: a signed-out launcher that just points visitors at
 * whichever of the three is theirs. It touches no auth store at all.
 *
 * Each portal is a separate chunk behind `import()`, so a hostname only ever
 * downloads its own audience's code — the login page of one portal never pays
 * for the other two. `lazyRouteComponent` (rather than `React.lazy`) gives us
 * `.preload()` for a flash-free hand-off and an automatic one-shot reload when
 * a chunk from a previous deploy has gone missing.
 */
const PORTALS: Record<AppVariant, ReturnType<typeof lazyRouteComponent>> = {
  employee: lazyRouteComponent(() => import('./employee-portal')),
  parent: lazyRouteComponent(() => import('./parent-portal')),
  hub: lazyRouteComponent(() => import('@/pages/portal-hub')),
  member: lazyRouteComponent(() => import('./student-portal')),
}

/** The portal component for this hostname. `main.tsx` preloads it before mounting. */
export const Portal = PORTALS[detectAppVariant()]
