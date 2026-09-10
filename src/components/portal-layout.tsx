import { Link, Outlet } from '@tanstack/react-router'
import {
  ArrowLeft,
  Lock,
  LogOut,
  MonitorSmartphone,
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
import { ThemeToggle } from '@/components/theme-toggle'
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
    <div className="min-h-svh bg-background text-foreground">
      {/* App-wide toasts, available on every signed-in page. */}
      <ChatNotifier />
      <NotificationNotifier />
      <header className="sticky top-0 z-10 border-b bg-card/80 shadow-sm backdrop-blur">
        <div className="mx-auto grid h-14 max-w-5xl grid-cols-[1fr_auto_1fr] items-center px-4 sm:px-6">
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
                  <Link to="/privacy">
                    <Lock />
                    Privacy
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/devices">
                    <MonitorSmartphone />
                    Devices
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

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6">
        {/* Keyed on the reconnect nonce: on recovery the active page remounts
            and its data-loading effects re-run, clearing stale empty states. */}
        <Outlet key={reconnectNonce} />
      </main>
    </div>
  )
}

/**
 * Compact page heading for the feature pages — a back link to the dashboard
 * plus a small icon badge and the page title. Kept deliberately short to
 * preserve vertical space for the actual page content.
 */
export function PageHeader({
  title,
  icon: Icon,
  accent,
  backTo = '/',
  backLabel = 'Back to dashboard',
}: {
  title: string
  /**
   * @deprecated No longer rendered — the header is intentionally compact.
   * Still accepted so existing call sites need no edit.
   */
  subtitle?: string
  /** Optional decorative icon, rendered as a colored gradient badge. */
  icon?: LucideIcon
  /** Accent hue for the icon badge — usually the page's module color. */
  accent?: ModuleColor
  /** Where the back link points. Defaults to the dashboard. */
  backTo?: string
  /** Override label for the back link. */
  backLabel?: string
}) {
  return (
    <div className="flex items-center gap-3">
      <Link
        to={backTo}
        aria-label={backLabel}
        title={backLabel}
        className="inline-grid size-9 shrink-0 place-items-center rounded-lg border text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
      </Link>
      {Icon && accent ? (
        <div
          className={cn(
            'grid size-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br text-icon-on shadow-md ring-1 ring-inset ring-icon-on/15',
            MODULE_GRADIENT[accent],
          )}
        >
          <Icon className="size-5" />
        </div>
      ) : null}
      <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
    </div>
  )
}
