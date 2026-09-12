import { Link, Outlet, useLocation, useNavigate } from '@tanstack/react-router'
import {
  Award,
  ChevronDown,
  FileDown,
  Home,
  Lock,
  LockOpen,
  LogOut,
  PanelLeftClose,
  Settings,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { NucleusLoader, NucleusLogo, NucleusMark } from '@/components/brand'
import { MenuSearchDialog, MenuSearchTrigger } from '@/components/employee/menu-search'
import { MODULE_TONES, iconFor, toneFor } from '@/components/employee/module-icons'
import { EmployeeNotificationBell } from '@/components/employee/notification-bell'
import { employeeNavigate } from '@/components/employee/notification-navigate'
import { EmployeeNotificationNotifier } from '@/components/employee/notification-notifier'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ThemePresetScope } from '@/components/theme-preset-scope'
import { ThemeToggle } from '@/components/theme-toggle'
import { HeaderSlotContext } from '@/hooks/use-header-slot'
import { EmployeeAccessContext } from '@/hooks/use-screen-access'
import { fetchEmployeeAccess, type EffectiveAccess } from '@/lib/employee-access'
import {
  employeeLogout,
  employeeMe,
  type EmployeeProfile,
} from '@/lib/employee-auth'
import { menuGroups, navigateTo, sortModules } from '@/lib/employee-menu'
import { cn } from '@/lib/utils'
import { useEmployeeAuthStore } from '@/stores/employee-auth-store'
import { withGlobalLoader } from '@/stores/loader-store'
import { useNetworkStore } from '@/stores/network-store'

const SIDEBAR_STORAGE_KEY = 'nucleus-employee-sidebar'
const MOBILE_MQ = '(max-width: 767px)' // matches Tailwind's < md

// Hover-to-expand (auto-hide) only applies to devices with a real pointer.
// On touch a tap synthesises mouseenter, which would leave the rail stuck open.
const CAN_HOVER =
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(hover: hover) and (pointer: fine)').matches

/**
 * Shared chrome for every signed-in employee page: a full-height left
 * sidebar that joins seamlessly with the top header (admin-app style),
 * plus a scrollable content column. The sidebar smoothly transitions
 * between an icon rail (w-16) and the expanded view (w-64).
 */
