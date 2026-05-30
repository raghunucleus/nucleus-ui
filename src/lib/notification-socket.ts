import { useEffect, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'

import { useAuthStore } from '@/stores/auth-store'
import { API_BASE_URL } from './api'
import { getAccessToken } from './student-auth'
import { refreshAccessToken, type StudentNotification } from './student-notifications'

/**
 * Single shared Socket.IO connection to the student notifications namespace.
 * Mirrors `chat-socket.ts`: authenticates with the stored access token at the
 * handshake and refreshes-then-reconnects once if the server drops it for an
 * expired token. Server → client only (marking read happens over REST).
 */

export interface UnreadEvent {
  unread: number
}

let socket: Socket | null = null

/** Get (lazily creating) the shared socket, or null if not signed in. */
export function getNotificationSocket(): Socket | null {
  const token = getAccessToken()
  if (!token) return null

  if (!socket) {
    socket = io(`${API_BASE_URL}/student/notifications`, {
      transports: ['websocket'],
      auth: { token },
      reconnection: true,
    })

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
export function disconnectNotificationSocket(): void {
  if (socket) {
    socket.removeAllListeners()
    socket.disconnect()
    socket = null
  }
}

// Drop the connection the moment the session is cleared.
const unsubscribeAuth = useAuthStore.subscribe((state, prev) => {
  if (prev.authed && !state.authed) disconnectNotificationSocket()
})

// Vite HMR safety: tear down the singleton + subscription on hot-replace so
// edits don't strand orphaned sockets that churn connect/disconnect.
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    unsubscribeAuth()
    disconnectNotificationSocket()
  })
}

// --- React hooks -----------------------------------------------------------

/** Ensure the socket is connected while mounted; report live connection state. */
export function useNotificationConnection(): { connected: boolean } {
  const authed = useAuthStore((s) => s.authed)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    const s = getNotificationSocket()
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

type NotificationEventMap = {
  'notification:new': StudentNotification
  'notification:unread': UnreadEvent
}

/** Subscribe to a notification socket event for the lifetime of the component. */
export function useNotificationEvent<K extends keyof NotificationEventMap>(
  event: K,
  handler: (payload: NotificationEventMap[K]) => void,
): void {
  const ref = useRef(handler)
  ref.current = handler

  useEffect(() => {
    const s = getNotificationSocket()
    if (!s) return
    const listener = (payload: NotificationEventMap[K]) => ref.current(payload)
    s.on(event, listener as never)
    return () => {
      s.off(event, listener as never)
    }
  }, [event])
}
