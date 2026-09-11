import { useState } from 'react'
import { Check, Laptop, Smartphone } from 'lucide-react'

import { AuthHeading } from '@/components/auth/auth-heading'
import { AuthTextButton } from '@/components/auth/auth-text-button'
import { FormError } from '@/components/auth/form-error'
import { Button } from '@/components/ui/button'
import {
  formatRelativeTime,
  isMobileDeviceName,
  type DeviceLimitSession,
} from '@/lib/sessions'
import { cn } from '@/lib/utils'

/**
 * Every visible string, as a prop with an English default — this folder must
 * not call `t()` (see index.ts). The parent portal passes translated ones;
 * the count-bearing strings are functions so each language can pluralise.
 */
export type DeviceLimitPickerStrings = {
  title: string
  /** "You're signed in on 2 of 2 allowed devices. Sign out of at least one…" */
  description: (signedIn: number, limit: number) => string
  /** Row meta: "Last active 5 minutes ago". */
  lastActive: (iso: string) => string
  /** Row meta: "Signed in 3 Sep". */
  signedIn: (iso: string) => string
  /** Submit label once something is selected. */
  submit: (selected: number) => string
  /** Submit label while nothing is selected (the button is disabled). */
  selectPrompt: string
  submitting: string
  /** The freed slot was taken by a racing sign-in; pick again. */
  raceNotice: string
  back: string
}

const DEFAULT_DEVICE_LIMIT_STRINGS: DeviceLimitPickerStrings = {
  title: 'Device limit reached',
  description: (signedIn, limit) =>
    `You're signed in on ${signedIn} of ${limit} allowed ${
      limit === 1 ? 'device' : 'devices'
    }. Sign out of at least one to continue here.`,
  lastActive: (iso) => `Last active ${formatRelativeTime(iso)}`,
  signedIn: (iso) => `Signed in ${formatRelativeTime(iso)}`,
  submit: (n) => `Sign out ${n} ${n === 1 ? 'device' : 'devices'} & continue`,
  selectPrompt: 'Select a device to sign out',
  submitting: 'Signing in…',
  raceNotice:
    'Those devices were signed out, but every slot is taken again — pick another device.',
  back: 'Back to sign in',
}

type Props = {
  /** The occupying devices, most recently active first. */
  sessions: DeviceLimitSession[]
  limit: number
  /**
   * Sign the chosen devices out and finish the login. The page owns the call
   * and its outcomes (success → its normal sign-in path; a race → new
   * `sessions` + `raced`; an expired challenge → back to the form) and should
   * not reject — the picker only tracks that it is in flight.
   */
  onSubmit: (sessionIds: string[]) => Promise<void>
  /** Abandon the flow and return to the sign-in form. */
  onBack: () => void
  /** The last attempt failed; shown above the list. */
  error?: string | null
  /** The last attempt hit a refilled slot — shows `strings.raceNotice`. */
  raced?: boolean
  strings?: Partial<DeviceLimitPickerStrings>
}

/**
 * Mid-login step shown when the password (or Google) is proven but every
 * device slot is taken: pick at least one signed-in device to sign out, then
 * the login completes here. Presentational — the login page keeps the
 * challenge token in component state and owns the API call.
 *
 * Ported from central-ui's device-limit page; rows are real checkboxes (a
 * visually-hidden input drives the custom box), so keyboard and screen-reader
 * multi-select work without extra wiring.
 */
export function DeviceLimitPicker({
  sessions,
  limit,
  onSubmit,
  onBack,
  error,
  raced = false,
  strings,
}: Props) {
  const copy = { ...DEFAULT_DEVICE_LIMIT_STRINGS, ...strings }
  const [selected, setSelected] = useState<ReadonlySet<string>>(
    () => new Set(),
  )
  const [submitting, setSubmitting] = useState(false)

  // Derived rather than reset in an effect: after a race the signed-out ids
  // are no longer in `sessions`, so they simply drop out of the selection.
  const chosen = sessions.filter((s) => selected.has(s.id)).map((s) => s.id)

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleSubmit(event: { preventDefault: () => void }) {
    event.preventDefault()
    if (chosen.length === 0 || submitting) return
    setSubmitting(true)
    try {
      await onSubmit(chosen)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <AuthHeading
        title={copy.title}
        description={copy.description(sessions.length, limit)}
      />

      {error && <FormError message={error} />}
      {raced && !error && (
        <p
          role="status"
          className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-foreground"
        >
          {copy.raceNotice}
        </p>
      )}

      {/* `min-w-0`: browsers default a fieldset to `min-inline-size:
          min-content` (preflight doesn't reset it), so a long `truncate`d
          device name would otherwise widen the whole list past the column. */}
      <fieldset className="min-w-0">
        <legend className="sr-only">{copy.title}</legend>
        <ul className="divide-y overflow-hidden rounded-xl border bg-card">
          {sessions.map((s) => {
            const checked = selected.has(s.id)
            const Icon = isMobileDeviceName(s.device_name) ? Smartphone : Laptop
            return (
              <li key={s.id}>
                <label
                  className={cn(
                    'flex cursor-pointer items-center gap-3 px-3 py-3 transition-colors hover:bg-accent/50',
                    checked && 'bg-primary/5',
                  )}
                >
                  <input
                    type="checkbox"
                    className="peer sr-only"
                    checked={checked}
                    disabled={submitting}
                    onChange={() => toggle(s.id)}
                  />
                  <span
                    aria-hidden
                    className={cn(
                      'grid size-4 shrink-0 place-items-center rounded border transition-colors peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring/50',
                      checked
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-input',
                    )}
                  >
                    {checked && <Check className="size-3" strokeWidth={3} />}
                  </span>
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {s.device_name}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {copy.lastActive(s.last_used_at)} ·{' '}
                      {copy.signedIn(s.created_at)}
                    </span>
                  </span>
                </label>
              </li>
            )
          })}
        </ul>
      </fieldset>

      <div className="space-y-3">
        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={submitting || chosen.length === 0}
        >
          {submitting
            ? copy.submitting
            : chosen.length > 0
              ? copy.submit(chosen.length)
              : copy.selectPrompt}
        </Button>
        <AuthTextButton onClick={onBack}>{copy.back}</AuthTextButton>
      </div>
    </form>
  )
}
