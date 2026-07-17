import { ArrowRight, Check, ExternalLink, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  changeCertificateUrl,
  changeFromText,
  changeToText,
  labelForChange,
  type ProfileUpdateChange,
} from '@/lib/student-requests'

/**
 * The requested `from → to` diff, with each field's outcome once decided.
 * Shared by both portals so a student sees exactly which fields were rejected
 * in a mixed decision — not just the request's overall status. V2 payloads
 * carry pre-rendered `display` text (FK names, unit summaries); V1 legacy
 * payloads fall back to the raw values.
 */
export function RequestChanges({
  changes,
  className,
}: {
  changes: ProfileUpdateChange[]
  className?: string
}) {
  if (changes.length === 0) {
    return (
      <p className={cn('text-sm text-muted-foreground', className)}>
        No changes recorded on this request.
      </p>
    )
  }

  return (
    <ul className={cn('space-y-2', className)}>
      {changes.map((c) => {
        // Presigned link — the server attaches it in detail views only.
        const certificateUrl = changeCertificateUrl(c)
        return (
          <li
            key={c.field}
            className="rounded-lg border bg-card px-3 py-2 text-sm"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-muted-foreground">
                {labelForChange(c)}
              </span>
              {c.outcome && (
                <span
                  className={cn(
                    'inline-flex items-center gap-1 text-xs font-medium',
                    c.outcome === 'approved'
                      ? 'text-success'
                      : 'text-destructive',
                  )}
                >
                  {c.outcome === 'approved' ? (
                    <Check className="size-3" />
                  ) : (
                    <X className="size-3" />
                  )}
                  {c.outcome === 'approved' ? 'Approved' : 'Rejected'}
                </span>
              )}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="text-muted-foreground line-through">
                {changeFromText(c)}
              </span>
              <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="font-medium break-all">{changeToText(c)}</span>
            </div>
            {certificateUrl && (
              <a
                href={certificateUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                <ExternalLink className="size-3" /> View certificate
              </a>
            )}
          </li>
        )
      })}
    </ul>
  )
}
