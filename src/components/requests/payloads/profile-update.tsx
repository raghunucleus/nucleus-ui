import { ArrowRight, Check, ExternalLink, X } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { ApprovalRow } from '@/lib/employee-requests'
import {
  changeCertificateUrl,
  changeFromText,
  changeToText,
  labelForChange,
  type ItemOutcome,
  type ProfileUpdateChange,
} from '@/lib/student-requests'
import type { PayloadRenderer, PayloadRendererProps } from './types'

const changesOf = (row: ApprovalRow | null): ProfileUpdateChange[] =>
  ((row?.payload as { changes?: ProfileUpdateChange[] })?.changes ?? []) as
    ProfileUpdateChange[]

/** Small Approve/Reject segmented toggle for one change row. */
function VerdictToggle({
  value,
  onChange,
}: {
  value: ItemOutcome
  onChange: (v: ItemOutcome) => void
}) {
  return (
    <div className="flex shrink-0 overflow-hidden rounded-md border">
      <button
        type="button"
        aria-pressed={value === 'approved'}
        onClick={() => onChange('approved')}
        className={cn(
          'flex items-center gap-1 px-2 py-1 text-xs font-medium transition-colors',
          value === 'approved'
            ? 'bg-success/15 text-success'
            : 'bg-card text-muted-foreground hover:bg-muted/40',
        )}
      >
        <Check className="size-3" /> Approve
      </button>
      <button
        type="button"
        aria-pressed={value === 'rejected'}
        onClick={() => onChange('rejected')}
        className={cn(
          'flex items-center gap-1 border-l px-2 py-1 text-xs font-medium transition-colors',
          value === 'rejected'
            ? 'bg-destructive/15 text-destructive'
            : 'bg-card text-muted-foreground hover:bg-muted/40',
        )}
      >
        <X className="size-3" /> Reject
      </button>
    </div>
  )
}

function Body({
  row,
  detail,
  editable,
  verdicts,
  setVerdicts,
}: PayloadRendererProps) {
  // Prefer the detail payload once loaded: the server enriches it per view
  // (presigned certificate links exist only there). Same item keys either way.
  const changes = changesOf(detail ?? row)

  return (
    // The extended profile can put dozens of items on one request — cap the
    // list and scroll inside it.
    <div className="max-h-[32rem] space-y-1.5 overflow-y-auto p-3">
      {changes.map((c) => {
        const certificateUrl = changeCertificateUrl(c)
        return (
          <div
            key={c.field}
            className="flex flex-wrap items-start gap-2 rounded-md bg-muted/30 px-3 py-2 text-sm"
          >
            <span className="w-32 shrink-0 pt-0.5 text-xs font-medium text-muted-foreground">
              {labelForChange(c)}
            </span>
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className="min-w-0 text-muted-foreground line-through break-words">
                {changeFromText(c)}
              </span>
              <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 font-medium break-words">
                {changeToText(c)}
                {certificateUrl && (
                  <a
                    href={certificateUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    <ExternalLink className="size-3" /> View certificate
                  </a>
                )}
              </span>
            </div>
            {editable ? (
              <VerdictToggle
                value={verdicts[c.field] ?? 'approved'}
                onChange={(v) => setVerdicts({ ...verdicts, [c.field]: v })}
              />
            ) : c.outcome ? (
              <Badge
                variant={c.outcome === 'approved' ? 'success' : 'destructive'}
              >
                {c.outcome === 'approved' ? 'Approved' : 'Rejected'}
              </Badge>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

/** Student profile updates: one row per field, each approvable on its own. */
export const profileUpdateRenderer: PayloadRenderer = {
  perItem: true,
  title: 'Requested changes',
  initialVerdicts: (row) =>
    Object.fromEntries(
      changesOf(row).map((c) => [c.field, 'approved' as ItemOutcome]),
    ),
  summary: (row) =>
    changesOf(row)
      .map((c) => labelForChange(c))
      .join(', '),
  Body,
}
