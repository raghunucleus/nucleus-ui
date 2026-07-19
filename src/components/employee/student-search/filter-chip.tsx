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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { FkOption, MetaAttribute } from '@/lib/student-search'
import { cn } from '@/lib/utils'

import { AttributePicker } from './attribute-picker'
import {
  type BuilderCondition,
  OPERATOR_LABELS,
  conditionComplete,
  formatValueLabel,
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
  expanded = false,
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
  /**
   * Roomy rendering for the expand modal: values are spelled out in full and
   * wrap over multiple lines instead of truncating behind a "+N" badge.
   */
  expanded?: boolean
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
  const { labels, full: valueFull } = summarizeValue(attr, condition, fkOptions)
  // Full, untruncated filter text — the compact pill only ever shows as much as
  // fits on one line.
  const fullText = [label, opLabel, valueFull].filter(Boolean).join(' ')

  // The expand modal has ~3.7x the rail's width, so it shows every value; the
  // compact rail shows one and hides the rest behind a "+N" badge.
  const shownValues = expanded ? labels : labels.slice(0, 1)
  const hiddenValues = expanded ? [] : labels.slice(1)
  const labelClass = expanded ? 'shrink-0' : 'max-w-[10rem] shrink-0 truncate'
  // A fixed height would clip wrapped value text.
  const pillClass = expanded ? 'min-h-7 py-0.5' : 'h-7'
  const buttonClass = expanded ? 'max-w-full' : 'max-w-[24rem]'

  // --- Locked / recommended default: read-only pill, click to unlock. --------
  if (locked) {
    return (
      <div
        className={cn(
          'inline-flex max-w-full items-center rounded-full border border-primary/30 bg-primary/5 pr-1 text-xs',
          pillClass,
        )}
      >
        <button
          type="button"
          onClick={onUnlock}
          title={`${fullText} — recommended placement filter, click to change`}
          className={cn(
            'flex min-w-0 items-center gap-1 rounded-full py-1 pl-2.5 pr-1 font-medium',
            buttonClass,
          )}
        >
          <Lock className="size-3 shrink-0 text-primary" />
          <span className={labelClass}>{label}</span>
          {hasValue ? (
            <>
              <ValueTokens values={shownValues} wrap={expanded} />
              <OverflowCount
                count={hiddenValues.length}
                hidden={hiddenValues}
              />
            </>
          ) : (
            <span className="shrink-0 whitespace-nowrap text-muted-foreground">
              {opLabel}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${label} filter`}
          className="shrink-0 rounded-full p-0.5 text-muted-foreground hover:text-destructive"
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
          'inline-flex max-w-full items-center rounded-full border bg-card pr-1 text-xs transition-colors',
          pillClass,
          open && 'ring-2 ring-ring/50',
          !complete && 'border-dashed',
        )}
      >
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={open}
          title={fullText}
          className={cn(
            'flex min-w-0 items-center gap-1 rounded-full py-1 pl-2.5 pr-1',
            buttonClass,
          )}
        >
          <span className={cn(labelClass, 'font-medium')}>{label}</span>
          <span className="shrink-0 whitespace-nowrap text-muted-foreground">
            {opLabel}
          </span>
          {hasValue ? (
            complete ? (
              <>
                <ValueTokens values={shownValues} wrap={expanded} />
                <OverflowCount
                  count={hiddenValues.length}
                  hidden={hiddenValues}
                />
              </>
            ) : (
              <span className="shrink-0 whitespace-nowrap italic text-muted-foreground">
                set value…
              </span>
            )
          ) : null}
        </button>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${label} filter`}
          className="shrink-0 rounded-full p-0.5 text-muted-foreground hover:text-destructive"
        >
          <X className="size-3.5" />
        </button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{label}</DialogTitle>
            {labels.length > 1 ? (
              <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                <span className="shrink-0">{opLabel}</span>
                <ValueTokens values={labels} wrap />
              </div>
            ) : null}
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

/**
 * A condition's selected values, one rounded token each — easier to tell apart
 * than a comma-joined string, whose separators vanish inside value names.
 *
 * Everything here is a `span`: these render inside the chip's edit `button`,
 * and a nested interactive element would be invalid HTML (same constraint as
 * `OverflowCount` below).
 *
 * `wrap` follows the surface. The compact rail is a fixed-height single line, so
 * its one token truncates; the expand modal lets tokens flow onto more lines.
 */
function ValueTokens({
  values,
  wrap = false,
  className,
}: {
  values: string[]
  wrap?: boolean
  className?: string
}) {
  if (values.length === 0) return null
  return (
    <span
      className={cn(
        'flex min-w-0 items-center gap-1',
        wrap ? 'flex-wrap' : 'flex-1',
        className,
      )}
    >
      {values.map((value, i) => (
        <span
          key={`${value}-${i}`}
          className={cn(
            'rounded bg-muted px-1.5 py-px text-[11px] font-medium text-foreground',
            wrap ? 'break-words' : 'truncate',
          )}
        >
          {value}
        </span>
      ))}
    </span>
  )
}

/**
 * "+2" badge for a multi-select chip's unshown values, listing them on hover.
 *
 * `shrink-0` is load-bearing: the value text beside it is a truncating flex
 * child, so without this the count would be the first thing clipped — exactly
 * when a long value makes it most useful.
 *
 * The trigger stays a `span`: this badge renders inside the chip's edit
 * `button`, and a nested `button` would be invalid HTML. As a span it takes
 * hover/focus for the tooltip while clicks fall through to open the editor.
 * `TooltipContent` is portalled, so unlike an anchored popover it survives the
 * filter rail's `overflow-y-auto` box (see this file's header note).
 */
function OverflowCount({ count, hidden }: { count: number; hidden: string[] }) {
  if (count <= 0) return null
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="shrink-0 rounded-full bg-muted px-1.5 text-[10px] font-medium tabular-nums text-muted-foreground">
            +{count}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p className="font-medium">Also selected</p>
          <ValueTokens values={hidden} wrap className="mt-1.5" />
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

/**
 * A condition's value as one label per selection, resolving fk / enum labels.
 *
 * The chip renders each label as its own token, so this returns the list rather
 * than a pre-joined string. `full` is the joined form, kept only for the pill's
 * native `title` attribute, which can't hold markup.
 */
function summarizeValue(
  attr: MetaAttribute | undefined,
  condition: BuilderCondition,
  fkOptions: Record<string, FkOption[] | undefined>,
): { labels: string[]; full: string } {
  const { op, value } = condition
  const one = (v: unknown) => formatValueLabel(attr, v, fkOptions)
  const single = (text: string) => ({ labels: [text], full: text })

  if (op === 'is_null' || op === 'not_null') return { labels: [], full: '' }
  if (value === null || value === undefined || value === '') return single('…')

  if (Array.isArray(value)) {
    // A range is one concept, not two selections — keep it in a single token.
    if (op === 'between') return single(`${one(value[0])}–${one(value[1])}`)
    const labels = value.map(one)
    return { labels, full: labels.join(', ') }
  }
  return single(one(value))
}
