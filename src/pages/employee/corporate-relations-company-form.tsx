import { useParams } from '@tanstack/react-router'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'

import { NoAccessEmptyState } from '@/components/employee/empty-states'
import { CompanyForm } from '@/components/corporate-relations/company-form'
import { useScreenAccess } from '@/hooks/use-screen-access'
import {
  getAssignableEmployees,
  getCompany,
  getFormOptions,
  type AssignableEmployee,
  type CompanyDetail,
  type FormOptions,
} from '@/lib/corporate-relations'

const SCREEN_KEY = 'corporate_relations.company_management.manage'
const LIST_ROUTE = '/corporate-relations/company-management'

/**
 * Imperative employee-portal navigation — the dual-router setup makes the typed
 * `<Link>` reject employee-only paths. Mirrors the helper in
 * `employee-portal-layout.tsx` / `attendance-mark-session.tsx`.
 */
function navigateTo(route: string) {
  window.history.pushState({}, '', route)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

/**
 * Full-screen create/edit surface for a recruiting company. Reached at
 * `/corporate-relations/company-management/new` (create) and
 * `/corporate-relations/company-management/$companyId/edit` (edit). Replaces the
 * old right-side slide-over sheet — the form is dense, multi-section config and
 * belongs on its own route.
 */
export default function EmployeeCompanyFormPage() {
  const access = useScreenAccess(SCREEN_KEY)
  const actions = access?.actions ?? []

  const { companyId: rawId } = useParams({ strict: false }) as {
    companyId?: string
  }
  const editId = rawId ? Number(rawId) : null
  const isEdit = editId !== null

  const [company, setCompany] = useState<CompanyDetail | null>(null)
  const [options, setOptions] = useState<FormOptions | null>(null)
  const [employees, setEmployees] = useState<AssignableEmployee[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    document.title = isEdit
      ? 'Edit Company — Nucleus'
      : 'New Company — Nucleus'
  }, [isEdit])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    Promise.all([
      getFormOptions('management'),
      getAssignableEmployees(),
      isEdit ? getCompany('management', editId) : Promise.resolve(null),
    ])
      .then(([o, e, c]) => {
        if (cancelled) return
        setOptions(o)
        setEmployees(e)
        setCompany(c)
      })
      .catch((err) => {
        if (!cancelled)
          setError(
            err instanceof Error ? err.message : 'Could not load the form.',
          )
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [isEdit, editId])

  // Access gate: create needs `create`, edit needs `edit`.
  const requiredAction = isEdit ? 'edit' : 'create'
  if (access && !actions.includes(requiredAction)) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <NoAccessEmptyState />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      {/* Manual sticky header (not the shared <StickyHeader>): the portal
          `<main>` scroll container has `py-6`, and `sticky top-0` pins to its
          content box — 24px below the padding edge — leaving an uncovered band
          where content scrolls through. `-top-6` (= the 24px padding) pins the
          header flush under the app header; `-mt-6`+`pt-6` keeps its resting
          position while the opaque `bg-background` + `pt-6` cover the band. */}
      <div className="sticky -top-6 z-10 -mx-4 -mt-6 flex items-center gap-3 border-b bg-background px-4 pb-3 pt-6 sm:-mx-6 sm:px-6">
        <button
          type="button"
          onClick={() => navigateTo(LIST_ROUTE)}
          className="flex size-8 items-center justify-center rounded-md border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label="Back to companies"
        >
          <ArrowLeft className="size-4" />
        </button>
        <div>
          <h1 className="text-lg font-semibold tracking-tight">
            {isEdit ? 'Edit company' : 'New company'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isEdit
              ? company?.name ?? 'Update the company record.'
              : 'Add a company to the CRM.'}
          </p>
        </div>
      </div>

      {loading || !access ? (
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="mr-2 size-4 animate-spin" /> Loading…
        </div>
      ) : error || !options ? (
        <p className="text-sm text-destructive">
          {error ?? 'Could not load the form.'}
        </p>
      ) : (
        <CompanyForm
          company={company}
          options={options}
          employees={employees}
          onCancel={() => navigateTo(LIST_ROUTE)}
          onSaved={(saved) => {
            navigateTo(`${LIST_ROUTE}?open=${saved.id}`)
          }}
        />
      )}
    </div>
  )
}
