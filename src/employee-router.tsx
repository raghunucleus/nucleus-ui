import {
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'

import { EmployeePortalLayout } from '@/components/employee-portal-layout'
import NotFound from '@/pages/not-found'
import EmployeeAttendanceHistoryPage from '@/pages/employee/attendance-history'
import EmployeeAttendanceMarkPage from '@/pages/employee/attendance-mark'
import EmployeeAttendanceMarkSessionPage from '@/pages/employee/attendance-mark-session'
import EmployeeAcademicHolidaysPage from '@/pages/employee/academic-holidays'
import EmployeeBirthdaysPage from '@/pages/employee/birthdays'
import EmployeeHome from '@/pages/employee/home'
import EmployeeIdCardPage from '@/pages/employee/id-card'
import EmployeeMarksUploadPage from '@/pages/employee/marks-upload'
import EmployeeMarksUploadBatchPage from '@/pages/employee/marks-upload-batch'
import EmployeeInchargeSchedulePage from '@/pages/employee/incharge-schedule'
import EmployeeInchargeTemplateDetailPage from '@/pages/employee/incharge-template-detail'
import EmployeeInchargeTemplatesPage from '@/pages/employee/incharge-templates'
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

const timetableRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/timetable',
  component: EmployeeTimetablePage,
})

const academicHolidaysRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/academic-holidays',
  component: EmployeeAcademicHolidaysPage,
})

const birthdaysRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/birthdays',
  component: EmployeeBirthdaysPage,
})

const idCardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/id-card',
  component: EmployeeIdCardPage,
})

const marksUploadRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/marks/upload',
  component: EmployeeMarksUploadPage,
})

const marksUploadBatchRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/marks/upload/$batchId',
  component: EmployeeMarksUploadBatchPage,
})

const attendanceMarkRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/attendance/mark',
  component: EmployeeAttendanceMarkPage,
})

const attendanceMarkSessionRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/attendance/mark/$sessionId',
  component: EmployeeAttendanceMarkSessionPage,
})

const attendanceHistoryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/attendance/history',
  component: EmployeeAttendanceHistoryPage,
})

const inchargeTemplatesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/timetable/incharge/templates',
  component: EmployeeInchargeTemplatesPage,
})

const inchargeTemplateDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/timetable/incharge/templates/$timetableId',
  component: EmployeeInchargeTemplateDetailPage,
})

const inchargeScheduleRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/timetable/incharge/schedule',
  component: EmployeeInchargeSchedulePage,
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
  academicHolidaysRoute,
  birthdaysRoute,
  idCardRoute,
  marksUploadRoute,
  marksUploadBatchRoute,
  timetableRoute,
  attendanceMarkRoute,
  attendanceMarkSessionRoute,
  attendanceHistoryRoute,
  inchargeTemplatesRoute,
  inchargeTemplateDetailRoute,
  inchargeScheduleRoute,
  profileRoute,
])

export const employeeRouter = createRouter({
  routeTree,
  defaultNotFoundComponent: NotFound,
})
