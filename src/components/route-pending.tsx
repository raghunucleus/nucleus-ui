import { NucleusLoader } from '@/components/brand'

/**
 * Suspense fallback for a route whose page chunk is still downloading. Every
 * page is a `lazyRouteComponent`, so this is what the router paints inside the
 * portal chrome (sidebar/header stay mounted) on a cold deep link or a slow
 * navigation — never a full-screen splash.
 */
export function RoutePending() {
  return (
    <div className="flex flex-1 items-center justify-center py-24">
      <NucleusLoader size={48} />
    </div>
  )
}
