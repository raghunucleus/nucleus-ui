import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'

import {
  FormError,
  PasswordHint,
  PasswordInput,
  authErrorMessage,
  validateNewPassword,
} from '@/components/auth'
import { Button } from '@/components/ui/button'
import { storeTokens, studentChangeOwnPassword } from '@/lib/student-auth'

/**
 * Settings → Change password (the voluntary flow; the forced first-login one
 * lives in student-login.tsx). On success the server signs out every other
 * device and hands this one a fresh token pair, which replaces the stored one.
 * A wrong current password is a form error, shown inline — not a toast.
 */
export function ChangePasswordPanel() {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return
    setError(null)

    const policyError = validateNewPassword(next)
    if (policyError) return setError(policyError)
    if (next !== confirm) return setError('The new passwords do not match.')
    if (next === current) {
      return setError('Choose a password different from your current one.')
    }

    setSubmitting(true)
    try {
      const tokens = await studentChangeOwnPassword(current, next)
      storeTokens(tokens)
      setCurrent('')
      setNext('')
      setConfirm('')
      toast.success('Password updated. Your other devices have been signed out.')
    } catch (err) {
      setError(authErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="rounded-xl border bg-card p-4">
      <form className="max-w-md space-y-4" onSubmit={handleSubmit}>
        <p className="text-sm text-muted-foreground">
          Changing your password signs out every other device. This one stays
          signed in.
        </p>

        {error && <FormError message={error} />}

        <PasswordInput
          id="settings-current-password"
          label="Current password"
          value={current}
          onChange={setCurrent}
          autoComplete="current-password"
          inputSize="default"
        />
        <PasswordInput
          id="settings-new-password"
          label="New password"
          value={next}
          onChange={setNext}
          autoComplete="new-password"
          inputSize="default"
        />
        <PasswordInput
          id="settings-confirm-password"
          label="Confirm new password"
          value={confirm}
          onChange={setConfirm}
          autoComplete="new-password"
          inputSize="default"
        />

        <PasswordHint />

        <div className="flex justify-end">
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Updating…' : 'Update password'}
          </Button>
        </div>
      </form>
    </div>
  )
}
