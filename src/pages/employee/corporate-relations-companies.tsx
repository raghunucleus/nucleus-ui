import { useEffect, useState } from 'react'

import { NoAccessEmptyState } from '@/components/employee/empty-states'
import { CompanyDetail } from '@/components/corporate-relations/company-detail'
import { useScreenAccess } from '@/hooks/use-screen-access'
import { CompanyList } from './corporate-relations-company-management'

const SCREEN_KEY = 'corporate_relations.companies.view'

/**
 * Responsible-officer surface. Reuses the same CompanyList + CompanyDetail as
 * the manager screen, but on the `companies` API surface (scoped server-side to
 * the officer's own companies) and with company fields read-only — only the
 * `record` action is honoured, so interactions/milestones/contacts are
 * editable while the master record is not.
 */
export default function EmployeeCompaniesPage() {
  useEffect(() => {
    document.title = 'Companies — Nucleus'
  }, [])

  const access = useScreenAccess(SCREEN_KEY)
  const [selectedId, setSelectedId] = useState<number | null>(null)

  if (!access) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <NoAccessEmptyState />
      </div>
    )
  }

  if (selectedId !== null) {
    return (
      <div className="mx-auto max-w-5xl">
        <CompanyDetail
          surface="companies"
          companyId={selectedId}
          canEditCompany={false}
          canRecord={access.actions.includes('record')}
          onBack={() => setSelectedId(null)}
        />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">My Companies</h1>
        <p className="text-sm text-muted-foreground">
          The companies assigned to you. Record interactions and keep the
          relationship up to date.
        </p>
      </div>
      <CompanyList surface="companies" onOpen={(id) => setSelectedId(id)} showFilters />
    </div>
  )
}
