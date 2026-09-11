import { CircleAlert, RefreshCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

export function ErrorBanner({
  message,
  retryLabel,
  onRetry,
}: {
  message: string
  retryLabel: string
  onRetry: () => void
}) {
  return (
    <Card className="flex items-start gap-3 border-destructive/30 bg-destructive/10 p-4">
      <CircleAlert className="mt-0.5 size-5 shrink-0 text-destructive" />
      <div className="flex-1 space-y-2">
        <p className="text-sm text-destructive">{message}</p>
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw />
          {retryLabel}
        </Button>
      </div>
    </Card>
  )
}
