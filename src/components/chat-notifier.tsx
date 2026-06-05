import { useMemo } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { MessageCircle } from 'lucide-react'
import { toast } from 'sonner'

import {
  getActiveChatConversation,
  useChatConnection,
  useChatEvent,
} from '@/lib/chat-socket'
import { fetchChatConversationMeta } from '@/lib/student-chat'
import { getStudentId } from '@/lib/student-auth'

/**
 * App-wide listener that surfaces incoming chat messages as a toast on any
 * page, so the student never misses one while elsewhere in the portal. Tapping
 * the toast opens that conversation on the Connect page. Renders nothing.
 *
 * It stays quiet for messages the student is already looking at (the open
 * thread renders them inline) and for the student's own messages echoed back to
 * their other devices. Mounted once, inside the routed portal chrome.
 */
export function ChatNotifier() {
  const navigate = useNavigate()
  const me = useMemo(() => getStudentId(), [])

  // Keep the socket alive for the whole session, not just while Connect is open.
  useChatConnection()

  useChatEvent('message:new', (msg) => {
    // Own message bounced to another device — nothing to announce.
    if (me != null && msg.sender_id === me) return
    // Already reading this thread — its own listener handles it.
    if (getActiveChatConversation() === msg.conversation_id) return

    const name = msg.sender_name ?? 'New message'
    const show = () =>
      toast(name, {
        description: msg.body,
        icon: <MessageCircle className="size-4" />,
        action: {
          label: 'Open',
          onClick: () =>
            void navigate({
              to: '/connect',
              search: { to: msg.sender_id, name: msg.sender_name ?? undefined },
            }),
        },
      })

    // Stay quiet for muted conversations — the message still lands in the list.
    // Fail open: if the mute check errors, show the toast rather than swallow it.
    void fetchChatConversationMeta(msg.conversation_id)
      .then((meta) => {
        if (!meta.muted) show()
      })
      .catch(() => show())
  })

  return null
}
