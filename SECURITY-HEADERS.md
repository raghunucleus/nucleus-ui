# Security headers — nucleus-ui

`vite build` generates `dist/_headers` with the real origins substituted from
`VITE_API_URL` and `VITE_STORAGE_ORIGIN`, plus a SHA-256 hash of the inline
script in `index.html`. This document explains what is in that file and why, so
the values can be transcribed into a host that does not read `_headers`
(CloudFront, nginx).

**Do not check a policy into `public/`.** That directory is copied byte-for-byte
with no substitution, so a committed policy would ship the literal string
`API_ORIGIN` — which CSP parses happily as a hostname matching nothing, blocking
every API call and all three sockets. Worse than shipping no CSP at all.

## The policy

```
default-src 'self';
base-uri 'self';
object-src 'none';
frame-ancestors 'none';
form-action 'self';
script-src 'self' 'sha256-<INLINE_SCRIPT_HASH>' https://accounts.google.com;
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob: S3_ORIGIN;
font-src 'self' data:;
connect-src 'self' API_ORIGIN WS_ORIGIN S3_ORIGIN https://accounts.google.com;
frame-src https://accounts.google.com;
worker-src 'self' blob:;
upgrade-insecure-requests
```

| Placeholder | Value | Source |
| --- | --- | --- |
| `API_ORIGIN` | `https://api-nucleus.raghuenggcollege.com` | `VITE_API_URL` |
| `WS_ORIGIN` | `wss://api-nucleus.raghuenggcollege.com` | derived from `VITE_API_URL` |
| `S3_ORIGIN` | `https://raghu-nucleus.s3.ap-south-1.amazonaws.com` | `VITE_STORAGE_ORIGIN` |
| `<INLINE_SCRIPT_HASH>` | computed at build time | the inline script in `index.html` |

### Why each non-obvious source is there

- **`WS_ORIGIN` is not optional.** Three Socket.IO clients connect to the API —
  student chat, student notifications, employee notifications — and all three use
  `transports: ['websocket']`, i.e. websocket-only with **no HTTP long-polling
  fallback**. A `connect-src` missing `wss:` breaks chat and both notification
  streams outright, with no degraded mode.
- **`S3_ORIGIN` in `img-src`.** Student photos, company logos and certificates
  are served as presigned S3 URLs rendered into `<img src>`. Omit it and every
  avatar in the app is blocked. It is in `connect-src` too for the paths that
  fetch a file into a blob.
- **`accounts.google.com` in three directives.** `@react-oauth/google` loads
  Google Identity Services as a script, renders it in an iframe, and lets it make
  its own requests — so `script-src`, `frame-src` and `connect-src` all need it.
  Without them the "Continue with Google" button silently does nothing.
- **The inline script hash.** `index.html` runs a small anti-flash script before
  first paint that reads `nucleus-ui-theme` from `localStorage` and sets `.dark`
  on `<html>`. Under a strict `script-src 'self'` the browser refuses to run it
  and every dark-theme user sees a flash of light on every load. The hash is
  computed from the **emitted** `index.html`, so it always matches what ships;
  the build fails if no inline script is found rather than shipping a policy that
  would block it.
- **`style-src 'unsafe-inline'`.** Radix, recharts and the Lexical editor set
  inline `style=""` for measured sizes, and static hosting has no nonce
  mechanism. It is the weakest line in the policy, and it is precisely why
  `script-src` being strict matters.
- **`frame-ancestors 'none'`** makes `X-Frame-Options` redundant.

## Companion headers

```
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer
Cross-Origin-Opener-Policy: same-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
```

## Applying it

**CloudFront (this deployment)** — `_headers` is inert on S3. Create a **Response
Headers Policy** with the custom headers above, copying the values out of the
generated `dist/_headers` after a build. Re-copy whenever `VITE_API_URL`,
`VITE_STORAGE_ORIGIN` or the inline script changes — a stale hash blocks the
theme script.

**Netlify / Cloudflare Pages** — `_headers` and `_redirects` are picked up as-is.

**nginx**, if the bundle is ever served directly:

```nginx
location / {
  try_files $uri $uri/ /index.html;
  add_header Content-Security-Policy "<the one-line policy from dist/_headers>" always;
  add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
  add_header X-Content-Type-Options "nosniff" always;
  add_header Referrer-Policy "no-referrer" always;
  add_header Cross-Origin-Opener-Policy "same-origin" always;
  add_header Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=()" always;
}
```

## Rolling it out

Ship `Content-Security-Policy-Report-Only` for one release first. Exercise, on
each of the three hostnames: login (including Google), the dashboard, a screen
with a student photo, the chat, a notification arriving live, and an XLSX export.
Then switch the header name to enforce.

If a WASM-based dependency is ever added and fails, add `'wasm-unsafe-eval'` —
**not** `'unsafe-eval'`.
