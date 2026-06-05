import { ApiError, apiFetch } from './api'
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  storeTokens,
  type AuthTokens,
} from './student-auth'

/**
 * Student chat ("Connect") API surface — mirrors nucleus-server's
 * `/student/chat/*` routes and pairs with the realtime socket in
 * `chat-socket.ts`. Every call is scoped to the signed-in student server-side
 * (the id comes from the JWT, never the client). Same backend the mobile app
 * uses; nothing here is web-specific.
 */

// --- types (mirror the server DTOs) ----------------------------------------

/** A groupmate the caller may start a chat with. */
export interface ChatContact {
  id: number
  display_name: string
  /** Roll number. */
  student_id: string
}

/** One chat message, as returned by REST history and socket events. */
export interface ChatMessage {
  id: number
  conversation_id: number
  sender_id: number
  body: string
  /** ISO timestamp. */
  created_at: string
  /** Echoed back on the sender's own message so an optimistic row reconciles. */
  client_temp_id?: string | null
  /**
   * Sender's display name. Present only on the realtime `message:new` event
   * (drives the global in-app notification); REST history omits it.
   */
  sender_name?: string | null
}

/** A row in the conversation list. */
export interface ChatConversationSummary {
  id: number
  other: ChatContact
  last_message_preview: string | null
  last_message_at: string | null
  last_message_sender_id: number | null
  /** Newest message id the other participant has read — drives our ticks. */
  other_last_read_message_id: number | null
  unread: number
  /** Consent state. `pending` here only ever means an invite *I* sent (outgoing). */
  status: 'pending' | 'accepted'
  /** Did I send the invite? While `pending`, always true in this list. */
  is_initiator: boolean
  /** Have I muted this conversation? */
  muted: boolean
  /** Have I blocked the other participant? */
  blocked_by_me: boolean
}

/** An incoming pending request in the Requests inbox. */
export interface ChatRequestSummary {
  id: number
  other: ChatContact
  invite_preview: string | null
  invite_at: string | null
  initiated_by_id: number
}

/** Per-conversation consent/block/mute state — drives the thread composer. */
export interface ChatConversationMeta {
  id: number
  other: ChatContact
  status: 'pending' | 'accepted'
  is_initiator: boolean
  muted: boolean
  blocked_by_me: boolean
}

export interface ChatMessagesPage {
  /** Newest first. */
  items: ChatMessage[]
  has_more: boolean
}

/** A page of new-chat contacts. `total` ignores limit/offset (drives "has more"). */
export interface ChatContactsPage {
  total: number
  items: ChatContact[]
}

export interface ChatContactsQuery {
  limit?: number
  offset?: number
  /** Search over display name OR roll number (server-side). */
  q?: string
}

// --- calls -----------------------------------------------------------------

export function fetchChatConfig(): Promise<{ retention_days: number }> {
  return withAuth((token) =>
    apiFetch<{ retention_days: number }>('/student/chat/config', { token }),
  )
}

/** A page of groupmates for the new-chat picker (name-ordered, searchable). */
export function fetchChatContacts(
  params: ChatContactsQuery = {},
): Promise<ChatContactsPage> {
  const qs = new URLSearchParams()
  if (params.limit != null) qs.set('limit', String(params.limit))
  if (params.offset != null) qs.set('offset', String(params.offset))
  if (params.q) qs.set('q', params.q)
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  return withAuth((token) =>
    apiFetch<ChatContactsPage>(`/student/chat/contacts${suffix}`, { token }),
  )
}

export function fetchChatConversations(): Promise<ChatConversationSummary[]> {
  return withAuth((token) =>
    apiFetch<ChatConversationSummary[]>('/student/chat/conversations', {
      token,
    }),
  )
}

export function fetchChatUnreadCount(): Promise<{
  total: number
  pending_requests: number
}> {
  return withAuth((token) =>
    apiFetch<{ total: number; pending_requests: number }>(
      '/student/chat/unread-count',
      { token },
    ),
  )
}

/** The caller's consent/block/mute state for one conversation. */
export function fetchChatConversationMeta(
  conversationId: number,
): Promise<ChatConversationMeta> {
  return withAuth((token) =>
    apiFetch<ChatConversationMeta>(
      `/student/chat/conversations/${conversationId}`,
      { token },
    ),
  )
}

/** Incoming message requests — the Requests inbox. */
export function fetchChatRequests(): Promise<ChatRequestSummary[]> {
  return withAuth((token) =>
    apiFetch<ChatRequestSummary[]>('/student/chat/requests', { token }),
  )
}

