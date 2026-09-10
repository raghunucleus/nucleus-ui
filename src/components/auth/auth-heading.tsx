import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

type Props = {
  /** Small uppercase kicker above the title, e.g. "Welcome back". */
  eyebrow?: ReactNode
  title: ReactNode
  description?: ReactNode
  /** Confirmation and error panels centre their text; forms start it. */
  align?: 'start' | 'center'
}

/**
 * The one heading size used by every sign-in, reset, invite and confirmation
 * panel: `text-2xl`.
 *
 * Before this the same flow mixed `text-3xl` (sign-in, reset, invite) and
 * `text-2xl` (change password, forgot, done) for headings at the same level —
 * and both were two steps above the `text-xl` every in-app page title uses.
 */
export function AuthHeading({
  eyebrow,
  title,
  description,
  align = 'start',
}: Props) {
  return (
    <header className={cn('space-y-1.5', align === 'center' && 'text-center')}>
      {eyebrow ? (
        <p className="text-xs font-medium uppercase tracking-wider text-primary">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
      {description ? (
        <p className="text-sm text-muted-foreground">{description}</p>
      ) : null}
    </header>
  )
}
