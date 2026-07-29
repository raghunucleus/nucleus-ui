import {
  Briefcase,
  Building2,
  ClipboardList,
  LayoutGrid,
  UserRound,
  type LucideIcon,
} from 'lucide-react'

import type { CatalogModule } from '@/lib/student-requests'

/**
 * Same shape as employee-portal-layout's ICON_MAP: the server sends an icon
 * NAME, and only names listed here resolve — an unknown one falls back rather
 * than crashing the panel. Add new names as request modules ship.
 */
const ICON_MAP: Record<string, LucideIcon> = {
  UserRound,
  ClipboardList,
  LayoutGrid,
  Briefcase,
  Building2,
}

export function iconFor(name: string): LucideIcon {
  return ICON_MAP[name] ?? LayoutGrid
}

/**
 * The icon of the module a request TYPE belongs to, already rendered — the
 * inbox's fallback thumbnail for types that supply no avatar of their own.
 * Returns the element rather than the component so callers never bind a
 * dynamically-chosen component to a name in their render body.
 */
export function renderModuleIcon(
  catalog: CatalogModule[],
  type: string,
  className: string,
) {
  const owner = catalog.find((m) => m.types.some((t) => t.type === type))
  const Icon = iconFor(owner?.icon ?? '')
  return <Icon className={className} />
}
