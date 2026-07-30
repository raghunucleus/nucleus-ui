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
import {
  EMPTY_CR_VIEW_FILTERS,
  FOLLOW_UP_PRESETS,
  NO_STATUS_ID,
  TRI_STATE,
  countActiveCrViewFilters,
  followUpLabel,
  triStateLabel,
  type CrViewFilters,
} from '@/lib/cr-view-filters'

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
  crOptions,
  companyOptions,
  value,
  onChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  scope: CrViewScope
  /** Derived from the loaded rows — the only place categories exist here. */
  categoryOptions: Chip[]
  /**
   * Management View only — every CR who owns a job role. Omitted on CR View,
   * where the answer is always "you", and the facet is then not rendered at all.
   */
  crOptions?: Chip[]
  /** Management View only — the companies present in the loaded rows. */
  companyOptions?: Chip[]
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
          {(crOptions || companyOptions) && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {crOptions && (
                <FilterField label="CR (responsible person)">
                  <SearchableMultiSelect
                    options={crOptions}
                    selected={value.cr_ids}
                    onChange={(v) => patch('cr_ids', v)}
                    placeholder="Any CR"
                    noOptions="No job roles are assigned yet."
                  />
                </FilterField>
              )}
              {companyOptions && (
                <FilterField label="Company">
                  <SearchableMultiSelect
                    options={companyOptions}
                    selected={value.company_ids}
                    onChange={(v) => patch('company_ids', v)}
                    placeholder="Any company"
                    noOptions="No companies loaded."
                  />
                </FilterField>
              )}
            </div>
          )}

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
                noOptions="No categories on these companies."
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
