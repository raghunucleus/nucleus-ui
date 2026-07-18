import { useMemo, useState } from 'react'
import { ArrowLeft, CircleHelp } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import type {
  AttrKind,
  MetaAttribute,
  SearchMeta,
  SearchOperator,
} from '@/lib/student-search'
import { cn } from '@/lib/utils'

import {
  FILTER_HELP,
  type FilterExample,
  GROUP_HELP,
  OPERATOR_GLOSSARY,
} from './filter-help-content'

const KIND_LABELS: Record<AttrKind, string> = {
  string: 'Text',
  number: 'Number',
  boolean: 'Yes / No',
  date: 'Date',
  enum: 'Choice',
  fk: 'Pick from list',
}

/** Fallback prose for attributes the content map doesn't document (yet). */
function autoSummary(attr: MetaAttribute): string {
  return `Filter students by ${attr.label.toLowerCase()} (${KIND_LABELS[
    attr.kind
  ].toLowerCase()}).`
}

function formatExampleValue(value: unknown): string {
  if (value === undefined) return ''
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (Array.isArray(value)) return value.map(String).join(' and ')
  return String(value)
}

/**
 * "Help with filters": full documentation of the student-search filters,
 * merged from the live `meta` (labels, groups, operators — always current)
 * and the hand-written prose/examples in `filter-help-content.ts`.
 *
 * Two panes: a searchable grouped index on the left; on the right either the
 * overview (how filtering works, NQL, operator glossary) or one filter's
 * detail with worked examples.
 */
