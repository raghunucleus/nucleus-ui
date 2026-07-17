import {
  Award,
  Bell,
  Building2,
  Cake,
  CalendarDays,
  ClipboardList,
  ContactRound,
  FileDown,
  IdCard,
  Megaphone,
  UserRound,
  type LucideIcon,
} from 'lucide-react'

import type { ModuleColor } from './modules'
import type { EmployeeNotificationModuleKey } from './employee-notifications'

/**
 * Per-module icon + accent for employee notifications. Hoisted so the bell and
 * the full page render the same row identically — the student side duplicates
 * its equivalent map across both files, which is exactly the drift this avoids.
 */
export const MODULE_META: Record<
  EmployeeNotificationModuleKey,
  { icon: LucideIcon; color: ModuleColor }
> = {
  requests: { icon: ClipboardList, color: 'orange' },
  attendance: { icon: ContactRound, color: 'emerald' },
  timetable: { icon: CalendarDays, color: 'blue' },
  'exam-marks': { icon: Award, color: 'amber' },
  birthdays: { icon: Cake, color: 'rose' },
  'id-card': { icon: IdCard, color: 'cyan' },
  profile: { icon: UserRound, color: 'violet' },
  'corporate-relations': { icon: Building2, color: 'blue' },
  announcements: { icon: Megaphone, color: 'orange' },
  exports: { icon: FileDown, color: 'cyan' },
}

/** A module the server knows about but this build doesn't — render it plainly. */
export const FALLBACK_META = { icon: Bell, color: 'violet' as ModuleColor }

export function metaFor(module: EmployeeNotificationModuleKey) {
  return MODULE_META[module] ?? FALLBACK_META
}
