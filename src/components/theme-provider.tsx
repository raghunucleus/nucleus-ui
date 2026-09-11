import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useState,
  useSyncExternalStore,
} from 'react'

import {
  DEFAULT_THEME_KEY,
  THEME_PRESET_STORAGE_KEY,
  isThemePresetKey,
  type ThemePresetKey,
} from '@/config/themes'

export type Theme = 'dark' | 'light' | 'system'

type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: Theme
  storageKey?: string
  presetStorageKey?: string
}

type ThemeProviderState = {
  /** MODE axis — light / dark / follow the OS. */
  theme: Theme
  resolvedTheme: 'dark' | 'light'
  setTheme: (theme: Theme) => void
  /** PRESET axis — which `.theme-<key>` re-skin is chosen. Independent of
   * mode: every preset has a light and a dark variant. */
  preset: ThemePresetKey
  setPreset: (preset: ThemePresetKey) => void
  /**
   * Presets apply only inside a signed-in portal shell: the login pages, the
   * portal hub and the 404 always render the brand look. A shell mounts
   * `<ThemePresetScope />`, which calls this and releases on unmount; the
   * classes go on `<html>` while at least one scope is live. The pre-paint
   * script in index.html mirrors the gate with a "has an access token" check.
   */
  enterPresetScope: () => () => void
}

const ThemeProviderContext = createContext<ThemeProviderState | undefined>(undefined)

const SYSTEM_DARK_MQ = '(prefers-color-scheme: dark)'

function getSystemTheme(): 'dark' | 'light' {
  return window.matchMedia(SYSTEM_DARK_MQ).matches ? 'dark' : 'light'
}

// The OS preference as an external store, so `resolvedTheme` is derived
// during render (no setState inside an effect) and re-renders on change.
function subscribeSystemTheme(onChange: () => void) {
  const mql = window.matchMedia(SYSTEM_DARK_MQ)
  mql.addEventListener('change', onChange)
  return () => mql.removeEventListener('change', onChange)
}

function readPreset(storageKey: string): ThemePresetKey {
  try {
    const raw = localStorage.getItem(storageKey)
    return isThemePresetKey(raw) ? raw : DEFAULT_THEME_KEY
  } catch {
    return DEFAULT_THEME_KEY
  }
}

export function ThemeProvider({
  children,
  defaultTheme = 'system',
  storageKey = 'ui-theme',
  presetStorageKey = THEME_PRESET_STORAGE_KEY,
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(
    () => (localStorage.getItem(storageKey) as Theme | null) ?? defaultTheme,
  )
  const systemTheme = useSyncExternalStore(subscribeSystemTheme, getSystemTheme)
  const resolvedTheme = theme === 'system' ? systemTheme : theme

  const [preset, setPresetState] = useState<ThemePresetKey>(() =>
    readPreset(presetStorageKey),
  )
  const [scopeCount, setScopeCount] = useState(0)

  // Mode → <html> class. A layout effect so a toggle lands before paint; the
  // pre-paint script in index.html has usually already put the class there.
  useLayoutEffect(() => {
    const root = window.document.documentElement
    root.classList.remove('light', 'dark')
    root.classList.add(resolvedTheme)
  }, [resolvedTheme])

  // Preset → <html> classes. Everything we manage that isn't wanted goes,
  // then the wanted set is added (no-ops when already present), so the
  // classes the pre-paint script set never flicker off and on.
  useLayoutEffect(() => {
    const root = window.document.documentElement
    const wanted =
      scopeCount > 0 && preset !== DEFAULT_THEME_KEY
        ? ['themed', `theme-${preset}`]
        : []
    for (const cls of Array.from(root.classList)) {
      const managed = cls === 'themed' || cls.startsWith('theme-')
      if (managed && !wanted.includes(cls)) root.classList.remove(cls)
    }
    for (const cls of wanted) root.classList.add(cls)
  }, [preset, scopeCount])

  const setTheme = useCallback(
    (next: Theme) => {
      localStorage.setItem(storageKey, next)
      setThemeState(next)
    },
    [storageKey],
  )

  const setPreset = useCallback(
    (next: ThemePresetKey) => {
      try {
        localStorage.setItem(presetStorageKey, next)
      } catch {
        /* private mode — the choice still applies for this session */
      }
      setPresetState(next)
    },
    [presetStorageKey],
  )

  const enterPresetScope = useCallback(() => {
    setScopeCount((c) => c + 1)
    return () => setScopeCount((c) => c - 1)
  }, [])

  return (
    <ThemeProviderContext.Provider
      value={{ theme, resolvedTheme, setTheme, preset, setPreset, enterPresetScope }}
    >
      {children}
    </ThemeProviderContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeProviderContext)
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider')
  return ctx
}
