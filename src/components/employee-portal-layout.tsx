import { Link, Outlet, useLocation, useNavigate } from '@tanstack/react-router'
import {
  Award,
  BookOpen,
  Briefcase,
  CalendarDays,
  ChevronDown,
  ClipboardCheck,
  ClipboardList,
  FileDown,
  GraduationCap,
  Home,
  IdCard,
  LayoutGrid,
  Lock,
  LockOpen,
  LogOut,
  type LucideIcon,
  Menu,
  PanelLeftClose,
  Search,
  SearchX,
  Settings,
  UserCheck,
  Users,
  Wallet,
  X,
} from 'lucide-react'
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import { NucleusLoader, NucleusLogo, NucleusMark } from '@/components/brand'
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
import { Input } from '@/components/ui/input'
import { ThemeToggle } from '@/components/theme-toggle'
import { EmployeeAccessContext } from '@/hooks/use-screen-access'
import { fetchEmployeeAccess, type EffectiveAccess } from '@/lib/employee-access'
import {
  employeeLogout,
  employeeMe,
  type EmployeeProfile,
} from '@/lib/employee-auth'
import { cn } from '@/lib/utils'
import { useEmployeeAuthStore } from '@/stores/employee-auth-store'
import { withGlobalLoader } from '@/stores/loader-store'
import { useNetworkStore } from '@/stores/network-store'

const ICON_MAP: Record<string, LucideIcon> = {
  BookOpen,
  CalendarDays,
  GraduationCap,
  ClipboardCheck,
  ClipboardList,
  Users,
  Wallet,
  IdCard,
  Briefcase,
  UserCheck,
  LayoutGrid,
}

function iconFor(name: string): LucideIcon {
  return ICON_MAP[name] ?? LayoutGrid
}

// Per-module tonal chip styles. Tailwind v4 needs the full class strings to
// appear verbatim in source for JIT to emit them — hence the static map rather
// than template-string interpolation.
type ToneName =
  | 'violet'
  | 'blue'
  | 'emerald'
  | 'amber'
  | 'rose'
  | 'cyan'
  | 'orange'

const MODULE_TONES: Record<ToneName, { bg: string; text: string }> = {
  violet: { bg: 'bg-icon-violet/12', text: 'text-icon-violet' },
  blue: { bg: 'bg-icon-blue/12', text: 'text-icon-blue' },
  emerald: { bg: 'bg-icon-emerald/12', text: 'text-icon-emerald' },
  amber: { bg: 'bg-icon-amber/14', text: 'text-icon-amber' },
  rose: { bg: 'bg-icon-rose/12', text: 'text-icon-rose' },
  cyan: { bg: 'bg-icon-cyan/12', text: 'text-icon-cyan' },
  orange: { bg: 'bg-icon-orange/12', text: 'text-icon-orange' },
}

const ICON_TONE: Record<string, ToneName> = {
  BookOpen: 'violet',
  CalendarDays: 'cyan',
  GraduationCap: 'blue',
  ClipboardCheck: 'emerald',
  ClipboardList: 'amber',
  Users: 'cyan',
  Wallet: 'amber',
  IdCard: 'rose',
  Briefcase: 'orange',
  UserCheck: 'rose',
  LayoutGrid: 'blue',
}

