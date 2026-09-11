import {
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
} from '@tanstack/react-router'

import { ParentPortalLayout } from '@/components/parent-portal-layout'
import { RoutePending } from '@/components/route-pending'
import NotFound from '@/pages/not-found'

// Every page is its own chunk, fetched on first navigation (or on link hover —
// see `defaultPreload`). Only the layout and NotFound are static: they render
// on every route. Never `import X from '@/pages/...'` here — one static import
// drags that page (and whatever it pulls in) into the app chunk for everyone.
const ParentHome = lazyRouteComponent(() => import('@/pages/parent/parent-home'))
const ParentTimetable = lazyRouteComponent(
  () => import('@/pages/parent/parent-timetable'),
)
const ParentAttendance = lazyRouteComponent(
  () => import('@/pages/parent/parent-attendance'),
)
const ParentAttendanceSubject = lazyRouteComponent(
  () => import('@/pages/parent/parent-attendance-subject'),
)
const ParentAttendanceAll = lazyRouteComponent(
  () => import('@/pages/parent/parent-attendance-all'),
)
const ParentExamResults = lazyRouteComponent(
  () => import('@/pages/parent/parent-exam-results'),
)
const ParentHolidays = lazyRouteComponent(
  () => import('@/pages/parent/parent-holidays'),
)
const ParentProfile = lazyRouteComponent(
  () => import('@/pages/parent/parent-profile'),
)
const Deployment = lazyRouteComponent(() => import('@/pages/deployment'))

/**
 * Router for the parent/guardian portal. All routes live under
 * ParentPortalLayout (the colorful sidebar chrome). The guardian must have a
 * child selected before this router mounts — App.tsx renders the Select-Child
 * gate otherwise — so every page can assume a selected child.
 */
const rootRoute = createRootRoute({ component: ParentPortalLayout })

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: ParentHome,
})

const timetableRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/timetable',
  component: ParentTimetable,
})

const attendanceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/attendance',
  component: ParentAttendance,
})

// Static segment — ranked above `$subjectId`.
const attendanceAllRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/attendance/all',
  component: ParentAttendanceAll,
})

const attendanceSubjectRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/attendance/$subjectId',
  component: ParentAttendanceSubject,
})

const examResultsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/exam-results',
  component: ParentExamResults,
})

const academicHolidaysRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/academic-holidays',
  component: ParentHolidays,
})

const profileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/profile',
  component: ParentProfile,
})

// Reached by URL only — the parent nav is hardcoded in ParentPortalLayout and
// this route is deliberately absent from it.
const deploymentRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/deployment',
  component: Deployment,
})

const routeTree = rootRoute.addChildren([
  homeRoute,
  timetableRoute,
  attendanceRoute,
  attendanceAllRoute,
  attendanceSubjectRoute,
  examResultsRoute,
  academicHolidaysRoute,
  profileRoute,
  deploymentRoute,
])

export const parentRouter = createRouter({
  routeTree,
  defaultNotFoundComponent: NotFound,
  // Suspense fallback while a page chunk downloads — inside the layout, so the
  // chrome never unmounts. Hovering/focusing a <Link> prefetches its chunk.
  defaultPendingComponent: RoutePending,
  defaultPreload: 'intent',
})
