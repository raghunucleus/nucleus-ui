import { Link } from '@tanstack/react-router'

import { cn } from '@/lib/utils'
import { MODULE_GRADIENT, MODULE_SOFT, type Module } from '@/lib/modules'

/**
 * A single Launchpad-style app tile — a rounded icon square with a label.
 * Live modules get a vivid gradient icon with a colored glow; modules that
 * aren't ready yet get a calmer soft-tinted version of the same hue. Shared
 * by the dashboard's Modules tile and the app drawer.
 */
export function ModuleTile({
  module,
  onNavigate,
  selected = false,
}: {
  module: Module
  /** Fired after the tile is activated — lets the app drawer close itself. */
  onNavigate?: () => void
  /** Keyboard-navigation highlight in the app drawer — pops the icon up. */
  selected?: boolean
}) {
  const Icon = module.icon
  const to = module.to
  const available = to !== undefined

  const rootBase =
    'flex w-24 shrink-0 flex-col items-center gap-2 rounded-2xl sm:w-28'

  const tile = (
    <>
      <div
        className={cn(
          'grid aspect-square w-full place-items-center rounded-2xl transition-all duration-200 ease-out',
          available
            ? cn(
                'bg-gradient-to-br text-icon-on shadow-lg ring-1 ring-inset ring-icon-on/15 group-hover:-translate-y-1 group-hover:shadow-xl',
                MODULE_GRADIENT[module.color],
              )
            : cn('border border-border/60', MODULE_SOFT[module.color]),
          // Selection highlight — scale the icon up and lift it, animated.
          selected && 'scale-110 -translate-y-1.5 shadow-xl',
        )}
      >
        <Icon className="size-7 sm:size-8" />
      </div>
      <div className="space-y-0.5 text-center">
        <p
          className={cn(
            'truncate text-xs transition-colors sm:text-sm',
            selected ? 'font-semibold text-foreground' : 'font-medium',
          )}
        >
          {module.title}
        </p>
        {!available ? (
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Soon
          </p>
        ) : null}
      </div>
    </>
  )

  if (to === undefined) {
    return (
      <div
        className={cn(rootBase, 'cursor-default')}
        title={`${module.title} — coming soon`}
      >
        {tile}
      </div>
    )
  }

  return (
    <Link
      to={to}
      title={module.description}
      onClick={onNavigate}
      className={cn(
        rootBase,
        'group outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
      )}
    >
      {tile}
    </Link>
  )
}
