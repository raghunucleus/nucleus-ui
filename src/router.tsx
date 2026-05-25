import {
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'

import { PortalLayout } from '@/components/portal-layout'
import StudentHome from '@/pages/student-home'
import Profile from '@/pages/profile'
import Timetable from '@/pages/timetable'
import Attendance from '@/pages/attendance'
import ExamMarks from '@/pages/exam-marks'
import Fees from '@/pages/fees'

/** The signed-in student/parent portal. `PortalLayout` renders the chrome. */
const rootRoute = createRootRoute({ component: PortalLayout })

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: StudentHome,
})

const profileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/profile',
  component: Profile,
})

const timetableRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/timetable',
  component: Timetable,
})

const attendanceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/attendance',
  component: Attendance,
})

const examMarksRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/exam-marks',
  component: ExamMarks,
})

const feesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/fees',
  component: Fees,
})

const routeTree = rootRoute.addChildren([
  homeRoute,
  profileRoute,
  timetableRoute,
  attendanceRoute,
  examMarksRoute,
  feesRoute,
])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
