import * as React from 'react'

import { cn } from '@/lib/utils'

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        'flex h-11 w-full rounded-md border border-input bg-background px-3.5 py-2 text-sm shadow-xs',
        'placeholder:text-muted-foreground',
        'transition-[color,box-shadow,border-color] outline-none',
        'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'aria-invalid:border-destructive aria-invalid:ring-destructive/20',
        'file:border-0 file:bg-transparent file:text-sm file:font-medium',
        // Browser autofill paints its own background/text color, which clashes
        // with our themed input. WebKit ignores `background-color` on autofilled
        // fields, so repaint with an inset box-shadow (composes with the focus
        // ring via Tailwind's --tw-shadow var) and override the text + caret.
        'autofill:shadow-[inset_0_0_0_1000px_var(--background)]',
        'autofill:[-webkit-text-fill-color:var(--foreground)] autofill:[caret-color:var(--foreground)]',
        className,
      )}
      {...props}
    />
  ),
)
Input.displayName = 'Input'

export { Input }
