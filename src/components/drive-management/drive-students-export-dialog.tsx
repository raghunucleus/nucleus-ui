import * as React from 'react'

import { ExportColumnsDialog } from '@/components/employee/student-search/export-columns-dialog'
import type {
  DriveStudentsExportApi,
  DriveStudentsExportBody,
  DriveStudentsExportColumn,
} from '@/lib/drive-management'
import type { ExportFormat } from '@/lib/student-search'

/**
 * The drive Students tab export — {@link ExportColumnsDialog} bound to the
 * drive's roster endpoints, replaying the tab's live filters so the file
 * matches the screen.
 *
 * Shared by the Drive Management and Placement Coordinator drive-detail
 * screens; only `api` differs, so scoping stays entirely server-side.
 */

const STORAGE_KEY = 'drive-students-export-columns'

export function DriveStudentsExportDialog({
  open,
  onOpenChange,
  api,
  filters,
  total,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  api: DriveStudentsExportApi
  /** The tab's live filter state — replayed so the file matches the screen. */
  filters: Omit<DriveStudentsExportBody, 'columns' | 'format'>
  /** Row count under those filters, for the footer hint. */
  total: number
}) {
  const loadColumns = React.useCallback(() => api.columns(), [api])
  const submit = React.useCallback(
    (columns: string[], format: ExportFormat) =>
      api.create({ ...filters, columns, format }),
    [api, filters],
  )

  return (
    <ExportColumnsDialog
      open={open}
      onOpenChange={onOpenChange}
      loadColumns={loadColumns}
      submit={submit}
      storageKey={STORAGE_KEY}
      total={total}
      csvNote="CSV shows the resume link as a raw URL"
    />
  )
}

export type { DriveStudentsExportColumn }
