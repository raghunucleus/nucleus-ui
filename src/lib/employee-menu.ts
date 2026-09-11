import type { EffectiveAccess } from '@/lib/employee-access'

/**
 * The employee menu model shared by the sidebar and the Ctrl-K menu search:
 * modules in server order, each with the screens the employee can open on
 * the web, optionally narrowed by a search query.
 */

export type MenuModule = EffectiveAccess['modules'][string]
export type MenuScreen = NonNullable<EffectiveAccess['screens'][string]>

export interface MenuGroup {
  mod: MenuModule
  screens: MenuScreen[]
}

/** Client-side navigation without a router hook, for menus rendered outside
 * the route tree. Pushes the URL and lets the router pick up the popstate. */
export function navigateTo(route: string) {
  window.history.pushState({}, '', route)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

export function sortModules(access: EffectiveAccess | null): MenuModule[] {
  if (!access) return []
  return Object.values(access.modules).sort((a, b) => a.order - b.order)
}

/**
 * Modules → their web screens, filtered by `query` (lower-cased, trimmed).
 * A module whose own label matches keeps every screen; otherwise only the
 * screens whose label matches. With an empty query every module is kept,
 * even one with no web screens (the sidebar shows a "No web screens" row).
 */
export function menuGroups(
  access: EffectiveAccess | null,
  modules: MenuModule[],
  query: string,
): MenuGroup[] {
  if (!access) return []
  const q = query.trim().toLowerCase()
  const searching = q.length > 0
  return modules
    .map((mod) => {
      const screens = mod.screen_keys
        .map((k) => access.screens[k])
        .filter((s): s is MenuScreen => Boolean(s) && Boolean(s.web_route))
      const moduleHit = mod.label.toLowerCase().includes(q)
      const matched = searching
        ? screens.filter((s) => moduleHit || s.label.toLowerCase().includes(q))
        : screens
      return { mod, screens: matched }
    })
    .filter(({ screens }) => !searching || screens.length > 0)
}
