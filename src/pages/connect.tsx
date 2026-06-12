import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso'
import {
  ArrowLeft,
  Ban,
  Bell,
  BellOff,
  Check,
  CheckCheck,
  CircleAlert,
  Clock,
  Loader2,
  MessageCircle,
  MoreVertical,
  Plus,
  Search,
  Send,
  ShieldOff,
  UserPlus,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'

import { PageHeader } from '@/components/portal-layout'
import { PeerProfileOverlay } from '@/components/peer-profile-overlay'
import { StateView } from '@/components/state-view'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { ApiError } from '@/lib/api'
import { MODULE_SOFT } from '@/lib/modules'
import { avatarColorFor } from '@/lib/student-birthdays'
import {
  acceptChatRequest,
  birthdayWish,
  blockChatConversation,
  fetchChatConfig,
  fetchChatContacts,
  fetchChatConversationMeta,
  fetchChatConversations,
  fetchChatMessages,
  fetchChatRequests,
  fetchChatRestricted,
  fetchChatUnreadCount,
  formatConversationTime,
  formatMessageTime,
  muteChatConversation,
  openChatConversation,
  unblockChatConversation,
  unmuteChatConversation,
  type ChatContact,
  type ChatConversationMeta,
  type ChatConversationSummary,
  type ChatMessage,
  type ChatRequestSummary,
} from '@/lib/student-chat'
import {
  markChatRead,
  sendChatMessage,
  setActiveChatConversation,
  setChatTyping,
  useChatConnection,
  useChatEvent,
} from '@/lib/chat-socket'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? parts[parts.length - 1][0] : ''
  return (first + last).toUpperCase() || '?'
}

function Avatar({
  name,
  photoUrl,
  className,
}: {
  name: string
  photoUrl?: string | null
  className?: string
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null)

  // Failure is per-URL: when a refetch delivers a fresh signed URL, retry the
  // image instead of staying on initials forever.
  if (photoUrl && failedUrl !== photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={name}
        onError={() => setFailedUrl(photoUrl)}
        className={cn(
          'size-10 shrink-0 rounded-full border bg-muted object-cover',
          className,
        )}
      />
    )
  }

  return (
    <div
      className={cn(
        'grid size-10 shrink-0 place-items-center rounded-full text-xs font-semibold',
        MODULE_SOFT[avatarColorFor(name)],
        className,
      )}
    >
      {initials(name)}
    </div>
  )
}

interface ActiveChat {
  id: number
  other: ChatContact
  /** Newest message id the other participant had read when we opened it. */
  otherLastRead: number
  /** Optional pre-filled composer text (e.g. a birthday wish). */
  draft?: string
}

