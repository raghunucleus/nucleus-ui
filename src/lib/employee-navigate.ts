/**
 * Imperative employee-portal navigation.
 *
 * The app runs two routers (student on `app.*`, employee on `employee.*`) but
 * only the student one is registered with TanStack's type system, so the typed
 * `<Link>` / `useNavigate()` reject employee-only paths outright. Pushing to
 * History and firing `popstate` lets the mounted employee router pick the change
 * up, which is what every employee page already does.
 *
 * Copies of this helper predate the module in `employee-portal-layout.tsx`,
 * `attendance-mark-session.tsx`, `corporate-relations-company-form.tsx` and
 * `corporate-relations-company-management.tsx` — prefer this one for new code,
 * and fold those in when you're next in them.
 */
export function employeeNavigateTo(route: string): void {
  window.history.pushState({}, '', route)
  window.dispatchEvent(new PopStateEvent('popstate'))
}
