import type { ModuleRoute } from './modules'
import type {
  NotificationModuleKey,
  NotificationTarget,
  StudentNotification,
} from './student-notifications'

/**
 * The web's notification route registry. The server stores only a stable
 * `module` key and a semantic `target`; this is the single place those map to
 * actual TanStack Router destinations. A route rename touches only this file —
 * never the server or the stored notifications.
 *
 * Resolution order (see `resolveNotificationTarget`): specific target → module
 * home → null. A null result means "no screen to open" (the caller surfaces a
 * friendly message rather than navigating).
 */

/** A TanStack-Router navigation target. */
export interface NavTarget {
  to: ModuleRoute
  search?: Record<string, unknown>
}

interface ModuleResolver {
  /** Landing route for the module — the fallback when no specific target resolves. */
  home?: NavTarget
  /** Resolve a specific entity within the module to a deep-link, or null. */
  resolve?: (target: NotificationTarget) => NavTarget | null
}

const REGISTRY: Partial<Record<NotificationModuleKey, ModuleResolver>> = {
  chat: {
    home: { to: '/connect' },
    resolve: (t) => {
      // Web deep-links chat by the *other* student's id (+ name), carried in
      // params; the conversation id (t.id) is what mobile uses instead.
      const otherId = Number(t.params?.otherStudentId)
      if (!Number.isFinite(otherId)) return null
      return {
        to: '/connect',
        search: { to: otherId, name: t.params?.otherName },
      }
    },
  },
  attendance: { home: { to: '/attendance' } },
  'exam-marks': { home: { to: '/exam-marks' } },
  timetable: {
    home: { to: '/timetable' },
    resolve: (t) => {
      // A published-week alert carries the week start (YYYY-MM-DD) so we open
      // the timetable on that exact week.
      const week = t.params?.week
      if (week) return { to: '/timetable', search: { week } }
      return null
    },
  },
  birthdays: { home: { to: '/birthdays' } },
  'id-card': { home: { to: '/id-card' } },
  profile: { home: { to: '/profile' } },
  requests: {
    home: { to: '/my-requests' },
    resolve: (t) => {
      // A decision notification points at the request — open My Requests with
      // that card expanded.
      if (t.type === 'request' && t.id != null) {
        return { to: '/my-requests', search: { open: Number(t.id) } }
      }
      return null
    },
  },
  placements: {
    home: { to: '/placements' },
    resolve: (t) => {
      // An invite opens the Invites tab with that drive's detail; an outcome
      // notification (only ever sent for Selected) lands on My Offers; a
      // revoke lands on the Drives tab.
      if (t.type === 'drive-invite' && t.id != null) {
        return {
          to: '/placements',
          search: { tab: 'invites', drive: Number(t.id) },
        }
      }
      if (t.type === 'drive-outcome' && t.id != null) {
        return {
          to: '/placements',
          search: { tab: 'offers', drive: Number(t.id) },
        }
      }
      if (t.type === 'drive-revoked' && t.id != null) {
        return {
          to: '/placements',
          search: { tab: 'drives', drive: Number(t.id) },
        }
      }
      return null
    },
  },
  // 'announcements' and 'fees' intentionally absent — no live page yet (fees
  // is disabled / coming soon), so they resolve to null ("no screen to open")
  // until the modules ship.
}

/**
 * Resolve a notification to a navigation target, or null if nothing can open it.
 * Tries the specific entity first, then the module's home screen.
 */
export function resolveNotificationTarget(
  n: Pick<StudentNotification, 'module' | 'target'>,
): NavTarget | null {
  const entry = REGISTRY[n.module]
  if (!entry) return null
  if (n.target && entry.resolve) {
    const specific = entry.resolve(n.target)
    if (specific) return specific
  }
  return entry.home ?? null
}
