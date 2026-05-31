import { GraduationCap } from 'lucide-react'

/**
 * Animated empty state for the exam-results screen — shown when the student has
 * no published results yet. A floating graduation cap inside pulsing rings.
 * Pure CSS (no animation library); the float keyframe is scoped inline.
 */
export function ResultsEmpty() {
  return (
    <div className="flex flex-col items-center justify-center gap-6 rounded-2xl border bg-card px-6 py-16 text-center">
      <style>{`@keyframes ncl-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}`}</style>
      <div className="relative grid size-28 place-items-center">
        <span className="absolute size-24 rounded-full bg-primary/10 motion-safe:animate-ping [animation-duration:2.6s]" />
        <span className="absolute size-28 rounded-full border border-primary/15 motion-safe:animate-pulse [animation-duration:2.6s]" />
        <div
          className="relative grid size-16 place-items-center rounded-2xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-lg"
          style={{ animation: 'ncl-float 3s ease-in-out infinite' }}
        >
          <GraduationCap className="size-8" />
        </div>
      </div>
      <div className="space-y-1.5">
        <h2 className="text-lg font-semibold">No results yet</h2>
        <p className="mx-auto max-w-sm text-sm text-muted-foreground">
          Your semester results will show up here the moment the examination
          cell publishes them. Hang tight — it’ll be worth the wait.
        </p>
      </div>
    </div>
  )
}
