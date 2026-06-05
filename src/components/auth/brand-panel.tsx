import { GraduationCap } from 'lucide-react'

type Props = { variant: 'employee' | 'parent' | 'member' }

const COPY = {
  employee: {
    headline: 'Run your campus,\nall in one place.',
    sub: 'Tools for faculty, staff, and administrators — built for the modern institution.',
    footer: 'Faculty & staff portal',
  },
  parent: {
    headline: "Stay close to your\nchild's progress.",
    sub: 'Timetable, attendance, exam results, and holidays — everything in one place.',
    footer: 'Parent portal',
  },
  member: {
    headline: 'Your learning,\nsimplified.',
    sub: 'Classes, attendance, fees, and announcements — all in one home.',
    footer: 'Student portal',
  },
} as const

export function BrandPanel({ variant }: Props) {
  const { headline, sub, footer } = COPY[variant]

  return (
    <aside className="relative hidden overflow-hidden bg-brand-panel text-brand-panel-foreground lg:flex lg:flex-1 lg:flex-col lg:justify-between lg:p-12 xl:p-16 2xl:p-20">
      {/* Decorative orbs — purely visual, hidden from AT */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-32 -top-32 size-[28rem] rounded-full bg-brand-panel-accent/30 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 -right-24 size-[34rem] rounded-full bg-brand-panel-glow/20 blur-3xl"
      />

      <div className="relative flex items-center gap-2.5">
        <div className="grid size-10 place-items-center rounded-lg bg-brand-panel-foreground/10 ring-1 ring-brand-panel-foreground/15 backdrop-blur">
          <GraduationCap className="size-5" />
        </div>
        <span className="text-lg font-semibold tracking-tight">Nucleus</span>
      </div>

      <div className="relative space-y-5">
        <h1 className="whitespace-pre-line text-4xl font-semibold leading-[1.1] tracking-tight xl:text-5xl 2xl:text-6xl">
          {headline}
        </h1>
        <p className="max-w-lg text-base text-brand-panel-foreground/75 xl:text-lg">{sub}</p>
      </div>

      <div className="relative flex items-center justify-between text-xs text-brand-panel-foreground/60">
        <span>&copy; {new Date().getFullYear()} Nucleus</span>
        <span className="hidden sm:inline">{footer}</span>
      </div>
    </aside>
  )
}
