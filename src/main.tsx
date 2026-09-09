import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { GoogleOAuthProvider } from '@react-oauth/google'
import './index.css'
import App from './App.tsx'
import { ThemeProvider } from '@/components/theme-provider'
import { GlobalLoader } from '@/components/global-loader'
import { ThemedToaster } from '@/components/themed-toaster'
import { ConnectivityMonitor } from '@/components/connectivity/connectivity-monitor'
import { Portal } from '@/portals/portal'

const googleClientId = import.meta.env.VITE_GOOGLE_OIDC_CLIENT_ID

// Fetch this hostname's portal chunk before React mounts. index.html's inline
// splash stays up meanwhile, so the first React commit is the login/hub itself
// instead of a second, different-looking loader. `preload()` never rejects: a
// chunk missing after a deploy triggers a one-shot reload on first render.
// (Optional call only because the router types it so; it is always defined.)
await Portal.preload?.()

const tree = (
  <StrictMode>
    <ThemeProvider defaultTheme="system" storageKey="nucleus-ui-theme">
      <App />
      <GlobalLoader />
      <ConnectivityMonitor />
      <ThemedToaster />
    </ThemeProvider>
  </StrictMode>
)

createRoot(document.getElementById('root')!).render(
  googleClientId ? (
    <GoogleOAuthProvider clientId={googleClientId}>{tree}</GoogleOAuthProvider>
  ) : (
    tree
  ),
)
