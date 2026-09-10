import {
  Award,
  Briefcase,
  CalendarClock,
  ClipboardList,
  FileText,
  GraduationCap,
  Home,
  IdCard,
  School,
  TrendingUp,
  User,
  Users,
  type LucideIcon,
} from 'lucide-react'

import type { ModuleColor } from '@/lib/modules'
import type { ProfileGroupView } from '@/lib/student-profile'

export interface ProfileGroupMeta {
  icon: LucideIcon
  color: ModuleColor
}

/**
 * Icon + accent for each profile group on the Profile hub. Keys mirror
 * `PROFILE_GROUPS` in nucleus-server's `src/student/profile/profile-fields.ts`;
 * the server filters them by entry type, so a student sees a subset.
 *
 * Kept in step with nucleus-mobile's `lib/profile-groups.ts` — same hues, so a
 * student sees the same colour for "Home address" on both clients.
 */
export const PROFILE_GROUP_META: Record<string, ProfileGroupMeta> = {
  personal: { icon: User, color: 'blue' },
  admission: { icon: GraduationCap, color: 'violet' },
  academic: { icon: TrendingUp, color: 'emerald' },
  certifications: { icon: Award, color: 'amber' },
  parent: { icon: Users, color: 'rose' },
  address: { icon: Home, color: 'cyan' },
  gov_ids: { icon: IdCard, color: 'violet' },
  entrance: { icon: ClipboardList, color: 'orange' },
  gap: { icon: CalendarClock, color: 'amber' },
  tenth: { icon: School, color: 'cyan' },
  twelfth: { icon: School, color: 'cyan' },
  diploma: { icon: School, color: 'cyan' },
  placement: { icon: Briefcase, color: 'emerald' },
}

/** Used when the server adds a group this build doesn't know about yet. */
export const PROFILE_GROUP_FALLBACK: ProfileGroupMeta = {
  icon: FileText,
  color: 'blue',
}

export function profileGroupMeta(key: string): ProfileGroupMeta {
  return PROFILE_GROUP_META[key] ?? PROFILE_GROUP_FALLBACK
}

/**
 * Per-group completeness. The server's `completeness` block is global, so the
 * hub cards derive their own counts from the fields it already sent.
 */
export function groupCounts(group: ProfileGroupView): {
  required: number
  filled: number
  pending: boolean
} {
  const mandatory = group.fields.filter((f) => f.mandatory)
  return {
    required: mandatory.length,
    filled: mandatory.filter((f) => !!f.display).length,
    pending: group.fields.some((f) => f.pending),
  }
}
