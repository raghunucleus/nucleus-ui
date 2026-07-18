import { apiFetch } from './api'
import type { DriveDetail, EligibilitySummary } from './drive-management'
import { withAuth } from './student-auth'

/**
 * Student side of placements: drive invitations to answer and the drives the
 * student accepted. Everything is scoped server-side to the JWT's student —
 * no student id ever leaves this client.
 */

/**
 * Lifecycle codes — a frozen mirror of the server's drive-student-status.ts.
 * Numeric with gaps of 10 on purpose so states can be inserted later.
 */
export const PLACEMENT_STATUS = {
  IMPORTED: 10,
  INVITED: 20,
  ACCEPTED: 30,
  DENIED: 40,
  NOT_ATTENDED: 50,
  SELECTED: 60,
  NOT_SELECTED: 70,
  REVOKED: 80,
} as const

/** Student-facing labels (the student is the actor, so no "(by student)"). */
export const PLACEMENT_STATUS_LABELS: Record<number, string> = {
  20: 'Invited',
  30: 'Accepted',
  40: 'Denied',
  50: 'Not Attended',
  60: 'Selected',
  70: 'Not Selected',
  80: 'Revoked',
}

export type PlacementBadgeVariant =
  | 'default'
  | 'secondary'
  | 'success'
  | 'warning'
  | 'destructive'
  | 'muted'

export const PLACEMENT_STATUS_BADGE: Record<number, PlacementBadgeVariant> = {
  20: 'warning',
  30: 'default',
  40: 'muted',
  50: 'secondary',
  60: 'success',
  70: 'destructive',
  80: 'muted',
}

// --- shapes (mirror of StudentPlacementsService) ---------------------------

interface PlacementDriveCard {
  drive_id: number
  drive_name: string
  company: { name: string; logo_url: string | null }
  offer_type: string | null
  job_locations: string[]
  registration_end_date: string | null
  drive_date: string | null
}

export interface PlacementInvite extends PlacementDriveCard {
  invited_at: string | null
}

export interface PlacementDeniedInvite extends PlacementInvite {
  responded_at: string | null
  rejection_reason: string | null
}

export interface PlacementDriveRecord extends PlacementDriveCard {
  status: number
  invited_at: string | null
  responded_at: string | null
  outcome_marked_at: string | null
  revoked_at: string | null
  /** Denial or revoke reason, when the row is terminal. */
  rejection_reason: string | null
  /** Only meaningful when status is REVOKED: true = revoked after accepting. */
  revoked_from_accepted: boolean | null
}

/** One entry of the student's action trail; actor is never a named employee. */
export interface PlacementHistoryEvent {
  action: 'invited' | 'reminded' | 'accepted' | 'denied' | 'outcome' | 'revoked'
  to_status: number
  by: 'you' | 'placement_cell'
  reason: string | null
  at: string
}

/** The employee drive detail minus the SPOC contact fields. */
export type PlacementDrive = Omit<DriveDetail, 'spoc_email' | 'spoc_contact'>

export interface PlacementDriveDetail {
  drive: PlacementDrive
  eligibility: EligibilitySummary
  membership: {
    status: number
    invited_at: string | null
    responded_at: string | null
    rejection_reason: string | null
    outcome_marked_at: string | null
  }
  history: PlacementHistoryEvent[]
}

// --- client-side filters ---------------------------------------------------

export type InviteFilter = 'pending' | 'accepted' | 'rejected'

export type DriveFilter =
  | 'accepted'
  | 'selected'
  | 'not_selected'
  | 'rejected'
  | 'others'
  | 'all'

export const INVITE_FILTERS: InviteFilter[] = [
  'pending',
  'accepted',
  'rejected',
]

export const DRIVE_FILTERS: DriveFilter[] = [
  'accepted',
  'selected',
  'not_selected',
  'rejected',
  'others',
  'all',
]

/**
 * Which Invites-tab chip a record belongs to. The three chips partition every
 * row: a revoke after the student accepted counts as "accepted", a revoke of a
 * still-pending invite sits with "rejected" (the card keeps its Revoked badge
 * either way).
 */
export function inviteFilterOf(r: PlacementDriveRecord): InviteFilter {
  if (r.status === PLACEMENT_STATUS.INVITED) return 'pending'
  if (
    r.status === PLACEMENT_STATUS.DENIED ||
    (r.status === PLACEMENT_STATUS.REVOKED && !r.revoked_from_accepted)
  ) {
    return 'rejected'
  }
  return 'accepted'
}

/** Which Drives-tab chip a record belongs to ("all" is handled by the page). */
export function driveFilterOf(
  r: PlacementDriveRecord,
): Exclude<DriveFilter, 'all'> {
  switch (r.status) {
    case PLACEMENT_STATUS.ACCEPTED:
      return 'accepted'
    case PLACEMENT_STATUS.SELECTED:
      return 'selected'
    case PLACEMENT_STATUS.NOT_SELECTED:
      return 'not_selected'
    case PLACEMENT_STATUS.DENIED:
      return 'rejected'
    default:
      return 'others'
  }
}

// --- calls -----------------------------------------------------------------

export function fetchPlacementInvites(): Promise<{
  pending: PlacementInvite[]
  denied: PlacementDeniedInvite[]
}> {
  return withAuth((token) =>
    apiFetch('/student/placements/invites', { token }),
  )
}

export function fetchPlacementDrives(): Promise<{
  items: PlacementDriveRecord[]
}> {
  return withAuth((token) => apiFetch('/student/placements/drives', { token }))
}

export function fetchPlacementDrive(
  driveId: number,
): Promise<PlacementDriveDetail> {
  return withAuth((token) =>
    apiFetch(`/student/placements/drives/${driveId}`, { token }),
  )
}

export function acceptPlacementInvite(
  driveId: number,
): Promise<{ status: number }> {
  return withAuth((token) =>
    apiFetch(`/student/placements/invites/${driveId}/accept`, {
      method: 'POST',
      token,
    }),
  )
}

export function rejectPlacementInvite(
  driveId: number,
  reason: string,
): Promise<{ status: number }> {
  return withAuth((token) =>
    apiFetch(`/student/placements/invites/${driveId}/reject`, {
      method: 'POST',
      body: { reason },
      token,
    }),
  )
}
