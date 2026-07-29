import { SlidersHorizontal } from 'lucide-react'
import { useEffect, useState } from 'react'

import LookupEditor from '@/components/employee/lookup-editor'
import PassoutYearsEditor from '@/components/employee/passout-years-editor'
import { NoAccessEmptyState } from '@/components/employee/empty-states'
import { useScreenAccess } from '@/hooks/use-screen-access'
import { cn } from '@/lib/utils'
import {
  createAttribute,
  createPassoutYear,
  listAttributes,
  listPassoutYears,
  setAttributeStatus,
  setPassoutYearStatus,
  updateAttribute,
  updatePassoutYear,
} from '@/lib/corporate-relations'

const SCREEN_KEY = 'corporate_relations.company_attributes.manage'

/**
 * The lists this screen configures. Kept separate from `LOOKUP_KINDS` (which
 * mirrors the server's parameterised `attributes/:type` whitelist) because
 * passout years have their own endpoints and their own editor.
 */
const SECTIONS = [
  { key: 'categories', label: 'Categories' },
  { key: 'passout-years', label: 'Passout Years' },
] as const

type SectionKey = (typeof SECTIONS)[number]['key']

export default function EmployeeCompanyAttributesPage() {
  useEffect(() => {
    document.title = 'Company Attributes — Nucleus'
  }, [])

  const access = useScreenAccess(SCREEN_KEY)
  const actions = access?.actions ?? []
  const [section, setSection] = useState<SectionKey>('categories')

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
      <div className="flex items-center gap-2">
        <SlidersHorizontal className="size-5 text-muted-foreground" />
        <div>
          <h1 className="text-lg font-semibold tracking-tight">
            Company Attributes
          </h1>
          <p className="text-sm text-muted-foreground">
            Configure the categories companies can be tagged with, and the
            passout years.
          </p>
        </div>
      </div>

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
        {section === 'categories' ? (
          <LookupEditor
            key={section}
            load={() => listAttributes('categories')}
            create={(name) => createAttribute('categories', { name })}
            rename={(id, name) => updateAttribute('categories', id, { name })}
            setStatus={(id, isActive) =>
              setAttributeStatus('categories', id, isActive)
            }
            canCreate={canCreate}
            canEdit={canEdit}
            canActivate={canActivate}
          />
        ) : (
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
        )}
      </div>
    </div>
  )
}
