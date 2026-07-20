import { Button } from '@/components/ui/button'
import { hasChannel, type NotifyChannels } from '@/lib/notify-channels'
import { cn } from '@/lib/utils'

const CHANNELS: Array<{ key: keyof NotifyChannels; label: string; hint: string }> =
  [
    { key: 'in_app', label: 'In-app', hint: 'Shows in their notification bell' },
    { key: 'push', label: 'Push', hint: 'Phone notification, if signed in' },
    { key: 'email', label: 'Email', hint: 'Personal email, else college email' },
  ]

/**
 * The "Send via" channel selector shared by every screen that mails a student:
 * profile-update nudges and drive invites both let the sender pick in-app, push
 * and email independently, and both must warn identically when nothing is on.
 *
 * Fully controlled — the caller owns the initial selection, which differs by
 * screen (a profile nudge starts in-app-only, a drive invite starts on all
 * three) and is worth remembering across repeated actions.
 */
export function ChannelPicker({
  value,
  onChange,
  title = 'Send via',
}: {
  value: NotifyChannels
  onChange: (next: NotifyChannels) => void
  title?: string
}) {
  const allOn = value.in_app && value.push && value.email

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">{title}</h3>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={() =>
            onChange(
              allOn
                ? { in_app: true, push: false, email: false }
                : { in_app: true, push: true, email: true },
            )
          }
        >
          {allOn ? 'In-app only' : 'All channels'}
        </Button>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {CHANNELS.map((c) => (
          <label
            key={c.key}
            className={cn(
              'flex cursor-pointer items-start gap-2 rounded-lg border p-2.5 text-sm',
              value[c.key] && 'border-primary bg-primary/5',
            )}
          >
            <input
              type="checkbox"
              checked={value[c.key]}
              onChange={(e) => onChange({ ...value, [c.key]: e.target.checked })}
              className="mt-0.5 accent-primary"
            />
            <span>
              <span className="block font-medium">{c.label}</span>
              <span className="block text-xs text-muted-foreground">
                {c.hint}
              </span>
            </span>
          </label>
        ))}
      </div>
      {!hasChannel(value) && (
        <p className="text-xs text-destructive">Pick at least one channel.</p>
      )}
    </section>
  )
}
