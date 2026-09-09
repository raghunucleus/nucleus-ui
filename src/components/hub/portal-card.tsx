import { ArrowRight, type LucideIcon } from 'lucide-react'

import type { PortalVariant } from '@/lib/subdomain'
import { cn } from '@/lib/utils'

import { useSpotlight } from './use-spotlight'

export type PortalCardProps = {
  role: PortalVariant
  /** Audience, e.g. "Students" — the eyebrow above the title. */
  label: string
  /** Link text and accessible name, e.g. "Student portal". */
  title: string
  /** One line. This is the whole explanation a chooser owes the reader. */
  description: string
  icon: LucideIcon
  href: string
  /** Target hostname, shown as small print so the destination is never a surprise. */
  hostLabel: string
}

/**
 * One portal on the hub: a full-width row of icon → text → arrow.
 *
 * A row rather than a tall card because the page's job is to present three
 * choices and get out of the way — stacked rows put all three in the first
 * screenful at any width, and read as a menu instead of a pitch.
 *
 * `data-hub-role` re-points --hub-accent for everything inside (see index.css).
 */
export function PortalCard({
  role,
  label,
  title,
  description,
  icon: Icon,
  href,
  hostLabel,
}: PortalCardProps) {
  const { ref, onPointerMove } = useSpotlight<HTMLLIElement>()

  return (
    <li
      ref={ref}
      onPointerMove={onPointerMove}
      data-hub-role={role}
      className={cn(
        'hub-glass hub-spotlight group relative flex items-center gap-4 rounded-2xl p-5 sm:gap-6 sm:p-6',
        'transition duration-300 ease-out hover:border-hub-accent/45 hover:bg-hub-accent/[0.04]',
        // Focus lives on the inner <a>, but the row is what the user sees — so
        // project the focus treatment outward instead of ringing just the title.
        'has-[a:focus-visible]:border-hub-accent/60 has-[a:focus-visible]:ring-2',
        'has-[a:focus-visible]:ring-hub-accent/70 has-[a:focus-visible]:ring-offset-2',
        'has-[a:focus-visible]:ring-offset-hub-bg',
        'motion-reduce:transition-none',
      )}
    >
      <span
        aria-hidden
        className="grid size-12 shrink-0 place-content-center rounded-xl border border-hub-accent/30 bg-hub-accent/10 text-hub-accent sm:size-14"
      >
        <Icon className="size-6 sm:size-7" />
      </span>

      {/* min-w-0 so the long hostnames can truncate instead of forcing the row wider. */}
      <div className="min-w-0 flex-1">
        <p className="text-[0.65rem] font-medium uppercase tracking-[0.16em] text-hub-accent">
          {label}
        </p>

        <h2 className="mt-1 text-lg font-semibold tracking-tight text-hub-ink sm:text-xl">
          {/* Stretched link: the ::after covers the whole row, so the entire
              surface is one large target and one tab stop, while the accessible
              name stays "Student portal" instead of the row's every word.
              A plain <a href> because this leaves the origin — TanStack's <Link>
              only navigates within the app, and the portals are separate origins
              on purpose (see lib/subdomain.ts). */}
          <a
            href={href}
            className="rounded-2xl outline-none after:absolute after:inset-0 after:content-['']"
          >
            {title}
          </a>
        </h2>

        <p className="mt-1.5 text-sm leading-snug text-hub-ink-dim sm:text-base">{description}</p>
        <p className="mt-2 truncate text-xs text-hub-ink-faint">{hostLabel}</p>
      </div>

      <ArrowRight
        aria-hidden
        className="size-5 shrink-0 text-hub-accent sm:size-6 transition-transform group-hover:translate-x-1 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
      />
    </li>
  )
}
