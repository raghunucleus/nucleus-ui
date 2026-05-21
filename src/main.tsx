import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { GoogleOAuthProvider } from '@react-oauth/google'
import './index.css'
import App from './App.tsx'
import { ThemeProvider } from '@/components/theme-provider'
import { GlobalLoader } from '@/components/global-loader'

const googleClientId = import.meta.env.VITE_GOOGLE_OIDC_CLIENT_ID

const tree = (
  <StrictMode>
    <ThemeProvider defaultTheme="system" storageKey="nucleus-ui-theme">
      <App />
      <GlobalLoader />
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
