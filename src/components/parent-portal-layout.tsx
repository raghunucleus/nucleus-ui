import { Outlet, useLocation } from '@tanstack/react-router'
import {
  Award,
  CalendarDays,
  ChevronDown,
  ClipboardCheck,
  Home,
  LogOut,
  type LucideIcon,
  Menu,
  PalmtreeIcon,
  PanelLeftClose,
  PanelLeftOpen,
  UserRound,
  Users,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { NucleusLogo, NucleusMark } from '@/components/brand'
import { ParentLanguageSwitcher } from '@/components/parent-language-switcher'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ThemePresetMenuItems } from '@/components/theme-preset-menu'
import { ThemePresetScope } from '@/components/theme-preset-scope'
import { ThemeToggle } from '@/components/theme-toggle'
import { parentLogout } from '@/lib/parent-auth'
import { parentNavigate } from '@/lib/parent-nav'
import { cn } from '@/lib/utils'
import { useParentAuthStore } from '@/stores/parent-auth-store'
import { withGlobalLoader } from '@/stores/loader-store'
import { useNetworkStore } from '@/stores/network-store'

const SIDEBAR_STORAGE_KEY = 'nucleus-parent-sidebar'
const MOBILE_MQ = '(max-width: 767px)' // matches Tailwind's < md

// Per-item tonal chip styles. Tailwind v4 needs the full class strings to
// appear verbatim in source for JIT to emit them — hence a static map.
type ToneName = 'violet' | 'blue' | 'emerald' | 'amber' | 'rose' | 'cyan'

const TONES: Record<ToneName, { bg: string; text: string }> = {
  violet: { bg: 'bg-icon-violet/12', text: 'text-icon-violet' },
  blue: { bg: 'bg-icon-blue/12', text: 'text-icon-blue' },
  emerald: { bg: 'bg-icon-emerald/12', text: 'text-icon-emerald' },
  amber: { bg: 'bg-icon-amber/14', text: 'text-icon-amber' },
  rose: { bg: 'bg-icon-rose/12', text: 'text-icon-rose' },
  cyan: { bg: 'bg-icon-cyan/12', text: 'text-icon-cyan' },
}

interface NavItem {
  /** i18n key under the `parent` namespace, e.g. `nav.home`. */
  labelKey: string
  route: string
  icon: LucideIcon
  tone: ToneName
}

const NAV_ITEMS: NavItem[] = [
  { labelKey: 'nav.home', route: '/', icon: Home, tone: 'blue' },
  { labelKey: 'nav.timetable', route: '/timetable', icon: CalendarDays, tone: 'cyan' },
  {
    labelKey: 'nav.attendance',
    route: '/attendance',
    icon: ClipboardCheck,
    tone: 'emerald',
  },
  { labelKey: 'nav.examResults', route: '/exam-results', icon: Award, tone: 'amber' },
  {
    labelKey: 'nav.holidays',
    route: '/academic-holidays',
    icon: PalmtreeIcon,
    tone: 'rose',
  },
  { labelKey: 'nav.profile', route: '/profile', icon: UserRound, tone: 'violet' },
]

