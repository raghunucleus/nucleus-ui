import { useEffect } from 'react'
import { Building } from 'lucide-react'

import ComingSoon from '@/components/employee/coming-soon'
import { NoAccessEmptyState } from '@/components/employee/empty-states'
import { useScreenAccess } from '@/hooks/use-screen-access'

const SCREEN_KEY = 'corporate_relations.companies.view'

export default function EmployeeCompaniesPage() {
  useEffect(() => {
    document.title = 'Companies — Nucleus'
  }, [])

  const access = useScreenAccess(SCREEN_KEY)
  if (!access) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <NoAccessEmptyState />
      </div>
    )
  }

  return (
    <ComingSoon
      title="Companies"
      subtitle="View the companies assigned to you."
      icon={Building}
    />
  )
}
