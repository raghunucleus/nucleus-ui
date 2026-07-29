import type {
  EmployeeNotification,
  EmployeeNotificationModuleKey,
  NotificationTarget,
} from './employee-notifications'

/**
 * The employee portal's notification route registry. The server stores only a
 * stable `module` key and a semantic `target`; this is the single place those
 * map to actual employee-portal routes. A route rename touches only this file —
 * never the server or the stored notifications.
 *
 * Resolution order (see `resolveEmployeeNotificationTarget`): specific target →
 * module home → null. A null result means "no screen to open" (the caller
 * surfaces a friendly message rather than navigating).
 */

/**
 * Routes the employee portal can open from a notification. Declared here rather
 * than imported: the student registry types `to` against the student
 * `ModuleRoute` union, and the employee portal's routes are a different set
 * entirely (see employee-router.tsx). Every value must string-equal a path
 * declared there.
 */
export type EmployeeNotificationRoute =
  | '/requests/approvals'
  | '/requests/mine'
  | '/attendance/mark'
  | '/attendance/history'
  | '/timetable'
  | '/marks/view'
  | '/birthdays'
  | '/id-card'
  | '/profile'
  | '/corporate-relations/company-management'
  | '/exports'

/** A TanStack-Router navigation target. */
export interface NavTarget {
  to: EmployeeNotificationRoute
  search?: Record<string, unknown>
}

interface ModuleResolver {
  /** Landing route for the module — the fallback when no specific target resolves. */
  home?: NavTarget
  /** Resolve a specific entity within the module to a deep-link, or null. */
  resolve?: (target: NotificationTarget) => NavTarget | null
}

const REGISTRY: Partial<Record<EmployeeNotificationModuleKey, ModuleResolver>> =
  {
    requests: {
      home: { to: '/requests/approvals' },
      resolve: (t) => {
        // "Needs your review" points at the request — open Approvals with that
        // one already selected (the page reads ?open= on mount).
        if (t.type === 'request' && t.id != null) {
          return { to: '/requests/approvals', search: { open: Number(t.id) } }
        }
        // A decision on YOUR OWN request. Deliberately a different target from
        // 'request': the raiser usually isn't an approver, so sending them to
        // the Approvals inbox would 404 the fetch on arrival.
        if (t.type === 'my-request' && t.id != null) {
          return { to: '/requests/mine', search: { open: Number(t.id) } }
        }
        return null
      },
    },
    attendance: { home: { to: '/attendance/mark' } },
    timetable: { home: { to: '/timetable' } },
    'exam-marks': { home: { to: '/marks/view' } },
    birthdays: { home: { to: '/birthdays' } },
    'id-card': { home: { to: '/id-card' } },
    profile: { home: { to: '/profile' } },
    'corporate-relations': {
      home: { to: '/corporate-relations/company-management' },
    },
    exports: {
      home: { to: '/exports' },
      resolve: (t) => {
        // "Export ready/failed" points at the job — open My exports with that
        // row highlighted (the page reads ?open= on mount).
        if (t.type === 'export' && t.id != null) {
          return { to: '/exports', search: { open: Number(t.id) } }
        }
        return null
      },
    },
    // 'announcements' intentionally absent — no page yet, so it resolves to
    // null ("no screen to open") until the module ships.
  }

/**
 * Resolve a notification to a navigation target, or null if nothing can open it.
 * Tries the specific entity first, then the module's home screen.
 */
export function resolveEmployeeNotificationTarget(
  n: Pick<EmployeeNotification, 'module' | 'target'>,
): NavTarget | null {
  const entry = REGISTRY[n.module]
  if (!entry) return null
  if (n.target && entry.resolve) {
    const specific = entry.resolve(n.target)
    if (specific) return specific
  }
  return entry.home ?? null
}
