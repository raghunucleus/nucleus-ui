import { ChevronLeft, ChevronRight } from 'lucide-react'

import { Button } from '@/components/ui/button'

/**
 * Compute the windowed list of page tokens to render.
 * Numbers are 1-based; `'…'` marks an elided gap. Always keeps the first and
 * last page, plus a small window around the current page.
 */
function pageWindow(page: number, totalPages: number): (number | '…')[] {
  // Few enough pages to show them all — no ellipsis needed.
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1)
  }
  const tokens: (number | '…')[] = [1]
  const start = Math.max(2, page - 1)
  const end = Math.min(totalPages - 1, page + 1)
  if (start > 2) tokens.push('…')
  for (let p = start; p <= end; p++) tokens.push(p)
  if (end < totalPages - 1) tokens.push('…')
  tokens.push(totalPages)
  return tokens
}

/**
 * Numbered pager with Prev/Next and an ellipsised page-number window.
 * Presentational only — the parent owns `page` state and refetches on change.
 */
export function Pagination({
  page,
  totalPages,
  onPage,
}: {
  page: number
  totalPages: number
  onPage: (page: number) => void
}) {
  if (totalPages <= 1) return null

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="outline"
        size="sm"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
        aria-label="Previous page"
      >
        <ChevronLeft className="size-4" />
        Prev
      </Button>
      {pageWindow(page, totalPages).map((token, i) =>
        token === '…' ? (
          <span
            key={`gap-${i}`}
            className="px-1.5 text-sm text-muted-foreground select-none"
          >
            …
          </span>
        ) : (
          <Button
            key={token}
            variant={token === page ? 'default' : 'outline'}
            size="sm"
            className="min-w-9"
            aria-current={token === page ? 'page' : undefined}
            onClick={() => onPage(token)}
          >
            {token}
          </Button>
        ),
      )}
      <Button
        variant="outline"
        size="sm"
        disabled={page >= totalPages}
        onClick={() => onPage(page + 1)}
        aria-label="Next page"
      >
        Next
        <ChevronRight className="size-4" />
      </Button>
    </div>
  )
}
