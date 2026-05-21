import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const spinnerVariants = cva(
  'inline-block shrink-0 animate-spin rounded-full border-current border-t-transparent',
  {
    variants: {
      size: {
        sm: 'size-4 border-2',
        default: 'size-6 border-2',
        lg: 'size-8 border-[3px]',
        xl: 'size-12 border-4',
      },
    },
    defaultVariants: {
      size: 'default',
    },
  },
)

export interface SpinnerProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof spinnerVariants> {
  /** Accessible label announced by screen readers. Defaults to "Loading". */
  label?: string
}

/**
 * A token-driven spinning indicator. The ring inherits the current text color
 * via `border-current`, so set its color with a text utility:
 *
 *   <Spinner size="lg" className="text-primary" />
 */
function Spinner({ className, size, label = 'Loading', ...props }: SpinnerProps) {
  return (
    <span
      data-slot="spinner"
      role="status"
      aria-label={label}
      className={cn(spinnerVariants({ size }), className)}
      {...props}
    />
  )
}

export { Spinner }
