import { apiFetch } from './api'
import { withEmployeeAuth } from './employee-auth'

/**
 * Data layer for the employee's own async export jobs ("My exports"). Jobs are
 * CREATED inside the feature that owns the data (e.g. the drive Filter tab);
 * this file only lists them and mints download URLs.
 */

export type ExportJobStatus =
  | 'pending'
  | 'processing'
  | 'ready'
  | 'failed'
  | 'expired'

export interface ExportJob {
  id: number
  source: string
  label: string
  context: Record<string, unknown> | null
  format: 'csv' | 'xlsx'
  status: ExportJobStatus
  filename: string | null
  row_count: number | null
  error: string | null
  /** ISO timestamp the download stops working (24h after completion). */
  expires_at: string | null
  created_at: string
}

export function listMyExports(): Promise<ExportJob[]> {
  return withEmployeeAuth((token) => apiFetch('/employee/exports', { token }))
}

/**
 * A short-lived presigned URL for one finished export. Throws ApiError 409
 * while still generating and 410 once failed or expired.
 */
export function getExportDownloadUrl(id: number): Promise<{ url: string }> {
  return withEmployeeAuth((token) =>
    apiFetch(`/employee/exports/${id}/download`, { token }),
  )
}
