/**
 * The hub's ambient background: three slowly drifting colour orbs — one per
 * portal, in that portal's own hue — under a vignette and a film-grain layer.
 *
 * Purely decorative and hidden from assistive tech. `overflow-hidden` here clips
 * art that is *meant* to bleed past the viewport; it is not papering over a
 * responsive layout overflow.
 */
export function HubBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      {/* Negative animation-delays start each orb partway through the same
          22s cycle, so they drift independently without three keyframe sets. */}
      <div
        data-hub-orb
        className="absolute -left-40 -top-52 size-[36rem] rounded-full bg-hub-role-member/25 blur-3xl animate-hub-drift"
      />
      <div
        data-hub-orb
        className="absolute -right-40 top-1/3 size-[32rem] rounded-full bg-hub-role-employee/15 blur-3xl animate-hub-drift [animation-delay:-7s]"
      />
      <div
        data-hub-orb
        className="absolute -bottom-56 left-1/4 size-[34rem] rounded-full bg-hub-role-parent/12 blur-3xl animate-hub-drift [animation-delay:-14s]"
      />

      <div className="hub-vignette absolute inset-0" />

      {/* Oversized so the grain's own jitter never exposes an untextured edge.
          Static on phones: repainting a full viewport of noise every 0.9s is the
          most expensive thing on this page and the least visible at that size. */}
      <div className="hub-grain absolute -inset-1/2 max-sm:animate-none" />
    </div>
  )
}
