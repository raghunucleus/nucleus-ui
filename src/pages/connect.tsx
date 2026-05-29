import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso'
import {
  ArrowLeft,
  Check,
  CheckCheck,
  CircleAlert,
  Clock,
  Loader2,
  MessageCircle,
  Plus,
  RefreshCw,
  Search,
  Send,
} from 'lucide-react'
import { toast } from 'sonner'

import { PageHeader } from '@/components/portal-layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ApiError } from '@/lib/api'
import { MODULE_SOFT } from '@/lib/modules'
import { avatarColorFor } from '@/lib/student-birthdays'
import {
  birthdayWish,
  fetchChatConfig,
  fetchChatContacts,
  fetchChatConversations,
  fetchChatMessages,
  formatConversationTime,
  formatMessageTime,
  openChatConversation,
  type ChatContact,
  type ChatConversationSummary,
  type ChatMessage,
} from '@/lib/student-chat'
import {
  markChatRead,
  sendChatMessage,
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
  className,
}: {
  name: string
  className?: string
}) {
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
  const [composing, setComposing] = useState(false)

  useEffect(() => {
    document.title = 'Connect — Nucleus'
  }, [])

  // Deep link (e.g. "send a wish" from the dashboard): open the chat with `to`,
  // optionally pre-filling a birthday greeting, then strip the params so a
  // refresh or back-nav doesn't re-open it.
  const deepLinkHandled = useRef(false)
  useEffect(() => {
    if (deepLinkHandled.current || !search.to) return
    deepLinkHandled.current = true
    const to = search.to
    const name = search.name ?? 'Chat'
    const wantWish = search.wish === true
    void (async () => {
      try {
        const conv = await openChatConversation(to)
        setActive({
          id: conv.id,
          other: { id: to, display_name: name, student_id: '' },
          otherLastRead: 0,
          draft: wantWish ? birthdayWish(name) : undefined,
        })
        setComposing(false)
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) signOut()
        else toast.error('Could not open the chat.')
      } finally {
        void navigate({ to: '/connect', search: {}, replace: true })
      }
    })()
  }, [search, navigate, signOut])

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

  useEffect(() => {
    void loadConversations()
  }, [loadConversations])

  // Any message or read change anywhere refreshes the list (previews/unread).
  useChatEvent('message:new', () => void loadConversations())
  useChatEvent('message:read', () => void loadConversations())

  const openConversation = useCallback((c: ChatConversationSummary) => {
    setActive({
      id: c.id,
      other: c.other,
      otherLastRead: c.other_last_read_message_id ?? 0,
    })
    setComposing(false)
  }, [])

  const startChatWith = useCallback(
    async (contact: ChatContact) => {
      try {
        const conv = await openChatConversation(contact.id)
        setActive({ id: conv.id, other: contact, otherLastRead: 0 })
        setComposing(false)
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
          {composing ? (
            <NewChatPanel
              onPick={startChatWith}
              onClose={() => setComposing(false)}
              onSessionEnd={signOut}
            />
          ) : (
            <ConversationList
              conversations={conversations}
              loading={loading}
              error={error}
              activeId={active?.id ?? null}
              onSelect={openConversation}
              onNewChat={() => setComposing(true)}
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
              onBack={() => setActive(null)}
              onActivity={loadConversations}
              onSessionEnd={signOut}
            />
          ) : (
            <EmptyThread />
          )}
        </section>
      </div>
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
  onSelect,
  onNewChat,
  onRetry,
}: {
  conversations: ChatConversationSummary[]
  loading: boolean
  error: string | null
  activeId: number | null
  onSelect: (c: ChatConversationSummary) => void
  onNewChat: () => void
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
          <div className="flex flex-col items-center gap-3 p-8 text-center">
            <CircleAlert className="size-6 text-destructive" />
            <p className="text-xs text-muted-foreground">{error}</p>
            <Button size="sm" variant="outline" onClick={onRetry}>
              <RefreshCw />
              Try again
            </Button>
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-8 text-center">
            <p className="text-sm font-medium">No chats yet</p>
            <p className="max-w-[16rem] text-xs text-muted-foreground">
              Start a conversation with someone in your group.
            </p>
            <Button size="sm" variant="outline" onClick={onNewChat}>
              <Plus />
              New chat
            </Button>
          </div>
        ) : filtered.length === 0 ? (
          <p className="p-8 text-center text-xs text-muted-foreground">
            No one matches &ldquo;{query.trim()}&rdquo;.
          </p>
        ) : (
          <ul className="p-1.5">
            {filtered.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => onSelect(c)}
                  aria-current={activeId === c.id}
                  className={cn(
                    'relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors',
                    activeId === c.id
                      ? 'bg-primary/10'
                      : 'hover:bg-muted/70',
                  )}
                >
                  {activeId === c.id ? (
                    <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-primary" />
                  ) : null}
                  <Avatar name={c.other.display_name} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate text-sm font-medium">
                        {c.other.display_name}
                      </p>
                      {c.last_message_at ? (
                        <span
                          className={cn(
                            'shrink-0 text-[11px]',
                            c.unread > 0
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
                          c.unread > 0
                            ? 'font-medium text-foreground'
                            : 'text-muted-foreground',
                        )}
                      >
                        {c.last_message_preview ?? 'No messages yet'}
                      </p>
                      {c.unread > 0 ? (
                        <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
                          {c.unread > 99 ? '99+' : c.unread}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// New-chat picker
// ---------------------------------------------------------------------------

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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    let alive = true
    fetchChatContacts()
      .then((rows) => {
        if (alive) setContacts(rows)
      })
      .catch((err) => {
        if (!alive) return
        if (err instanceof ApiError && err.status === 401) {
          onSessionEnd()
          return
        }
        setError(err instanceof Error ? err.message : 'Could not load contacts.')
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [onSessionEnd])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return contacts
    return contacts.filter(
      (c) =>
        c.display_name.toLowerCase().includes(q) ||
        c.student_id.toLowerCase().includes(q),
    )
  }, [contacts, query])

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

      <div className="scrollbar-themed min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <div className="space-y-2 p-3">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : error ? (
          <p className="p-8 text-center text-xs text-muted-foreground">{error}</p>
        ) : filtered.length === 0 ? (
          <p className="p-8 text-center text-xs text-muted-foreground">
            {query ? 'No matches.' : 'No one else in your group yet.'}
          </p>
        ) : (
          <ul className="divide-y">
            {filtered.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => onPick(c)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent"
                >
                  <Avatar name={c.display_name} />
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
  onBack,
  onActivity,
  onSessionEnd,
}: {
  conversationId: number
  otherId: number
  otherName: string
  otherRoll: string
  otherLastReadInit: number
  initialDraft?: string
  onBack: () => void
  onActivity: () => void
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
        <Avatar name={otherName} className="size-9" />
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-sm font-semibold">{otherName}</p>
          {peerTyping ? (
            <p className="text-xs font-medium text-primary">typing…</p>
          ) : otherRoll ? (
            <p className="truncate text-xs text-muted-foreground">{otherRoll}</p>
          ) : null}
        </div>
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
