import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import {
  ArrowLeft,
  ChevronRight,
  CircleAlert,
  ClipboardList,
  RefreshCw,
} from 'lucide-react'
import { toast } from 'sonner'

import { PageHeader } from '@/components/portal-layout'
import { ApproversList } from '@/components/requests/approvers-list'
import { RequestChanges } from '@/components/requests/request-changes'
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
import { RequestTimeline } from '@/components/requests/request-timeline'
import {
  StatusChips,
  type StatusFilter,
} from '@/components/requests/status-chips'
import { StateView } from '@/components/state-view'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ApiError } from '@/lib/api'
import {
  cancelRequest,
  fetchMyRequest,
  fetchMyRequestCounts,
  fetchMyRequests,
  fetchRequestCatalog,
  labelForChange,
  OPEN_REQUEST_STATUSES,
  REQUEST_STATUS_LABELS,
  requestStatusVariant,
  typeLabel,
  type CatalogModule,
  type RequestStatusCounts,
  type StudentRequest,
  type StudentRequestDetail,
} from '@/lib/student-requests'
import { useAuthStore } from '@/stores/auth-store'

function errMsg(err: unknown, fallback: string): string {
  return err instanceof ApiError || err instanceof Error
    ? err.message
    : fallback
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/**
 * My Requests is TRACKING-ONLY: requests are raised from the owning module's
 * screen (profile updates from the Profile screen; future types from theirs).
 * The one exception is reviving a SENT-BACK request — that is a continuation of
 * an existing request, not a new one, so it is actioned here via the profile
 * module's own dialog in edit mode.
 *
 * Layout: Modules panel (filters by request type) beside the list; status chips
 * across the top are GLOBAL and do not recount as the panel filters.
 */
export default function MyRequests() {
  const signOut = useAuthStore((state) => state.signOut)
  const search = useSearch({ strict: false }) as { open?: number }

  const [requests, setRequests] = useState<StudentRequest[] | null>(null)
  const [catalog, setCatalog] = useState<CatalogModule[]>([])
  const [counts, setCounts] = useState<RequestStatusCounts>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>(null)
  const [dateRange, setDateRange] = useState<DateRange>(null)
  const [sortDir, setSortDir] = useState<SortDir>('newest')
  // The notification deep-link (`?open=<id>`) opens that request on arrival.
  const [openId, setOpenId] = useState<number | null>(search.open ?? null)

  useEffect(() => {
    document.title = 'My Requests — Nucleus'
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [rows, cat, cnt] = await Promise.all([
        fetchMyRequests(),
        fetchRequestCatalog(),
        fetchMyRequestCounts(),
      ])
      setRequests(rows)
      setCatalog(cat)
      setCounts(cnt)
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        signOut()
        return
      }
      setError(errMsg(err, 'Could not load your requests.'))
    } finally {
      setLoading(false)
    }
  }, [signOut])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) return <RequestsSkeleton />
  if (error) return <ErrorState message={error} onRetry={() => void load()} />
  if (!requests) return null

  if (openId !== null) {
    return (
      <RequestDetail
        id={openId}
        catalog={catalog}
        onBack={() => setOpenId(null)}
        onChanged={() => void load()}
      />
    )
  }

  const visible = requests
    .filter(
      (r) =>
        (statusFilter === 'all' || r.status === statusFilter) &&
        (typeFilter === null || r.request_type === typeFilter) &&
        inDateRange(r.created_at, dateRange),
    )
    .sort((a, b) => {
      const diff =
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      return sortDir === 'newest' ? -diff : diff
    })

  return (
    <>
      <PageHeader
        title="My Requests"
        subtitle="Requests you raised from other screens and where they stand"
        icon={ClipboardList}
        accent="orange"
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
          catalog={catalog}
          value={typeFilter}
          onChange={setTypeFilter}
        />

        <div className="min-w-0">
          {visible.length === 0 ? (
            <StateView
              icon={ClipboardList}
              title={
                requests.length === 0
                  ? 'No requests yet'
                  : 'Nothing matches these filters'
              }
              description={
                requests.length === 0
                  ? 'Requests you raise from other screens will show up here.'
                  : 'Try a different status, module or date.'
              }
            />
          ) : (
            <div className="space-y-2.5">
              {visible.map((r) => (
                <RequestRow
                  key={r.id}
                  request={r}
                  catalog={catalog}
                  onOpen={() => setOpenId(r.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

function RequestRow({
  request,
  catalog,
  onOpen,
}: {
  request: StudentRequest
  catalog: CatalogModule[]
  onOpen: () => void
}) {
  const changes = request.payload.changes ?? []
  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/30"
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-icon-orange/10 text-icon-orange">
          <ClipboardList className="size-4.5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="text-sm font-semibold">
              {typeLabel(catalog, request.request_type)}
            </span>
            <Badge variant={requestStatusVariant(request.status)}>
              {REQUEST_STATUS_LABELS[request.status] ?? request.status}
            </Badge>
          </span>
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
            {changes.map((c) => labelForChange(c)).join(', ')}
            {' · '}
            {formatDate(request.created_at)}
          </span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
      </button>
    </Card>
  )
}

/**
 * The full view of one request: what was asked, who can act on it, and
 * everything that has happened to it so far.
 */
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
  const navigate = useNavigate()
  const [detail, setDetail] = useState<StudentRequestDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)

  const load = useCallback(async () => {
    setError(null)
    try {
      setDetail(await fetchMyRequest(id))
    } catch (err) {
      setError(errMsg(err, 'Could not load this request.'))
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  async function onCancel() {
    setBusy(true)
    try {
      await cancelRequest(id)
      toast.success('Request cancelled.')
      await load()
      onChanged()
    } catch (err) {
      toast.error(errMsg(err, 'Could not cancel the request.'))
    } finally {
      setBusy(false)
      setConfirmCancel(false)
    }
  }

  if (error) return <ErrorState message={error} onRetry={() => void load()} />
  if (!detail) return <RequestsSkeleton />

  const changes = detail.payload.changes ?? []
  const isOpen = OPEN_REQUEST_STATUSES.includes(detail.status)
  const isSentBack = detail.status === 'sent_back'

  return (
    <>
      <Button variant="ghost" size="sm" className="mb-3" onClick={onBack}>
        <ArrowLeft className="size-4" /> Back to my requests
      </Button>

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem] lg:items-start">
        <div className="space-y-4">
          <Card className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">
                {typeLabel(catalog, detail.request_type)}
              </h2>
              <Badge variant={requestStatusVariant(detail.status)}>
                {REQUEST_STATUS_LABELS[detail.status] ?? detail.status}
              </Badge>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Raised on {formatDate(detail.created_at)}
            </p>

            {isSentBack && detail.decision_note && (
              <div className="mt-3 rounded-lg border border-warning/40 bg-warning/10 p-3">
                <p className="text-xs font-medium text-warning">
                  Sent back for changes
                </p>
                <p className="mt-1 text-sm break-words">
                  {detail.decision_note}
                </p>
              </div>
            )}

            <h3 className="mt-4 mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Requested changes
            </h3>
            <RequestChanges changes={changes} />

            {detail.requester_note && (
              <p className="mt-3 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Your note:</span>{' '}
                {detail.requester_note}
              </p>
            )}
            {!isSentBack && detail.decision_note && (
              <p className="mt-1 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">
                  Reviewer note:
                </span>{' '}
                {detail.decision_note}
              </p>
            )}

            {isOpen && (
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-4">
                {isSentBack && (
                  <Button
                    size="sm"
                    onClick={() =>
                      // Revising is a continuation of this request, actioned on
                      // the profile module's full-screen form in edit mode.
                      void navigate({
                        to: '/profile/request-changes',
                        search: { edit: detail.id },
                      })
                    }
                  >
                    Revise &amp; resubmit
                  </Button>
                )}
                {confirmCancel ? (
                  <>
                    <span className="text-xs text-muted-foreground">
                      Cancel this request?
                    </span>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={busy}
                      onClick={() => void onCancel()}
                    >
                      Yes, cancel
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => setConfirmCancel(false)}
                    >
                      Keep it
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setConfirmCancel(true)}
                  >
                    Cancel request
                  </Button>
                )}
              </div>
            )}
          </Card>

          <Card className="p-4">
            <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              History
            </h3>
            <RequestTimeline timeline={detail.timeline} />
          </Card>
        </div>

        <Card className="p-4">
          <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Approvers
          </h3>
          <ApproversList
            approvers={detail.approvers}
            isDecided={!isOpen}
          />
        </Card>
      </div>
    </>
  )
}

// --- page states --------------------------------------------------------------

function RequestsSkeleton() {
  return (
    <div className="space-y-2.5">
      <div className="h-16 animate-pulse rounded-2xl bg-muted" />
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />
      ))}
    </div>
  )
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border bg-card p-10 text-center text-card-foreground">
      <div className="grid size-12 place-items-center rounded-full bg-destructive/10 text-destructive">
        <CircleAlert className="size-6" />
      </div>
      <div className="space-y-1">
        <h2 className="text-sm font-semibold">Couldn’t load your requests</h2>
        <p className="max-w-sm text-xs text-muted-foreground">{message}</p>
      </div>
      <Button size="sm" onClick={onRetry}>
        <RefreshCw className="size-4" /> Try again
      </Button>
    </div>
  )
}
