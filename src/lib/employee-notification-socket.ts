import { useEffect, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'

import { useEmployeeAuthStore } from '@/stores/employee-auth-store'
import { API_BASE_URL } from './api'
import {
  getEmployeeAccessToken,
  refreshEmployeeAccessToken,
} from './employee-auth'
import type { EmployeeNotification } from './employee-notifications'

/**
 * Single shared Socket.IO connection to the employee notifications namespace.
 * Mirrors the student `notification-socket.ts`: authenticates with the stored
 * access token at the handshake and refreshes-then-reconnects once if the
 * server drops it for an expired token. Server → client only (marking read
 * happens over REST).
 *
 * Its own singleton, separate from the student socket — the two portals never
 * run in the same tab, and the namespaces/secrets differ.
 */

export interface UnreadEvent {
  unread: number
}

let socket: Socket | null = null

/** Get (lazily creating) the shared socket, or null if not signed in. */
export function getEmployeeNotificationSocket(): Socket | null {
  const token = getEmployeeAccessToken()
  if (!token) return null

  if (!socket) {
    socket = io(`${API_BASE_URL}/employee/notifications`, {
      transports: ['websocket'],
      auth: { token },
      reconnection: true,
    })

    socket.on('disconnect', (reason) => {
      if (reason === 'io server disconnect') {
        void refreshEmployeeAccessToken().then((fresh) => {
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
export function disconnectEmployeeNotificationSocket(): void {
  if (socket) {
    socket.removeAllListeners()
    socket.disconnect()
    socket = null
  }
}

// Drop the connection the moment the session is cleared.
const unsubscribeAuth = useEmployeeAuthStore.subscribe((state, prev) => {
  if (prev.authed && !state.authed) disconnectEmployeeNotificationSocket()
})

// Vite HMR safety: tear down the singleton + subscription on hot-replace so
// edits don't strand orphaned sockets that churn connect/disconnect.
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    unsubscribeAuth()
    disconnectEmployeeNotificationSocket()
  })
}

// --- React hooks -----------------------------------------------------------

/** Ensure the socket is connected while mounted; report live connection state. */
export function useEmployeeNotificationConnection(): { connected: boolean } {
  const authed = useEmployeeAuthStore((s) => s.authed)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    const s = getEmployeeNotificationSocket()
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
  'notification:new': EmployeeNotification
  'notification:unread': UnreadEvent
}

/** Subscribe to a notification socket event for the lifetime of the component. */
export function useEmployeeNotificationEvent<
  K extends keyof NotificationEventMap,
>(event: K, handler: (payload: NotificationEventMap[K]) => void): void {
  const ref = useRef(handler)
  ref.current = handler

  useEffect(() => {
    const s = getEmployeeNotificationSocket()
    if (!s) return
    const listener = (payload: NotificationEventMap[K]) => ref.current(payload)
    s.on(event, listener as never)
    return () => {
      s.off(event, listener as never)
    }
  }, [event])
}
