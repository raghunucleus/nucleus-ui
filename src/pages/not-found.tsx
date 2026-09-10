import { Link } from '@tanstack/react-router'
import {
  ArrowLeft,
  Bot,
  Compass,
  Home,
  Search as SearchIcon,
  Sparkle,
} from 'lucide-react'

import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export default function NotFound() {
  return (
    <div className="relative isolate overflow-hidden rounded-xl border bg-card shadow-sm">
      {/* Floating gradient orbs — purely decorative, slow pulse. They sit
          behind the content via z-index and don't intercept pointer events. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-32 top-12 size-80 rounded-full bg-gradient-to-br from-primary/40 to-secondary/30 blur-3xl animate-pulse [animation-duration:7s]" />
        <div className="absolute -right-32 bottom-12 size-[28rem] rounded-full bg-gradient-to-br from-secondary/30 to-primary/30 blur-3xl animate-pulse [animation-duration:9s] [animation-delay:1.5s]" />
        <div className="absolute left-1/2 -bottom-40 size-72 -translate-x-1/2 rounded-full bg-gradient-to-br from-secondary/30 to-primary/40 blur-3xl animate-pulse [animation-duration:8s] [animation-delay:3s]" />
      </div>

      {/* Soft grid overlay — fades out at the edges via radial mask so it
          doesn't fight the orbs. Border color follows the active theme. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-50 [mask-image:radial-gradient(ellipse_at_center,black_25%,transparent_75%)]"
        style={{
          backgroundImage:
            'linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      <main className="relative flex min-h-[70svh] flex-col items-center justify-center px-6 py-20 text-center">
        <div className="inline-flex animate-in fade-in slide-in-from-bottom-2 items-center gap-2 rounded-full border bg-background/70 px-3 py-1 text-xs font-medium text-muted-foreground shadow-xs backdrop-blur duration-700">
          <Compass className="size-3.5 text-primary [animation:spin_8s_linear_infinite]" />
          You took a wrong turn
        </div>

        {/* 404 hero — a floating ghost mascot above a compact gradient "404".
            Each digit owns its own gradient + clip-to-text (parent-level clip
            breaks with inline-block children) and bobs on its own phase. */}
        <div className="relative mt-8 flex flex-col items-center gap-3 animate-in fade-in zoom-in-90 duration-700">
          {/* Bot mascot — sits inside a gradient capsule that floats
              (animate-bob). Sparkles twinkle on either side and a soft
              floor shadow sells the hover illusion. */}
          <div className="relative">
            <Sparkle
              aria-hidden
              className="absolute -left-7 top-1 size-3 text-secondary animate-ping [animation-duration:2.4s]"
            />
            <Sparkle
              aria-hidden
              className="absolute -right-8 top-5 size-4 text-secondary animate-ping [animation-duration:3s] [animation-delay:0.8s]"
            />
            <div
              className="grid size-20 place-items-center rounded-3xl bg-gradient-to-br from-primary to-secondary text-primary-foreground animate-bob"
              style={{ filter: 'drop-shadow(0 10px 24px var(--primary))' }}
            >
              <Bot aria-hidden strokeWidth={1.75} className="size-12" />
            </div>
            <div
              aria-hidden
              className="mx-auto -mt-1 h-2 w-14 rounded-full bg-primary/30 blur-md animate-pulse"
            />
          </div>

          <h1
            aria-label="404 — page not found"
            className="flex items-end gap-1 font-black leading-none tracking-tight select-none text-6xl sm:text-7xl"
          >
            <span className="inline-block animate-bob bg-gradient-to-br from-primary to-secondary bg-clip-text text-transparent">
              4
            </span>
            <span className="inline-block animate-bob bg-gradient-to-br from-secondary to-primary bg-clip-text text-transparent [animation-delay:500ms]">
              0
            </span>
            <span className="inline-block animate-bob bg-gradient-to-br from-primary to-secondary bg-clip-text text-transparent [animation-delay:1000ms]">
              4
            </span>
          </h1>
        </div>

        <h2 className="mt-6 animate-in fade-in slide-in-from-bottom-3 text-2xl font-semibold tracking-tight delay-150 duration-700">
          Hmm, I couldn&rsquo;t find that page
        </h2>
        <p className="mt-3 max-w-md animate-in fade-in slide-in-from-bottom-3 text-balance text-sm text-muted-foreground delay-200 duration-700 sm:text-base">
          The link you followed may be broken, or the page may have moved.
          Let&rsquo;s get you back somewhere familiar.
        </p>

        <div className="mt-8 flex animate-in fade-in slide-in-from-bottom-3 flex-col items-stretch gap-2 delay-300 duration-700 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={() => {
              if (window.history.length > 1) window.history.back()
              else window.location.assign('/')
            }}
            className={cn(buttonVariants({ variant: 'outline' }), 'gap-2')}
          >
            <ArrowLeft className="size-4" />
            Go back
          </button>
          <Link
            to="/"
            className={cn(
              buttonVariants(),
              'gap-2 bg-gradient-to-r from-primary to-secondary text-primary-foreground shadow-md shadow-primary/30 transition-all hover:shadow-lg hover:shadow-primary/40 hover:[transform:translateY(-1px)]',
            )}
          >
            <Home className="size-4" />
            Take me home
          </Link>
        </div>

        <div className="mt-12 flex animate-in fade-in items-center gap-1.5 text-xs text-muted-foreground delay-500 duration-1000">
          <SearchIcon className="size-3.5" />
          Tip: try the menu search to find what you were looking for.
        </div>
      </main>
    </div>
  )
}
