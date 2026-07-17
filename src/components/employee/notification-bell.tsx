import { ArrowUp, Bell, Loader2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { metaFor } from '@/lib/employee-notification-meta'
import {
  useEmployeeNotificationConnection,
  useEmployeeNotificationEvent,
} from '@/lib/employee-notification-socket'
import { resolveEmployeeNotificationTarget } from '@/lib/employee-notification-targets'
import {
  fetchNotificationUnreadCount,
  fetchNotifications,
  formatNotificationTime,
  markNotificationRead,
  type EmployeeNotification,
} from '@/lib/employee-notifications'
import { MODULE_SOFT } from '@/lib/modules'
import { cn } from '@/lib/utils'
import { employeeNavigate } from './notification-navigate'

const PAGE_SIZE = 12

/**
 * Header bell: a live unread badge plus a popover preview of the latest few
 * notifications. Tapping one marks it read and deep-links via the route
 * registry; "View all" opens the full notifications page. The count and preview
 * stay current from the socket.
 */
export function EmployeeNotificationBell() {
  const [unread, setUnread] = useState(0)
  const [items, setItems] = useState<EmployeeNotification[]>([])
  const [loaded, setLoaded] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [showTop, setShowTop] = useState(false)
  const loadingRef = useRef(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEmployeeNotificationConnection()

  useEffect(() => {
    let active = true
    fetchNotificationUnreadCount()
      .then((r) => active && setUnread(r.total))
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  useEmployeeNotificationEvent('notification:new', (n) => {
    setUnread((u) => u + 1)
    setItems((prev) => (prev.some((p) => p.id === n.id) ? prev : [n, ...prev]))
  })
  useEmployeeNotificationEvent('notification:unread', (p) => setUnread(p.unread))

  /** Lazily load the first page the first time the popover opens, then on reopen. */
  function onOpenChange(open: boolean) {
    if (!open) return
    setShowTop(false)
    fetchNotifications({ limit: PAGE_SIZE })
      .then((page) => {
        setItems(page.items)
        setUnread(page.unread)
        setHasMore(page.has_more)
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
  }

  /** Append the next page, seeking by the oldest id currently shown. */
  function loadMore() {
    if (loadingRef.current || !hasMore || items.length === 0) return
    loadingRef.current = true
    setLoadingMore(true)
    const before = items[items.length - 1].id
    fetchNotifications({ limit: PAGE_SIZE, before })
      .then((page) => {
        setItems((prev) => {
          const seen = new Set(prev.map((p) => p.id))
          return [...prev, ...page.items.filter((p) => !seen.has(p.id))]
        })
        setHasMore(page.has_more)
      })
      .catch(() => {})
      .finally(() => {
        loadingRef.current = false
        setLoadingMore(false)
      })
  }

  /** Load the next page as the list nears its bottom; reveal "back to top". */
  function onScroll(e: React.UIEvent<HTMLDivElement>) {
    const el = e.currentTarget
    setShowTop(el.scrollTop > 240)
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 120) loadMore()
  }

  function scrollToTop() {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
    setShowTop(false)
  }

  function open(n: EmployeeNotification) {
    if (!n.read_at) {
      setItems((prev) =>
        prev.map((p) =>
          p.id === n.id ? { ...p, read_at: new Date().toISOString() } : p,
        ),
      )
      void markNotificationRead(n.id).catch(() => {})
    }
    const target = resolveEmployeeNotificationTarget(n)
    if (target) employeeNavigate(target)
    else toast.info('This notification has no screen to open.')
  }

  return (
    <DropdownMenu onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          aria-label={
            unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'
          }
          className="relative"
        >
          <Bell />
          {unread > 0 ? (
            <span className="absolute -right-1 -top-1 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-4 text-primary-foreground">
              {unread > 9 ? '9+' : unread}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="relative w-80 p-0">
        <div className="flex items-center justify-between px-3 py-2.5">
          <p className="text-sm font-semibold">Notifications</p>
          {unread > 0 ? (
            <span className="text-xs text-muted-foreground">
              {unread} unread
            </span>
          ) : null}
        </div>
        <div
          ref={scrollRef}
          onScroll={onScroll}
          className="scrollbar-themed max-h-80 overflow-y-auto border-t"
        >
          {items.length === 0 ? (
            <p className="px-3 py-8 text-center text-xs text-muted-foreground">
              {loaded ? 'You are all caught up.' : 'Loading…'}
            </p>
          ) : (
            items.map((n) => {
              const meta = metaFor(n.module)
              return (
                <DropdownMenuItem
                  key={n.id}
                  onSelect={() => open(n)}
                  className="flex items-start gap-2.5 px-3 py-2.5 focus:bg-muted! focus:text-foreground!"
                >
                  <span
                    className={cn(
                      'mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg',
                      MODULE_SOFT[meta.color],
                    )}
                  >
                    <meta.icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="flex-1 truncate text-sm font-medium">
                        {n.title}
                      </span>
                      {!n.read_at ? (
                        <span className="size-2 shrink-0 rounded-full bg-primary" />
                      ) : null}
                    </span>
                    <span className="line-clamp-2 text-xs text-muted-foreground">
                      {n.body}
                    </span>
                    <span className="text-[11px] text-muted-foreground/70">
                      {formatNotificationTime(n.created_at)}
                    </span>
                  </span>
                </DropdownMenuItem>
              )
            })
          )}
          {loadingMore ? (
            <div className="flex items-center justify-center gap-2 py-2.5 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" />
              Loading…
            </div>
          ) : null}
        </div>
        {showTop ? (
          <button
            type="button"
            onClick={scrollToTop}
            aria-label="Scroll to top"
            className="absolute bottom-12 right-3 z-10 grid size-8 place-items-center rounded-full border bg-card text-foreground shadow-md transition hover:bg-muted"
          >
            <ArrowUp className="size-4" />
          </button>
        ) : null}
        <DropdownMenuItem
          onSelect={() => employeeNavigate({ to: '/notifications' })}
          className="justify-center border-t text-sm font-medium text-primary focus:bg-muted! focus:text-primary!"
        >
          View all notifications
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
