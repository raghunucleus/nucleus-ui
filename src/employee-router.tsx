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
import EmployeeCompaniesPage from '@/pages/employee/corporate-relations-companies'
import EmployeeCompanyAttributesPage from '@/pages/employee/corporate-relations-company-attributes'
import EmployeeCompanyFormPage from '@/pages/employee/corporate-relations-company-form'
import EmployeeCompanyManagementPage from '@/pages/employee/corporate-relations-company-management'
import EmployeeDriveAttributesPage from '@/pages/employee/drive-management-drive-attributes'
import EmployeeDriveDetailPage from '@/pages/employee/drive-management-drive-detail'
import EmployeeDriveFormPage from '@/pages/employee/drive-management-drive-form'
import EmployeeDrivesPage from '@/pages/employee/drive-management-drives'
import EmployeeEligibilityCheckPage from '@/pages/employee/drive-management-eligibility-check'
import EmployeeHome from '@/pages/employee/home'
import EmployeeIdCardPage from '@/pages/employee/id-card'
import EmployeeMarksUploadPage from '@/pages/employee/marks-upload'
import EmployeeMarksUploadBatchPage from '@/pages/employee/marks-upload-batch'
import EmployeeMarksViewPage from '@/pages/employee/marks-view'
import EmployeeInchargeSchedulePage from '@/pages/employee/incharge-schedule'
import EmployeeInchargeTemplateDetailPage from '@/pages/employee/incharge-template-detail'
import EmployeeInchargeTemplatesPage from '@/pages/employee/incharge-templates'
import EmployeeProfilePage, {
  type EmployeeProfileSection,
} from '@/pages/employee/profile'
import EmployeeRequestsApprovalsPage from '@/pages/employee/requests-approvals'
import EmployeeNotificationsPage from '@/pages/employee/notifications'
import EmployeeExportsPage from '@/pages/employee/exports'
import EmployeeRequestsMinePage from '@/pages/employee/requests-mine'
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

const marksViewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/marks/view',
  component: EmployeeMarksViewPage,
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

const companyManagementRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/corporate-relations/company-management',
  component: EmployeeCompanyManagementPage,
  validateSearch: (search: Record<string, unknown>) => {
    const raw = Number(search.open)
    return { open: Number.isFinite(raw) && raw > 0 ? raw : undefined }
  },
})

const companyCreateRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/corporate-relations/company-management/new',
  component: EmployeeCompanyFormPage,
})

const companyEditRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/corporate-relations/company-management/$companyId/edit',
  component: EmployeeCompanyFormPage,
})

const companiesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/corporate-relations/companies',
  component: EmployeeCompaniesPage,
})

const companyAttributesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/corporate-relations/company-attributes',
  component: EmployeeCompanyAttributesPage,
})

const driveAttributesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/drive-management/drive-attributes',
  component: EmployeeDriveAttributesPage,
})

const drivesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/drive-management/drives',
  component: EmployeeDrivesPage,
})

// Declared before the `$driveId` route so the literal segment wins the match.
const driveCreateRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/drive-management/drives/new',
  component: EmployeeDriveFormPage,
})

// The detail screen (tabs: overview, eligibility). A row click lands here.
const driveDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/drive-management/drives/$driveId',
  component: EmployeeDriveDetailPage,
})

// The create/edit form now lives under `/edit`; the detail's "Edit" button
// routes here.
const driveEditRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/drive-management/drives/$driveId/edit',
  component: EmployeeDriveFormPage,
})

// The standalone institution-wide student search (drive filter set, no drive).
const eligibilityCheckRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/drive-management/eligibility-check',
  component: EmployeeEligibilityCheckPage,
})

// Paths must equal the RBAC catalog's `web_route` values for the two
// derived Requests screens.
const requestsApprovalsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/requests/approvals',
  component: EmployeeRequestsApprovalsPage,
  // `?open=<id>` opens that request's detail on mount — the deep-link target
  // for a "needs your review" notification (there is no /:id route; the page is
  // master-detail driven by local state). Mirrors the student /my-requests.
  validateSearch: (search: Record<string, unknown>) => {
    const raw = Number(search.open)
    return Number.isFinite(raw) && raw > 0 ? { open: raw } : {}
  },
})

const requestsMineRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/requests/mine',
  component: EmployeeRequestsMinePage,
})

const profileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/profile',
  component: EmployeeProfilePage,
  validateSearch: (search: Record<string, unknown>) => {
    const raw = search.section
    // Anything unrecognised falls back to 'profile' — so every valid section
    // must be listed here or it silently redirects to the wrong tab.
    const section: EmployeeProfileSection =
      raw === 'password' || raw === 'notifications' ? raw : 'profile'
    return { section }
  },
})

// Reached from the header bell only — deliberately absent from the RBAC
// catalog, so it never renders in the sidebar (which lists screens with a
// `web_route`).
const notificationsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/notifications',
  component: EmployeeNotificationsPage,
})

// Reached from export notifications/toasts only — like /notifications it has
// no RBAC catalog entry, so it never renders in the sidebar.
const exportsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/exports',
  component: EmployeeExportsPage,
})

const routeTree = rootRoute.addChildren([
  homeRoute,
  academicHolidaysRoute,
  birthdaysRoute,
  idCardRoute,
  marksUploadRoute,
  marksUploadBatchRoute,
  marksViewRoute,
  timetableRoute,
  attendanceMarkRoute,
  attendanceMarkSessionRoute,
  attendanceHistoryRoute,
  inchargeTemplatesRoute,
  inchargeTemplateDetailRoute,
  inchargeScheduleRoute,
  companyManagementRoute,
  companyCreateRoute,
  companyEditRoute,
  companiesRoute,
  companyAttributesRoute,
  driveAttributesRoute,
  drivesRoute,
  driveCreateRoute,
  driveDetailRoute,
  driveEditRoute,
  eligibilityCheckRoute,
  requestsApprovalsRoute,
  requestsMineRoute,
  profileRoute,
  notificationsRoute,
  exportsRoute,
])

export const employeeRouter = createRouter({
  routeTree,
  defaultNotFoundComponent: NotFound,
})
