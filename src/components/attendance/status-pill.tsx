import type * as React from 'react'

import {
  STATUS_PILL_CLASS,
  type AttendanceStatusKind,
} from '@/lib/attendance-status'
import { cn } from '@/lib/utils'

/** The per-session status pill, identical on every role's screen. */
export function StatusPill({
  kind,
  className,
  children,
}: {
  kind: AttendanceStatusKind
  className?: string
  children: React.ReactNode
}) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold',
        STATUS_PILL_CLASS[kind],
        className,
      )}
    >
      {children}
    </span>
  )
}
