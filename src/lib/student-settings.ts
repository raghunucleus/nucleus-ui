/**
 * Tab keys for the student Settings page (`/settings?tab=`).
 *
 * Constants only: `router.tsx` imports this statically to validate the search
 * param, so keeping it free of React and API imports keeps the page itself a
 * lazy chunk.
 */
export const SETTINGS_TABS = [
  'privacy',
  'display',
  'theme',
  'password',
  'devices',
] as const

export type SettingsTab = (typeof SETTINGS_TABS)[number]

export const DEFAULT_SETTINGS_TAB: SettingsTab = 'privacy'

export function isSettingsTab(value: unknown): value is SettingsTab {
  return (
    typeof value === 'string' &&
    (SETTINGS_TABS as readonly string[]).includes(value)
  )
}
