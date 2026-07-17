import { SlidersHorizontal } from 'lucide-react'
import { useEffect, useState } from 'react'

import LookupEditor from '@/components/employee/lookup-editor'
import { NoAccessEmptyState } from '@/components/employee/empty-states'
import { useScreenAccess } from '@/hooks/use-screen-access'
import { cn } from '@/lib/utils'
import {
  createAttribute,
  listAttributes,
  setAttributeStatus,
  updateAttribute,
  LOOKUP_KINDS,
  type LookupKind,
} from '@/lib/corporate-relations'

const SCREEN_KEY = 'corporate_relations.company_attributes.manage'

export default function EmployeeCompanyAttributesPage() {
  useEffect(() => {
    document.title = 'Company Attributes — Nucleus'
  }, [])

  const access = useScreenAccess(SCREEN_KEY)
  const actions = access?.actions ?? []
  const [kind, setKind] = useState<LookupKind>('categories')

  if (!access) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <NoAccessEmptyState />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex items-center gap-2">
        <SlidersHorizontal className="size-5 text-muted-foreground" />
        <div>
          <h1 className="text-lg font-semibold tracking-tight">
            Company Attributes
          </h1>
          <p className="text-sm text-muted-foreground">
            Configure the classifiers companies can be tagged with.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
        <nav className="flex gap-1 overflow-x-auto sm:flex-col sm:overflow-visible">
          {LOOKUP_KINDS.map((k) => (
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
          load={() => listAttributes(kind)}
          create={(name) => createAttribute(kind, { name })}
          rename={(id, name) => updateAttribute(kind, id, { name })}
          setStatus={(id, isActive) => setAttributeStatus(kind, id, isActive)}
          canCreate={actions.includes('create')}
          canEdit={actions.includes('edit')}
          canActivate={actions.includes('activate')}
        />
      </div>
    </div>
  )
}
