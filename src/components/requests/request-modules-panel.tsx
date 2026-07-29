import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CatalogModule } from '@/lib/student-requests'
import { iconFor } from './module-icons'

/** `null` = no type filter ("All requests"). */
export type TypeFilter = string | null

/**
 * The left "Modules" panel: parent module → its request types. Selecting a
 * type filters the list beside it; the status chips above are global and do
 * not recount.
 *
 * Modules start expanded — there is one module with one type today, and a
 * collapsed-by-default tree would hide the only thing in it.
 */
export function RequestModulesPanel({
  catalog,
  value,
  onChange,
  className,
}: {
  catalog: CatalogModule[]
  value: TypeFilter
  onChange: (next: TypeFilter) => void
  className?: string
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const toggleModule = (key: string) =>
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }))

  return (
    <aside
      className={cn(
        'rounded-xl border bg-card p-3',
        className,
      )}
    >
      <h2 className="px-2 py-1.5 text-sm font-semibold">Modules</h2>

      <button
        type="button"
        onClick={() => onChange(null)}
        aria-pressed={value === null}
        className={cn(
          'mt-1 w-full rounded-lg px-2 py-2 text-left text-sm transition-colors',
          'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30',
          value === null
            ? 'bg-primary/10 font-medium text-primary'
            : 'text-muted-foreground hover:bg-muted/40',
        )}
      >
        All requests
      </button>

      <div className="mt-1 space-y-0.5">
        {catalog.map((m) => {
          const Icon = iconFor(m.icon)
          const isOpen = !collapsed[m.key]
          return (
            <div key={m.key}>
              <button
                type="button"
                onClick={() => toggleModule(m.key)}
                aria-expanded={isOpen}
                className={cn(
                  'flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm font-medium transition-colors',
                  'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30',
                  'hover:bg-muted/40',
                )}
              >
                <ChevronDown
                  className={cn(
                    'size-4 shrink-0 text-muted-foreground transition-transform',
                    !isOpen && '-rotate-90',
                  )}
                />
                <Icon className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{m.label}</span>
              </button>

              {isOpen && (
                // The rail mirrors the mockup's tree connector.
                <ul className="ml-4 space-y-0.5 border-l pl-3">
                  {m.types.map((t) => (
                    <li key={t.type}>
                      <button
                        type="button"
                        onClick={() => onChange(t.type)}
                        aria-pressed={value === t.type}
                        className={cn(
                          'w-full rounded-lg px-2 py-1.5 text-left text-sm transition-colors',
                          'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30',
                          value === t.type
                            ? 'bg-primary/10 font-medium text-primary'
                            : 'text-muted-foreground hover:bg-muted/40',
                        )}
                      >
                        {t.label}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        })}
      </div>
    </aside>
  )
}
