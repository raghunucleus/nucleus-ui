import { useEffect, useRef, useState } from 'react'
import { PartyPopper } from 'lucide-react'

/**
 * Festive fixed palette — deliberately not theme tokens so the confetti stays
 * vivid in both light and dark mode.
 */
const CONFETTI_COLORS = [
  '#f43f5e',
  '#f59e0b',
  '#10b981',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#f97316',
  '#22d3ee',
]

const DURATION_MS = 5200
const REDUCED_DURATION_MS = 2600
const FADE_MS = 400
const PARTICLE_COUNT = 160

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  color: string
  rotation: number
  spin: number
  /** ms after start at which this particle launches. */
  delay: number
  launched: boolean
}

function makeParticles(width: number, height: number): Particle[] {
  const particles: Particle[] = []
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    // Alternate two "cannons" at the bottom corners firing toward the centre.
    const fromLeft = i % 2 === 0
    const angle =
      (fromLeft ? -Math.PI / 3 : (-2 * Math.PI) / 3) +
      (Math.random() - 0.5) * (Math.PI / 5)
    const speed = (0.55 + Math.random() * 0.45) * Math.min(width, 900) * 0.02
    particles.push({
      x: fromLeft ? -10 : width + 10,
      y: height * (0.75 + Math.random() * 0.2),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: 5 + Math.random() * 5,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      rotation: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 0.3,
      delay: Math.random() * 1200,
      launched: false,
    })
  }
  return particles
}

/**
 * A full-screen, self-dismissing celebration: two confetti cannons plus a
 * congratulations card. Auto-dismisses after ~5s; click anywhere to skip.
 * Honors `prefers-reduced-motion` by showing only the (static) card, briefly.
 */
export function CelebrationOverlay({
  title,
  subtitle,
  onDone,
}: {
  title: string
  subtitle: string | null
  onDone: () => void
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const onDoneRef = useRef(onDone)
  useEffect(() => {
    onDoneRef.current = onDone
  }, [onDone])
  const [leaving, setLeaving] = useState(false)
  const [reduced] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )

  useEffect(() => {
    const total = reduced ? REDUCED_DURATION_MS : DURATION_MS
    const leaveTimer = window.setTimeout(() => setLeaving(true), total - FADE_MS)
    const doneTimer = window.setTimeout(() => onDoneRef.current(), total)

    let raf = 0
    const canvas = canvasRef.current
    if (!reduced && canvas) {
      const dpr = window.devicePixelRatio || 1
      const width = window.innerWidth
      const height = window.innerHeight
      canvas.width = width * dpr
      canvas.height = height * dpr
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.scale(dpr, dpr)
        const particles = makeParticles(width, height)
        const gravity = height * 0.0009
        const drag = 0.992
        const start = performance.now()
        const frame = (now: number) => {
          const elapsed = now - start
          ctx.clearRect(0, 0, width, height)
          for (const p of particles) {
            if (!p.launched) {
              if (elapsed < p.delay) continue
              p.launched = true
            }
            p.vx *= drag
            p.vy = p.vy * drag + gravity
            p.x += p.vx
            p.y += p.vy
            p.rotation += p.spin
            if (p.y > height + 20) continue
            // Fade the tail end of the show out gracefully.
            const life = Math.max(0, 1 - elapsed / (DURATION_MS - FADE_MS))
            ctx.globalAlpha = Math.min(1, life * 3)
            ctx.fillStyle = p.color
            ctx.save()
            ctx.translate(p.x, p.y)
            ctx.rotate(p.rotation)
            ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6)
            ctx.restore()
          }
          ctx.globalAlpha = 1
          if (elapsed < total) raf = requestAnimationFrame(frame)
        }
        raf = requestAnimationFrame(frame)
      }
    }

    return () => {
      window.clearTimeout(leaveTimer)
      window.clearTimeout(doneTimer)
      cancelAnimationFrame(raf)
    }
  }, [reduced])

  return (
    <div
      role="status"
      onClick={() => onDoneRef.current()}
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/25 backdrop-blur-[2px] transition-opacity duration-400 ${
        leaving ? 'opacity-0' : 'opacity-100'
      }`}
    >
      {!reduced ? (
        <style>{`
          @keyframes ncls-celebrate-pop {
            0% { opacity: 0; transform: scale(0.8) translateY(14px); }
            60% { opacity: 1; transform: scale(1.04) translateY(-2px); }
            100% { opacity: 1; transform: scale(1) translateY(0); }
          }
        `}</style>
      ) : null}
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0 h-full w-full"
      />
      <div
        className="relative mx-4 flex max-w-md flex-col items-center gap-3 rounded-xl border border-success/40 bg-card p-8 text-center shadow-xl"
        style={
          reduced
            ? undefined
            : { animation: 'ncls-celebrate-pop 500ms ease-out both' }
        }
      >
        <span className="grid size-14 place-items-center rounded-full bg-success/15 text-success">
          <PartyPopper className="size-7" />
        </span>
        <h2 className="text-xl font-bold">{title}</h2>
        {subtitle ? (
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        ) : null}
        <p className="text-xs text-muted-foreground/70">Tap anywhere to continue</p>
      </div>
    </div>
  )
}
