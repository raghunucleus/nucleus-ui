import { useEffect } from 'react'

import { NoAccessEmptyState } from '@/components/employee/empty-states'
import { PageHeader } from '@/components/ui/page-header'
import { StudentSearchPanel } from '@/components/employee/student-search/student-search-panel'
import { useScreenAccess } from '@/hooks/use-screen-access'
import { studentsDirectorySearchApi } from '@/lib/students-directory'

const SCREEN_KEY = 'students.directory.view'

// Module-level so the panel's boot effect (keyed on `api`) sees one stable
// adapter identity for the page's lifetime.
const API = studentsDirectorySearchApi()

/**
 * The raw database id — always returned, never useful here, and it would sit
 * left of the roll number and scroll out from under the pinned column.
 */
const HIDE_COLUMNS = ['id']

/**
 * Student directory — the registry-driven student search, scoped server-side
 * to the departments / programmes / admission years / sections this employee's
 * role grants. Search-only: no import, and export goes through the async
 * exports framework.
 */
export default function EmployeeStudentsDirectoryPage() {
  useEffect(() => {
    document.title = 'Student directory — Nucleus'
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
      <PageHeader
        className="shrink-0"
        title="Student directory"
        subtitle="Search, filter and export students within your assigned scope."
      />
      <div className="min-h-0 flex-1">
        <StudentSearchPanel
          api={API}
          showFilterHelp
          hideColumns={HIDE_COLUMNS}
          stickyColumn="student_id"
        />
      </div>
    </div>
  )
}
