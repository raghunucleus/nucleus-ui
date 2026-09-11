import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

import { Textarea } from '@/components/corporate-relations/bits'
import type { SearchMeta } from '@/lib/student-search'

/**
 * Free-form NQL query editor: a textarea plus a collapsible cheat-sheet built
 * from the server meta (operator table + runnable examples). Server-side
 * parse errors surface through the panel's error banner; this stays dumb.
 */
export function NqlEditor({
  meta,
  value,
  onChange,
}: {
  meta: SearchMeta
  value: string
  onChange: (value: string) => void
}) {
  const [showHelp, setShowHelp] = useState(false)

  return (
    <div className="space-y-2">
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        className="min-h-24 font-mono text-xs"
      />
      <button
        type="button"
        onClick={() => setShowHelp((s) => !s)}
        className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        {showHelp ? (
          <ChevronDown className="size-3.5" />
        ) : (
          <ChevronRight className="size-3.5" />
        )}
        Syntax help
      </button>
      {showHelp ? (
        <div className="space-y-3 rounded-lg border bg-muted/30 p-3 text-xs">
          <div>
            <p className="mb-1.5 font-semibold">Operators</p>
            <div className="flex flex-wrap gap-1.5">
              {Object.keys(meta.nql.operators).map((op) => (
                <code
                  key={op}
                  className="rounded bg-background px-1.5 py-0.5 font-mono"
                >
                  {op}
                </code>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1.5 font-semibold">Examples</p>
            <ul className="space-y-1">
              {meta.nql.examples.map((ex) => (
                <li key={ex}>
                  <button
                    type="button"
                    onClick={() => onChange(ex)}
                    className="rounded bg-background px-1.5 py-0.5 text-left font-mono hover:bg-accent"
                  >
                    {ex}
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <p className="text-muted-foreground">
            Combine with AND / OR and parentheses; names work for lookups
            (programmes, states, …); add <code>ORDER BY</code> to sort.
          </p>
        </div>
      ) : null}
    </div>
  )
}
