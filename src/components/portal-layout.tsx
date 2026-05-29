import { Link, Outlet } from '@tanstack/react-router'
import {
  ArrowLeft,
  GraduationCap,
  LogOut,
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
import { ChatNotifier } from '@/components/chat-notifier'
import { ModulesDrawer } from '@/components/modules-drawer'
import { ThemeToggle } from '@/components/theme-toggle'
import { MODULE_GRADIENT, type ModuleColor } from '@/lib/modules'
import { studentLogout } from '@/lib/student-auth'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'
import { withGlobalLoader } from '@/stores/loader-store'

/**
 * Shared chrome for every signed-in student page: a sticky header and a
 * centered content column. Rendered by the router's root route, so each
 * page only needs to render its own content into the `<Outlet />`.
 */
export function PortalLayout() {
  const signOut = useAuthStore((state) => state.signOut)
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
      {/* App-wide incoming-message toasts, available on every signed-in page. */}
      <ChatNotifier />
      <header className="sticky top-0 z-10 border-b bg-card/80 shadow-sm backdrop-blur">
        <div className="mx-auto grid h-16 max-w-5xl grid-cols-[1fr_auto_1fr] items-center px-4 sm:px-6">
          <Link to="/" className="flex w-fit items-center gap-2">
            <div className="grid size-9 place-items-center rounded-lg bg-gradient-to-br from-primary to-secondary text-primary-foreground shadow-sm shadow-primary/30">
              <GraduationCap className="size-5" />
            </div>
            <span className="text-base font-semibold tracking-tight">
              Nucleus
            </span>
          </Link>

          <ModulesDrawer />

          <div className="flex items-center justify-end gap-2">
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

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
        <Outlet />
      </main>
    </div>
  )
}

/**
 * Page heading for the feature pages — a back link to the dashboard plus the
 * page title and an optional subtitle.
 */
export function PageHeader({
  title,
  subtitle,
  icon: Icon,
  accent,
  backTo = '/',
  backLabel = 'Back to dashboard',
}: {
  title: string
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
    <div className="space-y-3">
      <Link
        to={backTo}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {backLabel}
      </Link>
      <div className="flex items-center gap-3.5">
        {Icon && accent ? (
          <div
            className={cn(
              'grid size-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br text-icon-on shadow-md ring-1 ring-inset ring-icon-on/15',
              MODULE_GRADIENT[accent],
            )}
          >
            <Icon className="size-6" />
          </div>
        ) : null}
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {title}
          </h1>
          {subtitle ? (
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
