import {
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'

import { EmployeePortalLayout } from '@/components/employee-portal-layout'
import NotFound from '@/pages/not-found'
import EmployeeHome from '@/pages/employee/home'
import EmployeeProfilePage, {
  type EmployeeProfileSection,
} from '@/pages/employee/profile'
import EmployeeTimetablePage from '@/pages/employee/timetable'

/**
 * Router for the employee portal (employee.* subdomain). All routes live
 * under the EmployeePortalLayout, which fetches the effective-access payload
 * once and threads it through context to the pages.
 *
 * The set of routes here mirrors the catalog's `web_route` values — the
 * sidebar shows only the screens the logged-in employee has access to, but
 * the router knows every possible route up front so navigation by URL works
 * even before the access payload finishes loading.
 */
const rootRoute = createRootRoute({ component: EmployeePortalLayout })

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: EmployeeHome,
})

const academicsTimetableRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/academics/timetable',
  component: EmployeeTimetablePage,
})

const profileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/profile',
  component: EmployeeProfilePage,
  validateSearch: (search: Record<string, unknown>) => {
    const raw = search.section
    const section: EmployeeProfileSection =
      raw === 'password' ? 'password' : 'profile'
    return { section }
  },
})

const routeTree = rootRoute.addChildren([
  homeRoute,
  academicsTimetableRoute,
  profileRoute,
])

export const employeeRouter = createRouter({
  routeTree,
  defaultNotFoundComponent: NotFound,
})
