import {
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'

import { PortalLayout } from '@/components/portal-layout'
import StudentHome from '@/pages/student-home'
import NotFound from '@/pages/not-found'
import IdCard from '@/pages/id-card'
import Profile from '@/pages/profile'
import Timetable from '@/pages/timetable'
import Attendance from '@/pages/attendance'
import AttendanceSubject from '@/pages/attendance-subject'
import ExamMarks from '@/pages/exam-marks'
import Fees from '@/pages/fees'

/** The signed-in student/parent portal. `PortalLayout` renders the chrome. */
const rootRoute = createRootRoute({ component: PortalLayout })

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: StudentHome,
})

const idCardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/id-card',
  component: IdCard,
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

const attendanceSubjectRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/attendance/$subjectId',
  component: AttendanceSubject,
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
  idCardRoute,
  profileRoute,
  timetableRoute,
  attendanceRoute,
  attendanceSubjectRoute,
  examMarksRoute,
  feesRoute,
])

export const router = createRouter({
  routeTree,
  defaultNotFoundComponent: NotFound,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
