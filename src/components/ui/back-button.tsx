import { ArrowLeft } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * The one standardized "back" control. Presentational — the caller supplies the
 * navigation in `onClick` (router `useNavigate` / the portal `navigateTo`
 * helper; never `window.location`).
 *
 * Pass it as `PageHeader`'s `leading` with `iconOnly` so it sits in the app
 * header beside the page title, where it is always visible — that is how a
 * back control stays pinned (see CLAUDE.md). The labelled form is for inline
 * use inside a panel or sheet.
 */
export function BackButton({
  label,
  onClick,
  iconOnly = false,
  className,
}: {
  label: string
  onClick: () => void
  /** Arrow only, with `label` as the accessible name and tooltip. */
  iconOnly?: boolean
  className?: string
}) {
  return (
    <Button
      variant="ghost"
      size={iconOnly ? 'icon' : 'sm'}
      onClick={onClick}
      aria-label={iconOnly ? label : undefined}
      title={iconOnly ? label : undefined}
      className={cn(
        '-ml-2 text-muted-foreground hover:text-foreground',
        className,
      )}
    >
      <ArrowLeft className="size-4" />
      {iconOnly ? null : label}
    </Button>
  )
}
