/**
 * SPA navigation for the parent portal via the History API. The parent router
 * listens for `popstate`, so pushing a new URL and dispatching the event moves
 * the route without a full reload. We use this instead of TanStack's typed
 * `<Link to>` / `useNavigate` because those are typed against the single
 * registered (student) router, which doesn't know the parent routes.
 */
export function parentNavigate(route: string): void {
  window.history.pushState({}, '', route)
  window.dispatchEvent(new PopStateEvent('popstate'))
}
