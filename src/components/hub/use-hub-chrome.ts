import { useEffect } from 'react'

const TITLE = 'Nucleus — choose your portal'

/**
 * Page chrome the hub owns for as long as it is mounted:
 *
 *  - `:root[data-portal="hub"]`, which pins a dark native color-scheme and a
 *    dark root background (see index.css).
 *  - `<meta name="theme-color">`. The two static ones in index.html key off the
 *    *OS* preference, so a phone with a light OS would paint pale browser chrome
 *    above the hub's near-black page. Read from the computed custom property
 *    rather than a literal, so --hub-bg stays the only place the value lives.
 *  - The document title, matching the per-screen pattern the login pages use.
 *
 * Everything is restored on unmount. In practice the hub never unmounts, but a
 * leaked <html> attribute surviving a Fast Refresh is a confusing thing to debug.
 */
export function useHubChrome() {
  useEffect(() => {
    const root = document.documentElement
    const previousTitle = document.title

    root.setAttribute('data-portal', 'hub')
    document.title = TITLE

    const hubBg = getComputedStyle(root).getPropertyValue('--hub-bg').trim()
    // Both metas carry a media attribute; overriding either one alone would
    // still lose to the other on half the devices, so retint them together.
    const metas = Array.from(
      document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]'),
    )
    const previousColors = metas.map((meta) => meta.content)
    if (hubBg) metas.forEach((meta) => (meta.content = hubBg))

    return () => {
      root.removeAttribute('data-portal')
      document.title = previousTitle
      metas.forEach((meta, index) => (meta.content = previousColors[index]))
    }
  }, [])
}
