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
 * it cannot read the live CSS variables. The values mirror index.css exactly;
 * `gradient` is the theme's `--brand-g1..3` triplet (declared explicitly in
 * the presets ported from central-ui, derived from the brand trio in the
 * original four).
 *
 * Order = render order in the picker: `default` first, then central-ui's
 * "Everyday themes" gallery order.
 */

export type ThemePresetKey =
  | 'default'
  | 'violet'
  | 'sky'
  | 'sakura'
  | 'neon'
  | 'emerald'
  | 'sunset'
  | 'ocean'
  | 'crimson'
  | 'slate'
  | 'midnight'
  | 'gold'
  | 'glass'

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
    key: 'sky',
    label: 'Sky',
    blurb: 'Classic light blue — airy, unfussy, easy on long days.',
    light: {
      primary: '#0284c7',
      primaryForeground: '#ffffff',
      background: '#f2f8fd',
      card: '#ffffff',
      sidebar: '#f9fcfe',
      foreground: '#132030',
      gradient: ['#38bdf8', '#0ea5e9', '#2563eb'],
    },
    dark: {
      primary: '#38bdf8',
      primaryForeground: '#082f49',
      background: '#171e26',
      card: '#1f2833',
      sidebar: '#0e141b',
      foreground: '#fafafa',
      gradient: ['#38bdf8', '#7dd3fc', '#bae6fd'],
    },
  },
  {
    key: 'sakura',
    label: 'Sakura',
    blurb: 'Soft pink over warm blush surfaces — gentle, never loud.',
    light: {
      primary: '#db2777',
      primaryForeground: '#ffffff',
      background: '#fbf1f6',
      card: '#ffffff',
      sidebar: '#fdf9fb',
      foreground: '#2d1622',
      gradient: ['#f472b6', '#db2777', '#e11d48'],
    },
    dark: {
      primary: '#f472b6',
      primaryForeground: '#500724',
      background: '#251a20',
      card: '#2f2129',
      sidebar: '#180f14',
      foreground: '#fafafa',
      gradient: ['#f472b6', '#f9a8d4', '#fbcfe8'],
    },
  },
  {
    key: 'neon',
    label: 'Neon Pulse',
    blurb: 'Electric magenta on near-black indigo — best in dark mode.',
    light: {
      primary: '#c026d3',
      primaryForeground: '#ffffff',
      background: '#faf3fc',
      card: '#ffffff',
      sidebar: '#fdf9fe',
      foreground: '#2a1030',
      gradient: ['#0891b2', '#a21caf', '#c026d3'],
    },
    dark: {
      primary: '#e879f9',
      primaryForeground: '#4a044e',
      background: '#0d0a14',
      card: '#171224',
      sidebar: '#080611',
      foreground: '#fafafa',
      gradient: ['#22d3ee', '#e879f9', '#f0abfc'],
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
    key: 'sunset',
    label: 'Sunset',
    blurb: 'Warm amber — cream by day, glowing ember by night.',
    light: {
      primary: '#c2410c',
      primaryForeground: '#ffffff',
      background: '#fdf5ef',
      card: '#ffffff',
      sidebar: '#fefaf6',
      foreground: '#2c1a10',
      gradient: ['#fb923c', '#ea580c', '#e11d48'],
    },
    dark: {
      primary: '#fb923c',
      primaryForeground: '#431407',
      background: '#241c17',
      card: '#2e241e',
      sidebar: '#17100b',
      foreground: '#fafafa',
      gradient: ['#fb923c', '#fdba74', '#fed7aa'],
    },
  },
  {
    key: 'ocean',
    label: 'Ocean',
    blurb: 'Teal sea-glass — cool, quiet, deep-work colors.',
    light: {
      primary: '#0d9488',
      primaryForeground: '#ffffff',
      background: '#f0f8f7',
      card: '#ffffff',
      sidebar: '#f7fcfb',
      foreground: '#102523',
      gradient: ['#2dd4bf', '#0d9488', '#0284c7'],
    },
    dark: {
      primary: '#2dd4bf',
      primaryForeground: '#042f2e',
      background: '#16211f',
      card: '#1e2b29',
      sidebar: '#0d1514',
      foreground: '#fafafa',
      gradient: ['#2dd4bf', '#5eead4', '#99f6e4'],
    },
  },
  {
    key: 'crimson',
    label: 'Crimson',
    blurb: 'Deep carmine with rose highlights — bold but composed.',
    light: {
      primary: '#be123c',
      primaryForeground: '#ffffff',
      background: '#fcf3f5',
      card: '#ffffff',
      sidebar: '#fdf8f9',
      foreground: '#2b1218',
      gradient: ['#fb7185', '#e11d48', '#be123c'],
    },
    dark: {
      primary: '#fb7185',
      primaryForeground: '#4c0519',
      background: '#241a1c',
      card: '#2e2225',
      sidebar: '#170f11',
      foreground: '#fafafa',
      gradient: ['#fb7185', '#fda4af', '#fecdd3'],
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
  {
    key: 'midnight',
    label: 'Midnight',
    blurb: "Indigo corporate classic — the default's cooler sibling.",
    light: {
      primary: '#4f46e5',
      primaryForeground: '#ffffff',
      background: '#f3f4fc',
      card: '#ffffff',
      sidebar: '#f9fafe',
      foreground: '#1b1a33',
      gradient: ['#818cf8', '#4f46e5', '#7c3aed'],
    },
    dark: {
      primary: '#818cf8',
      primaryForeground: '#1e1b4b',
      background: '#1c1c2a',
      card: '#252536',
      sidebar: '#111120',
      foreground: '#fafafa',
      gradient: ['#818cf8', '#a5b4fc', '#c7d2fe'],
    },
  },
  {
    key: 'gold',
    label: 'Gold',
    blurb: 'Champagne by day, black-and-gold by night.',
    light: {
      primary: '#a16207',
      primaryForeground: '#ffffff',
      background: '#fdf8ee',
      card: '#ffffff',
      sidebar: '#fefbf4',
      foreground: '#2a2210',
      gradient: ['#ca8a04', '#a16207', '#854d0e'],
    },
    dark: {
      primary: '#facc15',
      primaryForeground: '#422006',
      background: '#211d15',
      card: '#2b261c',
      sidebar: '#15120c',
      foreground: '#fafafa',
      gradient: ['#facc15', '#fde047', '#fef08a'],
    },
  },
  {
    key: 'glass',
    label: 'Glass',
    blurb:
      'Frosted, translucent surfaces over a soft aurora — liquid glass in both modes.',
    light: {
      primary: '#007aff',
      primaryForeground: '#ffffff',
      background: '#eef3f9',
      card: '#ffffff',
      sidebar: '#f6f9fc',
      foreground: '#1c2536',
      gradient: ['#5ac8fa', '#007aff', '#5e5ce6'],
    },
    dark: {
      primary: '#0a84ff',
      primaryForeground: '#ffffff',
      background: '#0c111c',
      card: '#151b2a',
      sidebar: '#070b13',
      foreground: '#fafafa',
      gradient: ['#0a84ff', '#64d2ff', '#5e5ce6'],
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
