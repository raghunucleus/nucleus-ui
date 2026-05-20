import * as React from 'react'

import { cn } from '@/lib/utils'

export function GoogleButton({
  className,
  children = 'Continue with Google',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex h-11 w-full items-center justify-center gap-3 rounded-md border bg-background px-4 text-sm font-medium shadow-xs',
        'transition-colors',
        'hover:bg-accent hover:text-accent-foreground',
        'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30',
        'disabled:pointer-events-none disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <GoogleMark className="size-5" />
      {children}
    </button>
  )
}

function GoogleMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden focusable="false">
      <path
        className="fill-google-blue"
        d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
      />
      <path
        className="fill-google-red"
        d="M6.3 14.7l6.6 4.8C14.6 16.2 18.9 13.5 24 13.5c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 7.1 29.6 5 24 5 16.3 5 9.7 9.5 6.3 14.7z"
      />
      <path
        className="fill-google-green"
        d="M24 44c5.4 0 10.3-2.1 14-5.4l-6.5-5.3c-2 1.4-4.5 2.2-7.5 2.2-5.2 0-9.6-3.3-11.3-8l-6.6 5.1C9.6 38.6 16.3 44 24 44z"
      />
      <path
        className="fill-google-yellow"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.3-4.1 5.8l6.5 5.3C40.6 36 44 30.5 44 24c0-1.3-.1-2.4-.4-3.5z"
      />
    </svg>
  )
}
