import { apiFetch } from './api'
import { withEmployeeAuth } from './employee-auth'

/**
 * Slim client for the schedule page's group picker. The earlier attendance
 * marking flow (sessions, roster, mark endpoints) was retired — the
 * incharge screen is now schedule management only. This lib survives
 * because the schedule page still needs to list the groups the caller is
 * incharge of.
 */

export interface InchargeGroupSummary {
  id: number
  name: string
  code: string
  /** Free-text note set by an admin — disambiguates groups that share a
   *  programme + year (e.g. "Morning lab batch"). */
  description: string | null
  programme: {
    id: number
    code: string
    name: string
    display_name: string
    department: { id: number; code: string; name: string } | null
  }
  admission_year: { id: number; year: number; display_year: string }
  /** Count of active students currently in the group. */
  member_count: number
}

export function fetchInchargeGroups(): Promise<InchargeGroupSummary[]> {
  return withEmployeeAuth((token) =>
    apiFetch<InchargeGroupSummary[]>(
      '/employee/attendance-incharge/groups',
      { token },
    ),
  )
}
