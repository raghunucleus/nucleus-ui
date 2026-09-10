import { useEffect, useRef, useState } from 'react'
import { GoogleLogin, type CredentialResponse } from '@react-oauth/google'

import { Button } from '@/components/ui/button'

type Props = {
  label?: string
  /** Text in the "or" rule above the button. */
  dividerLabel?: string
  disabled?: boolean
  onSuccess: (idToken: string) => void
  onError: (message: string) => void
  /** Shown when Google returns a response with no credential. */
  noCredentialMessage?: string
  /** Shown when Google's own flow reports a failure. */
  failedMessage?: string
}

/**
 * "Sign in with Google", styled like the rest of the form.
 *
 * Google renders its button inside a cross-origin iframe that cannot be themed
 * with CSS, so it never matches our inputs. We draw our own button and lay the
 * real one on top of it, invisible — `opacity-0` still receives clicks — so
 * Google owns the click and the ID-token flow while the user sees our styling.
 */
export function GoogleSignInButton({
  label = 'Sign in with Google',
  dividerLabel = 'or',
  disabled,
  onSuccess,
  onError,
  noCredentialMessage = 'Google sign-in did not return a credential. Please try again.',
  failedMessage = 'Google sign-in failed. Please try again.',
}: Props) {
  const wrapper = useRef<HTMLDivElement>(null)
  // Google's button takes a pixel width, so it has to be measured rather than
  // guessed — the old hardcoded 384 stopped matching the column the moment the
  // form's width or the root font-size changed.
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const el = wrapper.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      setWidth(Math.round(entry.contentRect.width))
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  function handleSuccess(credential: CredentialResponse) {
    if (!credential.credential) {
      onError(noCredentialMessage)
      return
    }
    onSuccess(credential.credential)
  }

  return (
    <>
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase tracking-wider">
          <span className="bg-background px-3 text-muted-foreground">
            {dividerLabel}
          </span>
        </div>
      </div>

      <div ref={wrapper} className="relative" aria-busy={disabled}>
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="w-full gap-3"
          disabled={disabled}
          tabIndex={-1}
          aria-hidden
        >
          <GoogleMark className="size-4" />
          {label}
        </Button>

        {/* Rendered only once the wrapper has been measured: Google refuses a
            width of 0 and would fall back to its own default size. */}
        {width > 0 && (
          <div className="absolute inset-0 opacity-0 [&_iframe]:!h-full [&_iframe]:!w-full [&>div]:!h-full [&>div]:!w-full">
            <GoogleLogin
              onSuccess={handleSuccess}
              onError={() => onError(failedMessage)}
              useOneTap={false}
              size="large"
              text="signin_with"
              width={String(width)}
            />
          </div>
        )}
      </div>
    </>
  )
}

/**
 * Multi-colour Google "G". The four brand colours are exempt from theming —
 * they're Google's, not ours — so they live as `--google-*` tokens in
 * index.css and are applied here as `fill-google-*` utilities rather than as
 * hex literals in the markup.
 */
function GoogleMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        className="fill-google-blue"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"
      />
      <path
        className="fill-google-green"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
      />
      <path
        className="fill-google-yellow"
        d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.07H2.18a11 11 0 0 0 0 9.87l3.66-2.84z"
      />
      <path
        className="fill-google-red"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
      />
    </svg>
  )
}
