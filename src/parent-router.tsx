import {
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'

import { ParentPortalLayout } from '@/components/parent-portal-layout'
import NotFound from '@/pages/not-found'
import ParentHome from '@/pages/parent/parent-home'
import ParentTimetable from '@/pages/parent/parent-timetable'
import ParentAttendance from '@/pages/parent/parent-attendance'
import ParentAttendanceSubject from '@/pages/parent/parent-attendance-subject'
import ParentExamResults from '@/pages/parent/parent-exam-results'
import ParentHolidays from '@/pages/parent/parent-holidays'
import ParentProfile from '@/pages/parent/parent-profile'

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

const routeTree = rootRoute.addChildren([
  homeRoute,
  timetableRoute,
  attendanceRoute,
  attendanceSubjectRoute,
  examResultsRoute,
  academicHolidaysRoute,
  profileRoute,
])

export const parentRouter = createRouter({
  routeTree,
  defaultNotFoundComponent: NotFound,
})
