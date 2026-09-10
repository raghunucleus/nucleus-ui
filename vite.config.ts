import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * A production build with no `VITE_API_URL` is a silent catastrophe on a static
 * host, so it's a build failure instead. `src/lib/api.ts` falls back to
 * `http://localhost:3000` — the developer's own machine — and the build still
 * succeeds. Nothing surfaces until a real user tries to sign in and every
 * request fails against a host that isn't theirs.
 *
 * Compounding it: `.env.development` is NOT read by `vite build` (Vite loads it
 * only in development mode), so the value that works locally is exactly the one
 * that does not travel.
 */
function assertApiUrl(env: Record<string, string>): void {
  if (env.VITE_API_URL?.trim()) return
  throw new Error(
    [
      'VITE_API_URL is not set for a production build.',
      '',
      'Without it src/lib/api.ts falls back to http://localhost:3000 — the machine that ran',
      'the build. Every API call from the deployed portal would target the user\'s own',
      'computer, and the three Socket.IO clients (student chat, student and employee',
      'notifications) would retry against it forever.',
      '',
      'Set it in .env.production (see .env.production.example) or in the build environment:',
      '  VITE_API_URL=https://api-nucleus.raghuenggcollege.in',
      '',
      'Note .env files without a mode suffix are loaded in EVERY mode, so a value parked',
      'there also satisfies this — keep deployment values in .env.production.',
    ].join('\n'),
  )
}

/**
 * CSP source list for the inline `<script>` blocks in index.html.
 *
 * index.html carries an inline anti-flash theme script (it reads the saved theme
 * from localStorage and sets `.dark` before first paint). Under a strict
 * `script-src 'self'` the browser refuses to run it and every user on a dark
 * theme gets a flash of light on every load. Hashing is the right fix; adding
 * `'unsafe-inline'` would void the strongest line in the whole policy.
 *
 * Hashed from the EMITTED html, so what we allow is exactly what ships.
 */
function inlineScriptHashes(html: string): string[] {
  const hashes: string[] = []
  // Inline blocks only — anything with a src= attribute is covered by 'self'.
  const re = /<script(?![^>]*\bsrc\b)[^>]*>([\s\S]*?)<\/script>/gi
  let match: RegExpExecArray | null
  while ((match = re.exec(html)) !== null) {
    const body = match[1]
    if (!body.trim()) continue
    hashes.push(
      `'sha256-${createHash('sha256').update(body, 'utf8').digest('base64')}'`,
    )
  }
  return hashes
}

/**
 * Emits the static host's config next to the build: the CSP + companion headers
 * from SECURITY-HEADERS.md, and the SPA rewrite.
 *
 * Generated rather than committed to `public/`, because `public/` is copied
 * byte-for-byte with no substitution — a checked-in policy would still say
 * `API_ORIGIN`, which CSP happily parses as a hostname that matches nothing.
 * The result: every API call and all three sockets blocked. Worse than no CSP.
 *
 * `_headers` and `_redirects` are read by Netlify and Cloudflare Pages. On
 * S3+CloudFront (this deployment) they are inert — but the generated `_headers`
 * is the source of truth to transcribe into the CloudFront Response Headers
 * Policy. See DEPLOYMENT.md.
 *
 * Runs in `writeBundle`, not `generateBundle`, and writes with fs rather than
 * `emitFile`. index.html is produced by Vite's own html plugin and is not
 * reliably present in the bundle object when a third-party plugin's
 * `generateBundle` runs — reading it there yielded an empty string and silently
 * dropped the script hash from the policy, which is exactly the bug this hash
 * exists to prevent. By `writeBundle` the file is on disk and final.
 */
