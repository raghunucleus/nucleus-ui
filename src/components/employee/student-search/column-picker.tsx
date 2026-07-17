import { useEffect, useRef, useState } from 'react'
import { Columns3 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { SearchMeta } from '@/lib/student-search'
import { IMPLICIT_COLUMN_LABELS } from '@/lib/student-search'
import { cn } from '@/lib/utils'

const MAX_COLUMNS = 40

/**
 * Popover checkbox list of selectable attributes, grouped as the registry
 * groups them. Implicit columns (id / roll number / name) are pinned — every
 * result carries them, so they render checked and disabled.
 */
export function ColumnPicker({
  meta,
  columns,
  onChange,
}: {
  meta: SearchMeta
  columns: string[]
  onChange: (columns: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const selectable = meta.attributes.filter((a) => a.selectable)
  const atLimit = columns.length >= MAX_COLUMNS

  const toggle = (key: string) =>
    onChange(
      columns.includes(key)
        ? columns.filter((c) => c !== key)
        : [...columns, key],
    )

  return (
    <div ref={rootRef} className="relative">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <Columns3 className="size-4" />
        Columns
        <span className="text-xs text-muted-foreground">
          {columns.length}
        </span>
      </Button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 max-h-80 w-72 overflow-y-auto rounded-md border bg-popover p-2 text-popover-foreground shadow-lg">
          <div className="mb-1 px-1 text-[11px] uppercase tracking-wide text-muted-foreground">
            Always included
          </div>
          {meta.implicitColumns.map((key) => (
            <label
              key={key}
              className="flex cursor-not-allowed items-center gap-2 rounded px-1.5 py-1 text-sm opacity-60"
            >
              <input type="checkbox" checked disabled className="accent-primary" />
              {IMPLICIT_COLUMN_LABELS[key] ?? key}
            </label>
          ))}
          {meta.groups.map((g) => {
            const inGroup = selectable.filter((a) => a.group === g.key)
            if (inGroup.length === 0) return null
            return (
              <div key={g.key}>
                <div className="mb-1 mt-2 px-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                  {g.label}
                </div>
                {inGroup.map((a) => {
                  const on = columns.includes(a.key)
                  const disabled = !on && atLimit
                  return (
                    <label
                      key={a.key}
                      className={cn(
                        'flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-accent',
                        disabled && 'cursor-not-allowed opacity-50',
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={on}
                        disabled={disabled}
                        onChange={() => toggle(a.key)}
                        className="accent-primary"
                      />
                      {a.label}
                    </label>
                  )
                })}
              </div>
            )
          })}
          {atLimit ? (
            <p className="mt-2 px-1 text-[11px] text-muted-foreground">
              Column limit reached ({MAX_COLUMNS}).
            </p>
          ) : null}
        </div>
      )}
    </div>
  )
}
