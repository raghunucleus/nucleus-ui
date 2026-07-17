import { lazy, Suspense, type ComponentProps } from 'react'

import { cn } from '@/lib/utils'

/**
 * The heavy Lexical {@link RichTextEditor} is the biggest dependency in the app.
 * This wrapper loads it on demand (a separate chunk) so Lexical stays out of the
 * initial bundle — mount it anywhere you'd mount the editor, with the same props.
 *
 * Read-only *display* should use `RichTextView` instead, which needs no Lexical
 * at all; this lazy editor is only for composing/editing.
 *
 * Import THIS, never `./rich-text-editor` directly — a static import anywhere in
 * the app pulls Lexical back into the initial bundle and quietly undoes the split.
 */
const RichTextEditorLazy = lazy(() =>
  import('./rich-text-editor').then((m) => ({ default: m.RichTextEditor })),
)

export type { RichTextValue } from './rich-text-editor'

export function LazyRichTextEditor(
  props: ComponentProps<typeof RichTextEditorLazy>,
) {
  return (
    <Suspense fallback={<EditorSkeleton />}>
      <RichTextEditorLazy {...props} />
    </Suspense>
  )
}

/** Holds the editor's footprint while its chunk loads, so layout doesn't jump. */
function EditorSkeleton() {
  return (
    <div
      className={cn('w-full animate-pulse rounded-md border bg-muted/50', 'h-36')}
      aria-hidden
    />
  )
}
