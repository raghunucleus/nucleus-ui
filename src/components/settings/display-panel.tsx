import { Monitor, Moon, Sun, type LucideIcon } from 'lucide-react'

import { ChoiceCard, ThemePreview } from '@/components/settings/choice-card'
import { useTheme, type Theme } from '@/components/theme-provider'
import { presetByKey, type ThemeSwatches } from '@/config/themes'

function isTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark' || value === 'system'
}

/** Light and dark side by side — what "System" means at a glance. */
function SplitPreview({
  light,
  dark,
}: {
  light: ThemeSwatches
  dark: ThemeSwatches
}) {
  return (
    <div
      aria-hidden
      className="grid grid-cols-2 overflow-hidden rounded-lg ring-1 ring-foreground/15 ring-inset"
    >
      <ThemePreview swatches={light} className="rounded-none ring-0" />
      <ThemePreview swatches={dark} className="rounded-none ring-0" />
    </div>
  )
}

function ModeTitle({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon className="size-4 text-muted-foreground" aria-hidden />
      {label}
    </span>
  )
}

/**
 * Light / Dark / System picker. Previews are painted with the CURRENTLY chosen
 * preset's swatches, so what you see is what you get. Applies at once
 * (ThemeProvider persists it) — no Save button. The header sun/moon toggle
 * still works; it writes an explicit light/dark, so "System" reads as
 * unselected after using it.
 */
export function DisplayPanel() {
  const { theme, resolvedTheme, setTheme, preset } = useTheme()
  const swatches = presetByKey(preset)

  const options: {
    key: Theme
    icon: LucideIcon
    label: string
    description: string
    preview: React.ReactNode
  }[] = [
    {
      key: 'light',
      icon: Sun,
      label: 'Light',
      description: 'Always the light look.',
      preview: <ThemePreview swatches={swatches.light} />,
    },
    {
      key: 'dark',
      icon: Moon,
      label: 'Dark',
      description: 'Always the dark look.',
      preview: <ThemePreview swatches={swatches.dark} />,
    },
    {
      key: 'system',
      icon: Monitor,
      label: 'System',
      description: `Follows your device — currently ${resolvedTheme}.`,
      preview: <SplitPreview light={swatches.light} dark={swatches.dark} />,
    },
  ]

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Choose how Nucleus looks on this device. System follows your device
        setting.
      </p>
      <div
        role="radiogroup"
        aria-label="Colour mode"
        className="grid gap-3 sm:grid-cols-3"
      >
        {options.map((o) => (
          <ChoiceCard
            key={o.key}
            name="display-mode"
            value={o.key}
            checked={theme === o.key}
            onSelect={(v) => {
              if (isTheme(v)) setTheme(v)
            }}
            title={<ModeTitle icon={o.icon} label={o.label} />}
            description={o.description}
            preview={o.preview}
          />
        ))}
      </div>
    </div>
  )
}
