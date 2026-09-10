import { ArrowUp, Bell, CheckCheck, Loader2, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { employeeNavigate } from '@/components/employee/notification-navigate'
import { Button } from '@/components/ui/button'
import { ApiError } from '@/lib/api'
import { metaFor } from '@/lib/employee-notification-meta'
import {
  useEmployeeNotificationConnection,
  useEmployeeNotificationEvent,
} from '@/lib/employee-notification-socket'
import { resolveEmployeeNotificationTarget } from '@/lib/employee-notification-targets'
import {
  fetchNotifications,
  formatNotificationTime,
  markAllNotificationsRead,
  markNotificationRead,
  type EmployeeNotification,
} from '@/lib/employee-notifications'
import { MODULE_SOFT } from '@/lib/modules'
import { cn } from '@/lib/utils'
import { useEmployeeAuthStore } from '@/stores/employee-auth-store'

const PAGE_SIZE = 30

/**
 * The employee's full notification history. Reached from the header bell — it
 * has no RBAC catalog entry, so it never appears in the sidebar (which renders
 * only screens carrying a `web_route`).
 */
export default function EmployeeNotificationsPage() {
  const signOut = useEmployeeAuthStore((state) => state.signOut)
  const [items, setItems] = useState<EmployeeNotification[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [firstLoad, setFirstLoad] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const [showTop, setShowTop] = useState(false)

  useEmployeeNotificationConnection()
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const onlyUnread = filter === 'unread'

  useEffect(() => {
    document.title = 'Notifications — Nucleus'
  }, [])

  // Surface a "back to top" button once the page has scrolled well down.
  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 600)
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const loadFirst = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const page = await fetchNotifications({
        limit: PAGE_SIZE,
        unread: onlyUnread,
      })
      setItems(page.items)
      setHasMore(page.has_more)
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        signOut()
        return
      }
      setError(
        err instanceof Error ? err.message : 'Could not load notifications.',
      )
    } finally {
      setLoading(false)
      setFirstLoad(false)
    }
  }, [signOut, onlyUnread])

  useEffect(() => {
    void loadFirst()
  }, [loadFirst])

  // Prepend live notifications as they arrive while the list is open (they're
  // always unread, so they belong in both the "all" and "unread" views).
  useEmployeeNotificationEvent('notification:new', (n) => {
    setItems((prev) => (prev.some((p) => p.id === n.id) ? prev : [n, ...prev]))
  })

  const loadMore = useCallback(async () => {
    if (loading || loadingMore || !hasMore || items.length === 0) return
    setLoadingMore(true)
    try {
      const before = items[items.length - 1].id
      const page = await fetchNotifications({
        limit: PAGE_SIZE,
        before,
        unread: onlyUnread,
      })
      setItems((prev) => {
        const seen = new Set(prev.map((p) => p.id))
        return [...prev, ...page.items.filter((p) => !seen.has(p.id))]
      })
      setHasMore(page.has_more)
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) signOut()
    } finally {
      setLoadingMore(false)
    }
  }, [loading, loadingMore, hasMore, items, signOut, onlyUnread])

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMore()
      },
      { rootMargin: '400px' },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [loadMore])

  const unreadCount = items.filter((n) => !n.read_at).length

  const open = useCallback(
    (n: EmployeeNotification) => {
      // Mark read optimistically; the server emits the new unread count to the
      // bell. Fire-and-forget — navigation shouldn't wait on it. Under the
      // "unread" filter the row leaves the list; otherwise it just greys out.
      if (!n.read_at) {
        setItems((prev) =>
          onlyUnread
            ? prev.filter((p) => p.id !== n.id)
            : prev.map((p) =>
                p.id === n.id ? { ...p, read_at: new Date().toISOString() } : p,
              ),
        )
        void markNotificationRead(n.id).catch(() => {})
      }

      const target = resolveEmployeeNotificationTarget(n)
      if (target) employeeNavigate(target)
      else toast.info('This notification has no screen to open.')
    },
    [onlyUnread],
  )

  const markAll = useCallback(async () => {
    // "Unread" view empties; "all" view just greys every row.
    if (onlyUnread) {
      setItems([])
      setHasMore(false)
    } else {
      setItems((prev) =>
        prev.map((p) =>
          p.read_at ? p : { ...p, read_at: new Date().toISOString() },
        ),
      )
    }
    try {
      await markAllNotificationsRead()
    } catch {
      toast.info('Could not mark all as read. Try again.')
    }
  }, [onlyUnread])

  const header = (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <header>
          <h1 className="text-xl font-semibold tracking-tight">Notifications</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {unreadCount > 0 ? `${unreadCount} unread` : 'You are all caught up'}
          </p>
        </header>
        {unreadCount > 0 ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => void markAll()}
            className="mb-1 shrink-0"
          >
            <CheckCheck />
            Mark all read
          </Button>
        ) : null}
      </div>
      <div className="inline-flex rounded-lg border bg-card p-0.5">
        <FilterTab
          label="All"
          active={filter === 'all'}
          onClick={() => setFilter('all')}
        />
        <FilterTab
          label="Unread"
          active={filter === 'unread'}
          onClick={() => setFilter('unread')}
        />
      </div>
    </div>
  )

  if (firstLoad && loading) {
    return (
      <div className="space-y-4">
        {header}
        <ListSkeleton />
      </div>
    )
  }

  if (error && items.length === 0) {
    return (
      <div className="space-y-4">
        {header}
        <ErrorState message={error} onRetry={() => void loadFirst()} />
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="space-y-4">
        {header}
        <EmptyState onlyUnread={onlyUnread} />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {header}
      <div className="space-y-2">
        {items.map((n) => (
          <NotificationRow key={n.id} notification={n} onOpen={open} />
        ))}
        {hasMore ? <div ref={sentinelRef} className="h-px" /> : null}
        {loadingMore ? (
          <div className="flex items-center justify-center gap-2 py-2 text-xs text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading more…
          </div>
        ) : null}
      </div>

      {showTop ? (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          aria-label="Back to top"
          className="fixed bottom-6 right-6 z-40 inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-lg transition hover:opacity-90"
        >
          <ArrowUp className="size-4" />
          Top
        </button>
      ) : null}
    </div>
  )
}

