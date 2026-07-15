import { useEffect } from 'react'
import { Building2 } from 'lucide-react'

import ComingSoon from '@/components/employee/coming-soon'
import { NoAccessEmptyState } from '@/components/employee/empty-states'
import { useScreenAccess } from '@/hooks/use-screen-access'

const SCREEN_KEY = 'corporate_relations.company_management.manage'

export default function EmployeeCompanyManagementPage() {
  useEffect(() => {
    document.title = 'Company Management — Nucleus'
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
    <ComingSoon
      title="Company Management"
      subtitle="Add, edit, activate/deactivate companies and assign employees."
      icon={Building2}
    />
  )
}
