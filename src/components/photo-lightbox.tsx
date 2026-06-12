import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'

/**
 * Full-size photo viewer: near-black scrim, the image large and centered, the
 * person's name below. Radix handles focus trap, Escape, and overlay click.
 */
export function PhotoLightbox({
  open,
  onOpenChange,
  src,
  name,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  src: string
  name: string
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/90" />
        <DialogPrimitive.Content
          className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-1/2 left-1/2 z-50 flex max-h-[90vh] w-auto max-w-[90vw] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-3 outline-none"
          aria-describedby={undefined}
        >
          <DialogPrimitive.Title className="sr-only">
            {name}&rsquo;s photo
          </DialogPrimitive.Title>
          <img
            src={src}
            alt={name}
            className="max-h-[80vh] max-w-[90vw] rounded-xl object-contain shadow-2xl"
          />
          {/* Fixed white-on-dark: the scrim is near-black in both themes. */}
          <p className="text-sm font-semibold text-white">{name}</p>
          <DialogPrimitive.Close
            aria-label="Close photo"
            className="absolute -top-2 -right-2 grid size-9 place-items-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/25 sm:-right-12 sm:top-0"
          >
            <X className="size-5" />
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
