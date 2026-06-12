export const API_BASE_URL = (
  import.meta.env.VITE_API_URL ?? 'http://localhost:3000'
).replace(/\/+$/, '')

/** Thrown for any non-2xx response, or when the server is unreachable (status 0). */
export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
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
    res = await fetch(`${API_BASE_URL}${path}`, {
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
    throw new ApiError(res.status, extractMessage(data, res.status))
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
): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
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
    throw new ApiError(res.status, extractMessage(data, res.status))
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
