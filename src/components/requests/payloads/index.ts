import type { RequestType } from '@/lib/student-requests'
import { companyApprovalRenderer } from './company-approval'
import { leaveApplyRenderer } from './leave-apply'
import { leaveCancelRenderer } from './leave-cancel'
import { profileUpdateRenderer } from './profile-update'
import type { PayloadRenderer } from './types'

export type { PayloadRenderer, PayloadRendererProps } from './types'

const RENDERERS: Record<RequestType, PayloadRenderer> = {
  profile_update: profileUpdateRenderer,
  company_approval: companyApprovalRenderer,
  leave_apply: leaveApplyRenderer,
  leave_cancel: leaveCancelRenderer,
}

/**
 * A deliberately empty body rather than a crash: a server that ships a new
 * request type before the client knows about it should still render a decidable
 * request with its header, approver pool and history intact.
 */
const FALLBACK: PayloadRenderer = {
  perItem: false,
  title: 'Request',
  summary: () => '—',
  Body: () => null,
}

export function rendererFor(type: string): PayloadRenderer {
  return RENDERERS[type as RequestType] ?? FALLBACK
}
