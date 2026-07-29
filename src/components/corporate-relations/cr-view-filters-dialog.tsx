import { X } from 'lucide-react'

import {
  EnumChoiceChips,
  FilterField,
  SearchableMultiSelect,
} from '@/components/corporate-relations/bits'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { Chip, CrViewScope } from '@/lib/corporate-relations'

/**
 * Rows whose record has no status (or no record at all) render the master's
 * default status — this sentinel id lets the status facet select exactly those.
 * Safe because lookup ids are positive serials.
 */
export const NO_STATUS_ID = 0

export const FOLLOW_UP_PRESETS = [
  'any',
  'overdue',
  'today',
  'this_week',
  'this_month',
  'not_set',
] as const
export type FollowUpPreset = (typeof FOLLOW_UP_PRESETS)[number]

const FOLLOW_UP_LABELS: Record<FollowUpPreset, string> = {
  any: 'Any',
  overdue: 'Overdue',
  today: 'Today',
  this_week: 'This week',
  this_month: 'This month',
  not_set: 'Not set',
}

export const TRI_STATE = ['any', 'yes', 'no'] as const
export type TriState = (typeof TRI_STATE)[number]

const TRI_STATE_LABELS: Record<TriState, string> = {
  any: 'Any',
  yes: 'Yes',
  no: 'No',
}

/** The committed facet state. Empty arrays / 'any' = that facet is off. */
export interface CrViewFilters {
  category_ids: number[]
  relationship_type_ids: number[]
  /** May contain {@link NO_STATUS_ID} for "no status recorded". */
  status_ids: number[]
  designation_ids: number[]
  programme_ids: number[]
  location_ids: number[]
  follow_up: FollowUpPreset
  has_contacts: TriState
  has_remarks: TriState
}

export const EMPTY_CR_VIEW_FILTERS: CrViewFilters = {
  category_ids: [],
  relationship_type_ids: [],
  status_ids: [],
  designation_ids: [],
  programme_ids: [],
  location_ids: [],
  follow_up: 'any',
  has_contacts: 'any',
  has_remarks: 'any',
}

/** How many facets are active, for the Filters button / dialog badges. */
export function countActiveCrViewFilters(f: CrViewFilters): number {
  let n = 0
  if (f.category_ids.length > 0) n++
  if (f.relationship_type_ids.length > 0) n++
  if (f.status_ids.length > 0) n++
  if (f.designation_ids.length > 0) n++
  if (f.programme_ids.length > 0) n++
  if (f.location_ids.length > 0) n++
  if (f.follow_up !== 'any') n++
  if (f.has_contacts !== 'any') n++
  if (f.has_remarks !== 'any') n++
  return n
}

export function followUpLabel(p: FollowUpPreset): string {
  return FOLLOW_UP_LABELS[p]
}

export function triStateLabel(t: TriState): string {
  return TRI_STATE_LABELS[t]
}

/**
 * The CR View facet dialog. Unlike the Drives filter dialog there is no
 * draft/Apply split: filtering here is client-side over rows already in
 * memory, so committing on every click costs nothing and shows the result the
 * moment the dialog closes (or live, behind it).
 */
export function CrViewFiltersDialog({
  open,
  onOpenChange,
  scope,
  categoryOptions,
  value,
  onChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  scope: CrViewScope
  /** Derived from the loaded rows — the only place categories exist here. */
  categoryOptions: Chip[]
  value: CrViewFilters
  onChange: (f: CrViewFilters) => void
}) {
  const activeCount = countActiveCrViewFilters(value)
  const patch = <K extends keyof CrViewFilters>(
    key: K,
    v: CrViewFilters[K],
  ) => onChange({ ...value, [key]: v })

  const statusOptions: Chip[] = [
    { id: NO_STATUS_ID, name: 'No status' },
    ...scope.current_statuses,
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] w-[calc(100vw-2rem)] max-w-3xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle className="flex items-center gap-2">
            Filters
            {activeCount > 0 && <Badge variant="secondary">{activeCount}</Badge>}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FilterField label="Current status">
              <SearchableMultiSelect
                options={statusOptions}
                selected={value.status_ids}
                onChange={(v) => patch('status_ids', v)}
                placeholder="Any status"
              />
            </FilterField>
            <FilterField label="Relationship type">
              <SearchableMultiSelect
                options={scope.relationship_types}
                selected={value.relationship_type_ids}
                onChange={(v) => patch('relationship_type_ids', v)}
                placeholder="Any relationship type"
              />
            </FilterField>
            <FilterField label="Designation">
              <SearchableMultiSelect
                options={scope.designations}
                selected={value.designation_ids}
                onChange={(v) => patch('designation_ids', v)}
                placeholder="Any designation"
              />
            </FilterField>
            <FilterField label="Programme">
              <SearchableMultiSelect
                options={scope.programmes}
                selected={value.programme_ids}
                onChange={(v) => patch('programme_ids', v)}
                placeholder="Any programme"
              />
            </FilterField>
            <FilterField label="Job location">
              <SearchableMultiSelect
                options={scope.job_locations}
                selected={value.location_ids}
                onChange={(v) => patch('location_ids', v)}
                placeholder="Any location"
              />
            </FilterField>
            <FilterField label="Company category">
              <SearchableMultiSelect
                options={categoryOptions}
                selected={value.category_ids}
                onChange={(v) => patch('category_ids', v)}
                placeholder="Any category"
                noOptions="No categories on your companies."
              />
            </FilterField>
          </div>

          <FilterField label="Next follow up">
            <EnumChoiceChips
              options={FOLLOW_UP_PRESETS}
              value={value.follow_up}
              onChange={(v) => patch('follow_up', v)}
              format={followUpLabel}
            />
          </FilterField>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FilterField label="Has contacts">
              <EnumChoiceChips
                options={TRI_STATE}
                value={value.has_contacts}
                onChange={(v) => patch('has_contacts', v)}
                format={triStateLabel}
              />
            </FilterField>
            <FilterField label="Has remarks">
              <EnumChoiceChips
                options={TRI_STATE}
                value={value.has_remarks}
                onChange={(v) => patch('has_remarks', v)}
                format={triStateLabel}
              />
            </FilterField>
          </div>
        </div>

        <DialogFooter className="flex-row justify-between border-t px-6 py-4">
          <Button
            variant="ghost"
            onClick={() => onChange(EMPTY_CR_VIEW_FILTERS)}
            disabled={activeCount === 0}
          >
            <X className="size-4" /> Clear all
          </Button>
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
