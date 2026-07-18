import { useEffect } from 'react'

import { NoAccessEmptyState } from '@/components/employee/empty-states'
import { StudentSearchPanel } from '@/components/employee/student-search/student-search-panel'
import { useScreenAccess } from '@/hooks/use-screen-access'
import { eligibilityCheckSearchApi } from '@/lib/drive-management'
import type { SearchGroup } from '@/lib/student-search'

const SCREEN_KEY = 'drive_management.eligibility_check.view'

// Module-level so the panel's boot effect (keyed on `api`) sees one stable
// adapter identity for the page's lifetime.
const API = eligibilityCheckSearchApi()

/**
 * Same recommended defaults the drive Filter tab seeds — but NOT locked here:
 * this is an exploratory tool, and "who hasn't opted in yet?" is a legitimate
 * eligibility question, so the rows delete without a confirmation.
 */
const SEEDED: SearchGroup = {
  and: [
    { attr: 'is_active', op: 'eq', value: true },
    { attr: 'allowed_by_dept_for_placements', op: 'eq', value: true },
    { attr: 'interested_in_placements_self', op: 'eq', value: true },
  ],
}

/**
 * Eligibility check — the drive Filter tab's full student search without a
 * drive. The placement cell answers "who would qualify?" questions here before
 * (or without) creating a drive; results are institution-wide and export goes
 * through the async exports framework.
 */
export default function EmployeeEligibilityCheckPage() {
  useEffect(() => {
    document.title = 'Eligibility Check — Nucleus'
  }, [])

  const access = useScreenAccess(SCREEN_KEY)

  if (!access) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <NoAccessEmptyState />
      </div>
    )
  }

  return (
    <div className="mx-auto flex h-full max-w-7xl flex-col gap-4 pb-4">
      <div className="shrink-0 pt-1">
        <h1 className="text-lg font-semibold tracking-tight">
          Eligibility Check
        </h1>
        <p className="text-sm text-muted-foreground">
          Filter the whole institution with the drive filter set — check who
          would qualify before creating a drive.
        </p>
      </div>
      <div className="min-h-0 flex-1">
        <StudentSearchPanel api={API} initialFilters={SEEDED} showFilterHelp />
      </div>
    </div>
  )
}
