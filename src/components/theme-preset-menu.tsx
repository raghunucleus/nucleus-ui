import { Palette } from 'lucide-react'

import { useTheme } from '@/components/theme-provider'
import {
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import {
  PRESET_THEMES,
  isThemePresetKey,
  type ThemePresetKey,
} from '@/config/themes'

/**
 * "Theme" section for an account dropdown — one radio row per preset with a
 * swatch of that preset's primary in the CURRENT mode, so the person sees
 * roughly what they would get before picking. Selecting keeps the menu open
 * (compare presets without reopening); Escape or a click outside closes it.
 *
 * Strings come in as props so this file never imports i18n (parent-only —
 * importing it here would pull i18next into the student and employee chunks).
 * The parent shell passes translated labels; the others use the defaults.
 */
export function ThemePresetMenuItems({
  heading = 'Theme',
  labels,
}: {
  heading?: string
  /** Translated preset names, keyed by preset. Missing keys fall back to the
   * catalog label. */
  labels?: Partial<Record<ThemePresetKey, string>>
}) {
  const { preset, setPreset, resolvedTheme } = useTheme()

  return (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuLabel className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Palette className="size-3.5" />
        {heading}
      </DropdownMenuLabel>
      <DropdownMenuRadioGroup
        value={preset}
        onValueChange={(v) => {
          if (isThemePresetKey(v)) setPreset(v)
        }}
      >
        {PRESET_THEMES.map((t) => (
          <DropdownMenuRadioItem
            key={t.key}
            value={t.key}
            // Keep the menu open so presets can be compared in place.
            onSelect={(e) => e.preventDefault()}
          >
            {/* The swatch paints a theme that may NOT be applied, so it has
                to carry its own literal colour (config/themes.ts is the one
                documented home for those). */}
            <span
              aria-hidden
              className="size-3 shrink-0 rounded-full ring-1 ring-inset ring-foreground/15"
              style={{ backgroundColor: t[resolvedTheme].primary }}
            />
            <span className="flex-1 truncate">{labels?.[t.key] ?? t.label}</span>
          </DropdownMenuRadioItem>
        ))}
      </DropdownMenuRadioGroup>
    </>
  )
}
