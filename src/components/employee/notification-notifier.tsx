import { Bell } from 'lucide-react'
import { toast } from 'sonner'

import {
  useEmployeeNotificationConnection,
  useEmployeeNotificationEvent,
} from '@/lib/employee-notification-socket'
import { resolveEmployeeNotificationTarget } from '@/lib/employee-notification-targets'
import { employeeNavigate } from './notification-navigate'

/**
 * App-wide listener that surfaces incoming notifications as a toast on any
 * employee page, with an "Open" action that deep-links via the route registry.
 * Renders nothing.
 *
 * Unlike the student notifier there is no chat carve-out — the employee portal
 * has no chat, so every module toasts here.
 */
export function EmployeeNotificationNotifier() {
  useEmployeeNotificationConnection()

  useEmployeeNotificationEvent('notification:new', (n) => {
    toast(n.title, {
      description: n.body,
      icon: <Bell className="size-4" />,
      action: {
        label: 'Open',
        onClick: () => {
          const target = resolveEmployeeNotificationTarget(n)
          if (target) employeeNavigate(target)
          else toast.info('This notification has no screen to open.')
        },
      },
    })
  })

  return null
}
