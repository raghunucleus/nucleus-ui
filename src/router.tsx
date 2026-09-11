import {
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
} from '@tanstack/react-router'

import { PortalLayout } from '@/components/portal-layout'
import { RoutePending } from '@/components/route-pending'
import NotFound from '@/pages/not-found'
import {
  DRIVE_FILTERS,
  INVITE_FILTERS,
  type DriveFilter,
  type InviteFilter,
} from '@/lib/student-placements'

// Every page is its own chunk, fetched on first navigation (or on link hover —
// see `defaultPreload`). Only the layout and NotFound are static: they render
// on every route. Never `import X from '@/pages/...'` here — one static import
// drags that page (and whatever it pulls in) into the app chunk for everyone.
const StudentHome = lazyRouteComponent(() => import('@/pages/student-home'))
const IdCard = lazyRouteComponent(() => import('@/pages/id-card'))
const Profile = lazyRouteComponent(() => import('@/pages/profile'))
const ProfileGroup = lazyRouteComponent(() => import('@/pages/profile-group'))
const ProfileUpdateRequest = lazyRouteComponent(
  () => import('@/pages/profile-update-request'),
)
const PrivacySettings = lazyRouteComponent(() => import('@/pages/privacy-settings'))
const Devices = lazyRouteComponent(() => import('@/pages/devices'))
const Timetable = lazyRouteComponent(() => import('@/pages/timetable'))
const Attendance = lazyRouteComponent(() => import('@/pages/attendance'))
const AttendanceSubject = lazyRouteComponent(
  () => import('@/pages/attendance-subject'),
)
const AttendanceAll = lazyRouteComponent(
  () => import('@/pages/attendance-all'),
)
const ExamMarks = lazyRouteComponent(() => import('@/pages/exam-marks'))
const Birthdays = lazyRouteComponent(() => import('@/pages/birthdays'))
const Connect = lazyRouteComponent(() => import('@/pages/connect'))
const Notifications = lazyRouteComponent(() => import('@/pages/notifications'))
const AcademicHolidays = lazyRouteComponent(
  () => import('@/pages/academic-holidays'),
)
const MyRequests = lazyRouteComponent(() => import('@/pages/my-requests'))
const Approvals = lazyRouteComponent(() => import('@/pages/approvals'))
const Leaves = lazyRouteComponent(() => import('@/pages/leaves'))
const Placements = lazyRouteComponent(() => import('@/pages/placements'))
const Deployment = lazyRouteComponent(() => import('@/pages/deployment'))

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

const profileUpdateRequestRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/profile/request-changes',
  component: ProfileUpdateRequest,
  // `?edit=<id>` revises a sent-back request instead of raising a new one.
  validateSearch: (search: Record<string, unknown>): { edit?: number } => ({
    edit:
      search.edit != null && Number.isFinite(Number(search.edit))
        ? Number(search.edit)
        : undefined,
  }),
})

// One group of the profile ("Home address", "Parent & guardian"…). The static
// `/profile/request-changes` above still wins over this dynamic sibling.
const profileGroupRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/profile/$group',
  component: ProfileGroup,
})

const privacyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/privacy',
  component: PrivacySettings,
})

// Reached from the account dropdown (next to Privacy) — signed-in devices.
const devicesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/devices',
  component: Devices,
})

const timetableRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/timetable',
  component: Timetable,
  // `?week=YYYY-MM-DD` opens a specific week (used by the "timetable updated"
  // notification deep-link).
  validateSearch: (search: Record<string, unknown>): { week?: string } => ({
    week: typeof search.week === 'string' ? search.week : undefined,
  }),
})

const attendanceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/attendance',
  component: Attendance,
})

// Static segment — TanStack ranks it above `$subjectId`, so `/attendance/all`
// never reaches the per-subject page.
const attendanceAllRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/attendance/all',
  component: AttendanceAll,
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

const birthdaysRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/birthdays',
  component: Birthdays,
})

const notificationsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/notifications',
  component: Notifications,
})

const academicHolidaysRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/academic-holidays',
  component: AcademicHolidays,
})

const myRequestsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/my-requests',
  component: MyRequests,
  // `?open=<id>` expands a specific request (used by the decision
  // notification deep-link).
  validateSearch: (search: Record<string, unknown>): { open?: number } => ({
    open:
      search.open != null && Number.isFinite(Number(search.open))
        ? Number(search.open)
        : undefined,
  }),
})

const approvalsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/approvals',
  component: Approvals,
})

const leavesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/leaves',
  component: Leaves,
  // `?open=<id>` opens a leave's detail; `?edit=<id>` opens the apply form in
  // revise mode for a sent-back application (My Requests → Revise);
  // `?apply=1` opens the blank form.
  validateSearch: (
    search: Record<string, unknown>,
  ): { open?: number; edit?: number; apply?: boolean } => ({
    open:
      search.open != null && Number.isFinite(Number(search.open))
        ? Number(search.open)
        : undefined,
    edit:
      search.edit != null && Number.isFinite(Number(search.edit))
        ? Number(search.edit)
        : undefined,
    apply: search.apply === true || search.apply === 'true' ? true : undefined,
  }),
})

const placementsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/placements',
  component: Placements,
  // `?tab=` picks Invites/Drives/My Offers; `?drive=<id>` opens that drive's
  // detail (used by the invite/outcome notification deep-links). The two filter
  // params keep each tab's chip selection in the URL; the page applies the
  // defaults (pending / accepted) when they are absent.
  validateSearch: (
    search: Record<string, unknown>,
  ): {
    tab?: 'invites' | 'drives' | 'offers'
    drive?: number
    invitesFilter?: InviteFilter
    drivesFilter?: DriveFilter
  } => ({
    tab:
      search.tab === 'invites' ||
      search.tab === 'drives' ||
      search.tab === 'offers'
        ? search.tab
        : undefined,
    drive:
      search.drive != null && Number.isFinite(Number(search.drive))
        ? Number(search.drive)
        : undefined,
    invitesFilter: INVITE_FILTERS.includes(search.invitesFilter as InviteFilter)
      ? (search.invitesFilter as InviteFilter)
      : undefined,
    drivesFilter: DRIVE_FILTERS.includes(search.drivesFilter as DriveFilter)
      ? (search.drivesFilter as DriveFilter)
      : undefined,
  }),
})

const connectRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/connect',
  component: Connect,
  // Deep-link params for opening a specific chat (e.g. "send a wish" from the
  // dashboard): `to` is the other student's id, `name` their display name, and
  // `wish` pre-fills a birthday greeting.
  validateSearch: (
    search: Record<string, unknown>,
  ): { to?: number; name?: string; wish?: boolean } => ({
    to:
      search.to != null && Number.isFinite(Number(search.to))
        ? Number(search.to)
        : undefined,
    name: typeof search.name === 'string' ? search.name : undefined,
    wish: search.wish === true || search.wish === 'true' ? true : undefined,
  }),
})

// Reached by URL only — it has no entry in `MODULES`, so it never shows up in
// the app drawer.
const deploymentRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/deployment',
  component: Deployment,
})

const routeTree = rootRoute.addChildren([
  homeRoute,
  idCardRoute,
  profileRoute,
  profileUpdateRequestRoute,
  profileGroupRoute,
  privacyRoute,
  devicesRoute,
  timetableRoute,
  attendanceRoute,
  attendanceAllRoute,
  attendanceSubjectRoute,
  examMarksRoute,
  birthdaysRoute,
  notificationsRoute,
  connectRoute,
  academicHolidaysRoute,
  myRequestsRoute,
  approvalsRoute,
  leavesRoute,
  placementsRoute,
  deploymentRoute,
])

export const router = createRouter({
  routeTree,
  defaultNotFoundComponent: NotFound,
  // Suspense fallback while a page chunk downloads — inside the layout, so the
  // chrome never unmounts. Hovering/focusing a <Link> prefetches its chunk.
  defaultPendingComponent: RoutePending,
  defaultPreload: 'intent',
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
