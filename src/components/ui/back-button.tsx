import { ArrowLeft } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * The one standardized "back" control. Presentational — the caller supplies the
 * navigation in `onClick` (router `useNavigate` / the portal `navigateTo`
 * helper; never `window.location`). Pair it with `StickyHeader` so it stays
 * pinned on scroll (see the pinned-back-button rule in CLAUDE.md).
 */
export function BackButton({
  label,
  onClick,
  className,
}: {
  label: string
  onClick: () => void
  className?: string
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      className={cn(
        '-ml-2 text-muted-foreground hover:text-foreground',
        className,
      )}
    >
      <ArrowLeft className="size-4" /> {label}
    </Button>
  )
}
