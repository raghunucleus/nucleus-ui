import type { ReactNode } from 'react'

/**
 * The tertiary action under a submit button — "Back to sign in", "Cancel and
 * sign out". Deliberately quiet: it is always the way out of a flow, never the
 * thing we want the person to click.
 */
export function AuthTextButton({
  onClick,
  children,
}: {
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-center text-xs font-medium text-muted-foreground hover:text-foreground"
    >
      {children}
    </button>
  )
}