function NotificationRow({
  notification,
  onOpen,
}: {
  notification: EmployeeNotification
  onOpen: (n: EmployeeNotification) => void
}) {
  const meta = metaFor(notification.module)
  const unread = !notification.read_at

  return (
    <button
      type="button"
      onClick={() => onOpen(notification)}
      className={cn(
        'flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-colors hover:bg-muted/50',
        unread ? 'border-primary/30 bg-primary/5' : 'border-border bg-card',
      )}
    >
      <div
        className={cn(
          'grid size-10 shrink-0 place-items-center rounded-lg',
          MODULE_SOFT[meta.color],
        )}
      >
        <meta.icon className="size-[18px]" />
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-start gap-2">
          <p className="flex-1 text-sm font-semibold">{notification.title}</p>
          {unread ? (
            <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
          ) : null}
        </div>
        <p className="line-clamp-3 text-xs text-muted-foreground">
          {notification.body}
        </p>
        <p className="text-xs text-muted-foreground/70">
          {formatNotificationTime(notification.created_at)}
        </p>
      </div>
    </button>
  )
}

function FilterTab({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
        active
          ? 'bg-primary text-primary-foreground shadow-sm'
          : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {label}
    </button>
  )
}

function ListSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />
      ))}
    </div>
  )
}

function EmptyState({ onlyUnread }: { onlyUnread: boolean }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border bg-card p-10 text-center text-card-foreground">
      <div className="grid size-12 place-items-center rounded-full bg-icon-violet/10 text-icon-violet">
        <Bell className="size-6" />
      </div>
      <div className="space-y-1">
        <h2 className="text-sm font-semibold">
          {onlyUnread ? 'No unread notifications' : 'No notifications yet'}
        </h2>
        <p className="max-w-sm text-xs text-muted-foreground">
          {onlyUnread
            ? "You're all caught up — switch to All to see earlier notifications."
            : 'When something needs your attention — a request to review, a timetable change — it’ll show up here.'}
        </p>
      </div>
    </div>
  )
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border bg-card p-10 text-center text-card-foreground">
      <div className="grid size-12 place-items-center rounded-full bg-destructive/10 text-destructive">
        <Bell className="size-6" />
      </div>
      <div className="space-y-1">
        <h2 className="text-sm font-semibold">
          Couldn&rsquo;t load notifications
        </h2>
        <p className="max-w-sm text-xs text-muted-foreground">{message}</p>
      </div>
      <Button size="sm" onClick={onRetry}>
        <RefreshCw />
        Try again
      </Button>
    </div>
  )
}
