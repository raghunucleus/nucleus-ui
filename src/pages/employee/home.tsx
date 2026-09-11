import { useMemo } from 'react'
import {
  BarChart3,
  BookOpen,
  Briefcase,
  ClipboardCheck,
  GraduationCap,
  IdCard,
  LayoutGrid,
  type LucideIcon,
  Users,
  Wallet,
} from 'lucide-react'

import { useEmployeeAccess } from '@/hooks/use-screen-access'
import { cn } from '@/lib/utils'

const ICON_MAP: Record<string, LucideIcon> = {
  BarChart3,
  BookOpen,
  GraduationCap,
  ClipboardCheck,
  Users,
  Wallet,
  IdCard,
  Briefcase,
  LayoutGrid,
}

export default function EmployeeHome() {
  const access = useEmployeeAccess()
  const modules = useMemo(() => {
    if (!access) return []
    return Object.values(access.modules).sort((a, b) => a.order - b.order)
  }, [access])

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Welcome</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick a module to get started. Only the modules and screens your role
          grants are shown.
        </p>
      </header>

      {!access ? (
        <div className="rounded-md border border-dashed bg-muted/20 px-6 py-12 text-center text-sm text-muted-foreground">
          Loading your access…
        </div>
      ) : modules.length === 0 ? (
        <div className="rounded-md border border-dashed bg-muted/20 px-6 py-12 text-center text-sm text-muted-foreground">
          No modules assigned yet. Contact an administrator to assign you a
          role.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map((mod) => {
            const Icon = ICON_MAP[mod.icon] ?? LayoutGrid
            const screens = mod.screen_keys
              .map((k) => access.screens[k])
              .filter((s) => s && s.web_route)
            return (
              <article
                key={mod.key}
                className={cn(
                  'rounded-lg border bg-card p-4 text-card-foreground shadow-xs',
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="size-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold">{mod.label}</h2>
                    <p className="text-xs text-muted-foreground">
                      {screens.length} screen{screens.length === 1 ? '' : 's'}
                    </p>
                  </div>
                </div>
                <ul className="mt-3 space-y-1">
                  {screens.length === 0 ? (
                    <li className="text-xs text-muted-foreground">
                      No web screens
                    </li>
                  ) : (
                    screens.map((s) => (
                      <li key={s.key}>
                        <a
                          href={s.web_route}
                          onClick={(e) => {
                            e.preventDefault()
                            if (s.web_route) {
                              window.history.pushState({}, '', s.web_route)
                              window.dispatchEvent(new PopStateEvent('popstate'))
                            }
                          }}
                          className="block rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
                        >
                          {s.label} →
                        </a>
                      </li>
                    ))
                  )}
                </ul>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