/** Initials from a name, e.g. "Asha Rao" → "AR". */
function initials(source: string): string {
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

/** True when `pathname` belongs to a nav item (exact for "/", prefix else). */
function isActive(pathname: string, route: string): boolean {
  if (route === '/') return pathname === '/'
  return pathname === route || pathname.startsWith(`${route}/`)
}

/**
 * Shared chrome for every signed-in parent page: a colorful, collapsible left
 * sidebar joined to a top header (employee-portal style), plus a scrollable
 * content column. The rail transitions between an icon-only width (w-16) and the
 * expanded view (w-64).
 */
export function ParentPortalLayout() {
  const { t } = useTranslation()
  const reconnectNonce = useNetworkStore((s) => s.reconnectNonce)
  const guardian = useParentAuthStore((s) => s.guardian)
  const students = useParentAuthStore((s) => s.students)
  const selectedStudentId = useParentAuthStore((s) => s.selectedStudentId)
  const switchChild = useParentAuthStore((s) => s.switchChild)
  const signOut = useParentAuthStore((s) => s.signOut)
  const [signingOut, setSigningOut] = useState(false)

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    const stored = window.localStorage.getItem(SIDEBAR_STORAGE_KEY)
    if (stored === 'collapsed') return true
    if (stored === 'expanded') return false
    return window.matchMedia(MOBILE_MQ).matches
  })

  useEffect(() => {
    window.localStorage.setItem(
      SIDEBAR_STORAGE_KEY,
      collapsed ? 'collapsed' : 'expanded',
    )
  }, [collapsed])

  const child =
    students.find((s) => s.id === selectedStudentId) ?? students[0] ?? null
  const canSwitch = students.length > 1

  async function handleSignOut() {
    if (signingOut) return
    setSigningOut(true)
    try {
      await withGlobalLoader(() => parentLogout(), 'Signing out…')
    } finally {
      signOut()
    }
  }

  return (
    <div className="flex h-svh bg-background text-foreground">
      {/* Signed-in shell → the chosen preset theme may apply. */}
      <ThemePresetScope />
      <ParentSidebar
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((c) => !c)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center justify-between gap-3 border-b bg-card px-4 shadow-header sm:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="-ml-2"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? t('a11y.expandMenu') : t('a11y.collapseMenu')}
            aria-expanded={!collapsed}
            aria-controls="parent-sidebar"
          >
            <Menu />
          </Button>

          <div className="flex items-center gap-1.5">
            {/* Child-context chip — only for guardians with more than one linked
                student, since its purpose is switching between them. A single-
                child guardian has nothing to switch to, so we hide it. */}
            {child && canSwitch && (
              <div className="mr-1 hidden h-8 items-center gap-2 rounded-full border bg-background pr-2.5 pl-1 sm:flex">
                <div className="brand-gradient grid size-6 shrink-0 place-items-center rounded-full text-[10px] font-semibold">
                  {initials(child.display_name)}
                </div>
                <div className="max-w-[12rem] truncate text-xs font-medium">
                  {child.display_name}
                  <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                    {child.student_id}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={switchChild}
                  className="text-[11px] font-medium text-primary hover:underline"
                >
                  {t('account.switch')}
                </button>
              </div>
            )}

            <ParentLanguageSwitcher />
            <ThemeToggle />
            <div aria-hidden className="mx-1 hidden h-5 w-px bg-border sm:block" />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  aria-label={t('a11y.openAccount')}
                  className="h-9 gap-2 px-2"
                >
                  <span className="brand-gradient grid size-7 shrink-0 place-items-center rounded-full text-[11px] font-semibold">
                    {initials(guardian?.display_name || 'Parent')}
                  </span>
                  <span className="hidden max-w-[10rem] truncate text-sm font-medium sm:inline">
                    {guardian?.display_name ?? 'Parent'}
                  </span>
                  <ChevronDown className="size-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuLabel>
                  <div className="leading-tight">
                    <div className="truncate text-sm font-medium text-foreground">
                      {guardian?.display_name ?? 'Parent'}
                    </div>
                    {guardian?.mobile_number && (
                      <div className="truncate text-xs text-muted-foreground">
                        {guardian.mobile_number}
                      </div>
                    )}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => parentNavigate('/profile')}>
                  <UserRound /> {t('nav.profile')}
                </DropdownMenuItem>
                {canSwitch && (
                  <DropdownMenuItem onSelect={() => switchChild()}>
                    <Users /> {t('account.switchStudent')}
                  </DropdownMenuItem>
                )}
                <ThemePresetMenuItems
                  heading={t('theme.heading')}
                  labels={{
                    default: t('theme.default'),
                    violet: t('theme.violet'),
                    emerald: t('theme.emerald'),
                    slate: t('theme.slate'),
                  }}
                />
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  disabled={signingOut}
                  onSelect={() => void handleSignOut()}
                >
                  <LogOut />
                  {signingOut ? t('common.signingOut') : t('common.signOut')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Padding is mirrored by PAGE_BLEED (src/lib/page-bleed.ts) — change both. */}
        <main className="scrollbar-themed min-w-0 flex-1 overflow-auto px-4 py-4 sm:px-6">
          <div className="mx-auto max-w-5xl space-y-4">
            {/* Keyed on the reconnect nonce so the active page remounts and
                refetches after a recovery. */}
            <Outlet key={reconnectNonce} />
          </div>
        </main>
      </div>
    </div>
  )
}

