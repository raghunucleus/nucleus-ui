import { ChevronDown } from 'lucide-react'
import { useId, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Segmented } from '@/components/ui/segmented'
import { useDismissOnOutside } from '@/hooks/use-dismiss-on-outside'
import { cn } from '@/lib/utils'
import { DEFAULT_THRESHOLD, MAX_THRESHOLD } from './format'

/** The cut-points that get asked for: condonation floor, exam eligibility, merit. */
const PRESETS = [65, DEFAULT_THRESHOLD, 85]

const PRESET_OPTIONS = PRESETS.map((p) => ({
  value: String(p),
  label: `${p}%`,
}))

/**
 * The Defaulters cutoff.
 *
 * 75% is the exam-eligibility rule and stays the default, but a condonation
 * list is built at 65% and an awards shortlist at 85%, so the cutoff moves.
 * Filtering happens client-side over `attended`/`held`, so dragging is instant
 * — no refetch.
 *
 * Packaged as a popover rather than an inline row: a label, a slider, a
 * readout and three buttons is most of a toolbar's width spent on a control
 * that is adjusted once and then left alone. The trigger keeps the current
 * value visible, which is the part that has to stay on screen.
 */
export function ThresholdControl({
  value,
  onChange,
  className,
}: {
  value: number
  onChange: (value: number) => void
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const rootRef = useDismissOnOutside<HTMLDivElement>(open, () =>
    setOpen(false),
  )

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <Button
        type="button"
        size="sm"
        variant="outline"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'h-9 shrink-0 gap-1.5 font-normal',
          // A colourless "the cutoff has been moved" cue. The `dark:` duplicate
          // is load-bearing: `outline` carries `dark:bg-input/30`, a different
          // variant that tailwind-merge would otherwise leave standing.
          value !== DEFAULT_THRESHOLD && 'bg-muted dark:bg-muted',
        )}
      >
        <span className="text-muted-foreground">Below</span>
        <span className="font-semibold tabular-nums">{value}%</span>
        <ChevronDown className="size-4 opacity-50" />
      </Button>

      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label="Defaulter threshold"
          className="absolute left-0 z-50 mt-2 w-64 rounded-md border bg-popover p-3 text-popover-foreground shadow-md"
        >
          <div className="flex items-center justify-between">
            <label
              htmlFor="defaulter-threshold"
              className="text-xs text-muted-foreground"
            >
              Below
            </label>
            <span className="text-sm font-semibold tabular-nums">{value}%</span>
          </div>
          <input
            id="defaulter-threshold"
            type="range"
            min={0}
            max={MAX_THRESHOLD}
            step={1}
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            className="mt-2 w-full accent-primary"
            aria-label="Defaulter threshold"
            aria-valuetext={`${value} percent`}
          />
          <Segmented
            aria-label="Threshold preset"
            size="sm"
            className="mt-3 w-full"
            value={String(value)}
            onChange={(v) => onChange(Number(v))}
            options={PRESET_OPTIONS}
          />
          <p className="mt-2 text-xs text-muted-foreground">
            75% is the exam rule. Condonation lists are drawn at 65%,
            shortlists at 85%.
          </p>
        </div>
      )}
    </div>
  )
}
