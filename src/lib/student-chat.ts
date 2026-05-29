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
}

export interface ChatMessagesPage {
  /** Newest first. */
  items: ChatMessage[]
  has_more: boolean
}

// --- calls -----------------------------------------------------------------

export function fetchChatConfig(): Promise<{ retention_days: number }> {
  return withAuth((token) =>
    apiFetch<{ retention_days: number }>('/student/chat/config', { token }),
  )
}

export function fetchChatContacts(): Promise<ChatContact[]> {
  return withAuth((token) =>
    apiFetch<ChatContact[]>('/student/chat/contacts', { token }),
  )
}

export function fetchChatConversations(): Promise<ChatConversationSummary[]> {
  return withAuth((token) =>
    apiFetch<ChatConversationSummary[]>('/student/chat/conversations', {
      token,
    }),
  )
}

export function fetchChatUnreadCount(): Promise<{ total: number }> {
  return withAuth((token) =>
    apiFetch<{ total: number }>('/student/chat/unread-count', { token }),
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
