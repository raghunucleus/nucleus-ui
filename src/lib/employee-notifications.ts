import { apiFetch } from './api'
import { withEmployeeAuth } from './employee-auth'

/**
 * Employee notifications API — mirrors nucleus-server's
 * `/employee/notifications/*` routes and pairs with the realtime socket in
 * `employee-notification-socket.ts`. Every call is scoped to the signed-in
 * employee server-side (id from the JWT); nothing here takes an employee id.
 *
 * The same backend the employee mobile app uses.
 */

// --- types (mirror the server DTOs / contract) -----------------------------

/** Stable module keys — mirror of the server's EmployeeNotificationModuleKey. */
export type EmployeeNotificationModuleKey =
  | 'requests'
  | 'attendance'
  | 'timetable'
  | 'exam-marks'
  | 'birthdays'
  | 'id-card'
  | 'profile'
  | 'corporate-relations'
  | 'announcements'
  | 'exports'

/** Route-independent pointer to the entity a notification is about. */
export interface NotificationTarget {
  type: string
  id?: string | number
  params?: Record<string, string>
}

export interface EmployeeNotification {
  id: number
  module: EmployeeNotificationModuleKey
  type: string
  title: string
  body: string
  target: NotificationTarget | null
  read_at: string | null
  created_at: string
}

export interface EmployeeNotificationsPage {
  items: EmployeeNotification[]
  has_more: boolean
  unread: number
}

/**
 * One module's delivery switches. In-app is absent by design — it is the list
 * itself and can't be turned off.
 */
export interface EmployeeNotificationPreference {
  module: EmployeeNotificationModuleKey
  label: string
  email_enabled: boolean
  push_enabled: boolean
}

// --- calls -----------------------------------------------------------------

export function fetchNotifications(
  opts: { before?: number; limit?: number; unread?: boolean } = {},
): Promise<EmployeeNotificationsPage> {
  const qs = new URLSearchParams()
  if (opts.before != null) qs.set('before', String(opts.before))
  if (opts.limit != null) qs.set('limit', String(opts.limit))
  if (opts.unread) qs.set('unread', 'true')
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  return withEmployeeAuth((token) =>
    apiFetch<EmployeeNotificationsPage>(`/employee/notifications${suffix}`, {
      token,
    }),
  )
}

export function fetchNotificationUnreadCount(): Promise<{ total: number }> {
  return withEmployeeAuth((token) =>
    apiFetch<{ total: number }>('/employee/notifications/unread-count', {
      token,
    }),
  )
}

export function markNotificationRead(id: number): Promise<{ unread: number }> {
  return withEmployeeAuth((token) =>
    apiFetch<{ unread: number }>(`/employee/notifications/${id}/read`, {
      method: 'PATCH',
      token,
    }),
  )
}

export function markAllNotificationsRead(): Promise<{ unread: number }> {
  return withEmployeeAuth((token) =>
    apiFetch<{ unread: number }>('/employee/notifications/read-all', {
      method: 'PATCH',
      token,
    }),
  )
}

/** Every module's effective switches — the server layers overrides on defaults. */
export function fetchNotificationPreferences(): Promise<
  EmployeeNotificationPreference[]
> {
  return withEmployeeAuth((token) =>
    apiFetch<EmployeeNotificationPreference[]>(
      '/employee/notifications/preferences',
      { token },
    ),
  )
}

/** Patch one module's switches; an omitted channel keeps its current value. */
export function setNotificationPreference(
  module: EmployeeNotificationModuleKey,
  patch: { email_enabled?: boolean; push_enabled?: boolean },
): Promise<EmployeeNotificationPreference> {
  return withEmployeeAuth((token) =>
    apiFetch<EmployeeNotificationPreference>(
      `/employee/notifications/preferences/${module}`,
      { method: 'PATCH', token, body: patch },
    ),
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
