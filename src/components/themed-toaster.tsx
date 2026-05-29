import { Toaster } from 'sonner'

import { useTheme } from '@/components/theme-provider'

/**
 * App-wide toast host that follows the active theme. Sonner's `<Toaster>`
 * defaults to a light surface, so without this it renders white in dark mode.
 */
export function ThemedToaster() {
  const { resolvedTheme } = useTheme()
  return <Toaster richColors theme={resolvedTheme} position="top-center" />
}
