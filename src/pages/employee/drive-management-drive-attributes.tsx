import { SlidersHorizontal } from 'lucide-react'
import { useEffect, useState } from 'react'

import LookupEditor, {
  type LookupExtras,
  type LookupFlag,
  type LookupNumberField,
} from '@/components/employee/lookup-editor'
import { NoAccessEmptyState } from '@/components/employee/empty-states'
import { useScreenAccess } from '@/hooks/use-screen-access'
import { PageHeader } from '@/components/ui/page-header'
import { cn } from '@/lib/utils'
import {
  createDriveAttribute,
  listDriveAttributes,
  setDriveAttributeStatus,
  updateDriveAttribute,
  DRIVE_LOOKUP_KINDS,
  type DriveLookupKind,
  type DriveLookupValue,
} from '@/lib/drive-management'

const SCREEN_KEY = 'drive_management.drive_attributes.manage'

// Offer types are the only kind carrying flags. Mirrors the server rule — an
// offer that is neither classifies no drive.
const OFFER_FLAGS: LookupFlag[] = [
  { key: 'is_internship', label: 'Internship' },
  { key: 'is_full_time', label: 'Full time' },
]
const NO_FLAGS = 'An offer type must be an internship, a full-time role, or both.'

// Placement categories are the only kind carrying a salary band. Bounds are in
// lakhs per annum, min-inclusive / max-exclusive; a blank bound is open-ended.
const SALARY_FIELDS: LookupNumberField[] = [
  { key: 'min_lpa', label: 'Min LPA' },
  { key: 'max_lpa', label: 'Max LPA' },
]

/** Mirrors the two server rules, so a bad band never leaves the browser. */
function validateSalary(extras: LookupExtras): string | null {
  const min = extras.min_lpa as number | null
  const max = extras.max_lpa as number | null
  if (min === null && max === null) {
    return 'A placement category needs a minimum salary, a maximum salary, or both.'
  }
  if (min !== null && max !== null && min >= max) {
    return 'The minimum salary must be less than the maximum.'
  }
  return null
}

/** (null, 5) → "<5L"; (5, 10) → "5–10L"; (10, null) → "≥10L". */
function formatSalary(row: DriveLookupValue): string | null {
  const min = row.min_lpa == null ? null : Number(row.min_lpa)
  const max = row.max_lpa == null ? null : Number(row.max_lpa)
  if (min === null && max === null) return null
  if (min === null) return `<${max}L`
  if (max === null) return `≥${min}L`
  return `${min}–${max}L`
}

export default function EmployeeDriveAttributesPage() {
  useEffect(() => {
    document.title = 'Drive Attributes — Nucleus'
  }, [])

  const access = useScreenAccess(SCREEN_KEY)
  const actions = access?.actions ?? []
  const [kind, setKind] = useState<DriveLookupKind>('designations')

  if (!access) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <NoAccessEmptyState />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <PageHeader icon={SlidersHorizontal} title="Drive Attributes" />

      <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
        <nav className="flex gap-1 overflow-x-auto sm:flex-col sm:overflow-visible">
          {DRIVE_LOOKUP_KINDS.map((k) => (
            <button
              key={k.key}
              type="button"
              onClick={() => setKind(k.key)}
              className={cn(
                'whitespace-nowrap rounded-md px-3 py-2 text-left text-sm font-medium transition-colors',
                kind === k.key
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-accent hover:text-accent-foreground',
              )}
            >
              {k.label}
            </button>
          ))}
        </nav>

        {/* key={kind} remounts the editor per kind, resetting its list, search
            and in-progress edits. */}
        <LookupEditor
          key={kind}
          load={() => listDriveAttributes(kind)}
          create={(name, extras) =>
            createDriveAttribute(kind, { name, ...extras })
          }
          rename={(id, name, extras) =>
            updateDriveAttribute(kind, id, { name, ...extras })
          }
          setFlags={(id, flags) => updateDriveAttribute(kind, id, flags)}
          setStatus={(id, isActive) =>
            setDriveAttributeStatus(kind, id, isActive)
          }
          flags={kind === 'offer-types' ? OFFER_FLAGS : undefined}
          flagsMessage={NO_FLAGS}
          numberFields={
            kind === 'placement-categories' ? SALARY_FIELDS : undefined
          }
          validateExtras={
            kind === 'placement-categories' ? validateSalary : undefined
          }
          formatRow={kind === 'placement-categories' ? formatSalary : undefined}
          canCreate={actions.includes('create')}
          canEdit={actions.includes('edit')}
          canActivate={actions.includes('activate')}
        />
      </div>
    </div>
  )
}
