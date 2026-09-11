// ---------------------------------------------------------------------------
// Signed-in devices ("sessions") — shared by the student, employee and parent
// portals. Every audience is capped at a number of devices (2 by default;
// an admin can raise it per employee). A login past the cap is paused with a
// 409 DEVICE_LIMIT and finished from the device-limit picker; "My devices"
// lists and revokes the caller's own sessions.
//
// Types and pure helpers only — each audience's calls live in its own
// `*-auth.ts`, next to the token storage and refresh wrapper they depend on.
// ---------------------------------------------------------------------------

/** One occupying device, as the device-limit 409 lists it (no IP pre-auth). */
export interface DeviceLimitSession {
  /** Session id (uuid) — what the picker sends back to sign it out. */
  id: string
  /** "Chrome 130 on Windows", or the phone model the mobile apps send. */
  device_name: string
  created_at: string
  last_used_at: string
}

/** Body of the 409 a login gets when every device slot is taken. */
export interface DeviceLimitPayload {
  statusCode: 409
  code: 'DEVICE_LIMIT'
  message: string
  /** Single-use, 5-minute bearer credential. Component state only. */
  challengeToken: string
  limit: number
  /** Most recently active first. */
  sessions: DeviceLimitSession[]
}

/** What a login page holds while the picker is up. */
export type DeviceLimitChallenge = Pick<
  DeviceLimitPayload,
  'challengeToken' | 'limit' | 'sessions'
>

/** One of the caller's own signed-in devices (`GET /x/sessions`). */
export interface SessionRow extends DeviceLimitSession {
  /** True for the session this request rode in on — i.e. this browser. */
  current: boolean
}

/** Narrow a DEVICE_LIMIT body to the part a login page keeps. */
export function toDeviceLimitChallenge(
  payload: DeviceLimitPayload,
): DeviceLimitChallenge {
  return {
    challengeToken: payload.challengeToken,
    limit: payload.limit,
    sessions: payload.sessions,
  }
}

/** Phone/tablet vs. computer, from the label alone — only picks the icon. */
export function isMobileDeviceName(deviceName: string): boolean {
  return /\b(android|ios|ipados|iphone|ipad|mobile)\b/i.test(deviceName)
}

/**
 * "5 minutes ago" / "yesterday" / "3 Sep" for a session timestamp, in the
 * given locale — `Intl` does the wording, so the parent portal's Hindi and
 * Telugu come for free. Anything older than a week shows the date instead.
 */
export function formatRelativeTime(iso: string, locale = 'en-IN'): string {
  const then = new Date(iso)
  const ms = then.getTime()
  if (!Number.isFinite(ms)) return ''

  let rtf: Intl.RelativeTimeFormat
  try {
    rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  } catch {
    rtf = new Intl.RelativeTimeFormat('en-IN', { numeric: 'auto' })
  }

  // Clamp: a clock slightly behind the server would otherwise say "in 2 minutes".
  const seconds = Math.max(0, Math.round((Date.now() - ms) / 1000))
  if (seconds < 60) return rtf.format(0, 'second')
  if (seconds < 3600) return rtf.format(-Math.floor(seconds / 60), 'minute')
  if (seconds < 86400) return rtf.format(-Math.floor(seconds / 3600), 'hour')
  if (seconds < 7 * 86400) {
    return rtf.format(-Math.floor(seconds / 86400), 'day')
  }

  const sameYear = then.getFullYear() === new Date().getFullYear()
  try {
    return then.toLocaleDateString(locale, {
      day: 'numeric',
      month: 'short',
      year: sameYear ? undefined : 'numeric',
    })
  } catch {
    return then.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
  }
}
