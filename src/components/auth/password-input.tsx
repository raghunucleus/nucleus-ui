import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type Props = {
  id: string
  label: string
  value: string
  onChange: (next: string) => void
  autoComplete: string
  autoFocus?: boolean
  /**
   * `lg` (the default) is the auth-form height; in-app settings forms pass
   * `default` so the field lines up with every other `h-9` control.
   */
  inputSize?: 'default' | 'lg'
  /** Renders a "forgot password" link beside the label when supplied. */
  onForgot?: () => void
  /**
   * Every label is a prop with an English default rather than a `t()` call, so
   * this component stays out of the i18n bundle. The parent portal — the only
   * translated one — passes its own strings.
   */
  forgotLabel?: string
  showLabel?: string
  hideLabel?: string
}

/**
 * Labelled password field with a show/hide toggle, shared by all three logins
 * and the student Settings page.
 *
 * The toggle is as wide as the field is tall (`w-10` in an `h-10` field, `w-9`
 * in an `h-9` one): an overlay wider than the control is tall reads as a
 * mis-scaled control, which is what `w-11` in an `h-9` input used to look like.
 */
export function PasswordInput({
  id,
  label,
  value,
  onChange,
  autoComplete,
  autoFocus,
  inputSize = 'lg',
  onForgot,
  forgotLabel = 'Forgot password?',
  showLabel = 'Show password',
  hideLabel = 'Hide password',
}: Props) {
  const [shown, setShown] = useState(false)
  const large = inputSize === 'lg'

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label htmlFor={id}>{label}</Label>
        {onForgot && (
          <button
            type="button"
            onClick={onForgot}
            className="text-xs font-medium text-primary hover:underline"
          >
            {forgotLabel}
          </button>
        )}
      </div>
      <div className="relative">
        <Input
          id={id}
          inputSize={inputSize}
          type={shown ? 'text' : 'password'}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          required
          className={large ? 'pr-10' : 'pr-9'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          onClick={() => setShown((v) => !v)}
          className={`absolute inset-y-0 right-0 grid ${large ? 'w-10' : 'w-9'} place-items-center text-muted-foreground transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:outline-none`}
          aria-label={shown ? hideLabel : showLabel}
        >
          {shown ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
    </div>
  )
}
