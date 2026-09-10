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
}

/**
 * One portal on the hub: a full-width row of colour rail → icon → text → arrow.
 *
 * A row rather than a tall card because the page's job is to present three
 * choices and get out of the way — stacked rows put all three in the first
 * screenful at any width, and read as a menu instead of a pitch.
 *
 * The card carries no feature list on purpose. Someone who has arrived here
 * already knows whether they are a student, a parent or staff; the only thing
 * this screen owes them is an obvious door. Identity is carried by colour and
 * icon instead of words: `data-hub-role` re-points --hub-accent for the rail,
 * the tile, the spotlight and the arrow all at once (see index.css).
 */
export function PortalCard({ role, label, title, description, icon: Icon, href }: PortalCardProps) {
  const { ref, onPointerMove } = useSpotlight<HTMLLIElement>()

  return (
    <li
      ref={ref}
      onPointerMove={onPointerMove}
      data-hub-role={role}
      className={cn(
        'hub-glass hub-spotlight group relative flex items-center gap-5 overflow-hidden',
        'rounded-2xl p-6 pl-7 sm:gap-6 sm:p-7 sm:pl-8',
        'transition duration-300 ease-out hover:border-hub-accent/45',
        // Focus lives on the inner <a>, but the row is what the user sees — so
        // project the focus treatment outward instead of ringing just the title.
        'has-[a:focus-visible]:border-hub-accent/60 has-[a:focus-visible]:ring-2',
        'has-[a:focus-visible]:ring-hub-accent/70 has-[a:focus-visible]:ring-offset-2',
        'has-[a:focus-visible]:ring-offset-hub-bg',
        'motion-reduce:transition-none',
      )}
    >
      {/* Role colour rail. An element rather than a border-left utility, whose
          precedence against hub-glass's own `border` shorthand would depend on
          stylesheet order. */}
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-1 bg-hub-accent/70 transition-colors group-hover:bg-hub-accent"
      />

      <span
        aria-hidden
        className="grid size-12 shrink-0 place-content-center rounded-2xl border border-hub-accent/30 bg-hub-accent/10 text-hub-accent transition-colors group-hover:bg-hub-accent/15 sm:size-16"
      >
        <Icon className="size-6 sm:size-8" />
      </span>

      {/* min-w-0 so long titles can shrink rather than forcing the row wider. */}
      <div className="min-w-0 flex-1">
        <p className="text-[0.65rem] font-medium uppercase tracking-[0.18em] text-hub-accent">
          {label}
        </p>

        <h2 className="mt-1 text-xl font-semibold tracking-tight text-hub-ink sm:text-2xl">
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
      </div>

      {/* Hidden on phones: it costs ~56px of a 390px row and the whole card is
          already the tap target, so the text is the better use of the width. */}
      <span
        aria-hidden
        className="hidden size-10 shrink-0 place-content-center self-center rounded-full border border-hub-line text-hub-accent transition-colors group-hover:border-hub-accent/50 group-hover:bg-hub-accent/10 sm:grid"
      >
        <ArrowRight className="size-5 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0" />
      </span>
    </li>
  )
}