function computeInitials(source: string): string {
  return (
    source
      .replace(/[^A-Za-z0-9 ]/g, '')
      .split(/\s+/)
      .filter(Boolean)
      .map((p) => p[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?'
  )
}

export function EmployeePortalLayout() {
  const signOut = useEmployeeAuthStore((s) => s.signOut)
  const navigate = useNavigate()
  const reconnectNonce = useNetworkStore((s) => s.reconnectNonce)
  const [access, setAccess] = useState<EffectiveAccess | null>(null)
  const [accessError, setAccessError] = useState<string | null>(null)
  const [profile, setProfile] = useState<EmployeeProfile | null>(null)
  const [signingOut, setSigningOut] = useState(false)
  // The header's title slot. `PageHeader` portals each page's heading into it
  // (see src/hooks/use-header-slot.ts); a callback ref keeps it in state so the
  // context re-renders consumers once the node exists.
  const [headerSlot, setHeaderSlot] = useState<HTMLElement | null>(null)

  // Persisted sidebar preference. true → pinned open. false → auto-hide rail
  // that expands on hover (central-ui style). First visit: pinned open on
  // desktop, rail on mobile. Legacy 'expanded'/'collapsed' values migrate so an
  // existing preference isn't lost.
  const [sidebarLocked, setSidebarLocked] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true
    const stored = window.localStorage.getItem(SIDEBAR_STORAGE_KEY)
    if (stored === 'locked' || stored === 'expanded') return true
    if (stored === 'unlocked' || stored === 'collapsed') return false
    return !window.matchMedia(MOBILE_MQ).matches
  })

  useEffect(() => {
    window.localStorage.setItem(
      SIDEBAR_STORAGE_KEY,
      sidebarLocked ? 'locked' : 'unlocked',
    )
  }, [sidebarLocked])

  // Tag <body> while the employee portal is mounted so portal-rendered
  // chrome (sheet overlays, dropdowns, etc.) can scope employee-only
  // overrides in CSS without touching the shared primitives. Cleaned up
  // on unmount so the student app on the same domain keeps defaults.
  useEffect(() => {
    document.body.dataset.portal = 'employee'
    return () => {
      delete document.body.dataset.portal
    }
  }, [])

  // Menu search (header button, Ctrl/⌘-K from anywhere in the portal).
  const [searchOpen, setSearchOpen] = useState(false)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    let alive = true
    void (async () => {
      // Fire both calls in parallel — neither depends on the other and
      // we want the header avatar to populate as soon as it can.
      const accessRes = fetchEmployeeAccess()
      const profileRes = employeeMe()

      try {
        const data = await accessRes
        if (alive) setAccess(data)
      } catch (err) {
        if (!alive) return
        const message =
          err instanceof Error ? err.message : 'Failed to load access'
        setAccessError(message)
        // 401s should drop us back to login.
        if (
          err instanceof Error &&
          'status' in err &&
          (err as { status: number }).status === 401
        ) {
          signOut()
        }
      }

      try {
        const p = await profileRes
        if (alive) setProfile(p)
      } catch {
        // Profile is non-critical for navigation; silently leave it null
        // and the dropdown will fall back to "Account".
      }
    })()
    return () => {
      alive = false
    }
  }, [signOut])

  async function handleSignOut() {
    if (signingOut) return
    setSigningOut(true)
    try {
      await withGlobalLoader(() => employeeLogout(), 'Signing out…')
    } finally {
      signOut()
    }
  }

  return (
    <EmployeeAccessContext.Provider value={access}>
    <HeaderSlotContext.Provider value={headerSlot}>
      {/* `portal-shell` / `app-header` (and the sidebar's `sidebar-panel`) are
          hooks for the Glass preset's chrome (index.css) — keep them when
          restyling the shell. */}
      <div className="portal-shell flex h-svh bg-background text-foreground">
        {/* Keeps the notification socket connected and toasts arrivals on any
            employee page. Renders nothing. */}
        <EmployeeNotificationNotifier />
        {/* Signed-in shell → the chosen preset theme may apply. */}
        <ThemePresetScope />
        <EmployeeSidebar
          access={access}
          accessError={accessError}
          locked={sidebarLocked}
          onLockedChange={setSidebarLocked}
        />

        <MenuSearchDialog
          open={searchOpen}
          onOpenChange={setSearchOpen}
          access={access}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="app-header flex h-12 shrink-0 items-center gap-2 border-b bg-card px-4 shadow-header sm:gap-3 sm:px-6">
            {/* Page title slot — the active page's `PageHeader` portals its
                back control, icon and title here, so page tabs start flush at
                the content's left edge. Sidebar pin/auto-hide lives in the
                sidebar footer. */}
            <div
              ref={setHeaderSlot}
              data-slot="header-title"
              className="flex min-w-0 flex-1 items-center gap-2"
            />

            <MenuSearchTrigger
              className="shrink-0"
              onOpen={() => setSearchOpen(true)}
            />

            <div className="flex shrink-0 items-center gap-1.5">
              <Button
                variant="outline"
                size="icon"
                aria-label="My exports"
                onClick={() => employeeNavigate({ to: '/exports' })}
              >
                <FileDown />
              </Button>
              <EmployeeNotificationBell />
              <ThemeToggle />
              <div aria-hidden className="mx-1 hidden h-5 w-px bg-border sm:block" />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    aria-label="Open account menu"
                    className="h-9 gap-2 px-2"
                  >
                    <span className="brand-gradient grid size-7 shrink-0 place-items-center rounded-full text-[11px] font-semibold">
                      {computeInitials(
                        profile?.emp_display_name ||
                          profile?.email ||
                          'Account',
                      )}
                    </span>
                    <span className="hidden max-w-[10rem] truncate text-sm font-medium sm:inline">
                      {profile?.emp_display_name ?? 'Account'}
                    </span>
                    <ChevronDown className="size-4 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60">
                  <DropdownMenuLabel>
                    <div className="leading-tight">
                      <div className="truncate text-sm font-medium text-foreground">
                        {profile?.emp_display_name ?? 'Account'}
                      </div>
                      {profile?.emp_code && (
                        <div className="truncate text-xs text-muted-foreground">
                          {profile.emp_code}
                        </div>
                      )}
                      {profile?.email && (
                        <div className="truncate text-xs text-muted-foreground">
                          {profile.email}
                        </div>
                      )}
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={() =>
                      void navigate({
                        to: '/profile',
                        search: { section: 'profile' },
                      })
                    }
                  >
                    <Settings /> Profile settings
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
          </header>

          {/* Padding is mirrored by PAGE_BLEED (src/lib/page-bleed.ts) — change both. */}
          <main className="scrollbar-themed min-w-0 flex-1 overflow-auto px-4 py-4 sm:px-6">
            {/* Gate page content until the access payload has resolved.
                Screens read their permissions from `EmployeeAccessContext`
                and render a "No access" state when it's null — which is also
                the value while the fetch is in flight. Without this gate the
                page flashes "No access" for the duration of that request, even
                for screens the employee can use. An error still falls through
                to the page (the sidebar surfaces a retry banner). */}
            {access || accessError ? (
              // Keyed on the reconnect nonce so the active page remounts and
              // refetches after a recovery.
              <Outlet key={reconnectNonce} />
            ) : (
              <AccessLoading />
            )}
          </main>
        </div>
      </div>
    </HeaderSlotContext.Provider>
    </EmployeeAccessContext.Provider>
  )
}