export default function ConnectPage() {
  const signOut = useAuthStore((s) => s.signOut)
  const navigate = useNavigate()
  const search = useSearch({ strict: false }) as {
    to?: number
    name?: string
    wish?: boolean
  }
  useChatConnection()

  const [conversations, setConversations] = useState<ChatConversationSummary[]>(
    [],
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [active, setActive] = useState<ActiveChat | null>(null)
  // Which view the left pane shows: the chat list, the new-chat picker, the
  // incoming message-requests inbox, or the blocked/muted management list.
  const [leftView, setLeftView] = useState<
    'list' | 'new' | 'requests' | 'restricted'
  >('list')
  const [requestCount, setRequestCount] = useState(0)
  const [restrictedCount, setRestrictedCount] = useState(0)
  // The classmate whose profile overlay is open (tapped in a thread header).
  const [profileFor, setProfileFor] = useState<ChatContact | null>(null)

  useEffect(() => {
    document.title = 'Connect — Nucleus'
  }, [])

  // Deep link to open a specific chat: either the dashboard's "send a wish"
  // (`?to&name&wish`) or the global new-message toast's "Open". We open the
  // conversation, then strip the params so a refresh or back-nav doesn't re-open
  // it. Keyed on `search.to` (a primitive) so a *new* target re-triggers even
  // while we're already on this page; the in-flight guard prevents the async
  // open from racing the param strip.
  const openingDeepLink = useRef(false)
  useEffect(() => {
    if (!search.to || openingDeepLink.current) return
    openingDeepLink.current = true
    const to = search.to
    const name = search.name ?? 'Chat'
    const wantWish = search.wish === true
    void (async () => {
      try {
        const conv = await openChatConversation(to)
        setActive({
          id: conv.id,
          // Placeholder until the conversation meta loads (which carries the
          // real roll number and photo URL for the header).
          other: { id: to, display_name: name, student_id: '', photo_url: null },
          otherLastRead: 0,
          draft: wantWish ? birthdayWish(name) : undefined,
        })
        setLeftView('list')
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) signOut()
        else toast.error('Could not open the chat.')
      } finally {
        void navigate({ to: '/connect', search: {}, replace: true })
        openingDeepLink.current = false
      }
    })()
  }, [search.to, search.name, search.wish, navigate, signOut])

  const loadConversations = useCallback(async () => {
    try {
      const rows = await fetchChatConversations()
      setConversations(rows)
      setError(null)
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        signOut()
        return
      }
      setError(err instanceof Error ? err.message : 'Could not load your chats.')
    } finally {
      setLoading(false)
    }
  }, [signOut])

  const loadRequestCount = useCallback(async () => {
    try {
      const { pending_requests } = await fetchChatUnreadCount()
      setRequestCount(pending_requests)
    } catch {
      // Non-critical badge; leave the last known value.
    }
  }, [])

  const loadRestrictedCount = useCallback(async () => {
    try {
      const rows = await fetchChatRestricted()
      setRestrictedCount(rows.length)
    } catch {
      // Non-critical entry; leave the last known value.
    }
  }, [])

  useEffect(() => {
    void loadConversations()
    void loadRequestCount()
    void loadRestrictedCount()
  }, [loadConversations, loadRequestCount, loadRestrictedCount])

  // Any message or read change anywhere refreshes the list (previews/unread) and
  // the requests badge (a first-time message from a stranger is a new request).
  useChatEvent('message:new', () => {
    void loadConversations()
    void loadRequestCount()
  })
  useChatEvent('message:read', () => void loadConversations())

  const openConversation = useCallback((c: ChatConversationSummary) => {
    setActive({
      id: c.id,
      other: c.other,
      otherLastRead: c.other_last_read_message_id ?? 0,
    })
    setLeftView('list')
  }, [])

  // Accept an incoming request from the inbox, then drop into the now-open chat.
  const acceptRequest = useCallback(
    async (req: ChatRequestSummary) => {
      try {
        await acceptChatRequest(req.id)
        setActive({ id: req.id, other: req.other, otherLastRead: 0 })
        setLeftView('list')
        void loadConversations()
        void loadRequestCount()
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) signOut()
        else toast.error('Could not accept the request.')
      }
    },
    [loadConversations, loadRequestCount, signOut],
  )

  const blockRequest = useCallback(
    async (req: ChatRequestSummary) => {
      try {
        await blockChatConversation(req.id)
        void loadRequestCount()
        void loadRestrictedCount()
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) signOut()
        else toast.error('Could not block.')
      }
    },
    [loadRequestCount, loadRestrictedCount, signOut],
  )

  const startChatWith = useCallback(
    async (contact: ChatContact) => {
      try {
        const conv = await openChatConversation(contact.id)
        setActive({ id: conv.id, other: contact, otherLastRead: 0 })
        setLeftView('list')
        void loadConversations()
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          signOut()
          return
        }
        toast.error(
          err instanceof Error ? err.message : 'Could not open the chat.',
        )
      }
    },
    [loadConversations, signOut],
  )

  return (
    <>
      <PageHeader
        title="Connect"
        subtitle="Chat one-to-one with students in your group."
        icon={MessageCircle}
        accent="cyan"
      />

      <div className="grid h-[68svh] min-h-[26rem] grid-cols-1 overflow-hidden rounded-2xl border bg-card text-card-foreground shadow-sm md:grid-cols-[20rem_1fr]">
        {/* Left pane: conversation list / new-chat picker */}
        <aside
          className={cn(
            'min-h-0 flex-col border-r md:flex',
            active ? 'hidden' : 'flex',
          )}
        >
          {leftView === 'new' ? (
            <NewChatPanel
              onPick={startChatWith}
              onClose={() => setLeftView('list')}
              onSessionEnd={signOut}
            />
          ) : leftView === 'requests' ? (
            <RequestsPanel
              onClose={() => setLeftView('list')}
              onAccept={acceptRequest}
              onBlock={blockRequest}
              onSessionEnd={signOut}
            />
          ) : leftView === 'restricted' ? (
            <RestrictedPanel
              onClose={() => setLeftView('list')}
              onChanged={() => {
                void loadConversations()
                void loadRestrictedCount()
              }}
              onSessionEnd={signOut}
            />
          ) : (
            <ConversationList
              conversations={conversations}
              loading={loading}
              error={error}
              activeId={active?.id ?? null}
              requestCount={requestCount}
              restrictedCount={restrictedCount}
              onSelect={openConversation}
              onNewChat={() => setLeftView('new')}
              onOpenRequests={() => setLeftView('requests')}
              onOpenRestricted={() => setLeftView('restricted')}
              onRetry={() => {
                setLoading(true)
                void loadConversations()
              }}
            />
          )}
        </aside>

        {/* Right pane: active thread */}
        <section
          className={cn(
            'min-h-0 flex-col md:flex',
            active ? 'flex' : 'hidden md:flex',
          )}
        >
          {active ? (
            <ChatThread
              key={active.id}
              conversationId={active.id}
              otherId={active.other.id}
              otherName={active.other.display_name}
              otherRoll={active.other.student_id}
              otherLastReadInit={active.otherLastRead}
              initialDraft={active.draft}
              onViewProfile={() => setProfileFor(active.other)}
              onBack={() => setActive(null)}
              onActivity={loadConversations}
              onMutated={() => {
                void loadConversations()
                void loadRequestCount()
                void loadRestrictedCount()
              }}
              onSessionEnd={signOut}
            />
          ) : (
            <EmptyThread />
          )}
        </section>
      </div>

      {profileFor ? (
        <PeerProfileOverlay
          key={profileFor.id}
          studentId={profileFor.id}
          fallbackName={profileFor.display_name}
          onClose={() => setProfileFor(null)}
          onSessionEnd={signOut}
        />
      ) : null}
    </>
  )
}

// ---------------------------------------------------------------------------
// Conversation list
// ---------------------------------------------------------------------------

