/**
 * Inline form error for the sign-in screens.
 *
 * Uses the `destructive` token, not Tailwind's raw red palette — the three
 * hand-rolled copies of this each hardcoded `red-500`/`red-600`, which the
 * repo's colour rules forbid and which ignored the theme (one copy was also
 * missing its `dark:` variant, so it rendered near-black on the dark portal).
 */
export function FormError({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
    >
      {message}
    </p>
  )
}
