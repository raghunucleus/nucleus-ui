import { useSearch } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

import { NoAccessEmptyState } from '@/components/employee/empty-states'
import { CompanyDetail } from '@/components/corporate-relations/company-detail'
import { useScreenAccess } from '@/hooks/use-screen-access'
import { CompanyList } from './corporate-relations-company-management'

const SCREEN_KEY = 'corporate_relations.companies.view'
const BASE_ROUTE = '/corporate-relations/companies'

/**
 * Responsible-officer surface. Reuses the same CompanyList + CompanyDetail as
 * the manager screen, but on the `companies` API surface (scoped server-side to
 * the officer's own companies) and with company fields read-only. Screen access
 * implies recording, so interactions/milestones/contacts are editable while the
 * master record is not.
 */
export default function EmployeeCompaniesPage() {
  useEffect(() => {
    document.title = 'Companies — Nucleus'
  }, [])

  const access = useScreenAccess(SCREEN_KEY)
  const search = useSearch({ strict: false }) as { open?: number; tab?: string }
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [initialTab, setInitialTab] = useState<string | undefined>()

  // Reopen a company from `?open=<id>` (optionally `&tab=`) and strip the params.
  // The Drives-tab → drive detail → Back round-trip returns here as
  // `?open=<id>&tab=drives`.
  useEffect(() => {
    if (search.open) {
      setSelectedId(search.open)
      setInitialTab(typeof search.tab === 'string' ? search.tab : undefined)
      window.history.replaceState({}, '', BASE_ROUTE)
    }
    // Run once on mount for the incoming redirect only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!access) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <NoAccessEmptyState />
      </div>
    )
  }

  if (selectedId !== null) {
    return (
      <div className="mx-auto h-full max-w-5xl">
        <CompanyDetail
          surface="companies"
          companyId={selectedId}
          canEditCompany={false}
          canRecord={access.actions.includes('view')}
          canEditDetails
          nameEditable={false}
          onBack={() => setSelectedId(null)}
          initialTab={initialTab}
        />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">My Companies</h1>
        <p className="text-sm text-muted-foreground">
          The companies assigned to you. Record interactions and keep the
          relationship up to date.
        </p>
      </div>
      <CompanyList
        surface="companies"
        onOpen={(id) => {
          setInitialTab(undefined)
          setSelectedId(id)
        }}
        showFilters
      />
    </div>
  )
}
