import { useLayoutEffect } from 'react'

import { useTheme } from '@/components/theme-provider'

/**
 * Lets the chosen preset theme apply while this is mounted. Render it once
 * inside each signed-in portal shell (employee / parent / student layouts) —
 * never on a login page, the portal hub or the 404, which always render the
 * brand look. Renders nothing.
 */
export function ThemePresetScope() {
  const { enterPresetScope } = useTheme()
  useLayoutEffect(() => enterPresetScope(), [enterPresetScope])
  return null
}
