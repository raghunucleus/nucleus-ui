import {
  Clock,
  Download,
  FileDown,
  FileSpreadsheet,
  FileText,
  Loader2,
  RefreshCw,
  XCircle,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState as EmptyStatePanel } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
import { ApiError } from '@/lib/api'
import {
  getExportDownloadUrl,
  listMyExports,
  type ExportJob,
  type ExportJobStatus,
} from '@/lib/exports'
import { cn } from '@/lib/utils'
import { useEmployeeAuthStore } from '@/stores/employee-auth-store'

/** Refresh cadence while a job is still generating. */
const POLL_MS = 15_000
/** Countdown re-render cadence. */
const TICK_MS = 30_000

/**
 * The employee's export jobs ("My exports"). Reached from the export-ready
 * notification (and the export toast) — like /notifications it has no RBAC
 * catalog entry, so it never appears in the sidebar.
 *
 * Files live for 24 hours after completion; a download attempt on an expired
 * job gets a 410 from the server and flips the row to Expired here.
 */
export default function EmployeeExportsPage() {
  const signOut = useEmployeeAuthStore((state) => state.signOut)
  const [jobs, setJobs] = useState<ExportJob[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Re-render tick so the "expires in …" countdowns stay fresh.
  const [, setNow] = useState(() => Date.now())
  const highlightId = useRef<number | null>(readOpenParam())

  useEffect(() => {
    document.title = 'My exports — Nucleus'
  }, [])

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true)
      try {
        const rows = await listMyExports()
        setJobs(rows)
        setError(null)
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          signOut()
          return
        }
        if (!silent) {
          setError(
            err instanceof Error ? err.message : 'Could not load exports.',
          )
        }
      } finally {
        if (!silent) setLoading(false)
      }
    },
    [signOut],
  )

  useEffect(() => {
    void load()
  }, [load])

  // Poll while anything is still generating.
  const hasActive = jobs.some(
    (j) => j.status === 'pending' || j.status === 'processing',
  )
  useEffect(() => {
    if (!hasActive) return
    const t = setInterval(() => void load(true), POLL_MS)
    return () => clearInterval(t)
  }, [hasActive, load])

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), TICK_MS)
    return () => clearInterval(t)
  }, [])

  const download = useCallback(async (job: ExportJob) => {
    try {
      const { url } = await getExportDownloadUrl(job.id)
      window.open(url, '_blank', 'noopener')
    } catch (err) {
      if (err instanceof ApiError && err.status === 410) {
        toast.error('This export link has expired.')
        setJobs((prev) =>
          prev.map((j) =>
            j.id === job.id ? { ...j, status: 'expired' as const } : j,
          ),
        )
        return
      }
      if (err instanceof ApiError && err.status === 409) {
        toast.info('This export is still being generated.')
        return
      }
      toast.error(
        err instanceof Error ? err.message : 'Could not download the export.',
      )
    }
  }, [])

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader
        title="My exports"
        subtitle="Files stay downloadable for 24 hours, then expire."
        actions={
          <Button variant="outline" size="sm" onClick={() => void load()}>
            <RefreshCw />
            Refresh
          </Button>
        }
      />

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : error && jobs.length === 0 ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : jobs.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-2">
          {jobs.map((job) => (
            <ExportRow
              key={job.id}
              job={job}
              highlighted={highlightId.current === job.id}
              onDownload={download}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ExportRow({
  job,
  highlighted,
  onDownload,
}: {
  job: ExportJob
  highlighted: boolean
  onDownload: (job: ExportJob) => void
}) {
  const generating = job.status === 'pending' || job.status === 'processing'
  const FormatIcon = job.format === 'xlsx' ? FileSpreadsheet : FileText

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-xl border bg-card p-4',
        highlighted && 'border-primary/40 ring-2 ring-primary/20',
      )}
    >
      <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-icon-cyan/10 text-icon-cyan">
        <FormatIcon className="size-[18px]" />
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold">{job.label}</p>
          <Badge variant="muted" className="uppercase">
            {job.format}
          </Badge>
          <StatusChip status={job.status} />
        </div>
        <p className="text-xs text-muted-foreground">
          {describeJob(job)}
        </p>
        {job.status === 'failed' && job.error ? (
          <p className="text-xs text-destructive">{job.error}</p>
        ) : null}
      </div>
      <div className="shrink-0 self-center">
        {job.status === 'ready' ? (
          <Button size="sm" onClick={() => onDownload(job)}>
            <Download className="size-4" />
            Download
          </Button>
        ) : generating ? (
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        ) : null}
      </div>
    </div>
  )
}

function StatusChip({ status }: { status: ExportJobStatus }) {
  switch (status) {
    case 'pending':
    case 'processing':
      return (
        <Badge variant="warning">
          <Loader2 className="size-3 animate-spin" />
          Generating
        </Badge>
      )
    case 'ready':
      return <Badge variant="success">Ready</Badge>
    case 'failed':
      return (
        <Badge variant="destructive">
          <XCircle className="size-3" />
          Failed
        </Badge>
      )
    case 'expired':
      return (
        <Badge variant="muted">
          <Clock className="size-3" />
          Expired
        </Badge>
      )
  }
}

function describeJob(job: ExportJob): string {
  const parts: string[] = [formatWhen(job.created_at)]
  if (job.row_count !== null) {
    parts.push(`${job.row_count.toLocaleString()} rows`)
  }
  if (job.status === 'ready' && job.expires_at) {
    const left = new Date(job.expires_at).getTime() - Date.now()
    parts.push(left > 0 ? `expires in ${formatLeft(left)}` : 'expiring…')
  } else if (job.status === 'expired') {
    parts.push('the file has been deleted')
  }
  return parts.join(' · ')
}

function formatWhen(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatLeft(ms: number): string {
  const totalMinutes = Math.max(1, Math.floor(ms / 60_000))
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

/** ?open=<job id> from a notification deep-link, read once at mount. */
function readOpenParam(): number | null {
  const raw = new URLSearchParams(window.location.search).get('open')
  const id = raw ? Number(raw) : NaN
  return Number.isFinite(id) ? id : null
}

function EmptyState() {
  return (
    <EmptyStatePanel
      icon={FileDown}
      title="No exports yet"
      description="Start one from a data screen — like a drive’s Filter tab — and it’ll appear here when it’s ready to download."
    />
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
        <FileDown className="size-6" />
      </div>
      <div className="space-y-1">
        <h2 className="text-sm font-semibold">Couldn&rsquo;t load exports</h2>
        <p className="max-w-sm text-xs text-muted-foreground">{message}</p>
      </div>
      <Button size="sm" onClick={onRetry}>
        <RefreshCw />
        Try again
      </Button>
    </div>
  )
}
