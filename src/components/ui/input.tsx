import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

/**
 * Heights match the Button scale so an input and the button beside (or under)
 * it are never a few pixels apart:
 *   default → h-9, pairs with `<Button size="default">`
 *   lg      → h-10, pairs with `<Button size="lg">` (auth forms use this)
 * An icon overlaid inside the field must be sized to match — `w-9`/`pr-9` in a
 * default input, `w-10`/`pr-10` in a large one.
 */
const inputVariants = cva(
  [
    'flex w-full rounded-md border border-input bg-background text-sm shadow-xs',
    'placeholder:text-muted-foreground',
    'transition-[color,box-shadow,border-color] outline-none',
    'focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40',
    'disabled:cursor-not-allowed disabled:opacity-50',
    'aria-invalid:border-destructive aria-invalid:ring-destructive/20',
    'file:border-0 file:bg-transparent file:text-sm file:font-medium',
    // Browser autofill paints its own background/text color, which clashes
    // with our themed input. WebKit ignores `background-color` on autofilled
    // fields, so repaint with an inset box-shadow (composes with the focus
    // ring via Tailwind's --tw-shadow var) and override the text + caret.
    'autofill:shadow-[inset_0_0_0_1000px_var(--background)]',
    'autofill:[-webkit-text-fill-color:var(--foreground)] autofill:[caret-color:var(--foreground)]',
  ].join(' '),
  {
    variants: {
      inputSize: {
        default: 'h-9 px-3 py-1',
        lg: 'h-10 px-3 py-1',
      },
    },
    defaultVariants: {
      inputSize: 'default',
    },
  },
)

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement>,
    VariantProps<typeof inputVariants> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, inputSize, ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      data-slot="input"
      className={cn(inputVariants({ inputSize }), className)}
      {...props}
    />
  ),
)
Input.displayName = 'Input'

export { Input }
