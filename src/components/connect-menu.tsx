import { useNavigate } from '@tanstack/react-router'
import { MessageCircle } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useChatConnection, useChatEvent } from '@/lib/chat-socket'
import {
  fetchChatConversations,
  fetchChatUnreadCount,
  formatConversationTime,
  type ChatConversationSummary,
} from '@/lib/student-chat'
import { cn } from '@/lib/utils'

const PREVIEW_LIMIT = 5

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? parts[parts.length - 1][0] : ''
  return (first + last).toUpperCase() || '?'
}

/**
 * Header chat shortcut: a live unread badge plus a popover preview of the most
 * recent conversations. Tapping one opens that thread on the Connect page;
 * "Open Connect" goes to the conversation list. Mirrors the notifications bell.
 */
export function ConnectMenu() {
  const navigate = useNavigate()
  const [unread, setUnread] = useState(0)
  const [items, setItems] = useState<ChatConversationSummary[]>([])
  const [loaded, setLoaded] = useState(false)

  useChatConnection()

  const refreshUnread = () =>
    fetchChatUnreadCount()
      .then((r) => setUnread(r.total))
      .catch(() => {})

  useEffect(() => {
    void refreshUnread()
  }, [])

  // A new message changes both the unread count and the conversation order.
  useChatEvent('message:new', () => {
    void refreshUnread()
  })

  function onOpenChange(open: boolean) {
    if (!open) return
    fetchChatConversations()
      .then((convs) => {
        setItems(convs.slice(0, PREVIEW_LIMIT))
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
    void refreshUnread()
  }

  function open(conv: ChatConversationSummary) {
    void navigate({
      to: '/connect',
      search: { to: conv.other.id, name: conv.other.display_name },
    })
  }

  return (
    <DropdownMenu onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          aria-label={unread > 0 ? `Connect, ${unread} unread` : 'Connect'}
          className="relative"
        >
          <MessageCircle />
          {unread > 0 ? (
            <span className="absolute -right-1 -top-1 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-4 text-primary-foreground">
              {unread > 9 ? '9+' : unread}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-3 py-2.5">
          <p className="text-sm font-semibold">Connect</p>
          {unread > 0 ? (
            <span className="text-xs text-muted-foreground">{unread} unread</span>
          ) : null}
        </div>
        <div className="scrollbar-themed max-h-80 overflow-y-auto border-t">
          {items.length === 0 ? (
            <p className="px-3 py-8 text-center text-xs text-muted-foreground">
              {loaded ? 'No conversations yet.' : 'Loading…'}
            </p>
          ) : (
            items.map((conv) => (
              <DropdownMenuItem
                key={conv.id}
                onSelect={() => open(conv)}
                className="flex items-center gap-2.5 px-3 py-2.5 focus:bg-muted! focus:text-foreground!"
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-icon-cyan/10 text-xs font-semibold text-icon-cyan">
                  {initials(conv.other.display_name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="flex-1 truncate text-sm font-medium">
                      {conv.other.display_name}
                    </span>
                    <span className="shrink-0 text-[11px] text-muted-foreground/70">
                      {formatConversationTime(conv.last_message_at)}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span
                      className={cn(
                        'line-clamp-1 flex-1 text-xs',
                        conv.unread > 0
                          ? 'font-medium text-foreground'
                          : 'text-muted-foreground',
                      )}
                    >
                      {conv.last_message_preview ?? 'No messages yet'}
                    </span>
                    {conv.unread > 0 ? (
                      <span className="grid min-w-4 shrink-0 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-4 text-primary-foreground">
                        {conv.unread > 9 ? '9+' : conv.unread}
                      </span>
                    ) : null}
                  </span>
                </span>
              </DropdownMenuItem>
            ))
          )}
        </div>
        <DropdownMenuItem
          onSelect={() => void navigate({ to: '/connect' })}
          className="justify-center border-t text-sm font-medium text-primary focus:bg-muted! focus:text-primary!"
        >
          Open Connect
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
