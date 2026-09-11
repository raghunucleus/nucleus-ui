/**
 * A persistent id for THIS browser, sent with every login so the server can
 * tell "the same device signing in again" (which replaces its existing
 * session) from "a new device" (which takes a slot toward the device limit).
 *
 * Deliberately its own localStorage key, outside every portal's token
 * namespace: it must survive sign-out and switching accounts — it identifies
 * the browser, not the person. Each portal is its own origin (student.*,
 * employee.*, parent.*), so each gets its own id, matching the server's
 * per-audience sessions. Carried in the login body, never as a header.
 */
const DEVICE_ID_KEY = 'nucleus-device-id'

/** Server-side cap on `device_id`. */
const MAX_LENGTH = 64

/** In-memory fallback for storage-walled browsers (private mode, policies). */
let ephemeralId: string | null = null

/**
 * A random v4-style UUID. `crypto.randomUUID` only exists in secure contexts,
 * and the app is also reached over plain http on the campus LAN — so fall
 * back to `getRandomValues` (available everywhere), then to Math.random.
 * This is an identifier, not a secret; it only needs to be unique.
 */
function mintId(): string {
  try {
    if (typeof crypto !== 'undefined') {
      if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
      if (typeof crypto.getRandomValues === 'function') {
        const bytes = crypto.getRandomValues(new Uint8Array(16))
        bytes[6] = (bytes[6] & 0x0f) | 0x40
        bytes[8] = (bytes[8] & 0x3f) | 0x80
        const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0'))
        return [
          hex.slice(0, 4).join(''),
          hex.slice(4, 6).join(''),
          hex.slice(6, 8).join(''),
          hex.slice(8, 10).join(''),
          hex.slice(10, 16).join(''),
        ].join('-')
      }
    }
  } catch {
    // fall through to Math.random
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

export function getDeviceId(): string {
  try {
    const stored = localStorage.getItem(DEVICE_ID_KEY)
    if (stored && stored.trim() && stored.length <= MAX_LENGTH) return stored
    const minted = mintId()
    localStorage.setItem(DEVICE_ID_KEY, minted)
    return minted
  } catch {
    // No storage: an id stable for this tab still lets a retry in this tab
    // replace the session it just created rather than stack another.
    if (!ephemeralId) ephemeralId = mintId()
    return ephemeralId
  }
}
