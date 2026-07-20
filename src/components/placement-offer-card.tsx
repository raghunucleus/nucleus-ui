import { ChevronRight } from 'lucide-react'

import {
  CompanyBadge,
  formatPlacementDate,
} from '@/components/placement-invite'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import {
  offerPackageSummary,
  type PlacementDriveRecord,
} from '@/lib/student-placements'

/**
 * One selection on the My Offers tab: the role and the actual offered package,
 * not the advertised drive bands. Legacy selections (recorded before the
 * package was captured) fall back to a "will be updated" line.
 */
export function PlacementOfferCard({
  record: r,
  onOpen,
}: {
  record: PlacementDriveRecord
  onOpen: (driveId: number) => void
}) {
  const sel = r.selection
  const pkg = sel ? offerPackageSummary(sel) : null
  return (
    <Card className="overflow-hidden border-success/50 bg-success/5">
      <button
        type="button"
        onClick={() => onOpen(r.drive_id)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-success/10"
      >
        <CompanyBadge name={r.company.name} logoUrl={r.company.logo_url} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2 text-sm font-semibold">
            <span className="truncate">{r.drive_name}</span>
            <Badge variant="success">Selected</Badge>
          </span>
          <span className="mt-0.5 block truncate text-sm font-medium">
            {sel?.designation
              ? `${sel.designation} · ${r.company.name}`
              : r.company.name}
          </span>
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
            {pkg ?? 'Package details will be updated by the placement cell'}
            {r.outcome_marked_at
              ? ` · Offered ${formatPlacementDate(r.outcome_marked_at)}`
              : ''}
          </span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
      </button>
    </Card>
  )
}
