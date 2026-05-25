import {
  Award,
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  CreditCard,
  Megaphone,
  UserRound,
  type LucideIcon,
} from 'lucide-react'

/** Routes that have a live page today. */
export type ModuleRoute =
  | '/profile'
  | '/timetable'
  | '/attendance'
  | '/exam-marks'
  | '/fees'

/**
 * The icon accent palette — one hue per module. The actual colors live as
 * `--icon-*` design tokens in `src/index.css`; the maps below pair each hue
 * with ready-made Tailwind class strings.
 */
export type ModuleColor =
  | 'violet'
  | 'blue'
  | 'emerald'
  | 'amber'
  | 'rose'
  | 'cyan'
  | 'orange'

export interface Module {
  icon: LucideIcon
  title: string
  description: string
  /** Accent hue — drives the colored icon tile and the page-header badge. */
  color: ModuleColor
  /** Present once the module has a live page; absent renders "Coming soon". */
  to?: ModuleRoute
}

/**
 * Bold gradient + colored glow for a vivid app-icon tile. Pair with
 * `bg-gradient-to-br text-icon-on shadow-lg`. Spelled out in full so Tailwind
 * can statically discover every class.
 */
export const MODULE_GRADIENT: Record<ModuleColor, string> = {
  violet: 'from-icon-violet to-icon-violet/60 shadow-icon-violet/40',
  blue: 'from-icon-blue to-icon-blue/60 shadow-icon-blue/40',
  emerald: 'from-icon-emerald to-icon-emerald/60 shadow-icon-emerald/40',
  amber: 'from-icon-amber to-icon-amber/60 shadow-icon-amber/40',
  rose: 'from-icon-rose to-icon-rose/60 shadow-icon-rose/40',
  cyan: 'from-icon-cyan to-icon-cyan/60 shadow-icon-cyan/40',
  orange: 'from-icon-orange to-icon-orange/60 shadow-icon-orange/40',
}

/** Soft tinted surface + matching icon color — for calmer, secondary accents. */
export const MODULE_SOFT: Record<ModuleColor, string> = {
  violet: 'bg-icon-violet/10 text-icon-violet',
  blue: 'bg-icon-blue/10 text-icon-blue',
  emerald: 'bg-icon-emerald/10 text-icon-emerald',
  amber: 'bg-icon-amber/10 text-icon-amber',
  rose: 'bg-icon-rose/10 text-icon-rose',
  cyan: 'bg-icon-cyan/10 text-icon-cyan',
  orange: 'bg-icon-orange/10 text-icon-orange',
}

/**
 * The portal's modules, in display order. Single source of truth for both the
 * home-screen launcher grid and the app drawer.
 */
export const MODULES: Module[] = [
  {
    icon: UserRound,
    title: 'Profile',
    description: 'Your personal and academic details.',
    color: 'violet',
    to: '/profile',
  },
  {
    icon: CalendarDays,
    title: 'Timetable',
    description: 'Your day-wise class schedule.',
    color: 'blue',
    to: '/timetable',
  },
  {
    icon: ClipboardCheck,
    title: 'Attendance',
    description: 'Classes attended and percentage.',
    color: 'emerald',
    to: '/attendance',
  },
  {
    icon: Award,
    title: 'Exam marks',
    description: 'Semester grades, SGPA and CGPA.',
    color: 'amber',
    to: '/exam-marks',
  },
  {
    icon: CreditCard,
    title: 'Fees',
    description: 'Fee structure and pending dues.',
    color: 'rose',
    to: '/fees',
  },
  {
    icon: BookOpen,
    title: 'Library',
    description: 'Borrowed books and due dates.',
    color: 'cyan',
  },
  {
    icon: Megaphone,
    title: 'Announcements',
    description: 'Notices from your department.',
    color: 'orange',
  },
]