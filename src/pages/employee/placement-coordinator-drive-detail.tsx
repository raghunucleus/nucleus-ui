import { useParams } from '@tanstack/react-router'
import {
  ArrowLeft,
  Briefcase,
  Building2,
  CalendarDays,
  Clock,
  Globe,
  IndianRupee,
  LayoutDashboard,
  Mail,
  MapPin,
  Phone,
  ScrollText,
  Tags,
  Users,
  Wallet,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import {
  CompanyLogo,
  TabBar,
  type TabDef,
} from '@/components/corporate-relations/bits'
import { DriveEligibilitySummary } from '@/components/drive-management/drive-eligibility-summary'
import { DriveStatusHistory } from '@/components/drive-management/drive-status-history'
import {
  DriveStudentGroupHeaderRow,
  DriveStudentsFilterPanel,
  DriveStudentsFilterToggle,
  DriveStudentsGroupBySelect,
} from '@/components/drive-management/drive-students-filter-bar'
import {
  IconBondFact,
  IconFact,
  IconMoneyFact,
} from '@/components/drive-management/facts'
import {
  formatPlacementDate,
  formatPlacementDateTime,
} from '@/components/placement-invite'
import { NoAccessEmptyState } from '@/components/employee/empty-states'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { RichTextView } from '@/components/ui/rich-text/rich-text-view'
import { Input } from '@/components/ui/input'
import { Pagination } from '@/components/ui/pagination'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useScreenAccess } from '@/hooks/use-screen-access'
import { ApiError } from '@/lib/api'
import { employeeNavigateTo } from '@/lib/employee-navigate'
import {
  DRIVE_STATUS_LABELS,
  DRIVE_STUDENT_STATUS,
  DRIVE_STUDENT_STATUS_BADGE,
  DRIVE_STUDENT_STATUS_LABELS,
  EMPTY_DRIVE_STUDENTS_FILTERS,
  buildDriveStudentDisplayItems,
  countDriveStudentsFilters,
  readDriveStudentsFiltersOpen,
  writeDriveStudentsFiltersOpen,
  companyWebsiteHref,
  companyWebsiteLabel,
  driveStatusVariant,
  type DriveDetail,
  type DriveStudentRow,
  type DriveStudentsFilterOptions,
  type DriveStudentsFilters,
  type EligibilitySummary,
} from '@/lib/drive-management'
import {
  getCoordinatorDrive,
  getCoordinatorDriveEligibilitySummary,
  getCoordinatorDriveStudentActivity,
  getCoordinatorDriveStudentProfile,
  getCoordinatorDriveStudentTrack,
  getCoordinatorDriveStudentsFilterOptions,
  listCoordinatorDriveStudents,
} from '@/lib/placement-coordinator'
import {
  DriveStudentDetailSheet,
  type DriveStudentDetailApi,
} from '@/components/employee/drive-student-detail-sheet'
import { cn } from '@/lib/utils'

/**
 * Placement Coordinator > Drive detail — the READ-ONLY counterpart of the
 * Drive Management detail page. No status control, no edit/delete, no student
 * lifecycle actions; the Students tab lists only the students within the
 * coordinator's programme/passout-year scope (server-enforced). Out-of-scope
 * drive ids 404 server-side and land in the error state here.
 */

const SCREEN_KEY = 'placement_coordinator.drives.view'
const LIST_ROUTE = '/placement-coordinator/drives'

function errMsg(e: unknown, fallback: string): string {
  return e instanceof ApiError || e instanceof Error ? e.message : fallback
}

const TABS: TabDef[] = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'students', label: 'Students', icon: Users },
]

