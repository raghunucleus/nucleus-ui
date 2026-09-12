import { ChoiceCard, ThemePreview } from '@/components/settings/choice-card'
import { useTheme } from '@/components/theme-provider'
import { PRESET_THEMES, isThemePresetKey } from '@/config/themes'

/**
 * Colour-preset picker: one card per preset, previewed in the CURRENT mode so
 * the person sees roughly what they would get. Selecting applies at once
 * (ThemeProvider persists it), so there is no Save button.
 *
 * Renders no heading of its own — the host page frames it (a tab on the
 * student Settings page, a section card on the employee Profile page).
 */
export function ThemePanel() {
  const { preset, setPreset, resolvedTheme } = useTheme()

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Pick an accent for the portal. It applies straight away on this device.
      </p>
      <div
        role="radiogroup"
        aria-label="Colour theme"
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
      >
        {PRESET_THEMES.map((t) => (
          <ChoiceCard
            key={t.key}
            name="theme-preset"
            value={t.key}
            checked={preset === t.key}
            onSelect={(v) => {
              if (isThemePresetKey(v)) setPreset(v)
            }}
            title={t.label}
            description={t.blurb}
            preview={<ThemePreview swatches={t[resolvedTheme]} />}
          />
        ))}
      </div>
    </div>
  )
}
