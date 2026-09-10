import type { ReactNode } from 'react'

import { BrandPanel } from '@/components/auth/brand-panel'
import { NucleusLogo } from '@/components/brand'
import { ThemeToggle } from '@/components/theme-toggle'

type Props = {
  /** Which portal this login belongs to — drives the brand panel's copy. */
  variant: 'employee' | 'parent' | 'member'
  /**
   * Header controls, top-right. Defaults to the theme toggle alone; the parent
   * portal passes its language switcher alongside it.
   *
   * This is a slot rather than a `showLanguageSwitcher` flag on purpose: the
   * switcher pulls in `@/lib/i18n`, which is parent-only. Importing it here
   * would drag i18next into the student and employee login chunks.
   */
  actions?: ReactNode
  children: ReactNode
}

/**
 * The chrome every sign-in screen shares: dark brand panel on the left, a
 * fixed-width form column on the right.
 *
 * All three login pages used to carry their own copy of this. They drifted —
 * different paddings, different heading sizes — which is what made the sign-in
 * screens read as a different product from the app behind them.
 */
export function AuthShell({ variant, actions, children }: Props) {
  return (
    <div className="flex min-h-svh bg-background text-foreground">
      <BrandPanel variant={variant} />

      {/* Equal halves. The form column used to be a fixed 28rem against a
          `flex-1` hero, so on a 1920 monitor the split was 78/22 and the form
          sat marooned in the right-hand corner. Both sides now grow together
          and the form centres in its half, which is how a split sign-in screen
          is expected to behave at any width. */}
      <main className="relative flex flex-1 basis-0 flex-col px-6 py-6 sm:px-10 lg:px-10">
        {/* Fixed height so the form below sits at the same vertical centre on
            every portal, whether the header holds one control or two. */}
        <div className="flex h-10 items-center justify-between">
          <div className="flex items-center lg:hidden">
            <NucleusLogo />
          </div>
          <div className="ml-auto flex items-center gap-2">
            {actions ?? <ThemeToggle />}
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center py-8">
          <div className="w-full max-w-md space-y-6">{children}</div>
        </div>
      </main>
    </div>
  )
}
