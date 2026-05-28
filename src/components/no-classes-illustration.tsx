import { CalendarOff, Coffee, Sparkles, Sun } from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * Animated "no classes scheduled" illustration. Composes Lucide icons over
 * a tinted circular backdrop so empty days don't feel like an error — the
 * calendar floats, a small sun twinkles in the top-right, and a coffee
 * cup sits as a hint that the user has a moment to themselves.
 *
 * No external animation library — everything runs on CSS keyframes
 * registered in `src/index.css` (`bob` / `twinkle`).
 */
export function NoClassesIllustration({
  title = 'No classes scheduled',
  description = 'You have a free slot — make the most of it.',
  className,
}: {
  title?: string
  description?: string
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-4 px-6 py-12 text-center',
        className,
      )}
    >
      <div className="relative grid size-28 place-items-center">
        {/* Soft halo — a slow ping behind the disc so the eye picks up the
            illustration without a jarring spinner. */}
        <span
          aria-hidden
          className="absolute inset-0 rounded-full bg-primary/10 animate-ping [animation-duration:2.5s]"
        />
        <span
          aria-hidden
          className="absolute inset-2 rounded-full bg-gradient-to-br from-primary/15 to-secondary/10"
        />

        {/* Floating calendar — the focal point. */}
        <span
          aria-hidden
          className="relative grid size-16 place-items-center rounded-2xl bg-card shadow-sm ring-1 ring-border/60 [animation:var(--animate-float)]"
        >
          <CalendarOff className="size-8 text-primary" />
        </span>

        {/* Twinkling sun — top-right accent. */}
        <Sun
          aria-hidden
          className="absolute -top-1 -right-1 size-6 text-icon-amber [animation:var(--animate-twinkle)]"
        />
        {/* Sparkle in the opposite corner — different cadence to feel alive. */}
        <Sparkles
          aria-hidden
          className="absolute -bottom-1 -left-1 size-5 text-icon-violet [animation:var(--animate-twinkle)] [animation-delay:0.8s]"
        />
        {/* Tiny coffee cup peeking out for the "enjoy your break" vibe. */}
        <Coffee
          aria-hidden
          className="absolute -bottom-2 right-0 size-5 text-icon-emerald [animation:var(--animate-float)] [animation-delay:1.2s]"
        />
      </div>

      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="max-w-xs text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}
