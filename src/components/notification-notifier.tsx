import { useNavigate } from '@tanstack/react-router'
import { Bell } from 'lucide-react'
import { toast } from 'sonner'

import {
  useNotificationConnection,
  useNotificationEvent,
} from '@/lib/notification-socket'
import { resolveNotificationTarget } from '@/lib/notification-targets'

/**
 * App-wide listener that surfaces incoming notifications as a toast on any page,
 * with an "Open" action that deep-links via the route registry. Renders nothing.
 *
 * Chat notifications are deliberately skipped here: `ChatNotifier` already
 * toasts incoming messages (and stays quiet for the thread you're viewing), so
 * handling them here too would double-toast. The bell badge still counts them.
 */
export function NotificationNotifier() {
  const navigate = useNavigate()

  useNotificationConnection()

  useNotificationEvent('notification:new', (n) => {
    if (n.module === 'chat') return // ChatNotifier owns chat toasts.

    toast(n.title, {
      description: n.body,
      icon: <Bell className="size-4" />,
      action: {
        label: 'Open',
        onClick: () => {
          const target = resolveNotificationTarget(n)
          if (target) void navigate(target)
          else toast.info('This notification has no screen to open.')
        },
      },
    })
  })

  return null
}
