import type { ReactNode } from 'react'

import type { ApprovalRow } from '@/lib/employee-requests'
import type { ItemOutcome } from '@/lib/student-requests'

/**
 * A request's payload is opaque to the Approvals screen — its shape belongs to
 * the type that produced it. Each type registers a renderer here so the screen
 * stays type-agnostic: it owns the chrome (header, approver pool, timeline,
 * decision dialogs) and the renderer owns the body.
 */
export interface PayloadRendererProps {
  /** The list row — always present, so the body renders without a fetch. */
  row: ApprovalRow
  /**
   * The enriched detail once loaded (presigned URLs live only here). Prefer it
   * when present; the item keys are identical either way.
   */
  detail: ApprovalRow | null
  /** False on a decided request and in the requester's own view. */
  editable: boolean
  verdicts: Record<string, ItemOutcome>
  setVerdicts: (next: Record<string, ItemOutcome>) => void
  /** Type-specific approver edits, sent with the decision. */
  overrides: Record<string, unknown>
  setOverrides: (next: Record<string, unknown>) => void
}

export interface PayloadRenderer {
  /**
   * Whether the type supports per-item verdicts. `false` types are approved or
   * rejected whole, and the screen renders explicit Approve/Reject buttons
   * instead of deriving a plan from per-field toggles.
   */
  perItem: boolean
  /** Seed for the per-item verdict map (item key → outcome). */
  initialVerdicts?: (row: ApprovalRow) => Record<string, ItemOutcome>
  /** Seed for the approver's edits. */
  initialOverrides?: (row: ApprovalRow) => Record<string, unknown>
  /** One-line summary for the inbox table's "Request" cell. */
  summary: (row: ApprovalRow) => string
  /**
   * Thumbnail for the inbox table's leading cell — a company logo, say. Rows
   * without one fall back to the module's icon, so this is optional.
   */
  Avatar?: (props: { row: ApprovalRow }) => ReactNode
  /** Heading above the body panel. */
  title: string
  Body: (props: PayloadRendererProps) => ReactNode
}