export function FilterHelpButton({ meta }: { meta: SearchMeta }) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  const attrByKey = useMemo(
    () => new Map(meta.attributes.map((a) => [a.key, a])),
    [meta],
  )
  const attrLabel = (key: string) => attrByKey.get(key)?.label ?? key

  // Groups in meta order, each with its filterable attributes (search-narrowed).
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    const matches = (a: MetaAttribute) => {
      if (!q) return true
      const help = FILTER_HELP[a.key]
      return (
        a.key.includes(q) ||
        a.label.toLowerCase().includes(q) ||
        (help?.summary.toLowerCase().includes(q) ?? false)
      )
    }
    return meta.groups
      .map((g) => ({
        ...g,
        attrs: meta.attributes.filter(
          (a) => a.group === g.key && a.filterable && matches(a),
        ),
      }))
      .filter((g) => g.attrs.length > 0)
  }, [meta, query])

  const selectedAttr = selected ? attrByKey.get(selected) : undefined
  const selectedHelp = selected ? FILTER_HELP[selected] : undefined

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="size-9 shrink-0"
        onClick={() => setOpen(true)}
        aria-label="Help with filters"
        title="Help with filters"
      >
        <CircleHelp className="size-4" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex h-[85vh] max-h-[85vh] w-[95vw] max-w-5xl flex-col gap-0 p-0">
          <DialogHeader className="shrink-0 border-b px-6 py-4">
            <DialogTitle>Help with filters</DialogTitle>
            <DialogDescription>
              What every filter means and how to combine them — pick a filter on
              the left, or start with the overview.
            </DialogDescription>
          </DialogHeader>

          <div className="grid min-h-0 flex-1 sm:grid-cols-[16rem_minmax(0,1fr)]">
            {/* LEFT: searchable grouped index */}
            <aside className="flex min-h-0 flex-col border-b sm:border-b-0 sm:border-r">
              <div className="shrink-0 p-3 pb-2">
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search filters…"
                />
              </div>
              <nav className="scrollbar-themed min-h-0 flex-1 overflow-y-auto px-3 pb-3">
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className={cn(
                    'mb-2 w-full rounded-md px-2 py-1.5 text-left text-sm font-medium transition-colors',
                    selected === null
                      ? 'bg-primary text-primary-foreground'
                      : 'text-foreground hover:bg-muted',
                  )}
                >
                  Overview & operators
                </button>
                {groups.map((g) => (
                  <div key={g.key} className="mb-2">
                    <div className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {g.label}
                    </div>
                    {g.attrs.map((a) => (
                      <button
                        key={a.key}
                        type="button"
                        onClick={() => setSelected(a.key)}
                        className={cn(
                          'w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors',
                          selected === a.key
                            ? 'bg-primary text-primary-foreground'
                            : 'text-foreground hover:bg-muted',
                        )}
                      >
                        {a.label}
                      </button>
                    ))}
                  </div>
                ))}
                {groups.length === 0 ? (
                  <p className="px-2 py-4 text-sm text-muted-foreground">
                    No filters match “{query.trim()}”.
                  </p>
                ) : null}
              </nav>
            </aside>

            {/* RIGHT: overview or one filter's detail */}
            <section className="scrollbar-themed min-h-0 overflow-y-auto p-6">
              {selectedAttr ? (
                <FilterDetail
                  attr={selectedAttr}
                  help={selectedHelp}
                  groupLabel={
                    meta.groups.find((g) => g.key === selectedAttr.group)
                      ?.label ?? selectedAttr.group
                  }
                  attrLabel={attrLabel}
                  onBack={() => setSelected(null)}
                />
              ) : (
                <Overview meta={meta} />
              )}
            </section>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function Overview({ meta }: { meta: SearchMeta }) {
  return (
    <div className="space-y-6 text-sm leading-relaxed">
      <section className="space-y-2">
        <h3 className="text-base font-semibold">How filtering works</h3>
        <p>
          Build conditions in the <span className="font-medium">Filters</span>{' '}
          panel — every condition must hold at the same time (they combine with
          AND). Pick a filter, an operator and a value, then press Search.
          Conditions seeded automatically (like Status is Active) are
          recommendations: you can change or remove them.
        </p>
        <p>
          The search box above the results is separate — it matches name, roll
          number, email and mobile in one go, and combines with whatever
          filters are set.
        </p>
      </section>

      <section className="space-y-2">
        <h3 className="text-base font-semibold">Query mode (NQL)</h3>
        <p>
          Switch to <span className="font-medium">Query (NQL)</span> to type
          conditions as text. NQL can do one thing the visual builder cannot:
          OR-alternatives, e.g. “60% in 12th <em>or</em> diploma”. Values are
          numbers, <code className="rounded bg-muted px-1">true</code>/
          <code className="rounded bg-muted px-1">false</code>, or quoted text
          — list values (programmes, companies…) are written by their visible
          name in quotes. End with{' '}
          <code className="rounded bg-muted px-1">ORDER BY</code> to sort.
        </p>
        <div className="space-y-1.5">
          {meta.nql.examples.map((ex) => (
            <pre
              key={ex}
              className="overflow-x-auto rounded-md bg-muted px-3 py-2 font-mono text-xs"
            >
              {ex}
            </pre>
          ))}
        </div>
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-xs">
            <tbody>
              {Object.entries(meta.nql.operators).map(([sym, op]) => (
                <tr key={sym} className="border-b last:border-b-0">
                  <td className="w-36 px-3 py-1.5 font-mono">{sym}</td>
                  <td className="px-3 py-1.5 text-muted-foreground">
                    {OPERATOR_GLOSSARY[op as SearchOperator]?.description ?? op}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-base font-semibold">Operators</h3>
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-xs">
            <tbody>
              {(
                Object.entries(OPERATOR_GLOSSARY) as [
                  SearchOperator,
                  { label: string; description: string },
                ][]
              ).map(([op, g]) => (
                <tr key={op} className="border-b last:border-b-0">
                  <td className="w-36 px-3 py-1.5 font-medium">{g.label}</td>
                  <td className="px-3 py-1.5 text-muted-foreground">
                    {g.description}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">
          Numeric and date comparisons skip students with nothing recorded in
          that field — use “is empty” / “is not empty” to target those
          directly.
        </p>
      </section>

      <section className="space-y-2">
        <h3 className="text-base font-semibold">Filter groups</h3>
        <div className="space-y-1.5">
          {meta.groups.map((g) => (
            <p key={g.key}>
              <span className="font-medium">{g.label}</span>
              {GROUP_HELP[g.key] ? (
                <span className="text-muted-foreground">
                  {' '}
                  — {GROUP_HELP[g.key]}
                </span>
              ) : null}
            </p>
          ))}
        </div>
      </section>
    </div>
  )
}

function FilterDetail({
  attr,
  help,
  groupLabel,
  attrLabel,
  onBack,
}: {
  attr: MetaAttribute
  help: (typeof FILTER_HELP)[string] | undefined
  groupLabel: string
  attrLabel: (key: string) => string
  onBack: () => void
}) {
  return (
    <div className="space-y-5 text-sm leading-relaxed">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        Overview & operators
      </button>

      <div className="space-y-2">
        <h3 className="text-lg font-semibold">{attr.label}</h3>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary">{groupLabel}</Badge>
          <Badge variant="outline">{KIND_LABELS[attr.kind]}</Badge>
          {!attr.selectable ? (
            <Badge variant="outline">Filter only — not a column</Badge>
          ) : null}
          {attr.sortable ? <Badge variant="outline">Sortable</Badge> : null}
        </div>
      </div>

      <p>{help?.summary ?? autoSummary(attr)}</p>
      {help?.details ? <p>{help.details}</p> : null}
      {help?.semantics ? (
        <div className="rounded-lg border bg-muted/40 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            How it’s derived
          </p>
          <p className="mt-1">{help.semantics}</p>
        </div>
      ) : null}

      {attr.enumValues && attr.enumValues.length > 0 ? (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Possible values
          </p>
          <div className="flex flex-wrap gap-1.5">
            {attr.enumValues.map((v) => (
              <Badge key={String(v)} variant="outline">
                {attr.enumLabels?.[String(v)] ?? String(v)}
              </Badge>
            ))}
          </div>
        </div>
      ) : null}

      <div className="space-y-1.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Operators
        </p>
        <div className="flex flex-wrap gap-1.5">
          {attr.operators.map((op) => (
            <Badge
              key={op}
              variant="outline"
              title={OPERATOR_GLOSSARY[op]?.description}
            >
              {OPERATOR_GLOSSARY[op]?.label ?? op}
            </Badge>
          ))}
        </div>
      </div>

      {help?.examples && help.examples.length > 0 ? (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Examples
          </p>
          {help.examples.map((ex) => (
            <ExampleCard key={ex.title} example={ex} attrLabel={attrLabel} />
          ))}
        </div>
      ) : null}
    </div>
  )
}

function ExampleCard({
  example,
  attrLabel,
}: {
  example: FilterExample
  attrLabel: (key: string) => string
}) {
  return (
    <div className="space-y-2 rounded-lg border p-3">
      <p className="font-medium">{example.title}</p>
      {example.description ? (
        <p className="text-xs text-muted-foreground">{example.description}</p>
      ) : null}
      {example.builder.length > 0 ? (
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            In the filter builder
          </p>
          <div className="flex flex-wrap gap-1.5">
            {example.builder.map((c, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs"
              >
                <span className="font-medium">{attrLabel(c.attr)}</span>
                <span className="text-muted-foreground">
                  {OPERATOR_GLOSSARY[c.op]?.label ?? c.op}
                </span>
                {c.value !== undefined ? (
                  <span>{formatExampleValue(c.value)}</span>
                ) : null}
              </span>
            ))}
          </div>
        </div>
      ) : null}
      <div className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          As NQL
        </p>
        <pre className="overflow-x-auto rounded-md bg-muted px-3 py-2 font-mono text-xs">
          {example.nql}
        </pre>
      </div>
    </div>
  )
}
