import { apiFetch } from './api'
import { withAuth } from './student-auth'

/**
 * Student notifications API — mirrors nucleus-server's `/student/notifications/*`
 * routes and pairs with the realtime socket in `notification-socket.ts`. Every
 * call is scoped to the signed-in student server-side (id from the JWT). The
 * same backend the mobile app uses.
 */

// --- types (mirror the server DTOs / contract) -----------------------------

/** Stable module keys — mirror of the server's StudentNotificationModuleKey. */
export type NotificationModuleKey =
  | 'chat'
  | 'attendance'
  | 'exam-marks'
  | 'fees'
  | 'timetable'
  | 'birthdays'
  | 'id-card'
  | 'profile'
  | 'requests'
  | 'announcements'
  | 'placements'

/** Route-independent pointer to the entity a notification is about. */
export interface NotificationTarget {
  type: string
  id?: string | number
  params?: Record<string, string>
}

export interface StudentNotification {
  id: number
  module: NotificationModuleKey
  type: string
  title: string
  body: string
  target: NotificationTarget | null
  /** ISO timestamp, or null while unread. */
  read_at: string | null
  created_at: string
}

export interface StudentNotificationsPage {
  /** Newest first. */
  items: StudentNotification[]
  has_more: boolean
  unread: number
}

// --- calls -----------------------------------------------------------------

/** A page of notifications (newest first). Pass `before` (oldest id seen) to page back. */
export function fetchNotifications(
  opts: { before?: number; limit?: number; unread?: boolean } = {},
): Promise<StudentNotificationsPage> {
  const qs = new URLSearchParams()
  if (opts.before != null) qs.set('before', String(opts.before))
  if (opts.limit != null) qs.set('limit', String(opts.limit))
  if (opts.unread) qs.set('unread', 'true')
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  return withAuth((token) =>
    apiFetch<StudentNotificationsPage>(`/student/notifications${suffix}`, {
      token,
    }),
  )
}

export function fetchNotificationUnreadCount(): Promise<{ total: number }> {
  return withAuth((token) =>
    apiFetch<{ total: number }>('/student/notifications/unread-count', {
      token,
    }),
  )
}

export function markNotificationRead(id: number): Promise<{ unread: number }> {
  return withAuth((token) =>
    apiFetch<{ unread: number }>(`/student/notifications/${id}/read`, {
      method: 'PATCH',
      token,
    }),
  )
}

export function markAllNotificationsRead(): Promise<{ unread: number }> {
  return withAuth((token) =>
    apiFetch<{ unread: number }>('/student/notifications/read-all', {
      method: 'PATCH',
      token,
    }),
  )
}

// --- formatting helper ------------------------------------------------------

/** "9:30 am" if today, else "12 Jun" — for the notification list timestamp. */
export function formatNotificationTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const now = new Date()
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  return sameDay
    ? d.toLocaleTimeString('en-IN', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
    : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}
