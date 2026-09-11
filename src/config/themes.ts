/**
 * Preset theme catalog — the UI side of the theme system.
 *
 * The CSS lives in `src/index.css` (`.theme-<key>` / `.dark.theme-<key>`
 * anchor blocks + the shared `.themed` derivations); this file carries what a
 * picker needs to SHOW a theme without applying it: label, blurb and a handful
 * of literal swatch hexes per mode. Keep the key set in step with index.css —
 * an unknown key degrades gracefully to the default look.
 *
 * This is the one documented exception to the "no colour literals outside
 * index.css" rule: a swatch paints a theme that is NOT currently applied, so
 * it cannot read the live CSS variables. The values mirror index.css exactly.
 */

export type ThemePresetKey = 'default' | 'violet' | 'emerald' | 'slate'

export const DEFAULT_THEME_KEY: ThemePresetKey = 'default'

/** localStorage key for the chosen preset. Mirrored by the pre-paint script in
 * index.html — change both together. */
export const THEME_PRESET_STORAGE_KEY = 'nucleus-ui-theme-preset'

/** Literal colours for painting a preview swatch (never read from CSS). */
export type ThemeSwatches = {
  primary: string
  /** Text on primary — the button chip label in a preview. */
  primaryForeground: string
  background: string
  card: string
  sidebar: string
  foreground: string
  /** The brand gradient triplet, for an accent strip. */
  gradient: [string, string, string]
}

export type PresetTheme = {
  key: ThemePresetKey
  label: string
  blurb: string
  light: ThemeSwatches
  dark: ThemeSwatches
}

export const PRESET_THEMES: readonly PresetTheme[] = [
  {
    key: 'default',
    label: 'Nucleus Blue',
    blurb: 'The Nucleus look — blue brand on cool gray neutrals.',
    light: {
      primary: '#2563eb',
      primaryForeground: '#ffffff',
      background: '#f4f4f5',
      card: '#ffffff',
      sidebar: '#fafafa',
      foreground: '#18181b',
      gradient: ['#2563eb', '#0ea5e9', '#38bdf8'],
    },
    dark: {
      primary: '#60a5fa',
      primaryForeground: '#27272a',
      background: '#202124',
      card: '#2a2b2e',
      sidebar: '#111111',
      foreground: '#fafafa',
      gradient: ['#60a5fa', '#38bdf8', '#7dd3fc'],
    },
  },
  {
    key: 'violet',
    label: 'Violet',
    blurb: 'Violet brand on calm lavender neutrals.',
    light: {
      primary: '#7c3aed',
      primaryForeground: '#ffffff',
      background: '#f6f3fb',
      card: '#ffffff',
      sidebar: '#fbfafd',
      foreground: '#241a3d',
      gradient: ['#7c3aed', '#a855f7', '#c084fc'],
    },
    dark: {
      primary: '#a78bfa',
      primaryForeground: '#27272a',
      background: '#1e1b26',
      card: '#29252f',
      sidebar: '#141118',
      foreground: '#fafafa',
      gradient: ['#a78bfa', '#c4b5fd', '#ddd6fe'],
    },
  },
  {
    key: 'emerald',
    label: 'Emerald',
    blurb: 'Teal-green — fresh without being loud.',
    light: {
      primary: '#059669',
      primaryForeground: '#ffffff',
      background: '#f2f8f5',
      card: '#ffffff',
      sidebar: '#f8fcfa',
      foreground: '#14261d',
      gradient: ['#059669', '#14b8a6', '#2dd4bf'],
    },
    dark: {
      primary: '#34d399',
      primaryForeground: '#27272a',
      background: '#1a211d',
      card: '#232b27',
      sidebar: '#0f1512',
      foreground: '#fafafa',
      gradient: ['#34d399', '#2dd4bf', '#5eead4'],
    },
  },
  {
    key: 'slate',
    label: 'Slate',
    blurb: 'Near-monochrome, for when the chrome should disappear.',
    light: {
      primary: '#475569',
      primaryForeground: '#ffffff',
      background: '#f4f5f7',
      card: '#ffffff',
      sidebar: '#f9fafb',
      foreground: '#1c2330',
      gradient: ['#475569', '#64748b', '#94a3b8'],
    },
    dark: {
      primary: '#94a3b8',
      primaryForeground: '#27272a',
      background: '#1c1f24',
      card: '#262a30',
      sidebar: '#101216',
      foreground: '#fafafa',
      gradient: ['#94a3b8', '#cbd5e1', '#e2e8f0'],
    },
  },
]

export function isThemePresetKey(value: unknown): value is ThemePresetKey {
  return (
    typeof value === 'string' && PRESET_THEMES.some((t) => t.key === value)
  )
}

export function presetByKey(key: ThemePresetKey): PresetTheme {
  return PRESET_THEMES.find((t) => t.key === key) ?? PRESET_THEMES[0]
}
