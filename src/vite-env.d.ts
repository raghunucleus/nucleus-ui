/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the nucleus-server API. Defaults to http://localhost:3000. */
  readonly VITE_API_URL?: string
  /** Google OAuth web client ID. When unset, Google sign-in is hidden. */
  readonly VITE_GOOGLE_OIDC_CLIENT_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
