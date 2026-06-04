import { Outlet, useLocation } from '@tanstack/react-router'
import {
  Award,
  CalendarDays,
  ChevronDown,
  ClipboardCheck,
  GraduationCap,
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
import { ThemeToggle } from '@/components/theme-toggle'
import { parentLogout } from '@/lib/parent-auth'
import { parentNavigate } from '@/lib/parent-nav'
import { cn } from '@/lib/utils'
import { useParentAuthStore } from '@/stores/parent-auth-store'
import { withGlobalLoader } from '@/stores/loader-store'

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
      <ParentSidebar
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((c) => !c)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center justify-between border-b bg-card/80 px-4 backdrop-blur sm:px-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? t('a11y.expandMenu') : t('a11y.collapseMenu')}
            aria-expanded={!collapsed}
            aria-controls="parent-sidebar"
          >
            <Menu />
          </Button>

          <div className="flex items-center gap-2">
            {/* Child-context chip — only for guardians with more than one linked
                student, since its purpose is switching between them. A single-
                child guardian has nothing to switch to, so we hide it. */}
            {child && canSwitch && (
              <div className="hidden items-center gap-2 rounded-full border bg-card px-3 py-1.5 sm:flex">
                <div className="grid size-7 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary to-secondary text-[10px] font-semibold text-primary-foreground">
                  {initials(child.display_name)}
                </div>
                <div className="leading-tight">
                  <div className="max-w-[12rem] truncate text-xs font-medium">
                    {child.display_name}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {child.student_id}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={switchChild}
                  className="ml-1 text-[11px] font-medium text-primary hover:underline"
                >
                  {t('account.switch')}
                </button>
              </div>
            )}

            <ParentLanguageSwitcher />
            <ThemeToggle />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={t('a11y.openAccount')}
                  className="flex items-center gap-2 rounded-md px-2 py-1 text-left transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                >
                  <div className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {initials(guardian?.display_name || 'Parent')}
                  </div>
                  <div className="hidden max-w-[12rem] leading-tight md:block">
                    <div className="truncate text-sm font-medium">
                      {guardian?.display_name ?? 'Parent'}
                    </div>
                    {guardian?.mobile_number && (
                      <div className="truncate text-xs text-muted-foreground">
                        {guardian.mobile_number}
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

        <main className="scrollbar-themed min-w-0 flex-1 overflow-auto px-4 py-8 sm:px-6">
          <div className="mx-auto max-w-5xl space-y-6">
            <Outlet />
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
  const navWeight = lang === 'hi' || lang === 'te' ? 'font-semibold' : 'font-medium'

  return (
    <aside
      id="parent-sidebar"
      className={cn(
        'relative isolate flex shrink-0 flex-col overflow-hidden border-r bg-sidebar text-sidebar-foreground transition-[width] duration-300 ease-out',
        collapsed ? 'w-16' : 'w-64',
      )}
    >
      {/* Subtle brand wash at the top — depth without competing with items. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-primary/[0.06] via-secondary/[0.03] to-transparent"
      />

      {/* Brand row — vertically aligned with the main header's h-16. */}
      <div
        className={cn(
          'relative flex h-16 shrink-0 items-center border-b transition-[padding] duration-300 ease-out',
          collapsed ? 'justify-center px-0' : 'gap-2 px-4',
        )}
      >
        <button
          type="button"
          onClick={() => parentNavigate('/')}
          className={cn(
            'flex items-center transition-colors',
            collapsed ? '' : 'gap-2',
          )}
          aria-label={t('a11y.parentHome')}
        >
          <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-primary to-secondary text-primary-foreground shadow-sm shadow-primary/30">
            <GraduationCap className="size-5" />
          </div>
          {!collapsed && (
            <div className="overflow-hidden text-left leading-tight">
              <div className="truncate text-base font-semibold tracking-tight">
                Nucleus
              </div>
              <div className="truncate text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                {t('brand.parentPortal')}
              </div>
            </div>
          )}
        </button>
      </div>

      <nav className="scrollbar-themed relative min-h-0 flex-1 space-y-1 overflow-y-auto overflow-x-hidden p-2">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const tone = TONES[item.tone]
          const active = isActive(pathname, item.route)

          return (
            <a
              key={item.route}
              href={item.route}
              title={collapsed ? t(item.labelKey) : undefined}
              onClick={(e) => {
                e.preventDefault()
                parentNavigate(item.route)
              }}
              className={cn(
                'group flex items-center rounded-lg text-sm transition-all',
                navWeight,
                collapsed ? 'justify-center px-0 py-2' : 'gap-2.5 px-2.5 py-2',
                active
                  ? 'bg-gradient-to-r from-primary to-secondary text-primary-foreground shadow-md shadow-primary/25'
                  : 'text-foreground/80 hover:bg-sidebar-accent/70 hover:text-foreground',
              )}
            >
              <span
                className={cn(
                  'grid size-8 shrink-0 place-items-center rounded-md transition-transform group-hover:scale-105',
                  active
                    ? 'bg-primary-foreground/15 text-primary-foreground'
                    : cn(tone.bg, tone.text),
                )}
              >
                <Icon className="size-4" />
              </span>
              {!collapsed && <span className="truncate">{t(item.labelKey)}</span>}
            </a>
          )
        })}
      </nav>

      <button
        type="button"
        onClick={onToggleCollapse}
        className={cn(
          'flex h-12 shrink-0 items-center border-t text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-foreground',
          collapsed ? 'justify-center px-0' : 'gap-2 px-4',
        )}
        aria-label={collapsed ? t('a11y.expandSidebar') : t('a11y.collapseSidebar')}
      >
        {collapsed ? (
          <PanelLeftOpen className="size-4" />
        ) : (
          <>
            <PanelLeftClose className="size-4" />
            <span>{t('account.collapse')}</span>
          </>
        )}
      </button>
    </aside>
  )
}
