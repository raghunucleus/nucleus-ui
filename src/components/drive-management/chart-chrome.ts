/**
 * Shared recharts chrome for every analytics surface — the drive's and the
 * placement coordinator's batch analytics — so charts read as one system.
 *
 * All colors are CSS custom properties rather than hex, so light and dark
 * resolve on their own without a theme hook. Lives in its own module because
 * a file that exports both components and constants breaks Fast Refresh.
 */

export const TOOLTIP_STYLE = {
  background: 'var(--color-card)',
  border: '1px solid var(--color-border)',
  borderRadius: 8,
  color: 'var(--color-foreground)',
  fontSize: 12,
  boxShadow: '0 4px 12px rgb(0 0 0 / 0.08)',
} as const

export const AXIS_TICK = {
  fontSize: 12,
  fill: 'var(--color-muted-foreground)',
} as const
