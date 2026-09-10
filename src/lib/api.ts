import { useNetworkStore } from '@/stores/network-store'
import type { DeviceLimitPayload } from './sessions'

export const API_BASE_URL = (
  import.meta.env.VITE_API_URL ?? 'http://localhost:3000'
).replace(/\/+$/, '')

/** Unauthenticated liveness probe (NestJS Terminus) used for recovery checks. */
const HEALTH_PATH = '/health/live'

/** Gateway statuses that mean an upstream proxy couldn't reach the app server. */
const GATEWAY_DOWN = new Set([502, 503, 504])

/** Thrown for any non-2xx response, or when the server is unreachable (status 0). */
export class ApiError extends Error {
  status: number
  /**
   * The parsed response body (JSON, or the raw text when it isn't JSON), for
   * error responses that carry more than a message — e.g. the device-limit
   * 409. Undefined when the server was unreachable.
   */
  data?: unknown

  constructor(status: number, message: string, data?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.data = data
  }
}

/**
 * True for the 409 a login gets when every device slot is taken. The body
 * carries a short-lived `challengeToken` — a bearer credential, so keep it in
 * component state only (never storage or the URL) — plus the occupying
 * devices to pick from.
 */
export function isDeviceLimit(
  err: unknown,
): err is ApiError & { data: DeviceLimitPayload } {
  if (!(err instanceof ApiError) || err.status !== 409) return false
  const data = err.data as Partial<DeviceLimitPayload> | null | undefined
  return (
    !!data &&
    typeof data === 'object' &&
    data.code === 'DEVICE_LIMIT' &&
    typeof data.challengeToken === 'string' &&
    typeof data.limit === 'number' &&
    Array.isArray(data.sessions)
  )
}

/**
 * Failures that say nothing about the caller's credentials — offline, timeout,
 * throttling, server or gateway errors. A token refresh that fails this way
 * must not end the session; only a definitive rejection (401/403/400) does.
 */
export function isTransientApiError(err: unknown): boolean {
  if (!(err instanceof ApiError)) return true
  return (
    err.status === 0 ||
    err.status === 408 ||
    err.status === 429 ||
    err.status >= 500
  )
}

/**
 * `fetch` that passively reports reachability into the network store. A resolved
 * `Response` is treated as online (even a 4xx/5xx app error), except gateway
 * statuses {502,503,504} which mean a proxy couldn't reach the app. A thrown
 * error (network down / DNS / abort) is a failure. The original result/error is
 * always returned/rethrown unchanged so call-site handling is untouched.
 */
async function fetchReporting(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  try {
    const res = await fetch(input, init)
    const net = useNetworkStore.getState()
    if (GATEWAY_DOWN.has(res.status)) net.reportFail()
    else net.reportOk()
    return res
  } catch (err) {
    useNetworkStore.getState().reportFail()
    throw err
  }
}

/**
 * Cheap, unauthenticated liveness check against `/health/live`. Returns a
 * boolean and writes nothing to the store — the monitor uses it for the
 * confirming probe and recovery polling. Aborts after `timeoutMs`.
 */
export async function pingServer(timeoutMs = 4000): Promise<boolean> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(`${API_BASE_URL}${HEALTH_PATH}`, {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
    })
    return res.ok
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

interface ApiFetchOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  token?: string
}

export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const headers: Record<string, string> = {}
  if (options.body !== undefined) headers['Content-Type'] = 'application/json'
  if (options.token) headers['Authorization'] = `Bearer ${options.token}`

  let res: Response
  try {
    res = await fetchReporting(`${API_BASE_URL}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body:
        options.body !== undefined ? JSON.stringify(options.body) : undefined,
    })
  } catch {
    throw new ApiError(
      0,
      'Cannot reach the server. Check your connection and try again.',
    )
  }

  if (res.status === 204) return undefined as T

  let data: unknown = null
  const text = await res.text()
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = text
    }
  }

  if (!res.ok) {
    throw new ApiError(res.status, extractMessage(data, res.status), data)
  }
  return data as T
}

/**
 * Multipart upload. Content-Type is left unset on purpose — the browser
 * generates the boundary; setting it manually breaks the request.
 */
export async function apiUpload<T>(
  path: string,
  form: FormData,
  token: string,
  method: 'POST' | 'PUT' = 'POST',
): Promise<T> {
  let res: Response
  try {
    res = await fetchReporting(`${API_BASE_URL}${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    })
  } catch {
    throw new ApiError(
      0,
      'Cannot reach the server. Check your connection and try again.',
    )
  }

  if (res.status === 204) return undefined as T

  let data: unknown = null
  const text = await res.text()
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = text
    }
  }

  if (!res.ok) {
    throw new ApiError(res.status, extractMessage(data, res.status), data)
  }
  return data as T
}

/** Pull a human-readable message out of a Nest/Zod error body. */
function extractMessage(data: unknown, status: number): string {
  if (data && typeof data === 'object' && 'message' in data) {
    const message = (data as { message: unknown }).message
    if (typeof message === 'string') return message
    if (
      Array.isArray(message) &&
      message.length > 0 &&
      typeof message[0] === 'string'
    ) {
      return message[0]
    }
  }
  if (typeof data === 'string' && data.length > 0) return data
  return `Request failed (${status})`
}