function toneFor(icon: string): ToneName {
  return ICON_TONE[icon] ?? 'blue'
}

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
      <div className="flex h-svh bg-background text-foreground">
        {/* Keeps the notification socket connected and toasts arrivals on any
            employee page. Renders nothing. */}
        <EmployeeNotificationNotifier />
        <EmployeeSidebar
          access={access}
          accessError={accessError}
          locked={sidebarLocked}
          onLockedChange={setSidebarLocked}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-14 shrink-0 items-center justify-between border-b bg-card/80 px-4 backdrop-blur sm:px-6">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarLocked((l) => !l)}
              aria-label={sidebarLocked ? 'Auto-hide menu' : 'Pin menu open'}
              aria-expanded={sidebarLocked}
              aria-controls="employee-sidebar"
            >
              <Menu />
            </Button>

            <div className="flex items-center gap-2">
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
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label="Open account menu"
                    className="flex items-center gap-2 rounded-md px-2 py-1 text-left transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                  >
                    <div className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      {computeInitials(
                        profile?.emp_display_name ||
                          profile?.email ||
                          'Account',
                      )}
                    </div>
                    <div className="hidden max-w-[14rem] leading-tight md:block">
                      <div className="truncate text-sm font-medium">
                        {profile?.emp_display_name ?? 'Account'}
                      </div>
                      {profile?.email && (
                        <div className="truncate text-xs text-muted-foreground">
                          {profile.email}
                        </div>
                      )}
                    </div>
                    <ChevronDown className="size-4 text-muted-foreground" />
                  </button>
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

          <main className="scrollbar-themed min-w-0 flex-1 overflow-auto px-4 py-6 sm:px-6">
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
      <div className="space-y-2 py-3" aria-hidden>
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="shimmer mx-auto size-8 rounded-md bg-muted/60"
          />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4 px-1 py-3" aria-hidden>
      {SKELETON_GROUPS.map((group, g) => (
        <div key={g} className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <div className="shimmer size-7 shrink-0 rounded-md bg-muted/60" />
            <div
              className={cn('shimmer h-2.5 rounded bg-muted/60', group.label)}
            />
          </div>
          <div className="space-y-2 pl-3">
            {group.items.map((w, s) => (
              <div key={s} className="flex items-center gap-2.5 px-2">
                <div className="size-1.5 shrink-0 rounded-full bg-muted/50" />
                <div className={cn('shimmer h-2 rounded bg-muted/60', w)} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function navigateTo(route: string) {
  window.history.pushState({}, '', route)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

function highlight(text: string, q: string): ReactNode {
  if (!q) return text
  const i = text.toLowerCase().indexOf(q)
  if (i < 0) return text
  return (
    <>
      {text.slice(0, i)}
      <mark className="rounded-sm bg-primary/15 px-0.5 text-primary">
        {text.slice(i, i + q.length)}
      </mark>
      {text.slice(i + q.length)}
    </>
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
  const [query, setQuery] = useState('')
  const [moduleClosed, setModuleClosed] = useState<Set<string>>(new Set())
  const [hovered, setHovered] = useState(false)
  const [searchFocused, setSearchFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  // Auto-hide: rest as an icon rail, expand while hovered or while the search
  // box has focus — unless pinned open (locked). Hover is honoured only on
  // pointer devices (see CAN_HOVER) so a tap doesn't leave the rail stuck open.
  const collapsed = !(locked || hovered || searchFocused)
  const isMac =
    typeof navigator !== 'undefined' &&
    /Mac|iPod|iPhone|iPad/.test(navigator.platform)

  // Cmd/Ctrl + K focuses search. When the rail is collapsed the input
  // isn't mounted, so expand first and focus after the next paint.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        if (collapsed) {
          onLockedChange(true)
          requestAnimationFrame(() => {
            inputRef.current?.focus()
            inputRef.current?.select()
          })
        } else {
          inputRef.current?.focus()
          inputRef.current?.select()
        }
      }
      if (e.key === 'Escape' && document.activeElement === inputRef.current) {
        setQuery('')
        inputRef.current?.blur()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [collapsed, onLockedChange])

  const modules = useMemo(() => {
    if (!access) return []
    return Object.values(access.modules).sort((a, b) => a.order - b.order)
  }, [access])

  const q = query.trim().toLowerCase()
  const searching = q.length > 0

  const filtered = useMemo(() => {
    if (!access) return []
    return modules
      .map((mod) => {
        const screens = mod.screen_keys
          .map((k) => access.screens[k])
          .filter(
            (s): s is NonNullable<typeof s> =>
              Boolean(s) && Boolean(s.web_route),
          )
        const moduleHit = mod.label.toLowerCase().includes(q)
        const matched = searching
          ? screens.filter(
              (s) => moduleHit || s.label.toLowerCase().includes(q),
            )
          : screens
        return { mod, screens: matched }
      })
      .filter(({ screens }) => !searching || screens.length > 0)
  }, [modules, q, searching, access])

  const totalMatches = filtered.reduce((n, { screens }) => n + screens.length, 0)

  function toggleModule(key: string) {
    setModuleClosed((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function onSearchKeyDown(e: ReactKeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter' || !searching) return
    const first = filtered.find(({ screens }) => screens.length > 0)?.screens[0]
    if (first?.web_route) {
      e.preventDefault()
      navigateTo(first.web_route)
      setQuery('')
      inputRef.current?.blur()
    }
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
      className={cn(
        'relative isolate flex shrink-0 flex-col overflow-hidden border-r bg-sidebar text-sidebar-foreground transition-[width] duration-300 ease-out',
        collapsed ? 'w-16' : 'w-64',
      )}
    >
      {/* Subtle brand wash at the top — depth without competing with menu items. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-primary/[0.06] via-secondary/[0.03] to-transparent"
      />

      {/* Brand row — vertically aligned with the main header's h-14. */}
      <div
        className={cn(
          'relative flex h-14 shrink-0 items-center border-b transition-[padding] duration-300 ease-out',
          collapsed ? 'justify-center px-0' : 'gap-2 px-4',
        )}
      >
        <Link
          to="/"
          className={cn(
            'flex items-center transition-colors',
            collapsed ? '' : 'gap-2',
          )}
          aria-label="Nucleus home"
        >
          {collapsed ? (
            <NucleusMark size={36} />
          ) : (
            <NucleusLogo eyebrow="Staff portal" />
          )}
        </Link>
      </div>

      {/* Search — full input when expanded; an icon button that expands
          the rail when collapsed. */}
      {collapsed ? (
        <button
          type="button"
          onClick={() => {
            onLockedChange(true)
            requestAnimationFrame(() => inputRef.current?.focus())
          }}
          aria-label="Search menu"
          title="Search menu"
          className="mx-auto mt-3 grid size-9 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
        >
          <Search className="size-4" />
        </button>
      ) : (
        <div className="relative shrink-0 border-b p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onSearchKeyDown}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              placeholder="Search menu"
              aria-label="Search menu"
              className="h-9 pl-9 pr-16 text-sm"
            />
            {query ? (
              <button
                type="button"
                onClick={() => {
                  setQuery('')
                  inputRef.current?.focus()
                }}
                className="absolute right-2 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="size-3.5" />
              </button>
            ) : (
              <kbd className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 select-none items-center gap-1 rounded border bg-muted/60 px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground lg:flex">
                {isMac ? '⌘' : 'Ctrl'} K
              </kbd>
            )}
          </div>
        </div>
      )}

      <nav className="scrollbar-themed relative min-h-0 flex-1 space-y-0.5 overflow-y-auto overflow-x-hidden p-2">
        <Link
          to="/"
          activeOptions={{ exact: true }}
          title={collapsed ? 'Home' : undefined}
          className={cn(
            'flex items-center rounded-lg text-sm font-medium transition-all',
            collapsed ? 'justify-center px-0 py-2' : 'gap-2.5 px-3 py-2',
          )}
          activeProps={{
            className:
              'bg-gradient-to-r from-primary to-secondary text-primary-foreground shadow-md shadow-primary/25',
          }}
          inactiveProps={{
            className:
              'text-foreground/80 hover:bg-sidebar-accent/70 hover:text-foreground',
          }}
        >
          <Home className="size-4 shrink-0" />
          {!collapsed && <span>{highlight('Home', q)}</span>}
        </Link>

        {accessError && !collapsed && (
          <div className="mt-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            Couldn&rsquo;t load your access. Refresh to retry.
          </div>
        )}

        {!access && !accessError && (
          <SidebarMenuSkeleton collapsed={collapsed} />
        )}

        {filtered.map(({ mod, screens }) => {
          const Icon = iconFor(mod.icon)
          const tone = MODULE_TONES[toneFor(mod.icon)]
          const open = searching || !moduleClosed.has(mod.key)
          const hasActiveScreen = screens.some(
            (s) => pathname === s.web_route,
          )

          if (collapsed) {
            return (
              <button
                key={mod.key}
                type="button"
                title={mod.label}
                onClick={() => expandAndOpenModule(mod.key)}
                className={cn(
                  'flex w-full items-center justify-center rounded-lg py-2 transition-colors',
                  hasActiveScreen
                    ? 'bg-sidebar-accent'
                    : 'hover:bg-sidebar-accent/60',
                )}
              >
                <span
                  className={cn(
                    'grid size-8 place-items-center rounded-md',
                    tone.bg,
                    tone.text,
                  )}
                >
                  <Icon className="size-4" />
                </span>
              </button>
            )
          }

          return (
            <div key={mod.key} className="pt-2">
              <button
                type="button"
                onClick={() => toggleModule(mod.key)}
                aria-expanded={open}
                className="group flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-sidebar-accent/40"
              >
                <span
                  className={cn(
                    'grid size-7 shrink-0 place-items-center rounded-md transition-transform group-hover:scale-105',
                    tone.bg,
                    tone.text,
                  )}
                >
                  <Icon className="size-4" />
                </span>
                <span className="flex-1 truncate text-[11px] font-semibold uppercase tracking-wider text-muted-foreground group-hover:text-foreground">
                  {highlight(mod.label, q)}
                </span>
                <ChevronDown
                  className={cn(
                    'size-3.5 shrink-0 text-muted-foreground transition-transform',
                    open ? '' : '-rotate-90',
                  )}
                />
              </button>
              {open && (
                <div className="mt-0.5 space-y-0.5 pl-2">
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
                          onClick={(e) => {
                            e.preventDefault()
                            if (s.web_route) navigateTo(s.web_route)
                          }}
                          className={cn(
                            'group flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm transition-all',
                            isActive
                              ? 'bg-gradient-to-r from-primary to-secondary font-medium text-primary-foreground shadow-sm shadow-primary/25'
                              : 'text-foreground/75 hover:bg-sidebar-accent/60 hover:text-foreground',
                          )}
                        >
                          <span
                            className={cn(
                              'size-1.5 shrink-0 rounded-full transition-all',
                              isActive
                                ? 'bg-primary-foreground/80'
                                : 'bg-foreground/20 group-hover:bg-foreground/50',
                            )}
                          />
                          <span className="truncate">
                            {isActive ? s.label : highlight(s.label, q)}
                          </span>
                        </a>
                      )
                    })
                  )}
                </div>
              )}
            </div>
          )
        })}

        {searching && totalMatches === 0 && access && !collapsed && (
          <div className="mt-2 flex flex-col items-center gap-1.5 rounded-md border border-dashed bg-muted/20 px-3 py-6 text-center">
            <SearchX className="size-5 text-muted-foreground" />
            <div className="text-xs text-muted-foreground">
              No menu items match{' '}
              <span className="font-medium text-foreground">
                &ldquo;{query}&rdquo;
              </span>
            </div>
          </div>
        )}

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
          'flex shrink-0 items-center border-t p-2',
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
            'flex h-9 items-center gap-2 rounded-md text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-foreground',
            collapsed ? 'w-9 justify-center px-0' : 'flex-1 justify-center px-2',
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
            'flex h-9 items-center gap-2 rounded-md text-sm transition-colors',
            locked
              ? 'text-primary hover:bg-sidebar-accent/60'
              : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground',
            collapsed ? 'w-9 justify-center px-0' : 'flex-1 justify-center px-2',
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
