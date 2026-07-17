import { useEffect, useState } from 'react'
import { Lock, X } from 'lucide-react'

import { NativeSelect } from '@/components/corporate-relations/bits'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { FkOption, MetaAttribute } from '@/lib/student-search'
import { cn } from '@/lib/utils'

import { AttributePicker } from './attribute-picker'
import {
  type BuilderCondition,
  OPERATOR_LABELS,
  conditionComplete,
} from './filter-model'
import { ValueInput } from './value-input'

/**
 * One filter rendered as a compact summary pill. Clicking an editable chip opens
 * a small "Edit filter" dialog (operator + value); recommended/locked defaults
 * are read-only pills whose click asks to unlock. This is the dense replacement
 * for the old stacked `ConditionEditor` rows — many chips fit where a few rows
 * did.
 *
 * The editor is a real `Dialog` (Radix-portalled above everything) rather than an
 * anchored popover: the shared `SearchableSelect` / `SearchableMultiSelect`
 * dropdowns are `absolute` and would be clipped inside the filter rail's scroll
 * box; a portalled dialog is never clipped and stacks correctly over the expand
 * modal.
 */
export function FilterChip({
  attr,
  condition,
  fkOptions,
  ensureFkOptions,
  onChange,
  onRemove,
  onUnlock,
  onAddOr,
  orAttributes,
  orGroups,
}: {
  attr: MetaAttribute | undefined
  condition: BuilderCondition
  fkOptions: Record<string, FkOption[] | undefined>
  ensureFkOptions: (lookup: string) => void
  onChange: (next: BuilderCondition) => void
  onRemove: () => void
  onUnlock: () => void
  /** When provided, the edit popover offers turning this filter into an OR set. */
  onAddOr?: (attr: MetaAttribute) => void
  orAttributes?: MetaAttribute[]
  orGroups?: { key: string; label: string }[]
}) {
  const locked = !!condition.protected
  const lookup = attr?.kind === 'fk' ? attr.fkLookup : null
  useEffect(() => {
    if (lookup) ensureFkOptions(lookup)
  }, [lookup, ensureFkOptions])

  const [open, setOpen] = useState(false)

  const pickOp = (op: BuilderCondition['op']) => {
    // Array-shaped and scalar-shaped values don't survive an operator switch.
    const shapeChanged =
      op === 'in' ||
      op === 'not_in' ||
      op === 'between' ||
      condition.op === 'in' ||
      condition.op === 'not_in' ||
      condition.op === 'between'
    onChange({
      ...condition,
      op,
      value: shapeChanged ? undefined : condition.value,
    })
  }

  const label = attr?.label ?? condition.attr
  const opLabel = OPERATOR_LABELS[condition.op]
  const hasValue = condition.op !== 'is_null' && condition.op !== 'not_null'
  const complete = conditionComplete(condition)
  const valueText = summarizeValue(attr, condition, fkOptions)

  // --- Locked / recommended default: read-only pill, click to unlock. --------
  if (locked) {
    return (
      <div className="inline-flex items-center rounded-full border border-primary/30 bg-primary/5 pr-1 text-xs">
        <button
          type="button"
          onClick={onUnlock}
          title="Recommended placement filter — click to change"
          className="flex items-center gap-1 rounded-full py-1 pl-2.5 pr-1 font-medium"
        >
          <Lock className="size-3 shrink-0 text-primary" />
          <span className="truncate">{label}</span>
          {hasValue ? (
            <span className="text-muted-foreground">{valueText}</span>
          ) : (
            <span className="text-muted-foreground">{opLabel}</span>
          )}
        </button>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${label} filter`}
          className="rounded-full p-0.5 text-muted-foreground hover:text-destructive"
        >
          <X className="size-3.5" />
        </button>
      </div>
    )
  }

  // --- Editable condition: summary pill + click-to-edit dialog. --------------
  return (
    <>
      <div
        className={cn(
          'inline-flex items-center rounded-full border bg-card pr-1 text-xs transition-colors',
          open && 'ring-2 ring-ring/50',
          !complete && 'border-dashed',
        )}
      >
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={open}
          className="flex max-w-[16rem] items-center gap-1 rounded-full py-1 pl-2.5 pr-1"
        >
          <span className="truncate font-medium">{label}</span>
          <span className="text-muted-foreground">{opLabel}</span>
          {hasValue ? (
            complete ? (
              <span className="truncate font-medium text-foreground">
                {valueText}
              </span>
            ) : (
              <span className="italic text-muted-foreground">set value…</span>
            )
          ) : null}
        </button>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${label} filter`}
          className="rounded-full p-0.5 text-muted-foreground hover:text-destructive"
        >
          <X className="size-3.5" />
        </button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{label}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <NativeSelect
              value={condition.op}
              onChange={(e) => pickOp(e.target.value as BuilderCondition['op'])}
              aria-label="Operator"
            >
              {(attr?.operators ?? []).map((op) => (
                <option key={op} value={op}>
                  {OPERATOR_LABELS[op]}
                </option>
              ))}
            </NativeSelect>
            {attr && hasValue ? (
              <ValueInput
                attr={attr}
                op={condition.op}
                value={condition.value}
                onChange={(value) => onChange({ ...condition, value })}
                fkOptions={attr.fkLookup ? fkOptions[attr.fkLookup] : undefined}
              />
            ) : null}
            {onAddOr && orAttributes && orGroups ? (
              <div className="border-t pt-3">
                <AttributePicker
                  compact
                  attributes={orAttributes}
                  groups={orGroups}
                  onPick={onAddOr}
                />
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" onClick={() => setOpen(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

/** Compact human summary of a condition's value, resolving fk / enum labels. */
function summarizeValue(
  attr: MetaAttribute | undefined,
  condition: BuilderCondition,
  fkOptions: Record<string, FkOption[] | undefined>,
): string {
  const { op, value } = condition
  if (op === 'is_null' || op === 'not_null') return ''
  if (value === null || value === undefined || value === '') return '…'

  const opts = attr?.fkLookup ? fkOptions[attr.fkLookup] : undefined
  const one = (v: unknown): string => {
    if (v === null || v === undefined || v === '') return '…'
    if (typeof v === 'boolean') return v ? 'Yes' : 'No'
    if (attr?.kind === 'fk') {
      return opts?.find((o) => o.id === v)?.label ?? String(v)
    }
    return attr?.enumLabels?.[String(v)] ?? String(v)
  }

  if (Array.isArray(value)) {
    if (op === 'between') return `${one(value[0])}–${one(value[1])}`
    return value.map(one).join(', ')
  }
  return one(value)
}
