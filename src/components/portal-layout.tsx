import { Link, Outlet } from '@tanstack/react-router'
import {
  ArrowLeft,
  LogOut,
  Settings,
  UserRound,
  type LucideIcon,
} from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { NucleusLogo } from '@/components/brand'
import { ChatNotifier } from '@/components/chat-notifier'
import { ConnectMenu } from '@/components/connect-menu'
import { ModulesDrawer } from '@/components/modules-drawer'
import { NotificationBell } from '@/components/notification-bell'
import { NotificationNotifier } from '@/components/notification-notifier'
import { PageHeader as SharedPageHeader } from '@/components/ui/page-header'
import { ThemePresetScope } from '@/components/theme-preset-scope'
import { ThemeToggle } from '@/components/theme-toggle'
import { useHeaderSlot } from '@/hooks/use-header-slot'
import { MODULE_GRADIENT, type ModuleColor } from '@/lib/modules'
import { studentLogout } from '@/lib/student-auth'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'
import { withGlobalLoader } from '@/stores/loader-store'
import { useNetworkStore } from '@/stores/network-store'

/**
 * Shared chrome for every signed-in student page: a sticky header and a
 * centered content column. Rendered by the router's root route, so each
 * page only needs to render its own content into the `<Outlet />`.
 */
export function PortalLayout() {
  const signOut = useAuthStore((state) => state.signOut)
  const reconnectNonce = useNetworkStore((s) => s.reconnectNonce)
  const [signingOut, setSigningOut] = useState(false)

  async function handleSignOut() {
    if (signingOut) return
    setSigningOut(true)
    try {
      await withGlobalLoader(() => studentLogout(), 'Signing out…')
    } finally {
      signOut()
    }
  }

  return (
    <div className="portal-shell min-h-svh bg-background text-foreground">
      {/* `portal-shell` above and `app-header` below are hooks for the Glass
          preset's chrome (index.css) — keep them when restyling the shell. */}
      {/* App-wide toasts, available on every signed-in page. */}
      <ChatNotifier />
      <NotificationNotifier />
      {/* Signed-in shell → the chosen preset theme may apply. */}
      <ThemePresetScope />
      <header className="app-header sticky top-0 z-10 border-b bg-card shadow-header">
        <div className="mx-auto grid h-12 max-w-5xl grid-cols-[1fr_auto_1fr] items-center px-4 sm:px-6">
          <Link to="/" className="flex w-fit items-center" aria-label="Nucleus home">
            <NucleusLogo />
          </Link>

          <ModulesDrawer />

          <div className="flex items-center justify-end gap-2">
            <ConnectMenu />
            <NotificationBell />
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Open profile menu"
                >
                  <UserRound />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>My account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/profile">
                    <UserRound />
                    Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/settings">
                    <Settings />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  disabled={signingOut}
                  onSelect={() => void handleSignOut()}
                >
                  <LogOut />
                  {signingOut ? 'Signing out…' : 'Sign out'}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Padding is mirrored by PAGE_BLEED (src/lib/page-bleed.ts) — change both. */}
      <main className="mx-auto max-w-5xl space-y-4 px-4 py-4 sm:px-6">
        {/* Keyed on the reconnect nonce: on recovery the active page remounts
            and its data-loading effects re-run, clearing stale empty states. */}
        <Outlet key={reconnectNonce} />
      </main>
    </div>
  )
}

/**
 * Compact page heading for the student / parent feature pages — the shared
 * `PageHeader` with a back link to the dashboard and an optional module icon
 * in its leading slot.
 *
 * In the parent portal the shell's app header owns a title slot, so the shared
 * component portals the back link, a muted glyph and the title up there and
 * the page starts straight with its content. The student portal has no slot:
 * the heading renders inline with the gradient module badge, kept deliberately
 * short to preserve vertical space.
 */
export function PageHeader({
  title,
  icon: Icon,
  accent,
  backTo = '/',
  backLabel = 'Back to dashboard',
  actions,
  tabs,
}: {
  title: string
  /**
   * @deprecated No longer rendered — the header is intentionally compact.
   * Still accepted so existing call sites need no edit.
   */
  subtitle?: string
  /** Optional decorative icon: a colored gradient badge inline, a muted glyph
   * in the app header. */
  icon?: LucideIcon
  /** Accent hue for the icon badge — usually the page's module color. */
  accent?: ModuleColor
  /** Where the back link points. Defaults to the dashboard; `null` renders no
   * back link (the dashboard itself). */
  backTo?: string | null
  /** Override label for the back link. */
  backLabel?: string
  /** Trailing controls, pushed to the far edge of the heading row. */
  actions?: React.ReactNode
  /** A `<TabsBar className="border-b-0" …/>` — the first row of the page in
   * the parent portal; shares the title row inline in the student portal. */
  tabs?: React.ReactNode
}) {
  const inHeader = useHeaderSlot() !== null

  const back =
    backTo === null ? null : (
      <Link
        to={backTo}
        aria-label={backLabel}
        title={backLabel}
        className="inline-grid size-8 shrink-0 place-items-center rounded-lg border text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
      </Link>
    )

  if (inHeader) {
    return (
      <SharedPageHeader
        title={title}
        icon={Icon}
        actions={actions}
        tabs={tabs}
        leading={back}
      />
    )
  }

  return (
    <SharedPageHeader
      title={title}
      actions={actions}
      tabs={tabs}
      leading={
        <>
          {back}
          {Icon && accent ? (
            <div
              className={cn(
                'grid size-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br text-icon-on shadow-md ring-1 ring-inset ring-icon-on/15',
                MODULE_GRADIENT[accent],
              )}
            >
              <Icon className="size-4" />
            </div>
          ) : null}
        </>
      }
    />
  )
}
