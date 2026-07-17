import type { NavTarget } from '@/lib/employee-notification-targets'

/**
 * Navigate the employee portal to a notification's resolved target.
 *
 * Why not TanStack's `useNavigate()`: `src/router.tsx` claims the global
 * `Register` block for the STUDENT router, so `useNavigate()` inside employee
 * components is typed against student routes and rejects every employee path.
 * The employee sidebar already sidesteps this the same way — a `pushState` plus
 * a synthetic `popstate`, which the employee router listens for.
 *
 * The `to` values are type-checked against `EmployeeNotificationRoute`, so a
 * typo is still a compile error; only the router's own typing is bypassed.
 */
export function employeeNavigate(
  target: NavTarget | { to: '/notifications' | '/exports' },
): void {
  const search =
    'search' in target && target.search
      ? `?${new URLSearchParams(
          Object.entries(target.search).reduce<Record<string, string>>(
            (acc, [k, v]) => {
              if (v != null) acc[k] = String(v)
              return acc
            },
            {},
          ),
        ).toString()}`
      : ''
  window.history.pushState({}, '', `${target.to}${search}`)
  window.dispatchEvent(new PopStateEvent('popstate'))
}
