import * as React from 'react'
import { ArrowDown, ArrowUp, GripVertical, Lock, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

export interface CrViewColumnDef {
  key: string
  label: string
  /** Locked columns cannot be hidden or moved — Company, which is pinned. */
  locked?: boolean
}

/**
 * Column picker + order editor for the CR View table — the same two-pane shape
 * as the export columns dialog: the catalog on the left, the ORDERED visible
 * set on the right, reorderable by drag and by arrow buttons (arrows matter:
 * they are the only keyboard-reachable path). Differences: no column cap, the
 * catalog is a static registry rather than a fetch, locked columns pin to the
 * front, and there is a reset to the default layout.
 *
 * Controlled: `value` is the visible keys in display order (locked keys
 * included, always first); Apply emits the edited array and the PAGE persists
 * it — the dialog owns no storage.
 */
export function CrViewColumnsDialog({
  open,
  ...props
}: {
  open: boolean
  /** The full registry, in default order. */
  columns: CrViewColumnDef[]
  /** Currently visible keys, in display order. */
  value: string[]
  /** What Reset restores — every column, registry order. */
  defaultValue: string[]
  onOpenChange: (open: boolean) => void
  onApply: (keys: string[]) => void
}) {
  // Unmounted while closed, so each open MOUNTS fresh and the draft seeds in
  // a plain useState initializer — no seed-on-open effect, and Cancel needs no
  // explicit revert.
  if (!open) return null
  return <ColumnsDialogBody {...props} />
}

function ColumnsDialogBody({
  columns,
  value,
  defaultValue,
  onOpenChange,
  onApply,
}: {
  columns: CrViewColumnDef[]
  value: string[]
  defaultValue: string[]
  onOpenChange: (open: boolean) => void
  onApply: (keys: string[]) => void
}) {
  const locked = React.useMemo(
    () => columns.filter((c) => c.locked).map((c) => c.key),
    [columns],
  )
  const byKey = React.useMemo(
    () => new Map(columns.map((c) => [c.key, c])),
    [columns],
  )

  /** The MOVABLE visible keys, in order — locked ones are prepended on Apply. */
  const [draft, setDraft] = React.useState<string[]>(() =>
    value.filter((k) => !columns.some((c) => c.key === k && c.locked)),
  )

  const toggle = (key: string) =>
    setDraft((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    )

  const move = (from: number, to: number) =>
    setDraft((prev) => {
      if (to < 0 || to >= prev.length) return prev
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })

  // Native HTML5 drag — no dependency, and the arrow buttons cover the cases
  // dragging handles badly (long lists, keyboards, touch).
  const dragFrom = React.useRef<number | null>(null)

  const apply = () => {
    onApply([...locked, ...draft])
    onOpenChange(false)
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Columns</DialogTitle>
          <DialogDescription>
            Choose which columns show and the order they appear in.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* --- catalog ------------------------------------------------- */}
          <div className="min-w-0">
            <p className="mb-2 border-b px-1 py-1.5 text-[11px] font-semibold uppercase tracking-wide">
              All columns
            </p>
            <div className="max-h-[50vh] overflow-y-auto pr-1">
              {columns.map((c) =>
                c.locked ? (
                  <div
                    key={c.key}
                    className="flex items-center gap-2 rounded px-2 py-1 text-sm text-muted-foreground"
                  >
                    <Lock className="size-3.5 shrink-0" />
                    <span className="min-w-0 truncate">{c.label}</span>
                    <span className="ml-auto text-[11px]">always shown</span>
                  </div>
                ) : (
                  <label
                    key={c.key}
                    className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-accent"
                  >
                    <input
                      type="checkbox"
                      checked={draft.includes(c.key)}
                      onChange={() => toggle(c.key)}
                      className="accent-primary"
                    />
                    <span className="min-w-0 truncate">{c.label}</span>
                  </label>
                ),
              )}
            </div>
          </div>

          {/* --- ordered selection --------------------------------------- */}
          <div className="min-w-0">
            <div className="mb-2 flex items-baseline justify-between border-b px-1 py-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wide">
                Column order
              </span>
              <span className="text-[11px] text-muted-foreground">
                {locked.length + draft.length}/{columns.length}
              </span>
            </div>
            <div className="max-h-[50vh] space-y-1 overflow-y-auto pr-1">
              {locked.map((key) => (
                <div
                  key={key}
                  className="flex items-center gap-1 rounded border border-dashed bg-muted/40 px-1.5 py-1 text-sm text-muted-foreground"
                >
                  <Lock className="size-3.5 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">
                    {byKey.get(key)?.label ?? key}
                  </span>
                  <span className="text-[11px]">pinned</span>
                </div>
              ))}
              {draft.length === 0 ? (
                <p className="px-2 py-8 text-center text-sm text-muted-foreground">
                  Pick columns on the left. They appear here in the order the
                  table shows them.
                </p>
              ) : (
                draft.map((key, i) => (
                  <div
                    key={key}
                    draggable
                    onDragStart={() => {
                      dragFrom.current = i
                    }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault()
                      if (dragFrom.current !== null) move(dragFrom.current, i)
                      dragFrom.current = null
                    }}
                    onDragEnd={() => {
                      dragFrom.current = null
                    }}
                    className="flex items-center gap-1 rounded border bg-card px-1.5 py-1 text-sm"
                  >
                    <GripVertical className="size-3.5 shrink-0 cursor-grab text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">
                      {byKey.get(key)?.label ?? key}
                    </span>
                    <button
                      type="button"
                      onClick={() => move(i, i - 1)}
                      disabled={i === 0}
                      aria-label={`Move ${byKey.get(key)?.label ?? key} up`}
                      className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
                    >
                      <ArrowUp className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => move(i, i + 1)}
                      disabled={i === draft.length - 1}
                      aria-label={`Move ${byKey.get(key)?.label ?? key} down`}
                      className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
                    >
                      <ArrowDown className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => toggle(key)}
                      aria-label={`Hide ${byKey.get(key)?.label ?? key}`}
                      className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <DialogFooter className={cn('border-t pt-3')}>
          <Button
            variant="ghost"
            className="mr-auto"
            onClick={() =>
              setDraft(defaultValue.filter((k) => !locked.includes(k)))
            }
          >
            Reset to default
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={apply}>Apply</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
