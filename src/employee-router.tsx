import {
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
} from '@tanstack/react-router'

import { EmployeePortalLayout } from '@/components/employee-portal-layout'
import { RoutePending } from '@/components/route-pending'
import NotFound from '@/pages/not-found'
import type { EmployeeProfileSection } from '@/pages/employee/profile'

// Every page is its own chunk, fetched on first navigation (or on link hover —
// see `defaultPreload`). Only the layout and NotFound are static: they render
// on every route. Never `import X from '@/pages/...'` here — one static import
// drags that page (and whatever it pulls in, e.g. recharts or xlsx) into the
// app chunk for every employee. Type-only imports are fine; they're erased.
const EmployeeAttendanceAnalyticsPage = lazyRouteComponent(
  () => import('@/pages/employee/attendance-analytics'),
)
const EmployeeAttendanceHistoryPage = lazyRouteComponent(
  () => import('@/pages/employee/attendance-history'),
)
const EmployeeAttendanceMarkPage = lazyRouteComponent(
  () => import('@/pages/employee/attendance-mark'),
)
const EmployeeAttendanceMarkSessionPage = lazyRouteComponent(
  () => import('@/pages/employee/attendance-mark-session'),
)
const EmployeeAcademicHolidaysPage = lazyRouteComponent(
  () => import('@/pages/employee/academic-holidays'),
)
const EmployeeBirthdaysPage = lazyRouteComponent(
  () => import('@/pages/employee/birthdays'),
)
const EmployeeCompanyAttributesPage = lazyRouteComponent(
  () => import('@/pages/employee/corporate-relations-company-attributes'),
)
const EmployeeCompanyFormPage = lazyRouteComponent(
  () => import('@/pages/employee/corporate-relations-company-form'),
)
const EmployeeCompanyManagementPage = lazyRouteComponent(
  () => import('@/pages/employee/corporate-relations-company-management'),
)
const EmployeeCrViewPage = lazyRouteComponent(
  () => import('@/pages/employee/corporate-relations-cr-view'),
)
const EmployeeManagementViewPage = lazyRouteComponent(
  () => import('@/pages/employee/corporate-relations-management-view'),
)
const EmployeeJobRolesPage = lazyRouteComponent(
  () => import('@/pages/employee/corporate-relations-job-roles'),
)
const EmployeeDriveAttributesPage = lazyRouteComponent(
  () => import('@/pages/employee/drive-management-drive-attributes'),
)
const EmployeeDriveDetailPage = lazyRouteComponent(
  () => import('@/pages/employee/drive-management-drive-detail'),
)
const EmployeeDriveFormPage = lazyRouteComponent(
  () => import('@/pages/employee/drive-management-drive-form'),
)
const EmployeeDrivesPage = lazyRouteComponent(
  () => import('@/pages/employee/drive-management-drives'),
)
const EmployeeEligibilityCheckPage = lazyRouteComponent(
  () => import('@/pages/employee/drive-management-eligibility-check'),
)
const EmployeePlacementCoordinatorDriveDetailPage = lazyRouteComponent(
  () => import('@/pages/employee/placement-coordinator-drive-detail'),
)
const EmployeePlacementCoordinatorStudentsPage = lazyRouteComponent(
  () => import('@/pages/employee/placement-coordinator-students'),
)
const EmployeePlacementCoordinatorDrivesPage = lazyRouteComponent(
  () => import('@/pages/employee/placement-coordinator-drives'),
)
const EmployeeHome = lazyRouteComponent(() => import('@/pages/employee/home'))
const EmployeeIdCardPage = lazyRouteComponent(
  () => import('@/pages/employee/id-card'),
)
const EmployeeMarksUploadPage = lazyRouteComponent(
  () => import('@/pages/employee/marks-upload'),
)
const EmployeeMarksUploadBatchPage = lazyRouteComponent(
  () => import('@/pages/employee/marks-upload-batch'),
)
const EmployeeMarksViewPage = lazyRouteComponent(
  () => import('@/pages/employee/marks-view'),
)
const EmployeeInchargeSchedulePage = lazyRouteComponent(
  () => import('@/pages/employee/incharge-schedule'),
)
const EmployeeInchargeTemplateDetailPage = lazyRouteComponent(
  () => import('@/pages/employee/incharge-template-detail'),
)
const EmployeeInchargeTemplatesPage = lazyRouteComponent(
  () => import('@/pages/employee/incharge-templates'),
)
const EmployeeProfilePage = lazyRouteComponent(
  () => import('@/pages/employee/profile'),
)
const EmployeeRequestsApprovalsPage = lazyRouteComponent(
  () => import('@/pages/employee/requests-approvals'),
)
const EmployeeNotificationsPage = lazyRouteComponent(
  () => import('@/pages/employee/notifications'),
)
const EmployeeExportsPage = lazyRouteComponent(
  () => import('@/pages/employee/exports'),
)
const EmployeeRequestsMinePage = lazyRouteComponent(
  () => import('@/pages/employee/requests-mine'),
)
const EmployeeStudentsDirectoryPage = lazyRouteComponent(
  () => import('@/pages/employee/students-directory'),
)
const EmployeeTimetablePage = lazyRouteComponent(
  () => import('@/pages/employee/timetable'),
)
const Deployment = lazyRouteComponent(() => import('@/pages/deployment'))

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

