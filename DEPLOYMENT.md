# Deploying nucleus-ui

The app is a **static bundle**. `npm run build` produces `dist/`; whatever serves
those files is the "host".

**One build serves three audiences.** `src/lib/subdomain.ts` reads the leftmost
DNS label at runtime and mounts the matching portal:

| Hostname | `AppVariant` | Portal |
| --- | --- | --- |
| `employee.raghuenggcollege.in` | `employee` | Employee |
| `parent.raghuenggcollege.in` | `parent` | Parent / guardian |
| `student.raghuenggcollege.in` | `member` | Student |

There is no build-time variant flag — the same `dist/` is served on all three.
Anything unrecognised falls through to the student portal, so a typo'd hostname
renders students rather than an error.

**The three hostnames are a security requirement, not a convenience.** Each
audience keeps its tokens in `localStorage` under its own key prefix
(`nucleus.student.*`, `nucleus.employee.*`, `nucleus.parent.*`), and
`localStorage` is scoped to the **origin**. Serve all three from one hostname and
the three sessions share one store, collapsing the isolation the code assumes.

> The `?app=employee` / `?app=parent` query override exists for localhost dev and
> is not gated by environment — it works in production too. It only changes which
> portal renders, not which tokens are valid, but it does mean the employee login
> screen is reachable from any of the three hosts.

## Build

```bash
cp .env.production.example .env.production   # then edit it
npm run build                                # tsc -b && vite build && postbuild
```

`vite build` runs in `production` mode, so it reads `.env.production`
automatically. Shell values win over the file, which is what CI should use:

```bash
VITE_API_URL=https://api-nucleus.raghuenggcollege.in npm run build
```

### Environment

| Key | Required | What it does |
| --- | --- | --- |
| `VITE_API_URL` | **yes** | API origin, no trailing slash. Baked into the bundle; also derives the WebSocket origin for chat and both notification streams. |
| `VITE_GOOGLE_OIDC_CLIENT_ID` | no | Google sign-in. Unset hides the button. |
| `VITE_STORAGE_ORIGIN` | no | S3 origin serving presigned URLs. Only widens the generated CSP — unset, student photos are blocked. |
| `BASE_PATH` | no (`/`) | Sub-path the app is served from, with both slashes. |

**The build fails if `VITE_API_URL` is unset.** That is deliberate: `src/lib/api.ts`
falls back to `http://localhost:3000` — the machine that ran the build — and the
build would otherwise succeed, shipping a bundle that calls the user's own
computer while three sockets retry against it forever. Nothing surfaces until
someone tries to sign in.

> `.env.development` is **not** read by `vite build` (Vite loads it only in
> development mode). The value that works locally is exactly the one that does
> not travel — keep deployment values in `.env.production` or the CI environment.

### What the build emits

| File | Written by | Read by |
| --- | --- | --- |
| `_headers` | `emitHostConfig` in `vite.config.ts` | Netlify, Cloudflare Pages — and it is the source of truth to transcribe into a CloudFront Response Headers Policy |
| `_redirects` (`/*  /index.html  200`) | same | Netlify, Cloudflare Pages |
| `404.html` | `postbuild` in `package.json` | S3 website hosting |

`_headers` carries the CSP and companion headers from
[SECURITY-HEADERS.md](SECURITY-HEADERS.md) with the **real** origins substituted
and a SHA-256 hash of the inline theme script. It is generated rather than
committed to `public/` on purpose — see that document.

## SPA fallback — required, not optional

The app is client-routed with browser history (TanStack Router), so **every** path
must serve `index.html`. Deep links like `/attendance` and `/placements/drives`
404 on a cold load or a refresh without a catch-all rewrite.

**S3 + CloudFront (this deployment)** — set custom error responses mapping **403
and 404** → `/index.html` with HTTP 200. S3's REST endpoint returns **403**, not
404, for a missing key when the bucket is private behind Origin Access Control,
so a 404-only rule silently misses.

## Deploying to S3 + CloudFront

```bash
VITE_API_URL=https://api-nucleus.raghuenggcollege.in \
VITE_STORAGE_ORIGIN=https://raghu-nucleus.s3.ap-south-1.amazonaws.com \
VITE_GOOGLE_OIDC_CLIENT_ID=<client-id> \
  npm run build

aws s3 sync dist/ s3://<ui-bucket>/ --delete
aws cloudfront create-invalidation --distribution-id <ID> --paths "/*"
```

**One distribution, three alternate domain names.** The bundle is identical for
all three audiences and picks its portal from `window.location.hostname`, so a
single CloudFront distribution carrying `employee.`, `parent.` and `student.` as
alternate domain names (over one SAN or wildcard certificate) is correct — and
simpler than three distributions of the same bytes.

**Cache policy.** `/assets/*` is content-hashed and immutable (1 year), but
**`index.html` must be `no-cache`**. Otherwise a user holds a stale shell that
references hashed chunks the last deploy deleted — and because the Lexical editor
loads as a lazy chunk on click, that failure appears minutes later on an
unrelated screen.

## Pairing with nucleus-server

| Server var | Value |
| --- | --- |
| `CORS_ORIGINS` | Must list all three portal origins (plus the admin one). The default allowlist is localhost-only and applies whenever `NODE_ENV` is not `dev`. |
| `STUDENT_APP_URL` | `https://student.raghuenggcollege.in` |
| `EMPLOYEE_APP_URL` | `https://employee.raghuenggcollege.in` — **no** `?app=employee` query; that dev marker exists only because dev shares one origin. |

The API endpoint must also terminate WebSocket upgrades, and the S3 bucket needs
a CORS rule allowing these origins. Both are covered in
`nucleus-server/DEPLOYMENT.md`.

Finally, add all three origins to the **Google Cloud Console** OAuth client's
authorized JavaScript origins, or Google sign-in fails on every portal.

## Verifying a deployment

On **each** of the three hostnames:

1. Hard-reload a deep link (`/attendance`) — proves the SPA fallback.
2. Confirm the correct portal renders for that hostname.
3. Sign in; confirm the Google button appears and works.
4. Open DevTools console — there must be no CSP violations.
5. Confirm a student photo renders (S3 CORS + `img-src`).
6. Confirm the page does **not** flash light before painting dark (the inline
   script hash is correct).
7. On the student portal, confirm the chat and notification sockets reach
   `connected` in the Network tab rather than retrying.
8. Stop the API; confirm the server-unreachable screen appears within ~5s and
   recovers on restart without a reload.
