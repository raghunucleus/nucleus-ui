import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ChevronRight,
  CircleAlert,
  ClipboardList,
  Pencil,
  RefreshCw,
  X,
} from 'lucide-react'
import { toast } from 'sonner'

import { formatDate } from '@/components/corporate-relations/bits'
import { NoAccessEmptyState } from '@/components/employee/empty-states'
import { ApproversList } from '@/components/requests/approvers-list'
import { rendererFor } from '@/components/requests/payloads'
import {
  RequestFilters,
  inDateRange,
  type DateRange,
  type SortDir,
} from '@/components/requests/request-filters'
import { RequestAvatar } from '@/components/requests/request-avatar'
import {
  RequestModulesPanel,
  type TypeFilter,
} from '@/components/requests/request-modules-panel'
import { RequestTimeline } from '@/components/requests/request-timeline'
import {
  StatusChips,
  type StatusFilter,
} from '@/components/requests/status-chips'
import { BackButton } from '@/components/ui/back-button'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { useScreenAccess } from '@/hooks/use-screen-access'
import { ApiError } from '@/lib/api'
import {
  cancelMyEmployeeRequest,
  fetchApprovalCatalog,
  fetchMyEmployeeRequest,
  fetchMyEmployeeRequestCounts,
  fetchMyEmployeeRequests,
  type ApprovalRow,
  type EmployeeOwnRequest,
  type EmployeeOwnRequestDetail,
} from '@/lib/employee-requests'
import {
  OPEN_REQUEST_STATUSES,
  REQUEST_STATUS_LABELS,
  requestStatusVariant,
  typeLabel,
  type CatalogModule,
  type RequestStatusCounts,
} from '@/lib/student-requests'
import { cn } from '@/lib/utils'

const SCREEN_KEY = 'requests.mine.view'

/**
 * Imperative employee-portal navigation — the dual-router setup makes the typed
 * `<Link>` reject employee-only paths.
 */