// Group-wise analytics for an attendance-group incharge. The path must stay
// byte-identical to `web_route` on attendance.incharge.analytics.view — the
// sidebar links straight at the catalog value, so a mismatch renders a nav
// item that 404s.
const attendanceAnalyticsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/attendance/analytics',
  component: EmployeeAttendanceAnalyticsPage,
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

const companyAttributesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/corporate-relations/company-attributes',
  component: EmployeeCompanyAttributesPage,
})

const jobRolesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/corporate-relations/job-roles',
  component: EmployeeJobRolesPage,
})

// Per-passout-year view of the same roles. The path must stay byte-identical to
// `web_route` on corporate_relations.cr_view.view — the sidebar links straight
// at the catalog value, so a mismatch renders a nav item that 404s.
const crViewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/corporate-relations/cr-view',
  component: EmployeeCrViewPage,
})

// The same rows unscoped, read-only, plus the insight charts. Byte-identical to
// `web_route` on corporate_relations.management_view.view, for the same reason.
const managementViewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/corporate-relations/management-view',
  component: EmployeeManagementViewPage,
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

// The read-only, RBAC-scoped coordinator surface. The list path must equal
// the catalog's `web_route` for `placement_coordinator.drives.view`.
const placementCoordinatorDrivesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/placement-coordinator/drives',
  component: EmployeePlacementCoordinatorDrivesPage,
})

const placementCoordinatorDriveDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/placement-coordinator/drives/$driveId',
  component: EmployeePlacementCoordinatorDriveDetailPage,
})

// The coordinator's cohort. Scope comes from the employee's profile-verifier
// batches, not from RBAC attributes; the path must equal the catalog's
// `web_route` for `placement_coordinator.students.view`.
const placementCoordinatorStudentsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/placement-coordinator/students',
  component: EmployeePlacementCoordinatorStudentsPage,
})

// RBAC-scoped student search. The path must equal the catalog's `web_route`
// for `students.directory.view` â€” the sidebar links straight at it.
const studentsDirectoryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/students/directory',
  component: EmployeeStudentsDirectoryPage,
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

// Reached by URL only — no RBAC catalog entry, so it never renders in the
// sidebar. Shows the hand-maintained deploy stamp, nothing employee-specific.
const deploymentRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/deployment',
  component: Deployment,
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
  attendanceAnalyticsRoute,
  inchargeTemplatesRoute,
  inchargeTemplateDetailRoute,
  inchargeScheduleRoute,
  companyManagementRoute,
  companyCreateRoute,
  companyEditRoute,
  companyAttributesRoute,
  jobRolesRoute,
  crViewRoute,
  managementViewRoute,
  driveAttributesRoute,
  drivesRoute,
  driveCreateRoute,
  driveDetailRoute,
  driveEditRoute,
  placementCoordinatorDrivesRoute,
  placementCoordinatorDriveDetailRoute,
  placementCoordinatorStudentsRoute,
  eligibilityCheckRoute,
  studentsDirectoryRoute,
  requestsApprovalsRoute,
  requestsMineRoute,
  profileRoute,
  notificationsRoute,
  exportsRoute,
  deploymentRoute,
])

export const employeeRouter = createRouter({
  routeTree,
  defaultNotFoundComponent: NotFound,
  // Suspense fallback while a page chunk downloads — inside the layout, so the
  // sidebar never unmounts. Hovering/focusing a <Link> prefetches its chunk.
  defaultPendingComponent: RoutePending,
  defaultPreload: 'intent',
})