export default function EmployeePlacementCoordinatorDriveDetailPage() {
  const access = useScreenAccess(SCREEN_KEY)

  const params = useParams({ strict: false }) as { driveId?: string }
  const driveId = params.driveId ? Number(params.driveId) : null

  const [drive, setDrive] = useState<DriveDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [tab, setTab] = useState('overview')

  useEffect(() => {
    document.title = 'Drive — Placement Coordinator — Nucleus'
  }, [])

  useEffect(() => {
    if (driveId === null) return
    let cancelled = false
    setLoading(true)
    getCoordinatorDrive(driveId)
      .then((d) => {
        if (cancelled) return
        setDrive(d)
        setLoadError(null)
      })
      .catch((e: unknown) => {
        if (!cancelled) setLoadError(errMsg(e, 'Could not load the drive.'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [driveId])

  if (!access) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <NoAccessEmptyState />
      </div>
    )
  }
  if (loading || !drive) {
    return (
      <div className="mx-auto max-w-4xl rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
        {loadError ?? 'Loading…'}
      </div>
    )
  }

  return (
    <div className="mx-auto flex h-full max-w-7xl flex-col gap-4 pb-4">
      <div className="shrink-0 space-y-3 pt-1">
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => employeeNavigateTo(LIST_ROUTE)}
          >
            <ArrowLeft className="size-4" /> Back
          </Button>
          <CompanyLogo
            name={drive.company.name}
            logoUrl={drive.company.logo_url}
            className="size-10 shrink-0"
          />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-semibold tracking-tight">
              {drive.drive_name}
            </h1>
            <p className="truncate text-sm text-muted-foreground">
              {drive.company.name}
            </p>
            {drive.company.website ? (
              <a
                href={companyWebsiteHref(drive.company.website)}
                target="_blank"
                rel="noreferrer noopener"
                className="mt-0.5 inline-flex max-w-full items-center gap-1 text-xs text-icon-blue hover:underline"
              >
                <Globe className="size-3 shrink-0" />
                <span className="truncate">
                  {companyWebsiteLabel(drive.company.website)}
                </span>
              </a>
            ) : null}
          </div>

          <Badge variant={driveStatusVariant(drive.status)}>
            {DRIVE_STATUS_LABELS[drive.status]}
          </Badge>
        </div>

        <TabBar tabs={TABS} active={tab} onChange={setTab} />
      </div>

      <div className="scrollbar-themed min-h-0 flex-1 overflow-y-auto">
        {tab === 'overview' && <OverviewTab drive={drive} />}
        {tab === 'students' && <StudentsTab driveId={drive.id} />}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------

/**
 * The Overview tab — the same read-only summary as the manage screen: key
 * facts, classifiers, each designation with its JD and attachments, the
 * eligibility criteria and the status history.
 */
function OverviewTab({ drive }: { drive: DriveDetail }) {
  const [eligibility, setEligibility] = useState<EligibilitySummary | null>(null)

  useEffect(() => {
    let cancelled = false
    getCoordinatorDriveEligibilitySummary(drive.id)
      .then((e) => {
        if (!cancelled) setEligibility(e)
      })
      .catch(() => {
        // A failed eligibility load shouldn't blank the whole overview.
        if (!cancelled) setEligibility(null)
      })
    return () => {
      cancelled = true
    }
  }, [drive.id])

  return (
    <div className="mx-auto grid max-w-6xl gap-5 pb-6 lg:grid-cols-3 lg:items-start">
      {/* Main column */}
      <div className="space-y-5 lg:col-span-2">
        {/* Key facts */}
        <Card className="p-4">
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <IconFact
              icon={CalendarDays}
              label="Drive date"
              value={formatPlacementDate(drive.drive_date)}
            />
            <IconFact
              icon={Clock}
              label="Register by"
              value={formatPlacementDateTime(drive.registration_end_date)}
            />
            {drive.offer_type ? (
              <IconFact
                icon={Briefcase}
                label="Offer type"
                value={drive.offer_type.name}
              />
            ) : null}
            {drive.job_locations.length > 0 ? (
              <IconFact
                icon={MapPin}
                label="Job locations"
                value={drive.job_locations.map((l) => l.name).join(', ')}
              />
            ) : null}
            <IconMoneyFact
              icon={Wallet}
              label="Stipend"
              mode={drive.stipend_mode}
              min={drive.stipend_min}
              max={drive.stipend_max}
            />
            <IconMoneyFact
              icon={IndianRupee}
              label="CTC"
              mode={drive.ctc_mode}
              min={drive.ctc_min}
              max={drive.ctc_max}
            />
            <IconBondFact
              icon={ScrollText}
              hasBond={drive.has_bond}
              bondYears={drive.bond_years}
            />
            {drive.placement_categories.length > 0 ? (
              <IconFact
                icon={Tags}
                label="Placement categories"
                value={drive.placement_categories.map((c) => c.name).join(', ')}
              />
            ) : null}
            {drive.company_categories.length > 0 ? (
              <IconFact
                icon={Building2}
                label="Company categories"
                value={drive.company_categories.map((c) => c.name).join(', ')}
              />
            ) : null}
            {drive.spoc_email ? (
              <IconFact icon={Mail} label="SPOC email" value={drive.spoc_email} />
            ) : null}
            {drive.spoc_contact ? (
              <IconFact
                icon={Phone}
                label="SPOC contact"
                value={drive.spoc_contact}
              />
            ) : null}
          </dl>
          {drive.bond_desc ? (
            <div className="mt-3 border-t pt-3">
              <p className="mb-1 text-xs font-medium text-muted-foreground">
                Bond details
              </p>
              <RichTextView value={drive.bond_desc} className="text-sm" />
            </div>
          ) : null}
        </Card>

        {/* Eligibility */}
        {eligibility ? <DriveEligibilitySummary summary={eligibility} /> : null}

        {/* Designations */}
        {drive.profiles.map((p) => (
          <Card key={p.id} className="p-4">
            <h2 className="mb-3 text-sm font-semibold">{p.designation.name}</h2>
            <dl className="mb-3 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
              {p.offer_type ? (
                <IconFact
                  icon={Briefcase}
                  label="Offer type"
                  value={p.offer_type.name}
                />
              ) : null}
              {p.job_locations.length > 0 ? (
                <IconFact
                  icon={MapPin}
                  label="Job locations"
                  value={p.job_locations.map((l) => l.name).join(', ')}
                />
              ) : null}
              <IconMoneyFact
                icon={Wallet}
                label="Stipend"
                mode={p.stipend_mode}
                min={p.stipend_min}
                max={p.stipend_max}
              />
              <IconMoneyFact
                icon={IndianRupee}
                label="CTC"
                mode={p.ctc_mode}
                min={p.ctc_min}
                max={p.ctc_max}
              />
              <IconBondFact
                icon={ScrollText}
                hasBond={p.has_bond}
                bondYears={p.bond_years}
              />
            </dl>
            {p.jd ? (
              <div className="border-t pt-3">
                <p className="mb-1 text-xs font-medium text-muted-foreground">
                  Job description
                </p>
                <RichTextView value={p.jd} className="text-sm" />
              </div>
            ) : null}
            {p.attachments.length > 0 ? (
              <div className="mt-3 border-t pt-3">
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                  Attachments
                </p>
                <div className="flex flex-wrap gap-2">
                  {p.attachments.map((a) => (
                    <a
                      key={a.id}
                      href={a.file_url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg border px-2.5 py-1 text-xs font-medium hover:bg-accent"
                    >
                      {a.file_name}
                    </a>
                  ))}
                </div>
              </div>
            ) : null}
          </Card>
        ))}
      </div>

      {/* Status history sidebar */}
      <Card className="p-4">
        <h2 className="mb-3 text-sm font-semibold">Status history</h2>
        <DriveStatusHistory history={drive.status_history} />
      </Card>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Students tab — read-only, scoped to the coordinator's students
// ---------------------------------------------------------------------------

/** "Designation · CTC ₹6,00,000 LPA · Stipend ₹25,000 – ₹30,000/month" for a
 *  Selected row; null when nothing was recorded (legacy selections). */
/** The coordinator surface's scope-checked fetchers for the detail sheet. */
const coordinatorStudentDetailApi: DriveStudentDetailApi = {
  getProfile: getCoordinatorDriveStudentProfile,
  getDriveActivity: getCoordinatorDriveStudentActivity,
  getTrack: getCoordinatorDriveStudentTrack,
}

function selectionSummary(r: DriveStudentRow): string | null {
  const fmt = (v: string) => `₹${Number(v).toLocaleString('en-IN')}`
  const band = (main: string, min: string | null) =>
    min != null ? `${fmt(min)} – ${fmt(main)}` : fmt(main)
  const parts: string[] = []
  if (r.selected_designation) parts.push(r.selected_designation)
  if (r.ctc != null) parts.push(`CTC ${band(r.ctc, r.ctc_min)} LPA`)
  if (r.stipend != null)
    parts.push(`Stipend ${band(r.stipend, r.stipend_min)}/month`)
  return parts.length > 0 ? parts.join(' · ') : null
}

const STATUS_FILTERS: { value: number | null; label: string }[] = [
  { value: null, label: 'All' },
  ...Object.entries(DRIVE_STUDENT_STATUS_LABELS).map(([v, label]) => ({
    value: Number(v),
    label,
  })),
]

function StudentsTab({ driveId }: { driveId: number }) {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<number | null>(null)
  const [filters, setFilters] = useState<DriveStudentsFilters>(
    EMPTY_DRIVE_STUDENTS_FILTERS,
  )
  const [filterOptions, setFilterOptions] =
    useState<DriveStudentsFilterOptions | null>(null)
  // The left filter rail — remembered across visits.
  const [filtersOpen, setFiltersOpen] = useState(readDriveStudentsFiltersOpen)
  // Collapsed group keys of the grouped view.
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [rows, setRows] = useState<DriveStudentRow[] | null>(null)
  const [total, setTotal] = useState(0)
  const [pageCount, setPageCount] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [detailStudent, setDetailStudent] = useState<DriveStudentRow | null>(
    null,
  )

  // Reset to the first page (and re-expand groups) whenever a filter changes.
  useEffect(() => {
    setPage(1)
    setCollapsed(new Set())
  }, [search, statusFilter, filters])

  // Filter dropdown options (scope-trimmed server-side). Errors are non-fatal.
  useEffect(() => {
    let cancelled = false
    getCoordinatorDriveStudentsFilterOptions(driveId)
      .then((opts) => {
        if (!cancelled) setFilterOptions(opts)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [driveId])

  const grouped = filters.groupBy !== 'none'

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    listCoordinatorDriveStudents(driveId, {
      page: grouped ? 1 : page,
      pageSize: 25,
      search,
      status: statusFilter ?? undefined,
      programme_ids: filters.programmeIds,
      passout_years: filters.passoutYears,
      entry_type: filters.entryType ?? undefined,
      all: grouped || undefined,
    })
      .then((res) => {
        if (cancelled) return
        setRows(res.rows)
        setTotal(res.total)
        setPageCount(res.pageCount)
        setError(null)
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(errMsg(e, 'Could not load students.'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [driveId, page, search, statusFilter, filters, grouped])

  const anyFilterActive =
    statusFilter !== null ||
    search.trim() !== '' ||
    filters.programmeIds.length > 0 ||
    filters.passoutYears.length > 0 ||
    filters.entryType !== null
  const displayItems = useMemo(
    () => buildDriveStudentDisplayItems(rows ?? [], filters.groupBy, collapsed),
    [rows, filters.groupBy, collapsed],
  )
  const toggleGroup = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  const activeFilterCount = countDriveStudentsFilters(filters)
  const toggleFilters = () => {
    const next = !filtersOpen
    setFiltersOpen(next)
    writeDriveStudentsFiltersOpen(next)
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 py-1">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <span className="text-base font-semibold">
            {total.toLocaleString()}
          </span>
          <span className="text-sm text-muted-foreground">
            student{total === 1 ? '' : 's'}
            {statusFilter !== null
              ? ` · ${DRIVE_STUDENT_STATUS_LABELS[statusFilter]}`
              : ' in your scope'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <DriveStudentsFilterToggle
            open={filtersOpen}
            activeCount={activeFilterCount}
            onToggle={toggleFilters}
          />
          <div className="min-w-52 max-w-xs">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or roll no…"
            />
          </div>
          <DriveStudentsGroupBySelect
            value={filters.groupBy}
            onChange={(groupBy) => setFilters({ ...filters, groupBy })}
          />
        </div>
      </div>

      <div
        className={cn(
          'grid min-h-0 flex-1 gap-4',
          filtersOpen && 'lg:grid-cols-[20rem_minmax(0,1fr)]',
        )}
      >
        {filtersOpen ? (
          <DriveStudentsFilterPanel
            options={filterOptions}
            value={filters}
            onChange={setFilters}
          />
        ) : null}

        <div className="flex min-h-0 min-w-0 flex-col gap-3">
          {/* Status filter chips */}
          <div className="flex shrink-0 flex-wrap gap-1.5">
            {STATUS_FILTERS.map((f) => {
              const on = statusFilter === f.value
              return (
                <button
                  key={f.label}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setStatusFilter(f.value)}
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                    on
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'bg-card hover:bg-accent hover:text-accent-foreground',
                  )}
                >
                  {f.label}
                </button>
              )
            })}
          </div>

          {error ? (
            <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
              {error}
            </div>
          ) : loading && rows === null ? (
            <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
              Loading…
            </div>
          ) : rows && rows.length === 0 ? (
            <div className="rounded-xl border bg-card p-10 text-center text-sm text-muted-foreground">
              {anyFilterActive
                ? 'No students match the current filters.'
                : 'No students from your programmes and passout years in this drive yet.'}
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-hidden rounded-lg border">
              <Table containerClassName="h-full max-h-[62vh] overflow-y-auto scrollbar-themed lg:max-h-none">
                <TableHeader className="sticky top-0 z-10 bg-card">
                  <TableRow>
                    <TableHead>Roll number</TableHead>
                    <TableHead>Full name</TableHead>
                    <TableHead>Programme</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Imported</TableHead>
                    <TableHead>Imported by</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayItems.map((item) => {
                    if (item.kind === 'header') {
                      return (
                        <DriveStudentGroupHeaderRow
                          key={`group:${item.key}`}
                          item={item}
                          colSpan={6}
                          onToggle={() => toggleGroup(item.key)}
                        />
                      )
                    }
                    const r = item.row
                    return (
                    <TableRow
                      key={r.id}
                      className="cursor-pointer"
                      onClick={() => setDetailStudent(r)}
                    >
                      <TableCell className="whitespace-nowrap text-sm font-medium">
                        {r.roll_no}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {r.display_name}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {r.programme ?? '—'}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Badge variant={DRIVE_STUDENT_STATUS_BADGE[r.status]}>
                          {DRIVE_STUDENT_STATUS_LABELS[r.status] ?? r.status}
                        </Badge>
                        {(r.status === DRIVE_STUDENT_STATUS.DENIED ||
                          r.status === DRIVE_STUDENT_STATUS.REVOKED) &&
                        r.rejection_reason ? (
                          <p
                            className="mt-0.5 max-w-56 truncate text-xs text-muted-foreground"
                            title={r.rejection_reason}
                          >
                            {r.rejection_reason}
                          </p>
                        ) : null}
                        {r.status === DRIVE_STUDENT_STATUS.SELECTED &&
                        (r.ctc != null || r.stipend != null) ? (
                          <p
                            className="mt-0.5 max-w-64 truncate text-xs text-muted-foreground"
                            title={selectionSummary(r) ?? undefined}
                          >
                            {selectionSummary(r)}
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {new Date(r.imported_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {r.imported_by ?? '—'}
                      </TableCell>
                    </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {grouped && rows && total > rows.length ? (
            <p className="shrink-0 text-xs text-muted-foreground">
              Showing the first {rows.length.toLocaleString()} of{' '}
              {total.toLocaleString()} students — narrow the filters to group
              everything.
            </p>
          ) : null}

          {!grouped && !loading && !error && pageCount > 1 && (
            <Pagination page={page} totalPages={pageCount} onPage={setPage} />
          )}
        </div>
      </div>

      {/* Per-student detail (profile / drive activity / this drive's trail) */}
      <DriveStudentDetailSheet
        driveId={driveId}
        studentId={detailStudent?.id ?? null}
        studentName={detailStudent?.display_name}
        open={!!detailStudent}
        onOpenChange={(open) => {
          if (!open) setDetailStudent(null)
        }}
        api={coordinatorStudentDetailApi}
      />
    </div>
  )
}