/**
 * Shown in the content column while the effective-access payload is still
 * loading on initial portal mount. Prevents screens from briefly rendering
 * their "No access" empty state before permissions have arrived.
 */
function AccessLoading() {
  return (
    <NucleusLoader
      size={64}
      message="Setting up your workspace…"
      className="min-h-[60vh]"
    />
  )
}

/**
 * Loading placeholder for the menu while the access payload is in flight.
 * Mirrors the real menu's shape — module icon chips with a label and a few
 * sub-item rows — so the sidebar reads as "loading my menu" rather than
 * sitting empty. Renders in both the collapsed icon rail and the expanded
 * view. Uses the shared `shimmer` utility (a sweeping light band) for a
 * livelier feel than a static pulse.
 */
const SKELETON_GROUPS = [
  { label: 'w-24', items: ['w-28', 'w-20', 'w-24'] },
  { label: 'w-16', items: ['w-24', 'w-28'] },
  { label: 'w-20', items: ['w-20', 'w-28', 'w-16'] },
]

function SidebarMenuSkeleton({ collapsed }: { collapsed: boolean }) {
  if (collapsed) {
    return (
      <div className="space-y-3 py-2" aria-hidden>
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex h-8 items-center px-3">
            <div className="shimmer size-4 rounded bg-muted/60" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-3 py-2" aria-hidden>
      {SKELETON_GROUPS.map((group, g) => (
        <div key={g}>
          <div className="flex h-8 items-center gap-3 px-3">
            <div className="shimmer size-4 shrink-0 rounded bg-muted/60" />
            <div
              className={cn('shimmer h-2.5 rounded bg-muted/60', group.label)}
            />
          </div>
          <div className="mt-1 ml-5 space-y-1 border-l border-sidebar-border pt-1 pl-3">
            {group.items.map((w, s) => (
              <div key={s} className="flex h-7 items-center px-3">
                <div className={cn('shimmer h-2 rounded bg-muted/60', w)} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function EmployeeSidebar({
  access,
  accessError,
  locked,
  onLockedChange,
}: {
  access: EffectiveAccess | null
  accessError: string | null
  locked: boolean
  onLockedChange: (locked: boolean) => void
}) {
  const pathname = useLocation({ select: (l) => l.pathname })
  const [moduleClosed, setModuleClosed] = useState<Set<string>>(new Set())
  const [hovered, setHovered] = useState(false)
  // Auto-hide: rest as an icon rail, expand while hovered — unless pinned open
  // (locked). Hover is honoured only on pointer devices (see CAN_HOVER) so a
  // tap doesn't leave the rail stuck open.
  const collapsed = !(locked || hovered)

  const modules = useMemo(() => sortModules(access), [access])
  const groups = useMemo(() => menuGroups(access, modules, ''), [access, modules])

  function toggleModule(key: string) {
    setModuleClosed((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function expandAndOpenModule(key: string) {
    onLockedChange(true)
    setModuleClosed((prev) => {
      if (!prev.has(key)) return prev
      const next = new Set(prev)
      next.delete(key)
      return next
    })
  }

  return (
    <aside
      id="employee-sidebar"
      onMouseEnter={CAN_HOVER ? () => setHovered(true) : undefined}
      onMouseLeave={CAN_HOVER ? () => setHovered(false) : undefined}
      data-expanded={!collapsed}
      data-touch={!CAN_HOVER || undefined}
      className={cn(
        'sidebar-panel relative isolate flex shrink-0 flex-col overflow-hidden border-r bg-sidebar text-sidebar-foreground transition-[width] duration-300 ease-out motion-reduce:transition-none',
        collapsed ? 'w-16' : 'w-64',
      )}
    >
      {/* Subtle brand wash at the top — depth without competing with menu items. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-primary/[0.06] via-secondary/[0.03] to-transparent"
      />

      {/* Brand row — vertically aligned with the main header's h-12. `px-3.5`
          in both states keeps the mark from jumping as the rail expands. */}
      <div className="relative flex h-12 shrink-0 items-center gap-2 border-b px-3.5">
        <Link
          to="/"
          className="flex items-center gap-2 transition-colors"
          aria-label="Nucleus home"
        >
          {collapsed ? (
            <NucleusMark size={28} />
          ) : (
            <NucleusLogo eyebrow="Staff portal" />
          )}
        </Link>
      </div>

      {/* `px-3` on the nav and on every row keeps each icon at a fixed 24px from
          the panel edge whether collapsed or not, so expanding reveals labels
          instead of sliding every row sideways. Labels stay mounted and fade
          via `.nav-label` (index.css). */}
      <nav className="scrollbar-themed relative min-h-0 flex-1 space-y-1 overflow-y-auto overflow-x-hidden px-3 py-3">
        <Link
          to="/"
          activeOptions={{ exact: true }}
          title={collapsed ? 'Home' : undefined}
          className="nav-link nav-tap flex items-center gap-3 rounded-lg px-3 py-2 font-medium data-[status=active]:font-semibold"
        >
          <Home className="size-4 shrink-0" />
          <span className="nav-label truncate" aria-hidden={collapsed}>
            Home
          </span>
        </Link>

        {accessError && !collapsed && (
          <div className="mt-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            Couldn&rsquo;t load your access. Refresh to retry.
          </div>
        )}

        {!access && !accessError && (
          <SidebarMenuSkeleton collapsed={collapsed} />
        )}

        {groups.map(({ mod, screens }) => {
          const Icon = iconFor(mod.icon)
          const tone = MODULE_TONES[toneFor(mod.icon)]
          const open = !moduleClosed.has(mod.key)
          const hasActiveScreen = screens.some(
            (s) => pathname === s.web_route,
          )

          return (
            <div key={mod.key}>
              {/* Collapsed: a tap expands the rail and opens this module —
                  a disclosure only makes sense once its children are visible. */}
              <button
                type="button"
                onClick={() =>
                  collapsed ? expandAndOpenModule(mod.key) : toggleModule(mod.key)
                }
                aria-expanded={collapsed ? false : open}
                aria-label={collapsed ? `${mod.label} — open menu` : undefined}
                title={collapsed ? mod.label : undefined}
                className={cn(
                  'nav-tap flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left font-medium transition-colors',
                  hasActiveScreen
                    ? 'text-foreground'
                    : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground',
                  collapsed && hasActiveScreen && 'bg-sidebar-accent',
                )}
              >
                <Icon className={cn('size-4 shrink-0', tone.text)} />
                <span
                  className="nav-label flex-1 truncate"
                  aria-hidden={collapsed}
                >
                  {mod.label}
                </span>
                <ChevronDown
                  className={cn(
                    'nav-chevron size-4 shrink-0 text-muted-foreground transition-transform',
                    open ? '' : '-rotate-90',
                  )}
                  aria-hidden
                />
              </button>
              {!collapsed && open && (
                <div className="relative mt-1 ml-5 space-y-1 border-l border-sidebar-border pt-1 pl-3">
                  {screens.length === 0 ? (
                    <div className="px-3 py-1.5 text-xs text-muted-foreground">
                      No web screens
                    </div>
                  ) : (
                    screens.map((s) => {
                      const isActive = pathname === s.web_route
                      return (
                        <a
                          key={s.key}
                          href={s.web_route}
                          data-status={isActive ? 'active' : undefined}
                          onClick={(e) => {
                            e.preventDefault()
                            if (s.web_route) navigateTo(s.web_route)
                          }}
                          className="nav-link nav-tap flex items-center rounded-lg px-3 py-2 font-medium data-[status=active]:font-semibold"
                        >
                          <span className="nav-label truncate">{s.label}</span>
                        </a>
                      )
                    })
                  )}
                </div>
              )}
            </div>
          )
        })}

        {access && modules.length === 0 && !accessError && !collapsed && (
          <div className="mt-2 rounded-md border border-dashed bg-muted/20 px-3 py-4 text-center text-xs text-muted-foreground">
            <Award className="mx-auto mb-2 size-5" />
            No modules assigned yet. Contact an administrator.
          </div>
        )}
      </nav>

      {/* Footer controls — central-ui style. Collapse returns to the auto-hide
          rail; Lock pins the sidebar open, disabling hover expansion. */}
      <div
        className={cn(
          'flex shrink-0 items-center border-t p-3',
          collapsed ? 'flex-col gap-1' : 'gap-1',
        )}
      >
        {/* Collapse: unpin and close now so it returns to the auto-hide rail.
            It re-expands on the next hover (pointer devices) or module tap. */}
        <button
          type="button"
          onClick={() => {
            onLockedChange(false)
            setHovered(false)
          }}
          aria-label="Collapse sidebar (auto-hide)"
          title="Collapse — auto-hide on hover"
          className={cn(
            'nav-tap flex h-9 items-center gap-2 rounded-lg text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-foreground',
            collapsed ? 'w-full justify-center px-0' : 'flex-1 justify-center px-3',
          )}
        >
          <PanelLeftClose className="size-4 shrink-0" />
          {!collapsed && <span className="truncate">Collapse</span>}
        </button>

        {/* Lock: pin open, disabling auto-hide on hover. */}
        <button
          type="button"
          onClick={() => onLockedChange(!locked)}
          aria-pressed={locked}
          aria-label={
            locked
              ? 'Unlock sidebar (enable auto-hide)'
              : 'Keep sidebar open (disable auto-hide)'
          }
          title={
            locked
              ? 'Locked open — click to auto-hide'
              : 'Auto-hide — click to keep open'
          }
          className={cn(
            'nav-tap flex h-9 items-center gap-2 rounded-lg text-sm font-medium transition-colors',
            locked
              ? 'text-primary hover:bg-sidebar-accent/60'
              : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground',
            collapsed ? 'w-full justify-center px-0' : 'flex-1 justify-center px-3',
          )}
        >
          {locked ? (
            <Lock className="size-4 shrink-0" />
          ) : (
            <LockOpen className="size-4 shrink-0" />
          )}
          {!collapsed && (
            <span className="truncate">{locked ? 'Locked' : 'Lock'}</span>
          )}
        </button>
      </div>
    </aside>
  )
}
