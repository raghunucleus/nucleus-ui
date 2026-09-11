import { SlidersHorizontal } from 'lucide-react'
import { useEffect, useState } from 'react'

import LookupEditor from '@/components/employee/lookup-editor'
import PassoutYearsEditor from '@/components/employee/passout-years-editor'
import { NoAccessEmptyState } from '@/components/employee/empty-states'
import { useScreenAccess } from '@/hooks/use-screen-access'
import { PageHeader } from '@/components/ui/page-header'
import { cn } from '@/lib/utils'
import {
  LOOKUP_KINDS,
  createAttribute,
  createPassoutYear,
  listAttributes,
  listPassoutYears,
  setAttributeDefault,
  setAttributeStatus,
  setPassoutYearStatus,
  updateAttribute,
  updatePassoutYear,
  type LookupKind,
} from '@/lib/corporate-relations'

const SCREEN_KEY = 'corporate_relations.company_attributes.manage'

/** The bespoke list — its own endpoints, its own editor, no `attributes/:type`. */
const PASSOUT_YEARS = 'passout-years'

/**
 * The lists this screen configures: the passout years first — everything else
 * on the screen is recorded against them — then every parameterised lookup
 * kind. Derived from `LOOKUP_KINDS` so adding a kind server-side and in the
 * client whitelist is all it takes to show up here.
 */
const SECTIONS = [
  { key: PASSOUT_YEARS, label: 'Passout Years' },
  ...LOOKUP_KINDS,
] as const

type SectionKey = (typeof SECTIONS)[number]['key']

export default function EmployeeCompanyAttributesPage() {
  useEffect(() => {
    document.title = 'Company Attributes — Nucleus'
  }, [])

  const access = useScreenAccess(SCREEN_KEY)
  const actions = access?.actions ?? []
  const [section, setSection] = useState<SectionKey>(PASSOUT_YEARS)

  if (!access) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <NoAccessEmptyState />
      </div>
    )
  }

  const canCreate = actions.includes('create')
  const canEdit = actions.includes('edit')
  const canActivate = actions.includes('activate')

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <PageHeader
        icon={SlidersHorizontal}
        title="Company Attributes"
        subtitle="Configure the categories companies can be tagged with, the relationship types and current statuses CR View records against, and the passout years."
      />

      <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
        <nav className="flex gap-1 overflow-x-auto sm:flex-col sm:overflow-visible">
          {SECTIONS.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setSection(s.key)}
              className={cn(
                'whitespace-nowrap rounded-md px-3 py-2 text-left text-sm font-medium transition-colors',
                section === s.key
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-accent hover:text-accent-foreground',
              )}
            >
              {s.label}
            </button>
          ))}
        </nav>

        {/* key={section} remounts the editor per list, resetting its values,
            search and in-progress edits. */}
        {section === PASSOUT_YEARS ? (
          <PassoutYearsEditor
            key={section}
            load={listPassoutYears}
            create={createPassoutYear}
            save={updatePassoutYear}
            setStatus={setPassoutYearStatus}
            canCreate={canCreate}
            canEdit={canEdit}
            canActivate={canActivate}
          />
        ) : (
          <LookupEditor
            key={section}
            load={() => listAttributes(section as LookupKind)}
            create={(name) => createAttribute(section as LookupKind, { name })}
            rename={(id, name) =>
              updateAttribute(section as LookupKind, id, { name })
            }
            setStatus={(id, isActive) =>
              setAttributeStatus(section as LookupKind, id, isActive)
            }
            // Statuses alone carry a default — it is what CR View shows for a
            // (role × year) with nothing recorded, so every new passout year
            // reads as it again.
            defaultMarker={
              section === 'current-statuses'
                ? {
                    key: 'is_default',
                    label: 'Default',
                    actionLabel: 'Make default',
                    set: (id) => setAttributeDefault('current-statuses', id),
                  }
                : undefined
            }
            canCreate={canCreate}
            canEdit={canEdit}
            canActivate={canActivate}
          />
        )}
      </div>
    </div>
  )
}
