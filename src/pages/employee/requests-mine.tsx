import { useCallback, useEffect, useState } from 'react'
import { CircleAlert, ClipboardList, RefreshCw } from 'lucide-react'

import { formatDate } from '@/components/corporate-relations/bits'
import { NoAccessEmptyState } from '@/components/employee/empty-states'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useScreenAccess } from '@/hooks/use-screen-access'
import { ApiError } from '@/lib/api'
import {
  fetchApprovalCatalog,
  fetchMyEmployeeRequests,
  type EmployeeOwnRequest,
} from '@/lib/employee-requests'
import {
  REQUEST_STATUS_LABELS,
  requestStatusVariant,
  typeLabel,
  type CatalogModule,
} from '@/lib/student-requests'

const SCREEN_KEY = 'requests.mine.view'

/**
 * Employee "My Requests" — a functional shell: the list endpoint is real, but
 * no employee-creatable request types exist yet, so today it always renders
 * the empty state. When the first type ships (with its own module + creation
 * endpoint), this screen already lists it.
 */
export default function EmployeeRequestsMinePage() {
  const access = useScreenAccess(SCREEN_KEY)

  useEffect(() => {
    document.title = 'My Requests — Nucleus'
  }, [])

  if (!access) return <NoAccessEmptyState />
  return <MyRequests />
}

function MyRequests() {
  const [requests, setRequests] = useState<EmployeeOwnRequest[] | null>(null)
  const [catalog, setCatalog] = useState<CatalogModule[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // No Modules panel here: there are no employee-creatable request types yet,
  // so the tree would have nothing to filter. The catalog is fetched only for
  // its type labels; add the panel when the first employee type ships.
  useEffect(() => {
    fetchApprovalCatalog()
      .then(setCatalog)
      .catch(() => setCatalog([]))
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setRequests(await fetchMyEmployeeRequests())
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

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">My Requests</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Things you asked for and where they stand.
        </p>
      </header>

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border bg-card p-10 text-center">
          <CircleAlert className="size-6 text-destructive" />
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button size="sm" onClick={() => void load()}>
            <RefreshCw className="size-4" /> Try again
          </Button>
        </div>
      ) : !requests || requests.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed bg-muted/20 px-6 py-14 text-center">
          <ClipboardList className="size-8 text-muted-foreground" />
          <h3 className="text-sm font-medium">No requests yet</h3>
          <p className="max-w-sm text-xs text-muted-foreground">
            You haven't submitted any requests. Employee request types are
            coming soon — they'll show up here with their approval status.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {requests.map((r) => (
            <div
              key={r.id}
              className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">
                    {typeLabel(catalog, r.request_type)}
                  </span>
                  <Badge variant={requestStatusVariant(r.status)}>
                    {REQUEST_STATUS_LABELS[r.status] ?? r.status}
                  </Badge>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Submitted {formatDate(r.created_at)}
                  {r.decision_note ? ` · ${r.decision_note}` : ''}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