function ParentSidebar({
  collapsed,
  onToggleCollapse,
}: {
  collapsed: boolean
  onToggleCollapse: () => void
}) {
  const { t, i18n } = useTranslation()
  const pathname = useLocation({ select: (l) => l.pathname })
  // Devanagari/Telugu have no 500-weight face in the OS fallback fonts
  // (e.g. Nirmala UI), so `font-medium` renders as the thin Regular. Bumping
  // to `font-semibold` makes CSS font-matching pick the Bold face, which reads
  // at a normal weight for these scripts. Latin keeps `font-medium`.
  const lang = i18n.resolvedLanguage ?? i18n.language
  const isIndic = lang === 'hi' || lang === 'te'
  const navWeight = isIndic ? 'font-semibold' : 'font-medium'

  return (
    <aside
      id="parent-sidebar"
      data-expanded={!collapsed}
      className={cn(
        'sidebar-panel relative isolate flex shrink-0 flex-col overflow-hidden border-r bg-sidebar text-sidebar-foreground transition-[width] duration-300 ease-out motion-reduce:transition-none',
        collapsed ? 'w-16' : 'w-64',
      )}
    >
      {/* Subtle brand wash at the top — depth without competing with items. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-primary/[0.06] via-secondary/[0.03] to-transparent"
      />

      {/* Brand row — vertically aligned with the main header's h-12. `px-3.5`
          in both states keeps the mark from jumping as the rail expands. */}
      <div className="relative flex h-12 shrink-0 items-center gap-2 border-b px-3.5">
        <button
          type="button"
          onClick={() => parentNavigate('/')}
          className="flex items-center gap-2 transition-colors"
          aria-label={t('a11y.parentHome')}
        >
          {collapsed ? (
            <NucleusMark size={28} />
          ) : (
            <NucleusLogo eyebrow={t('brand.parentPortal')} className="text-left" />
          )}
        </button>
      </div>

      {/* `px-3` on the nav and every row keeps each icon at a fixed 24px from
          the panel edge in both states; labels stay mounted and fade via
          `.nav-label` (index.css). Devanagari/Telugu keep `text-sm`: the
          11.4px nav-label size is too small for those scripts. */}
      <nav className="scrollbar-themed relative min-h-0 flex-1 space-y-1 overflow-y-auto overflow-x-hidden px-3 py-3">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const tone = TONES[item.tone]
          const active = isActive(pathname, item.route)

          return (
            <a
              key={item.route}
              href={item.route}
              title={collapsed ? t(item.labelKey) : undefined}
              data-status={active ? 'active' : undefined}
              onClick={(e) => {
                e.preventDefault()
                parentNavigate(item.route)
              }}
              className={cn(
                'nav-link nav-tap flex items-center gap-3 rounded-lg px-3 py-2',
                navWeight,
              )}
            >
              <Icon className={cn('size-4 shrink-0', !active && tone.text)} />
              <span
                className={cn('nav-label truncate', isIndic && 'text-sm')}
                aria-hidden={collapsed}
              >
                {t(item.labelKey)}
              </span>
            </a>
          )
        })}
      </nav>

      <div className="flex shrink-0 items-center border-t p-3">
        <button
          type="button"
          onClick={onToggleCollapse}
          className={cn(
            'nav-tap flex h-9 items-center gap-2 rounded-lg text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-foreground',
            collapsed ? 'w-full justify-center px-0' : 'flex-1 px-3',
          )}
          aria-label={collapsed ? t('a11y.expandSidebar') : t('a11y.collapseSidebar')}
        >
          {collapsed ? (
            <PanelLeftOpen className="size-4 shrink-0" />
          ) : (
            <>
              <PanelLeftClose className="size-4 shrink-0" />
              <span className="truncate">{t('account.collapse')}</span>
            </>
          )}
        </button>
      </div>
    </aside>
  )
}