/** Conversations the caller has muted and/or blocked — the management list. */
export function fetchChatRestricted(): Promise<ChatConversationSummary[]> {
  return withAuth((token) =>
    apiFetch<ChatConversationSummary[]>('/student/chat/restricted', { token }),
  )
}

/** Accept an incoming request, optionally muting it in the same step. */
export function acceptChatRequest(
  conversationId: number,
  opts: { mute?: boolean } = {},
): Promise<{ ok: true }> {
  return withAuth((token) =>
    apiFetch<{ ok: true }>(
      `/student/chat/conversations/${conversationId}/accept`,
      { method: 'POST', token, body: { mute: opts.mute ?? false } },
    ),
  )
}

/** Block the other participant (works on a request or an accepted chat). */
export function blockChatConversation(
  conversationId: number,
): Promise<{ ok: true }> {
  return withAuth((token) =>
    apiFetch<{ ok: true }>(
      `/student/chat/conversations/${conversationId}/block`,
      { method: 'POST', token },
    ),
  )
}

/** Unblock the other participant. */
export function unblockChatConversation(
  conversationId: number,
): Promise<{ ok: true }> {
  return withAuth((token) =>
    apiFetch<{ ok: true }>(
      `/student/chat/conversations/${conversationId}/unblock`,
      { method: 'POST', token },
    ),
  )
}

/** Mute the conversation (suppresses our notifications). */
export function muteChatConversation(
  conversationId: number,
): Promise<{ ok: true }> {
  return withAuth((token) =>
    apiFetch<{ ok: true }>(
      `/student/chat/conversations/${conversationId}/mute`,
      { method: 'POST', token },
    ),
  )
}

/** Unmute the conversation. */
export function unmuteChatConversation(
  conversationId: number,
): Promise<{ ok: true }> {
  return withAuth((token) =>
    apiFetch<{ ok: true }>(
      `/student/chat/conversations/${conversationId}/unmute`,
      { method: 'POST', token },
    ),
  )
}

/** Open (find or create) the conversation between the caller and `studentId`. */
export function openChatConversation(
  studentId: number,
): Promise<{ id: number; other_id: number }> {
  return withAuth((token) =>
    apiFetch<{ id: number; other_id: number }>('/student/chat/conversations', {
      method: 'POST',
      token,
      body: { studentId },
    }),
  )
}

/** A page of history (newest first). Pass `before` (oldest id seen) to page back. */
export function fetchChatMessages(
  conversationId: number,
  opts: { before?: number; limit?: number } = {},
): Promise<ChatMessagesPage> {
  const qs = new URLSearchParams()
  if (opts.before != null) qs.set('before', String(opts.before))
  if (opts.limit != null) qs.set('limit', String(opts.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  return withAuth((token) =>
    apiFetch<ChatMessagesPage>(
      `/student/chat/conversations/${conversationId}/messages${suffix}`,
      { token },
    ),
  )
}

/** Friendly pre-filled birthday greeting, addressed by first name. */
export function birthdayWish(name: string): string {
  const first = name.trim().split(/\s+/)[0] || 'there'
  return `Happy birthday, ${first}! 🎉🎂 Wishing you an amazing year ahead!`
}

// --- formatting helpers ----------------------------------------------------

/** Clock time of a message, e.g. "9:30 am" (en-IN). */
export function formatMessageTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

/** Conversation-list timestamp: clock time if today, else a short date. */
export function formatConversationTime(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const now = new Date()
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  if (sameDay) return formatMessageTime(iso)
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

// --- auth helper (local mirror of student-auth's private withAuth) ---------

async function withAuth<T>(call: (token: string) => Promise<T>): Promise<T> {
  const token = getAccessToken()
  if (!token) {
    throw new ApiError(401, 'Your session has ended. Please sign in again.')
  }
  try {
    return await call(token)
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      const refreshed = await refreshAccessToken()
      if (refreshed) return call(refreshed)
      clearTokens()
      throw new ApiError(401, 'Your session has expired. Please sign in again.')
    }
    throw err
  }
}

/**
 * Refresh the access token and persist it. Exported so the socket layer can run
 * the same recovery when its handshake is rejected for an expired token.
 */
export async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken()
  if (!refreshToken) return null
  try {
    const tokens = await apiFetch<AuthTokens>('/student/auth/refresh', {
      method: 'POST',
      body: { refreshToken },
    })
    storeTokens(tokens)
    return tokens.accessToken
  } catch {
    return null
  }
}
