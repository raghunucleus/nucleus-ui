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
import ProfileUpdateRequest from '@/pages/profile-update-request'
import PrivacySettings from '@/pages/privacy-settings'
import Timetable from '@/pages/timetable'
import Attendance from '@/pages/attendance'
import AttendanceSubject from '@/pages/attendance-subject'
import ExamMarks from '@/pages/exam-marks'
import Birthdays from '@/pages/birthdays'
import Connect from '@/pages/connect'
import Notifications from '@/pages/notifications'
import AcademicHolidays from '@/pages/academic-holidays'
import MyRequests from '@/pages/my-requests'
import Approvals from '@/pages/approvals'
import Placements from '@/pages/placements'
import {
  DRIVE_FILTERS,
  INVITE_FILTERS,
  type DriveFilter,
  type InviteFilter,
} from '@/lib/student-placements'

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

const privacyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/privacy',
  component: PrivacySettings,
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

const routeTree = rootRoute.addChildren([
  homeRoute,
  idCardRoute,
  profileRoute,
  profileUpdateRequestRoute,
  privacyRoute,
  timetableRoute,
  attendanceRoute,
  attendanceSubjectRoute,
  examMarksRoute,
  birthdaysRoute,
  notificationsRoute,
  connectRoute,
  academicHolidaysRoute,
  myRequestsRoute,
  approvalsRoute,
  placementsRoute,
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
