import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { CircleAlert, RefreshCw, Stamp } from 'lucide-react'

import {
  PlacementInviteCard,
  PlacementRecordRow,
} from '@/components/placement-invite'
import { PageHeader } from '@/components/portal-layout'
import {
  RequestFilters,
  inDateRange,
  type DateRange,
  type SortDir,
} from '@/components/requests/request-filters'
import {
  RequestModulesPanel,
  type TypeFilter,
} from '@/components/requests/request-modules-panel'
import {
  StatusChips,
  type StatusFilter,
} from '@/components/requests/status-chips'
import { StateView } from '@/components/state-view'
import { ApiError } from '@/lib/api'
import {
  fetchStudentApprovalCounts,
  fetchStudentApprovals,
  type ApprovalCounts,
  type StudentApprovalItem,
} from '@/lib/student-approvals'
import type { CatalogModule } from '@/lib/student-requests'
import { useAuthStore } from '@/stores/auth-store'

/**
 * Student Approvals — everything sent to the student for a decision, plus the
 * history of what they already decided, read from the server-owned
 * `student_approvals` table. Every approval, whatever its module, shares one
 * common status axis (pending / approved / rejected / sent back / cancelled).
 *
 * Layout mirrors My Requests: status chips + date/sort controls across the top,
 * a Modules panel beside the list. The whole inbox is fetched once and filtered
 * in memory; status chip counts are GLOBAL and do not recount as the panel or
 * date filter narrows the list below. Placement drive invitations are the first
 * (and currently only) source.
 */

/**
 * The Modules tree for approvals. One module today; the leaf `type` must match
 * the server's `STUDENT_APPROVAL_TYPE_DRIVE_INVITE` so it filters `item.type`.
 */
const APPROVAL_MODULES: CatalogModule[] = [
  {
    key: 'placements',
    label: 'Placements',
    icon: 'Briefcase',
    order: 1,
    types: [{ type: 'drive_invite', label: 'Drive Invitation', order: 1 }],
  },
]

/** Per-status empty-state copy — the Pending tab keeps the original wording. */
const EMPTY: Record<StatusFilter, { title: string; description: string }> = {
  pending: {
    title: 'Nothing needs your approval',
    description: 'When something is sent to you for approval, it will show up here.',
  },
  approved: {
    title: 'No approved items',
    description: 'Invitations you accepted will show up here.',
  },
  rejected: {
    title: 'No rejected items',
    description: 'Invitations you declined will show up here.',
  },
  sent_back: {
    title: 'Nothing sent back',
    description: 'Anything returned to you for changes will show up here.',
  },
  cancelled: {
    title: 'Nothing cancelled',
    description: 'Invitations the placement cell withdrew will show up here.',
  },
  all: {
    title: 'No approvals yet',
    description: 'When something is sent to you for approval, it will show up here.',
  },
}

export default function Approvals() {
  const signOut = useAuthStore((state) => state.signOut)
  const navigate = useNavigate()
  const [items, setItems] = useState<StudentApprovalItem[] | null>(null)
  const [counts, setCounts] = useState<ApprovalCounts>({})
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>(null)
  const [dateRange, setDateRange] = useState<DateRange>(null)
  const [sortDir, setSortDir] = useState<SortDir>('newest')

  useEffect(() => {
    document.title = 'Approvals — Nucleus'
  }, [])

  const load = useCallback(async () => {
    try {
      const [list, tally] = await Promise.all([
        fetchStudentApprovals(),
        fetchStudentApprovalCounts(),
      ])
      setItems(list)
      setCounts(tally)
      setError(null)
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        signOut()
        return
      }
      setError(
        err instanceof ApiError || err instanceof Error
          ? err.message
          : 'Could not load approvals.',
      )
    }
  }, [signOut])

  useEffect(() => {
    void load()
  }, [load])

  const openDrive = (driveId: number) =>
    void navigate({
      to: '/placements',
      search: { tab: 'invites', drive: driveId },
    })

  if (error) {
    return (
      <>
        <PageHeader
          title="Approvals"
          subtitle="Requests waiting for your decision"
          icon={Stamp}
          accent="emerald"
        />
        <StateView
          icon={CircleAlert}
          title="Could not load approvals"
          description={error}
          action={{ label: 'Retry', onClick: () => void load(), icon: RefreshCw }}
        />
      </>
    )
  }

  const visible = (items ?? [])
    .filter(
      (i) =>
        (statusFilter === 'all' || i.status === statusFilter) &&
        (typeFilter === null || i.type === typeFilter) &&
        inDateRange(i.created_at, dateRange),
    )
    .sort((a, b) => {
      const diff =
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      return sortDir === 'newest' ? -diff : diff
    })

  return (
    <>
      <PageHeader
        title="Approvals"
        subtitle="Requests waiting for your decision"
        icon={Stamp}
        accent="emerald"
      />

      <StatusChips
        className="mb-4"
        value={statusFilter}
        counts={counts}
        onChange={setStatusFilter}
      />

      <RequestFilters
        className="mb-4"
        value={dateRange}
        onChange={setDateRange}
        sort={sortDir}
        onSortChange={setSortDir}
      />

      <div className="grid gap-4 lg:grid-cols-[16rem_minmax(0,1fr)] lg:items-start">
        <RequestModulesPanel
          catalog={APPROVAL_MODULES}
          value={typeFilter}
          onChange={setTypeFilter}
        />

        <div className="min-w-0">
          {items === null ? (
            <div className="space-y-2.5">
              {[0, 1].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />
              ))}
            </div>
          ) : visible.length === 0 ? (
            items.length === 0 ? (
              <StateView
                icon={Stamp}
                title={EMPTY[statusFilter].title}
                description={EMPTY[statusFilter].description}
              />
            ) : (
              <StateView
                icon={Stamp}
                title="Nothing matches these filters"
                description="Try a different status, module or date."
              />
            )
          ) : (
            <div className="space-y-2.5">
              {visible.map((item) =>
                !item.drive ? null : item.status === 'pending' ? (
                  <PlacementInviteCard
                    key={item.id}
                    invite={item.drive}
                    onView={() => openDrive(item.drive!.drive_id)}
                    onChanged={() => void load()}
                  />
                ) : (
                  <PlacementRecordRow
                    key={item.id}
                    record={item.drive}
                    onOpen={openDrive}
                  />
                ),
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
