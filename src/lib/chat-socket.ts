import { useEffect, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'

import { useAuthStore } from '@/stores/auth-store'
import { API_BASE_URL } from './api'
import { getAccessToken } from './student-auth'
import {
  birthdayWish,
  refreshAccessToken,
  type ChatMessage,
} from './student-chat'

/**
 * Single shared Socket.IO connection to the student chat namespace. Authenticates
 * with the stored access token at the handshake; if the server drops it for an
 * expired token, refresh once and reconnect. Components subscribe via the hooks
 * below; emit helpers are imperative.
 */

export interface TypingEvent {
  conversation_id: number
  student_id: number
  typing: boolean
}
export interface ReadEvent {
  conversation_id: number
  reader_id: number
  last_read_message_id: number | null
}
export interface DeliveredEvent {
  conversation_id: number
  message_id: number
}
export interface SendAck {
  ok: boolean
  message?: ChatMessage
  error?: string
}

let socket: Socket | null = null

/** Get (lazily creating) the shared socket, or null if not signed in. */
export function getChatSocket(): Socket | null {
  const token = getAccessToken()
  if (!token) return null

  if (!socket) {
    socket = io(`${API_BASE_URL}/student/chat`, {
      transports: ['websocket'],
      auth: { token },
      reconnection: true,
    })

    // The gateway accepts the handshake then disconnects if the token is bad or
    // expired (a server-initiated disconnect, which Socket.IO will NOT auto-
    // retry). Refresh once and reconnect with the new token.
    socket.on('disconnect', (reason) => {
      if (reason === 'io server disconnect') {
        void refreshAccessToken().then((fresh) => {
          if (fresh && socket) {
            socket.auth = { token: fresh }
            socket.connect()
          }
        })
      }
    })
  }
  return socket
}

/** Tear down the shared socket — call on sign-out. */
export function disconnectChatSocket(): void {
  if (socket) {
    socket.removeAllListeners()
    socket.disconnect()
    socket = null
  }
}

// Drop the connection the moment the session is cleared.
const unsubscribeAuth = useAuthStore.subscribe((state, prev) => {
  if (prev.authed && !state.authed) disconnectChatSocket()
})

// Vite HMR safety: when this module is hot-replaced during development, tear
// down the singleton socket and the store subscription. Otherwise each edit
// strands the previous socket (still connected and auto-reconnecting) and
// stacks another auth subscription — the orphans churn connect/disconnect and
// make every chat view flicker until a full reload.
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    unsubscribeAuth()
    disconnectChatSocket()
  })
}

// --- emit helpers ----------------------------------------------------------

export function sendChatMessage(
  payload: { toStudentId: number; body: string; clientTempId?: string },
  ack?: (res: SendAck) => void,
): void {
  getChatSocket()?.emit('message:send', payload, ack)
}

export function markChatRead(conversationId: number): void {
  getChatSocket()?.emit('message:read', { conversationId })
}

export function setChatTyping(conversationId: number, typing: boolean): void {
  getChatSocket()?.emit(
    typing ? 'typing:start' : 'typing:stop',
    { conversationId },
  )
}

/**
 * Send a personalized birthday greeting to several classmates at once. The
 * gateway get-or-creates each conversation and persists the message, so no
 * conversation needs to exist first. Resolves with how many were delivered;
 * a per-message 6s timeout means one stuck send can't hang the whole batch.
 */
export function sendBirthdayWishes(
  people: { id: number; display_name: string }[],
): Promise<{ sent: number; failed: number }> {
  const sendOne = (p: { id: number; display_name: string }) =>
    new Promise<boolean>((resolve) => {
      let done = false
      const finish = (ok: boolean) => {
        if (!done) {
          done = true
          resolve(ok)
        }
      }
      sendChatMessage(
        { toStudentId: p.id, body: birthdayWish(p.display_name) },
        (res) => finish(res.ok),
      )
      setTimeout(() => finish(false), 6000)
    })
  return Promise.all(people.map(sendOne)).then((results) => ({
    sent: results.filter(Boolean).length,
    failed: results.filter((ok) => !ok).length,
  }))
}

// --- React hooks -----------------------------------------------------------

/** Ensure the socket is connected while mounted; report live connection state. */
export function useChatConnection(): { connected: boolean } {
  const authed = useAuthStore((s) => s.authed)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    const s = getChatSocket()
    if (!s) return
    setConnected(s.connected)
    const onConnect = () => setConnected(true)
    const onDisconnect = () => setConnected(false)
    s.on('connect', onConnect)
    s.on('disconnect', onDisconnect)
    return () => {
      s.off('connect', onConnect)
      s.off('disconnect', onDisconnect)
    }
  }, [authed])

  return { connected }
}

type ChatEventMap = {
  'message:new': ChatMessage
  'message:read': ReadEvent
  'message:delivered': DeliveredEvent
  typing: TypingEvent
}

/** Subscribe to a chat socket event for the lifetime of the component. */
export function useChatEvent<K extends keyof ChatEventMap>(
  event: K,
  handler: (payload: ChatEventMap[K]) => void,
): void {
  const ref = useRef(handler)
  ref.current = handler

  useEffect(() => {
    const s = getChatSocket()
    if (!s) return
    const listener = (payload: ChatEventMap[K]) => ref.current(payload)
    s.on(event, listener as never)
    return () => {
      s.off(event, listener as never)
    }
  }, [event])
}
