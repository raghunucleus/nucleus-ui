import { useSearch } from '@tanstack/react-router'
import { Building2, Loader2, Plus, Search } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NoAccessEmptyState } from '@/components/employee/empty-states'
import { CompanyDetail } from '@/components/corporate-relations/company-detail'
import {
  NativeSelect,
  formatDate,
  relationshipVariant,
  titleCase,
} from '@/components/corporate-relations/bits'
import { useScreenAccess } from '@/hooks/use-screen-access'
import {
  listCompanies,
  type CompanyListItem,
} from '@/lib/corporate-relations'

const SCREEN_KEY = 'corporate_relations.company_management.manage'
const BASE_ROUTE = '/corporate-relations/company-management'

/**
 * Imperative employee-portal navigation — the dual-router setup makes the typed
 * `<Link>` reject employee-only paths. Mirrors the helper in
 * `employee-portal-layout.tsx`.
 */
function navigateTo(route: string) {
  window.history.pushState({}, '', route)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

export default function EmployeeCompanyManagementPage() {
  useEffect(() => {
    document.title = 'Company Management — Nucleus'
  }, [])

  const access = useScreenAccess(SCREEN_KEY)
  const actions = access?.actions ?? []

  const search = useSearch({ strict: false }) as { open?: number }
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  // After the full-screen create/edit form saves, it redirects back here with
  // `?open=<id>`; reopen that company's detail and strip the param so a manual
  // back/refresh doesn't re-trigger it.
  useEffect(() => {
    if (search.open) {
      setSelectedId(search.open)
      setReloadToken((n) => n + 1)
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
      <div className="mx-auto max-w-5xl">
        <CompanyDetail
          surface="management"
          companyId={selectedId}
          canEditCompany={actions.includes('edit')}
          canRecord={actions.includes('record')}
          onBack={() => setSelectedId(null)}
          onEditCompany={(c) => navigateTo(`${BASE_ROUTE}/${c.id}/edit`)}
          reloadToken={reloadToken}
        />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">
            Company Management
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage the recruiting-company catalog and assign officers.
          </p>
        </div>
        {actions.includes('create') && (
          <Button onClick={() => navigateTo(`${BASE_ROUTE}/new`)}>
            <Plus className="size-4" /> New company
          </Button>
        )}
      </div>

      <CompanyList
        surface="management"
        onOpen={(id) => setSelectedId(id)}
        reloadToken={reloadToken}
        showFilters
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Shared company list (used by both manager and officer pages)
// ---------------------------------------------------------------------------

export function CompanyList({
  surface,
  onOpen,
  reloadToken = 0,
  showFilters = false,
}: {
  surface: 'management' | 'companies'
  onOpen: (id: number) => void
  reloadToken?: number
  showFilters?: boolean
}) {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<'active' | 'inactive' | 'all'>('active')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<{
    items: CompanyListItem[]
    total: number
    limit: number
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    listCompanies(surface, { search: search || undefined, status, page })
      .then((r) => {
        if (!cancelled) setData(r)
      })
      .catch((e) => {
        if (!cancelled)
          setError(e instanceof Error ? e.message : 'Could not load companies.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [surface, search, status, page, reloadToken])

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1

  return (
    <div className="space-y-3">
      {showFilters && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-48 flex-1">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => {
                setPage(1)
                setSearch(e.target.value)
              }}
              placeholder="Search companies…"
              className="pl-8"
            />
          </div>
          <NativeSelect
            value={status}
            onChange={(e) => {
              setPage(1)
              setStatus(e.target.value as 'active' | 'inactive' | 'all')
            }}
            className="w-36"
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="all">All</option>
          </NativeSelect>
        </div>
      )}

      {loading && !data ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 size-4 animate-spin" /> Loading…
        </div>
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : !data || data.items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/20 px-6 py-14 text-center">
          <Building2 className="mb-2 size-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No companies found.</p>
        </div>
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {data.items.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onOpen(c.id)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/50"
              >
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
                    {c.name}
                    <Badge variant={relationshipVariant(c.relationship_status)}>
                      {titleCase(c.relationship_status)}
                    </Badge>
                    {!c.is_active && (
                      <Badge variant="destructive">Inactive</Badge>
                    )}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {[c.short_name, c.city].filter(Boolean).join(' · ') || '—'}
                    {c.categories.length > 0 &&
                      ` · ${c.categories.map((x) => x.name).join(', ')}`}
                  </p>
                </div>
                <div className="hidden shrink-0 text-right sm:block">
                  <p className="text-xs text-muted-foreground">
                    {c.responsible_employee?.name ?? 'Unassigned'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {c.last_engaged_on
                      ? `Engaged ${formatDate(c.last_engaged_on)}`
                      : 'No activity'}
                  </p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {data && totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {data.total} companies · page {page} / {totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