function ConversationList({
  conversations,
  loading,
  error,
  activeId,
  requestCount,
  restrictedCount,
  onSelect,
  onNewChat,
  onOpenRequests,
  onOpenRestricted,
  onRetry,
}: {
  conversations: ChatConversationSummary[]
  loading: boolean
  error: string | null
  activeId: number | null
  requestCount: number
  restrictedCount: number
  onSelect: (c: ChatConversationSummary) => void
  onNewChat: () => void
  onOpenRequests: () => void
  onOpenRestricted: () => void
  onRetry: () => void
}) {
  const [query, setQuery] = useState('')

  // Search matches the PERSON (name or roll number) — never the message text.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return conversations
    return conversations.filter(
      (c) =>
        c.other.display_name.toLowerCase().includes(q) ||
        c.other.student_id.toLowerCase().includes(q),
    )
  }, [conversations, query])

  return (
    <>
      <header className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <h2 className="text-sm font-semibold">Chats</h2>
        <Button size="sm" onClick={onNewChat}>
          <Plus />
          New
        </Button>
      </header>

      {requestCount > 0 ? (
        <button
          type="button"
          onClick={onOpenRequests}
          className="flex w-full items-center gap-3 border-b px-4 py-3 text-left transition-colors hover:bg-muted/70"
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
            <UserPlus className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Message requests</p>
            <p className="truncate text-xs text-muted-foreground">
              {requestCount} {requestCount === 1 ? 'person wants' : 'people want'}{' '}
              to chat
            </p>
          </div>
          <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-destructive px-1.5 text-[10px] font-semibold text-destructive-foreground">
            {requestCount > 99 ? '99+' : requestCount}
          </span>
        </button>
      ) : null}

      {restrictedCount > 0 ? (
        <button
          type="button"
          onClick={onOpenRestricted}
          className="flex w-full items-center gap-3 border-b px-4 py-3 text-left transition-colors hover:bg-muted/70"
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
            <ShieldOff className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Blocked &amp; muted</p>
            <p className="truncate text-xs text-muted-foreground">
              {restrictedCount}{' '}
              {restrictedCount === 1 ? 'conversation' : 'conversations'}
            </p>
          </div>
        </button>
      ) : null}

      {!loading && !error && conversations.length > 0 ? (
        <div className="border-b p-2.5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search people"
              className="h-9 pl-8 text-sm"
              aria-label="Search chats by name or roll number"
            />
          </div>
        </div>
      ) : null}

      <div className="scrollbar-themed min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <div className="space-y-2 p-3">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : error ? (
          <StateView
            compact
            icon={MessageCircle}
            title="Couldn't load chats"
            description={error}
            action={{ label: 'Try again', onClick: onRetry }}
          />
        ) : conversations.length === 0 ? (
          <StateView
            compact
            icon={MessageCircle}
            title="No chats yet"
            description="Start a conversation with someone in your group."
            action={{ label: 'New chat', icon: Plus, onClick: onNewChat }}
          />
        ) : filtered.length === 0 ? (
          <p className="p-8 text-center text-xs text-muted-foreground">
            No one matches &ldquo;{query.trim()}&rdquo;.
          </p>
        ) : (
          <ul className="p-1.5">
            {filtered.map((c) => {
              const pendingSent = c.status === 'pending' && c.is_initiator
              const subtitle = c.blocked_by_me
                ? 'Blocked'
                : pendingSent
                  ? 'Request sent · waiting to accept'
                  : (c.last_message_preview ?? 'No messages yet')
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(c)}
                    aria-current={activeId === c.id}
                    className={cn(
                      'relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors',
                      activeId === c.id ? 'bg-primary/10' : 'hover:bg-muted/70',
                      c.blocked_by_me && 'opacity-60',
                    )}
                  >
                    {activeId === c.id ? (
                      <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-primary" />
                    ) : null}
                    <Avatar
                      name={c.other.display_name}
                      photoUrl={c.other.photo_url}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="flex min-w-0 items-center gap-1.5 truncate text-sm font-medium">
                          <span className="truncate">{c.other.display_name}</span>
                          {c.muted ? (
                            <BellOff className="size-3 shrink-0 text-muted-foreground" />
                          ) : null}
                        </p>
                        {c.last_message_at && !pendingSent ? (
                          <span
                            className={cn(
                              'shrink-0 text-[11px]',
                              c.unread > 0 && !c.muted
                                ? 'font-medium text-primary'
                                : 'text-muted-foreground',
                            )}
                          >
                            {formatConversationTime(c.last_message_at)}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-0.5 flex items-center justify-between gap-2">
                        <p
                          className={cn(
                            'truncate text-xs',
                            c.unread > 0 && !c.muted
                              ? 'font-medium text-foreground'
                              : 'text-muted-foreground',
                            (pendingSent || c.blocked_by_me) && 'italic',
                          )}
                        >
                          {subtitle}
                        </p>
                        {c.unread > 0 && !pendingSent ? (
                          <span
                            className={cn(
                              'grid h-5 min-w-5 shrink-0 place-items-center rounded-full px-1.5 text-[10px] font-semibold text-primary-foreground',
                              c.muted ? 'bg-muted-foreground/50' : 'bg-primary',
                            )}
                          >
                            {c.unread > 99 ? '99+' : c.unread}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// New-chat picker
// ---------------------------------------------------------------------------

const CONTACTS_PAGE_SIZE = 30

function NewChatPanel({
  onPick,
  onClose,
  onSessionEnd,
}: {
  onPick: (c: ChatContact) => void
  onClose: () => void
  onSessionEnd: () => void
}) {
  const [contacts, setContacts] = useState<ChatContact[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  // Bumped per query so a stale fetch can't overwrite newer results.
  const reqId = useRef(0)

  // Debounce the search box into the server-side `q`.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300)
    return () => clearTimeout(t)
  }, [query])

  // (Re)load the first page whenever the debounced search changes.
  useEffect(() => {
    let alive = true
    const id = (reqId.current += 1)
    setLoading(true)
    setError(null)
    fetchChatContacts({
      limit: CONTACTS_PAGE_SIZE,
      offset: 0,
      q: debounced || undefined,
    })
      .then((page) => {
        if (!alive || id !== reqId.current) return
        setContacts(page.items)
        setTotal(page.total)
      })
      .catch((err) => {
        if (!alive || id !== reqId.current) return
        if (err instanceof ApiError && err.status === 401) {
          onSessionEnd()
          return
        }
        setError(err instanceof Error ? err.message : 'Could not load contacts.')
      })
      .finally(() => {
        if (alive && id === reqId.current) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [debounced, onSessionEnd])

  const loadMore = useCallback(() => {
    if (loading || loadingMore || contacts.length >= total) return
    const id = reqId.current
    setLoadingMore(true)
    fetchChatContacts({
      limit: CONTACTS_PAGE_SIZE,
      offset: contacts.length,
      q: debounced || undefined,
    })
      .then((page) => {
        if (id !== reqId.current) return
        setContacts((prev) => [...prev, ...page.items])
        setTotal(page.total)
      })
      .catch(() => {
        // Leave what we have; scrolling again retries.
      })
      .finally(() => {
        if (id === reqId.current) setLoadingMore(false)
      })
  }, [loading, loadingMore, contacts.length, total, debounced])

  // Infinite scroll: pull the next page as the list nears the bottom.
  const onScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const el = e.currentTarget
      if (el.scrollHeight - el.scrollTop - el.clientHeight < 240) loadMore()
    },
    [loadMore],
  )

  return (
    <>
      <header className="flex items-center gap-2 border-b px-3 py-3">
        <Button
          size="icon"
          variant="ghost"
          onClick={onClose}
          aria-label="Back to chats"
        >
          <ArrowLeft />
        </Button>
        <h2 className="text-sm font-semibold">New chat</h2>
      </header>

      <div className="border-b p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or roll number"
            className="pl-9"
            aria-label="Search your group"
          />
        </div>
      </div>

      <div
        className="scrollbar-themed min-h-0 flex-1 overflow-y-auto"
        onScroll={onScroll}
      >
        {loading ? (
          <div className="space-y-2 p-3">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : error ? (
          <StateView
            compact
            icon={Users}
            title="Couldn't load your group"
            description={error}
          />
        ) : contacts.length === 0 ? (
          debounced ? (
            <p className="p-8 text-center text-xs text-muted-foreground">
              No matches.
            </p>
          ) : (
            <StateView
              compact
              icon={Users}
              title="No one in your group yet"
              description="When classmates are added to your group, they’ll appear here."
            />
          )
        ) : (
          <>
            <ul className="divide-y">
              {contacts.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => onPick(c)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent"
                  >
                    <Avatar name={c.display_name} photoUrl={c.photo_url} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {c.display_name}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {c.student_id}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
            {loadingMore ? (
              <div className="flex justify-center py-4">
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              </div>
            ) : null}
          </>
        )}
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Message-requests inbox
// ---------------------------------------------------------------------------

function RequestsPanel({
  onClose,
  onAccept,
  onBlock,
  onSessionEnd,
}: {
  onClose: () => void
  onAccept: (req: ChatRequestSummary) => Promise<void>
  onBlock: (req: ChatRequestSummary) => Promise<void>
  onSessionEnd: () => void
}) {
  const [requests, setRequests] = useState<ChatRequestSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    fetchChatRequests()
      .then((rows) => {
        setRequests(rows)
        setError(null)
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          onSessionEnd()
          return
        }
        setError(
          err instanceof Error ? err.message : 'Could not load requests.',
        )
      })
      .finally(() => setLoading(false))
  }, [onSessionEnd])

  useEffect(() => {
    load()
  }, [load])

  const accept = async (req: ChatRequestSummary) => {
    if (busyId != null) return
    setBusyId(req.id)
    try {
      await onAccept(req)
    } finally {
      setBusyId(null)
    }
  }

  const block = async (req: ChatRequestSummary) => {
    if (busyId != null) return
    setBusyId(req.id)
    try {
      await onBlock(req)
      setRequests((prev) => prev.filter((r) => r.id !== req.id))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <>
      <header className="flex items-center gap-2 border-b px-3 py-3">
        <Button
          size="icon"
          variant="ghost"
          onClick={onClose}
          aria-label="Back to chats"
        >
          <ArrowLeft />
        </Button>
        <h2 className="text-sm font-semibold">Message requests</h2>
      </header>

      <div className="scrollbar-themed min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <div className="space-y-2 p-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-28 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : error ? (
          <StateView
            compact
            icon={UserPlus}
            title="Couldn't load requests"
            description={error}
            action={{ label: 'Try again', onClick: load }}
          />
        ) : requests.length === 0 ? (
          <StateView
            compact
            icon={UserPlus}
            title="No requests"
            description="When someone outside your chats messages you, it'll show up here to accept or block."
          />
        ) : (
          <ul className="space-y-2 p-2.5">
            {requests.map((req) => (
              <li
                key={req.id}
                className="space-y-2.5 rounded-xl border p-3"
              >
                <div className="flex items-center gap-3">
                  <Avatar
                    name={req.other.display_name}
                    photoUrl={req.other.photo_url}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate text-sm font-medium">
                        {req.other.display_name}
                      </p>
                      {req.invite_at ? (
                        <span className="shrink-0 text-[11px] text-muted-foreground">
                          {formatConversationTime(req.invite_at)}
                        </span>
                      ) : null}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {req.other.student_id}
                    </p>
                  </div>
                </div>
                {req.invite_preview ? (
                  <p className="line-clamp-2 text-xs text-foreground">
                    &ldquo;{req.invite_preview}&rdquo;
                  </p>
                ) : null}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1"
                    disabled={busyId != null}
                    onClick={() => void accept(req)}
                  >
                    <Check />
                    Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busyId != null}
                    onClick={() => void block(req)}
                  >
                    <Ban />
                    Block
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Blocked & muted management
// ---------------------------------------------------------------------------

type RestrictedFilter = 'all' | 'muted' | 'blocked'

function RestrictedPanel({
  onClose,
  onChanged,
  onSessionEnd,
}: {
  onClose: () => void
  onChanged: () => void
  onSessionEnd: () => void
}) {
  const [rows, setRows] = useState<ChatConversationSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<RestrictedFilter>('all')
  const [busyId, setBusyId] = useState<number | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    fetchChatRestricted()
      .then((data) => {
        setRows(data)
        setError(null)
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          onSessionEnd()
          return
        }
        setError(err instanceof Error ? err.message : 'Could not load.')
      })
      .finally(() => setLoading(false))
  }, [onSessionEnd])

  useEffect(() => {
    load()
  }, [load])

  const act = async (
    c: ChatConversationSummary,
    kind: 'unmute' | 'unblock',
  ) => {
    if (busyId != null) return
    setBusyId(c.id)
    try {
      await (kind === 'unmute'
        ? unmuteChatConversation(c.id)
        : unblockChatConversation(c.id))
      // Recompute this row's flags; drop it once it's neither muted nor blocked.
      setRows((prev) =>
        prev
          .map((r) =>
            r.id === c.id
              ? {
                  ...r,
                  muted: kind === 'unmute' ? false : r.muted,
                  blocked_by_me: kind === 'unblock' ? false : r.blocked_by_me,
                }
              : r,
          )
          .filter((r) => r.muted || r.blocked_by_me),
      )
      onChanged()
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) onSessionEnd()
      else toast.error('Something went wrong. Try again.')
    } finally {
      setBusyId(null)
    }
  }

  const filtered = useMemo(() => {
    if (filter === 'muted') return rows.filter((r) => r.muted)
    if (filter === 'blocked') return rows.filter((r) => r.blocked_by_me)
    return rows
  }, [rows, filter])

  return (
    <>
      <header className="flex items-center gap-2 border-b px-3 py-3">
        <Button
          size="icon"
          variant="ghost"
          onClick={onClose}
          aria-label="Back to chats"
        >
          <ArrowLeft />
        </Button>
        <h2 className="text-sm font-semibold">Blocked &amp; muted</h2>
      </header>

      {!loading && !error && rows.length > 0 ? (
        <div className="border-b p-2.5">
          <div className="flex gap-1 rounded-lg bg-muted p-1">
            {(['all', 'muted', 'blocked'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={cn(
                  'flex-1 rounded-md py-1.5 text-xs font-semibold capitalize transition-colors',
                  filter === f
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="scrollbar-themed min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <div className="space-y-2 p-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : error ? (
          <StateView
            compact
            icon={ShieldOff}
            title="Couldn't load"
            description={error}
            action={{ label: 'Try again', onClick: load }}
          />
        ) : filtered.length === 0 ? (
          <StateView
            compact
            icon={ShieldOff}
            title={filter === 'all' ? 'Nothing here' : `No ${filter}`}
            description="When you mute or block someone, they show up here to undo."
          />
        ) : (
          <ul className="space-y-2 p-2.5">
            {filtered.map((c) => (
              <li key={c.id} className="rounded-xl border p-3">
                <div className="flex items-center gap-3">
                  <Avatar
                    name={c.other.display_name}
                    photoUrl={c.other.photo_url}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {c.other.display_name}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {c.other.student_id}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {c.muted ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyId != null}
                        onClick={() => void act(c, 'unmute')}
                      >
                        Unmute
                      </Button>
                    ) : null}
                    {c.blocked_by_me ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyId != null}
                        onClick={() => void act(c, 'unblock')}
                      >
                        Unblock
                      </Button>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Active thread
// ---------------------------------------------------------------------------

type SendStatus = 'sending' | 'sent' | 'failed'
type UiMessage = ChatMessage & { _status?: SendStatus }

const PAGE_SIZE = 30
// Virtuoso anchor for reverse-infinite scroll: the absolute index of the first
// item. We start high and decrement it as older pages are prepended, which is
// how Virtuoso keeps the scroll position stable across prepends.
const START_INDEX = 1_000_000

/** Context handed to Virtuoso's Header so it re-renders without remounting. */
interface ThreadListContext {
  loadingMore: boolean
  retentionDays: number | null
}

/** Top-of-thread chrome: retention notice + "loading older" spinner. */
function ThreadListHeader({ context }: { context?: ThreadListContext }) {
  return (
    <div className="flex flex-col items-center gap-1 px-4 pb-1 pt-3">
      {context?.loadingMore ? (
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
      ) : null}
      {context?.retentionDays != null ? (
        <span className="rounded-full bg-muted px-3 py-1 text-center text-[11px] text-muted-foreground">
          {context.retentionDays === 0
            ? 'Messages are not retained.'
            : `🔒 Messages are automatically deleted after ${context.retentionDays} days.`}
        </span>
      ) : null}
    </div>
  )
}

function ThreadListFooter() {
  return <div className="h-2" />
}

/** "Today" / "Yesterday" / "12 Jun" — day-separator label for a message. */
function dayLabel(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  if (Number.isNaN(d.getTime())) return ''
  const startOf = (x: Date) =>
    new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const diffDays = Math.round((startOf(now) - startOf(d)) / 86400000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric',
  })
}

function ChatThread({
  conversationId,
  otherId,
  otherName,
  otherRoll,
  otherLastReadInit,
  initialDraft,
  onViewProfile,
  onBack,
  onActivity,
  onMutated,
  onSessionEnd,
}: {
  conversationId: number
  otherId: number
  otherName: string
  otherRoll: string
  otherLastReadInit: number
  initialDraft?: string
  /** Open the other participant's profile (tapped the header avatar/name). */
  onViewProfile: () => void
  onBack: () => void
  onActivity: () => void
  /** Called after accept/block/mute so the parent refreshes its list + badges. */
  onMutated: () => void
  onSessionEnd: () => void
}) {
  const [messages, setMessages] = useState<UiMessage[]>([]) // ascending (oldest→newest)
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [otherLastRead, setOtherLastRead] = useState(otherLastReadInit)
  const [deliveredMax, setDeliveredMax] = useState(0)
  const [peerTyping, setPeerTyping] = useState(false)
  const [text, setText] = useState(initialDraft ?? '')
  const [retentionDays, setRetentionDays] = useState<number | null>(null)
  const [meta, setMeta] = useState<ChatConversationMeta | null>(null)
  const [actionBusy, setActionBusy] = useState(false)

  const virtuosoRef = useRef<VirtuosoHandle | null>(null)
  const tempIdRef = useRef(-1)
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const peerTypingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [firstItemIndex, setFirstItemIndex] = useState(START_INDEX)

  // Hold the latest callbacks in refs so the initial-load effect can call them
  // without listing them as dependencies — otherwise a new `onActivity`
  // identity on each parent render would re-trigger the load in a tight loop.
  const onActivityRef = useRef(onActivity)
  onActivityRef.current = onActivity
  const onSessionEndRef = useRef(onSessionEnd)
  onSessionEndRef.current = onSessionEnd

  // Initial history load + mark read. Runs once per conversation (the component
  // is keyed by conversationId, so a switch remounts it). Callbacks come from
  // refs above, NOT the dependency array, to avoid a re-fetch loop. Virtuoso
  // handles scrolling to the bottom via initialTopMostItemIndex.
  useEffect(() => {
    let alive = true
    setLoading(true)
    fetchChatMessages(conversationId, { limit: PAGE_SIZE })
      .then((page) => {
        if (!alive) return
        setMessages([...page.items].reverse()) // server is newest-first
        setHasMore(page.has_more)
        markChatRead(conversationId)
        onActivityRef.current()
      })
      .catch((err) => {
        if (!alive) return
        if (err instanceof ApiError && err.status === 401) {
          onSessionEndRef.current()
        }
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [conversationId])

  // Mark this thread as the one on screen so the global notifier doesn't toast
  // its messages (they already render inline here). Cleared when it closes or
  // switches to another conversation.
  useEffect(() => {
    setActiveChatConversation(conversationId)
    return () => setActiveChatConversation(null)
  }, [conversationId])

  // Retention notice text.
  useEffect(() => {
    let alive = true
    fetchChatConfig()
      .then((c) => {
        if (alive) setRetentionDays(c.retention_days)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  // Consent/block/mute state for this conversation — drives the composer and the
  // header overflow menu. Reloadable so accept/block/mute reflect immediately.
  const loadMeta = useCallback(() => {
    fetchChatConversationMeta(conversationId)
      .then(setMeta)
      .catch(() => {})
  }, [conversationId])

  useEffect(() => {
    loadMeta()
  }, [loadMeta])

  // The inviter accepted live — unlock the composer.
  useChatEvent('conversation:accepted', (evt) => {
    if (evt.conversation_id === conversationId) loadMeta()
  })

  // Run a mute/block/accept mutation, then refresh local meta + the parent list.
  const runAction = useCallback(
    async (fn: () => Promise<unknown>) => {
      if (actionBusy) return
      setActionBusy(true)
      try {
        await fn()
        loadMeta()
        onMutated()
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) onSessionEnd()
        else toast.error('Something went wrong. Try again.')
      } finally {
        setActionBusy(false)
      }
    },
    [actionBusy, loadMeta, onMutated, onSessionEnd],
  )

  const isIncomingPending = meta?.status === 'pending' && !meta.is_initiator
  const isBlockedByMe = meta?.blocked_by_me === true
  const isWaitingToAccept =
    meta?.status === 'pending' &&
    meta.is_initiator === true &&
    messages.length > 0

  // Reverse-infinite scroll: when the top is reached, prepend the previous page
  // and shift firstItemIndex back by however many we added, so Virtuoso keeps
  // the viewport anchored (no jump). Guarded by hasMore so it can't loop.
  const loadEarlier = useCallback(async () => {
    if (loadingMore || !hasMore || messages.length === 0) return
    setLoadingMore(true)
    try {
      const page = await fetchChatMessages(conversationId, {
        before: messages[0].id,
        limit: PAGE_SIZE,
      })
      const older = [...page.items].reverse()
      if (older.length) {
        setFirstItemIndex((v) => v - older.length)
        setMessages((prev) => [...older, ...prev])
      }
      setHasMore(page.has_more)
    } catch {
      // leave as-is; reaching the top again retries
    } finally {
      setLoadingMore(false)
    }
  }, [conversationId, loadingMore, hasMore, messages])

  useChatEvent('message:new', (msg) => {
    if (msg.conversation_id !== conversationId) return
    setMessages((prev) =>
      prev.some((m) => m.id === msg.id) ? prev : [...prev, msg],
    )
    if (msg.sender_id === otherId) {
      markChatRead(conversationId)
      onActivity()
    }
    // Virtuoso's followOutput auto-scrolls only when we're already at the
    // bottom, so an incoming message never yanks you away from older history.
  })

  useChatEvent('message:read', (evt) => {
    if (evt.conversation_id === conversationId && evt.reader_id === otherId) {
      setOtherLastRead((prev) => Math.max(prev, evt.last_read_message_id ?? 0))
    }
  })

  useChatEvent('message:delivered', (evt) => {
    if (evt.conversation_id === conversationId) {
      setDeliveredMax((prev) => Math.max(prev, evt.message_id))
    }
  })

  useChatEvent('typing', (evt) => {
    if (evt.conversation_id !== conversationId || evt.student_id !== otherId) {
      return
    }
    setPeerTyping(evt.typing)
    if (peerTypingTimeout.current) clearTimeout(peerTypingTimeout.current)
    if (evt.typing) {
      peerTypingTimeout.current = setTimeout(() => setPeerTyping(false), 5000)
    }
  })

  function onChangeText(value: string) {
    setText(value)
    setChatTyping(conversationId, true)
    if (typingTimeout.current) clearTimeout(typingTimeout.current)
    typingTimeout.current = setTimeout(
      () => setChatTyping(conversationId, false),
      1500,
    )
  }

  function onSend() {
    const body = text.trim()
    if (!body) return
    setText('')
    setChatTyping(conversationId, false)
    if (typingTimeout.current) clearTimeout(typingTimeout.current)

    const clientTempId = `t${Date.now()}_${Math.abs(tempIdRef.current)}`
    const temp: UiMessage = {
      id: tempIdRef.current,
      conversation_id: conversationId,
      sender_id: -1, // any id ≠ otherId marks it as "mine"
      body,
      created_at: new Date().toISOString(),
      client_temp_id: clientTempId,
      _status: 'sending',
    }
    tempIdRef.current -= 1
    setMessages((prev) => [...prev, temp])
    // Always jump to the newest message after sending.
    requestAnimationFrame(() =>
      virtuosoRef.current?.scrollToIndex({ index: 'LAST', behavior: 'smooth' }),
    )

    sendChatMessage({ toStudentId: otherId, body, clientTempId }, (res) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.client_temp_id === clientTempId
            ? res.ok && res.message
              ? { ...res.message, _status: 'sent' as SendStatus }
              : { ...m, _status: 'failed' as SendStatus }
            : m,
        ),
      )
      if (res.ok) onActivity()
      else toast.error(res.error ?? 'Message not sent.')
    })
  }

  const listContext = useMemo<ThreadListContext>(
    () => ({ loadingMore, retentionDays }),
    [loadingMore, retentionDays],
  )
  const listComponents = useMemo(
    () => ({ Header: ThreadListHeader, Footer: ThreadListFooter }),
    [],
  )

  return (
    <>
      <header className="flex items-center gap-2.5 border-b bg-card/60 px-3 py-2.5 backdrop-blur">
        <Button
          size="icon"
          variant="ghost"
          onClick={onBack}
          className="md:hidden"
          aria-label="Back to chats"
        >
          <ArrowLeft />
        </Button>
        <button
          type="button"
          onClick={onViewProfile}
          aria-label={`View ${otherName}'s profile`}
          className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg text-left transition-opacity hover:opacity-80"
        >
          <Avatar
            name={otherName}
            photoUrl={meta?.other.photo_url}
            className="size-9"
          />
          <div className="min-w-0 flex-1 leading-tight">
            <p className="flex min-w-0 items-center gap-1.5 truncate text-sm font-semibold">
              <span className="truncate">{otherName}</span>
              {meta?.muted ? (
                <BellOff className="size-3 shrink-0 text-muted-foreground" />
              ) : null}
            </p>
            {peerTyping ? (
              <p className="text-xs font-medium text-primary">typing…</p>
            ) : otherRoll ? (
              <p className="truncate text-xs text-muted-foreground">
                {otherRoll}
              </p>
            ) : null}
          </div>
        </button>
        {meta && !isIncomingPending ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                aria-label="Conversation options"
                disabled={actionBusy}
              >
                <MoreVertical />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onSelect={() =>
                  void runAction(() =>
                    meta.muted
                      ? unmuteChatConversation(conversationId)
                      : muteChatConversation(conversationId),
                  )
                }
              >
                {meta.muted ? <Bell /> : <BellOff />}
                {meta.muted ? 'Unmute' : 'Mute'}
              </DropdownMenuItem>
              <DropdownMenuItem
                variant={meta.blocked_by_me ? 'default' : 'destructive'}
                onSelect={() =>
                  void runAction(() =>
                    meta.blocked_by_me
                      ? unblockChatConversation(conversationId)
                      : blockChatConversation(conversationId),
                  )
                }
              >
                <Ban />
                {meta.blocked_by_me ? 'Unblock' : 'Block'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </header>

      {loading ? (
        <div className="flex flex-1 items-center justify-center bg-muted/20 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : messages.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-1 bg-muted/20 text-center">
          <p className="text-sm font-medium">No messages yet</p>
          <p className="text-xs text-muted-foreground">
            Say hello to {otherName.split(' ')[0]} 👋
          </p>
        </div>
      ) : (
        <Virtuoso<UiMessage, ThreadListContext>
          ref={virtuosoRef}
          data={messages}
          context={listContext}
          components={listComponents}
          firstItemIndex={firstItemIndex}
          initialTopMostItemIndex={Math.max(0, messages.length - 1)}
          startReached={() => void loadEarlier()}
          followOutput={(atBottom) => (atBottom ? 'smooth' : false)}
          computeItemKey={(_index, m) => m.id}
          className="scrollbar-themed bg-muted/20"
          style={{ flex: 1, minHeight: 0 }}
          itemContent={(index, m) => {
            const arrayIndex = index - firstItemIndex
            const prev = messages[arrayIndex - 1]
            const showDay =
              !prev || dayLabel(prev.created_at) !== dayLabel(m.created_at)
            return (
              <div className="px-4 pb-1.5">
                {showDay ? (
                  <div className="flex justify-center py-1.5">
                    <span className="rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      {dayLabel(m.created_at)}
                    </span>
                  </div>
                ) : null}
                <MessageBubble
                  message={m}
                  mine={m.sender_id !== otherId}
                  otherLastRead={otherLastRead}
                  deliveredMax={deliveredMax}
                />
              </div>
            )
          }}
        />
      )}

      {isIncomingPending ? (
        <div className="space-y-2 border-t p-3">
          <p className="text-center text-xs text-muted-foreground">
            {otherName} wants to chat. Accept to reply.
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              className="flex-1"
              disabled={actionBusy}
              onClick={() =>
                void runAction(() => acceptChatRequest(conversationId))
              }
            >
              <Check />
              Accept
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={actionBusy}
              onClick={() =>
                void runAction(() =>
                  blockChatConversation(conversationId).then(onBack),
                )
              }
            >
              <Ban />
              Block
            </Button>
          </div>
        </div>
      ) : isBlockedByMe ? (
        <div className="flex items-center justify-center gap-3 border-t p-3 text-xs text-muted-foreground">
          <span>You blocked {otherName}.</span>
          <Button
            size="sm"
            variant="outline"
            disabled={actionBusy}
            onClick={() =>
              void runAction(() => unblockChatConversation(conversationId))
            }
          >
            Unblock
          </Button>
        </div>
      ) : isWaitingToAccept ? (
        <div className="border-t p-4 text-center text-xs text-muted-foreground">
          Waiting for {otherName} to accept your request.
        </div>
      ) : (
        <div className="flex items-end gap-2 border-t p-3">
          <textarea
            value={text}
            onChange={(e) => onChangeText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                onSend()
              }
            }}
            rows={1}
            placeholder="Message"
            className="max-h-32 min-h-10 flex-1 resize-none rounded-xl border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <Button
            size="icon"
            onClick={onSend}
            disabled={!text.trim()}
            aria-label="Send message"
          >
            <Send />
          </Button>
        </div>
      )}
    </>
  )
}

function MessageBubble({
  message,
  mine,
  otherLastRead,
  deliveredMax,
}: {
  message: UiMessage
  mine: boolean
  otherLastRead: number
  deliveredMax: number
}) {
  return (
    <div className={cn('flex flex-col', mine ? 'items-end' : 'items-start')}>
      <div
        className={cn(
          'max-w-[78%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm shadow-sm',
          mine
            ? 'rounded-br-sm bg-primary text-primary-foreground'
            : 'rounded-bl-sm border border-border bg-card text-foreground',
        )}
      >
        {message.body}
      </div>
      <div className="mt-0.5 flex items-center gap-1 px-1">
        <span className="text-[10px] text-muted-foreground/70">
          {formatMessageTime(message.created_at)}
        </span>
        {mine ? (
          <Receipt
            message={message}
            otherLastRead={otherLastRead}
            deliveredMax={deliveredMax}
          />
        ) : null}
      </div>
    </div>
  )
}

/** WhatsApp-style status ticks for the caller's own messages. */
function Receipt({
  message,
  otherLastRead,
  deliveredMax,
}: {
  message: UiMessage
  otherLastRead: number
  deliveredMax: number
}) {
  if (message._status === 'sending') {
    return <Clock className="size-3 text-muted-foreground/70" />
  }
  if (message._status === 'failed') {
    return <CircleAlert className="size-3 text-destructive" />
  }
  if (message.id >= 0 && otherLastRead >= message.id) {
    return <CheckCheck className="size-3.5 text-primary" /> // read
  }
  if (message.id >= 0 && deliveredMax >= message.id) {
    return <CheckCheck className="size-3.5 text-muted-foreground/70" /> // delivered
  }
  return <Check className="size-3.5 text-muted-foreground/70" /> // sent
}

function EmptyThread() {
  return (
    <div className="hidden flex-1 flex-col items-center justify-center gap-3 p-10 text-center md:flex">
      <div className="grid size-14 place-items-center rounded-full bg-muted text-muted-foreground">
        <MessageCircle className="size-7" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium">Your messages</p>
        <p className="max-w-xs text-xs text-muted-foreground">
          Select a chat on the left, or start a new one with someone in your
          group.
        </p>
      </div>
    </div>
  )
}