function emitHostConfig(env: Record<string, string>): Plugin {
  return {
    name: 'nucleus-host-config',
    apply: 'build',
    writeBundle(options) {
      const outDir = options.dir ?? path.resolve(__dirname, 'dist')
      const api = env.VITE_API_URL?.trim() ?? ''
      // `/api` (a same-origin proxy escape hatch) has no origin of its own —
      // 'self' already covers it.
      let apiOrigin = ''
      let wsOrigin = ''
      try {
        const url = new URL(api)
        apiOrigin = url.origin
        wsOrigin = `${url.protocol === 'https:' ? 'wss:' : 'ws:'}//${url.host}`
      } catch {
        /* relative base — same origin */
      }
      // Presigned S3 URLs for student photos, company logos and certificates.
      // With S3_FORCE_PATH_STYLE=false the bucket is its own origin.
      const storage = env.VITE_STORAGE_ORIGIN?.trim() ?? ''
      // Google Identity Services: a script, an iframe, and its own XHRs.
      const google = 'https://accounts.google.com'

      const html = readFileSync(path.join(outDir, 'index.html'), 'utf8')
      const hashes = inlineScriptHashes(html)
      if (hashes.length === 0) {
        // index.html has always carried the inline anti-flash theme script. Zero
        // hashes means the scan broke, and shipping the policy anyway would
        // block that script in every browser — fail the build instead.
        this.error(
          'No inline <script> found in the emitted index.html. The CSP script-src hash ' +
            'could not be computed, and shipping without it would block the anti-flash ' +
            'theme script. Check emitHostConfig in vite.config.ts.',
        )
      }
      const scriptHashes = hashes.join(' ')

      const sources = (...parts: string[]) => parts.filter(Boolean).join(' ')

      const csp = [
        `default-src 'self'`,
        `base-uri 'self'`,
        `object-src 'none'`,
        `frame-ancestors 'none'`,
        `form-action 'self'`,
        `script-src ${sources("'self'", scriptHashes, google)}`,
        // Radix, recharts and the Lexical editor set inline style="" for
        // measured sizes, and static hosting has no nonce mechanism.
        `style-src 'self' 'unsafe-inline'`,
        `img-src ${sources("'self'", 'data:', 'blob:', storage)}`,
        `font-src 'self' data:`,
        `connect-src ${sources("'self'", apiOrigin, wsOrigin, storage, google)}`,
        `frame-src ${google}`,
        `worker-src 'self' blob:`,
        `upgrade-insecure-requests`,
      ].join('; ')

      const headers = [
        '/*',
        `  Content-Security-Policy: ${csp}`,
        '  Strict-Transport-Security: max-age=31536000; includeSubDomains',
        '  X-Content-Type-Options: nosniff',
        '  Referrer-Policy: no-referrer',
        '  Cross-Origin-Opener-Policy: same-origin',
        '  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()',
        '',
      ].join('\n')

      const base = env.BASE_PATH || '/'
      writeFileSync(path.join(outDir, '_headers'), headers, 'utf8')
      writeFileSync(
        path.join(outDir, '_redirects'),
        // Client-side routing: every path is served the app shell, 200 not 302,
        // so a deep link or a refresh on /attendance works on a cold load.
        `/*  ${base}index.html  200\n`,
        'utf8',
      )
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Empty prefix: BASE_PATH and VITE_STORAGE_ORIGIN are build inputs, not client
  // values, so they can live in .env.production alongside VITE_API_URL. Only
  // VITE_-prefixed keys are ever exposed to the bundle (envPrefix is untouched),
  // and this object must never be spread into `define`.
  const env = loadEnv(mode, process.cwd(), '')
  if (mode === 'production') assertApiUrl(env)

  return {
    // Served at "/" by default. This app is deployed at a domain root on three
    // hostnames; BASE_PATH exists only for sub-path hosting.
    base: env.BASE_PATH || '/',
    plugins: [react(), tailwindcss(), emitHostConfig(env)],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    // Code splitting is driven by `import()` boundaries in src (portal → app
    // shell → page, plus on-demand xlsx / Lexical) rather than by manual chunk
    // groups: the bundler already hoists modules shared by several lazy pages
    // (recharts, the UI kit) into common chunks, and a manual vendor group
    // would only rename them. The old `manualChunks` split was a no-op for
    // first load — the entry still preloaded those chunks statically.
    build: {
      chunkSizeWarningLimit: 1000,
    },
    optimizeDeps: {
      // Only reached through `import()` boundaries (the parent portal chunk,
      // the upload dialogs), so the dev pre-bundler can miss them at startup,
      // discover them mid-session and answer the first request with a 504
      // "Outdated Optimize Dep" — which surfaces as "Failed to fetch
      // dynamically imported module" on the parent login. Pre-bundle up front.
      include: ['i18next', 'react-i18next', 'xlsx'],
    },
    server: {
      port: 5000,
    },
  }
})
