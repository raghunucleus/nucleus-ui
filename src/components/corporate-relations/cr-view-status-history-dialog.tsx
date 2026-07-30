import * as React from 'react'
import { Loader2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatDateTime } from '@/components/corporate-relations/bits'
import { ApiError } from '@/lib/api'
import {
  getCrViewStatusHistory,
  type CrViewStatusLogEntry,
} from '@/lib/corporate-relations'

function errMsg(e: unknown, fallback: string): string {
  return e instanceof ApiError || e instanceof Error ? e.message : fallback
}

/** How the dialog loads its entries — injectable so both surfaces can use it. */
export type StatusHistoryFetcher = (
  jobRoleId: number,
  passoutYearId: number,
) => Promise<CrViewStatusLogEntry[]>

/**
 * Read-only status history for one (job role × passout year) — every status
 * transition with when and by whom, newest first. Opened from the small clock
 * icon in the Current status cell; the log itself is written server-side
 * inside the record's save transaction, so this is purely a viewer.
 *
 * `fetcher` defaults to CR View's own (self-scoped) endpoint. Management View
 * passes its unscoped one — the rendering is identical, only the reach differs.
 */
export function CrViewStatusHistoryDialog({
  open,
  ...props
}: {
  open: boolean
  /** e.g. the role name. */
  title: string
  /** e.g. "TCS · 2026-2027". */
  subtitle: string
  jobRoleId: number
  passoutYearId: number
  fetcher?: StatusHistoryFetcher
  onOpenChange: (open: boolean) => void
}) {
  // Unmounted while closed, so each open MOUNTS fresh and fetches anew —
  // history changes with every status edit, and stale entries would mislead.
  if (!open) return null
  return <StatusHistoryBody {...props} />
}

function StatusHistoryBody({
  title,
  subtitle,
  jobRoleId,
  passoutYearId,
  fetcher = getCrViewStatusHistory,
  onOpenChange,
}: {
  title: string
  subtitle: string
  jobRoleId: number
  passoutYearId: number
  fetcher?: StatusHistoryFetcher
  onOpenChange: (open: boolean) => void
}) {
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [entries, setEntries] = React.useState<CrViewStatusLogEntry[]>([])

  React.useEffect(() => {
    let cancelled = false
    fetcher(jobRoleId, passoutYearId)
      .then((rows) => {
        if (!cancelled) setEntries(rows)
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(errMsg(e, 'Could not load the history.'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [fetcher, jobRoleId, passoutYearId])

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[80vh] flex-col overflow-hidden sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Status history — {title}</DialogTitle>
          <DialogDescription>{subtitle}</DialogDescription>
        </DialogHeader>

        <div className="-mx-1 flex-1 overflow-y-auto px-1">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="mr-2 size-4 animate-spin" /> Loading…
            </div>
          ) : error ? (
            <p className="py-6 text-sm text-destructive">{error}</p>
          ) : entries.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No status changes recorded yet.
            </p>
          ) : (
            <ol className="space-y-0">
              {entries.map((e, i) => (
                <li
                  key={e.id}
                  className={
                    'flex flex-wrap items-center gap-x-2 gap-y-1 py-2.5' +
                    (i < entries.length - 1 ? ' border-b' : '')
                  }
                >
                  {e.status ? (
                    <Badge variant="secondary">{e.status.name}</Badge>
                  ) : (
                    <span className="text-sm italic text-muted-foreground">
                      Cleared — back to default
                    </span>
                  )}
                  <span className="ml-auto text-right text-xs text-muted-foreground">
                    {formatDateTime(e.changed_at)}
                    {e.changed_by ? ` · ${e.changed_by.name}` : ''}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
