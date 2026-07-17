import { Toaster } from 'sonner'

import { useTheme } from '@/components/theme-provider'

/**
 * App-wide toast host that follows the active theme. Sonner's `<Toaster>`
 * defaults to a light surface, so without this it renders white in dark mode.
 *
 * `richColors` is intentionally OFF: the glass toast look (see `index.css`) uses
 * a neutral frosted surface for every toast and conveys type via a colored left
 * accent + tinted icon, which richColors' solid fills would override.
 */
export function ThemedToaster() {
  const { resolvedTheme } = useTheme()
  return <Toaster theme={resolvedTheme} position="top-right" closeButton />
}
