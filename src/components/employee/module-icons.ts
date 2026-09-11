import {
  BarChart3,
  BookOpen,
  Briefcase,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  GraduationCap,
  IdCard,
  LayoutGrid,
  type LucideIcon,
  UserCheck,
  Users,
  Wallet,
} from 'lucide-react'

/**
 * Module icon + tone lookup for the employee menu (sidebar and the Ctrl-K
 * search). The server names an icon per module (`modules.icon`); this maps
 * that name to a lucide glyph and a per-module accent colour.
 */
const ICON_MAP: Record<string, LucideIcon> = {
  BarChart3,
  BookOpen,
  CalendarDays,
  GraduationCap,
  ClipboardCheck,
  ClipboardList,
  Users,
  Wallet,
  IdCard,
  Briefcase,
  UserCheck,
  LayoutGrid,
}

export function iconFor(name: string): LucideIcon {
  return ICON_MAP[name] ?? LayoutGrid
}

// Per-module tonal styles. Tailwind v4 needs the full class strings to appear
// verbatim in source for JIT to emit them — hence the static map rather than
// template-string interpolation.
export type ToneName =
  | 'violet'
  | 'blue'
  | 'emerald'
  | 'amber'
  | 'rose'
  | 'cyan'
  | 'orange'

export const MODULE_TONES: Record<ToneName, { bg: string; text: string }> = {
  violet: { bg: 'bg-icon-violet/12', text: 'text-icon-violet' },
  blue: { bg: 'bg-icon-blue/12', text: 'text-icon-blue' },
  emerald: { bg: 'bg-icon-emerald/12', text: 'text-icon-emerald' },
  amber: { bg: 'bg-icon-amber/14', text: 'text-icon-amber' },
  rose: { bg: 'bg-icon-rose/12', text: 'text-icon-rose' },
  cyan: { bg: 'bg-icon-cyan/12', text: 'text-icon-cyan' },
  orange: { bg: 'bg-icon-orange/12', text: 'text-icon-orange' },
}

const ICON_TONE: Record<string, ToneName> = {
  BarChart3: 'violet',
  BookOpen: 'violet',
  CalendarDays: 'cyan',
  GraduationCap: 'blue',
  ClipboardCheck: 'emerald',
  ClipboardList: 'amber',
  Users: 'cyan',
  Wallet: 'amber',
  IdCard: 'rose',
  Briefcase: 'orange',
  UserCheck: 'rose',
  LayoutGrid: 'blue',
}

export function toneFor(icon: string): ToneName {
  return ICON_TONE[icon] ?? 'blue'
}
