import type { ReactNode } from 'react'

/** Password policy hint. Mirrors `validateNewPassword` in `auth-helpers.ts`. */
export function PasswordHint({
  children = 'Use at least 8 characters, including a letter and a number.',
}: {
  children?: ReactNode
}) {
  return <p className="text-xs text-muted-foreground">{children}</p>
}