function navigateTo(route: string) {
  window.history.pushState({}, '', route)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

const isOpen = (status: string) =>
  (OPEN_REQUEST_STATUSES as readonly string[]).includes(status)

/**
 * Employee "My Requests" — what you asked for and where it stands.
 *
 * The payload is rendered through the same registry the Approvals screen uses,
 * with `editable: false`, so the raiser sees exactly what the approver saw —
 * including which person an approver substituted on a company job role.
 */
export default function EmployeeRequestsMinePage() {
  const access = useScreenAccess(SCREEN_KEY)

  useEffect(() => {
    document.title = 'My Requests — Nucleus'
  }, [])

  if (!access) return <NoAccessEmptyState />
  return <MyRequests />
}

/** Shown in every state of the list — loading and error included. */
function PageHead() {
  return <PageHeader title="My Requests" />
}

/**
 * Layout mirrors the Approvals screen: status chips across the top, a date and
 * sort bar, then the Modules panel beside the list. The chips are GLOBAL — they
 * count every request you raised and do not recount as the panel narrows the
 * list below.
 */
function MyRequests() {
  const [requests, setRequests] = useState<EmployeeOwnRequest[] | null>(null)
  const [catalog, setCatalog] = useState<CatalogModule[]>([])
  const [counts, setCounts] = useState<RequestStatusCounts>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  // 'all', not Approvals' 'pending' — this is a tracking screen, not a queue.
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>(null)
  const [dateRange, setDateRange] = useState<DateRange>(null)
  const [sortDir, setSortDir] = useState<SortDir>('newest')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // The catalog (type labels + the Modules tree) and the chip counts are
      // decoration — losing either must not blank the list itself.
      const [rows, cat, cnt] = await Promise.all([
        fetchMyEmployeeRequests(),
        fetchApprovalCatalog().catch(() => [] as CatalogModule[]),
        fetchMyEmployeeRequestCounts().catch(() => ({}) as RequestStatusCounts),
      ])
      setRequests(rows)
      setCatalog(cat)
      setCounts(cnt)
    } catch (err) {
      setError(
        err instanceof ApiError || err instanceof Error
          ? err.message
          : 'Could not load your requests.',
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // Deep-link from a decision notification (`?open=<id>`), then strip the param
  // so a refresh doesn't re-trigger it.
  const openedRef = useRef(false)
  useEffect(() => {
    if (openedRef.current) return
    const raw = Number(new URLSearchParams(window.location.search).get('open'))
    if (Number.isFinite(raw) && raw > 0) {
      openedRef.current = true
      setSelectedId(raw)
      window.history.replaceState({}, '', '/requests/mine')
    }
  }, [])

  if (selectedId !== null) {
    return (
      <RequestDetail
        id={selectedId}
        catalog={catalog}
        onBack={() => setSelectedId(null)}
        onChanged={() => {
          setSelectedId(null)
          void load()
        }}
      />
    )
  }

  if (loading || error || !requests) {
    return (
      <div className="space-y-4">
        <PageHead />
        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 rounded-xl border bg-card p-10 text-center">
            <CircleAlert className="size-6 text-destructive" />
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button size="sm" onClick={() => void load()}>
              <RefreshCw className="size-4" /> Try again
            </Button>
          </div>
        )}
      </div>
    )
  }

  // The catalog carries EVERY request type (the Approvals tree needs the ones
  // an employee can only receive); prune it to what this employee actually HAS
  // raised, so no branch of the tree is a filter that can only ever come back
  // empty — and so student-only types never surface on a raiser's screen.
  // Derived from ALL requests, never the filtered list — otherwise picking a
  // module would collapse the tree to just that module.
  const ownTypes = new Set<string>(requests.map((r) => r.request_type))
  const ownCatalog = catalog
    .map((m) => ({ ...m, types: m.types.filter((t) => ownTypes.has(t.type)) }))
    .filter((m) => m.types.length > 0)
  // A selection can outlive the tree it came from (the last request of a type
  // withdrawn, say); treat it as cleared rather than silently showing nothing.
  const activeType = typeFilter && ownTypes.has(typeFilter) ? typeFilter : null

  const visible = requests
    .filter(
      (r) =>
        (statusFilter === 'all' || r.status === statusFilter) &&
        (activeType === null || r.request_type === activeType) &&
        inDateRange(r.created_at, dateRange),
    )
    .sort((a, b) => {
      const diff =
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      return sortDir === 'newest' ? -diff : diff
    })

  return (
    <div className="space-y-4">
      <PageHead />

      <StatusChips
        value={statusFilter}
        counts={counts}
        onChange={setStatusFilter}
      />

      <RequestFilters
        value={dateRange}
        onChange={setDateRange}
        sort={sortDir}
        onSortChange={setSortDir}
      />

      <div
        className={cn(
          'grid gap-4 lg:items-start',
          // Nothing raised yet means nothing to filter — drop the rail rather
          // than park an empty panel beside the "no requests" state.
          ownCatalog.length > 0 && 'lg:grid-cols-[16rem_minmax(0,1fr)]',
        )}
      >
        {ownCatalog.length > 0 && (
          <RequestModulesPanel
            catalog={ownCatalog}
            value={activeType}
            onChange={setTypeFilter}
          />
        )}

        <div className="min-w-0">
          {visible.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed bg-muted/20 px-6 py-14 text-center">
              <ClipboardList className="size-8 text-muted-foreground" />
              <h3 className="text-sm font-medium">
                {requests.length === 0
                  ? 'No requests yet'
                  : 'Nothing matches these filters'}
              </h3>
              <p className="max-w-sm text-xs text-muted-foreground">
                {requests.length === 0
                  ? 'Anything you send for approval — a new company, a change to one — shows up here with its status.'
                  : 'Try a different status, module or date.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {visible.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setSelectedId(r.id)}
                  className="flex w-full items-center gap-3 rounded-lg border bg-card px-4 py-3 text-left transition-colors hover:bg-accent/40"
                >
                  <RequestAvatar
                    row={r as unknown as ApprovalRow}
                    catalog={catalog}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        {typeLabel(catalog, r.request_type)}
                      </span>
                      <Badge variant={requestStatusVariant(r.status)}>
                        {REQUEST_STATUS_LABELS[r.status] ?? r.status}
                      </Badge>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {rendererFor(r.request_type).summary(
                        r as unknown as ApprovalRow,
                      )}
                      {' · '}
                      Submitted {formatDate(r.created_at)}
                    </p>
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function RequestDetail({
  id,
  catalog,
  onBack,
  onChanged,
}: {
  id: number
  catalog: CatalogModule[]
  onBack: () => void
  onChanged: () => void
}) {
  const [detail, setDetail] = useState<EmployeeOwnRequestDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Which corporate-relations screen this employee can resubmit a sent-back
  // company from. Hooks run before the early returns below.
  const companyMgmt = useScreenAccess(
    'corporate_relations.company_management.manage',
  )
  const jobRoles = useScreenAccess('corporate_relations.job_roles.manage')
  const canEditCompanies = companyMgmt?.actions.includes('edit') ?? false
  const canAddCompanies = jobRoles?.actions.includes('create') ?? false

  useEffect(() => {
    let cancelled = false
    fetchMyEmployeeRequest(id)
      .then((d) => !cancelled && setDetail(d))
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof ApiError || err instanceof Error
              ? err.message
              : 'Could not load the request.',
          )
        }
      })
    return () => {
      cancelled = true
    }
  }, [id])

  async function cancel() {
    setBusy(true)
    try {
      await cancelMyEmployeeRequest(id)
      toast.success('Request withdrawn.')
      onChanged()
    } catch (err) {
      toast.error(
        err instanceof ApiError || err instanceof Error
          ? err.message
          : 'Could not withdraw the request.',
      )
    } finally {
      setBusy(false)
    }
  }

  // The heading is rendered in every state so the back control never blinks
  // out; the type label arrives with the detail, so the fallback is static.
  const back = (
    <BackButton iconOnly label="Back to my requests" onClick={onBack} />
  )

  if (error) {
    return (
      <div className="space-y-4">
        <PageHeader leading={back} title="Request" />
        <p className="text-sm text-destructive">{error}</p>
      </div>
    )
  }
  if (!detail) {
    return (
      <div className="space-y-4">
        <PageHeader leading={back} title="Request" />
        <div className="h-64 animate-pulse rounded-xl bg-muted" />
      </div>
    )
  }

  const renderer = rendererFor(detail.request_type)
  // The payload renderers are written against the approver's row shape; a
  // requester's row is the same minus the approver-only fields, none of which
  // a renderer reads.
  const asRow = detail as unknown as ApprovalRow
  const companyId = (detail.payload as { company_id?: number }).company_id
  // A company request is resubmitted from whichever corporate-relations screen
  // the raiser actually holds — Company Management if they have it, otherwise
  // Roles or Designations, which opens the same form in its slide-over.
  const resubmitRoute = canEditCompanies
    ? `/corporate-relations/company-management/${companyId}/edit`
    : canAddCompanies
      ? `/corporate-relations/job-roles?edit=${companyId}`
      : null
  const canResubmit =
    detail.status === 'sent_back' &&
    detail.request_type === 'company_approval' &&
    !!companyId &&
    resubmitRoute !== null
  const canWithdraw = isOpen(detail.status)

  return (
    <div className="space-y-4">
      <PageHeader
        leading={back}
        title={typeLabel(catalog, detail.request_type)}
        actions={
          (canResubmit || canWithdraw) && (
            <>
              {canResubmit && resubmitRoute && (
                <Button size="sm" onClick={() => navigateTo(resubmitRoute)}>
                  <Pencil className="size-4" /> Edit and resubmit
                </Button>
              )}
              {canWithdraw && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => void cancel()}
                >
                  <X className="size-4" /> Withdraw
                </Button>
              )}
            </>
          )
        }
      />
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Badge variant={requestStatusVariant(detail.status)}>
          {REQUEST_STATUS_LABELS[detail.status] ?? detail.status}
        </Badge>
        <span>Submitted {formatDate(detail.created_at)}</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[20rem_1fr] lg:items-start">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Approvers
          </p>
          <ApproversList
            className="mt-2"
            approvers={detail.approvers}
            isDecided={detail.status !== 'pending'}
          />

          <p className="mt-4 border-t pt-4 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            History
          </p>
          <RequestTimeline className="mt-2" timeline={detail.timeline} />
        </div>

        <div className="space-y-3">
          <div className="rounded-lg border bg-card">
            <div className="border-b px-4 py-2.5">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {renderer.title}
              </p>
            </div>
            <renderer.Body
              row={asRow}
              detail={asRow}
              editable={false}
              verdicts={{}}
              setVerdicts={() => {}}
              overrides={{}}
              setOverrides={() => {}}
            />
          </div>

          {/* A sent-back request is NOT decided — it is parked with you. The
              same columns carry who/when/why, so label by status. */}
          {detail.status !== 'pending' && (
            <div className="rounded-lg border bg-card p-4">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {detail.status === 'sent_back' ? 'Sent back' : 'Decision'}
              </p>
              <p className="mt-1 text-sm">
                {detail.status === 'sent_back'
                  ? 'Waiting on you to revise and resubmit'
                  : (REQUEST_STATUS_LABELS[detail.status] ?? detail.status)}
                {detail.decided_at ? ` · ${formatDate(detail.decided_at)}` : ''}
              </p>
              {detail.decision_note && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {detail.decision_note}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
