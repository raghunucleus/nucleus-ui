import { useParams, useSearch } from '@tanstack/react-router'
import {
  ArrowLeft,
  Ban,
  BarChart3,
  BellRing,
  Briefcase,
  Building2,
  CalendarDays,
  Clock,
  Download,
  FileSpreadsheet,
  Filter,
  Globe,
  GraduationCap,
  IndianRupee,
  LayoutDashboard,
  Loader2,
  Mail,
  MapPin,
  Pencil,
  Phone,
  ScrollText,
  Send,
  Tags,
  Trash2,
  Users,
  Wallet,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import {
  CompanyLogo,
  Field,
  NativeSelect,
  SearchableMultiSelect,
  TabBar,
  type TabDef,
} from '@/components/corporate-relations/bits'
import { DriveAnalyticsTab } from '@/components/drive-management/drive-analytics'
import { DriveSelectionUploadDialog } from '@/components/drive-management/drive-selection-upload-dialog'
import { DriveStudentsExportDialog } from '@/components/drive-management/drive-students-export-dialog'
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
import {
  DriveStudentDetailSheet,
  type DriveStudentDetailApi,
} from '@/components/employee/drive-student-detail-sheet'
import {
  SelectionFields,
  prefillSelectionDraft,
  sanitizeSelectionDraft,
  selectionDraftToWrite,
  selectionDraftValid,
  type SelectionDraft,
} from '@/components/drive-management/selection-fields'
import { ChannelPicker } from '@/components/employee/channel-picker'
import { NoAccessEmptyState } from '@/components/employee/empty-states'
import { StudentSearchPanel } from '@/components/employee/student-search/student-search-panel'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { RichTextView } from '@/components/ui/rich-text/rich-text-view'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
  DRIVE_OUTCOME_OPTIONS,
  DRIVE_STATUS_LABELS,
  driveStatusOptions,
  DRIVE_STUDENT_STATUS,
  DRIVE_STUDENT_STATUS_BADGE,
  DRIVE_STUDENT_STATUS_LABELS,
  REVOCABLE_STATUSES,
  ENTRY_TYPE_OPTIONS,
  GENDER_OPTIONS,
  EMPTY_DRIVE_STUDENTS_FILTERS,
  buildDriveStudentDisplayItems,
  countDriveStudentsFilters,
  readDriveStudentsFiltersOpen,
  writeDriveStudentsFiltersOpen,
  companyWebsiteHref,
  companyWebsiteLabel,
  driveStatusVariant,
  driveStudentsExportApi,
  driveStudentsExportFilters,
  driveStudentsSearchApi,
  getDrive,
  getDriveEligibility,
  getDriveEligibilitySummary,
  getDriveStudentActivity,
  getDriveStudentProfile,
  getDriveStudentTrack,
  getDriveStudentsFilterOptions,
  getDriveStudentsFilterPrefill,
  importAllDriveStudents,
  importDriveStudents,
  inviteAllDriveStudents,
  inviteDriveStudents,
  listDriveEligibilityOptions,
  listDriveStudents,
  markDriveStudentOutcome,
  remindDriveStudents,
  removeDriveStudent,
  revokeDriveStudents,
  saveDriveEligibility,
  updateDriveStatus,
  updateDriveStudentSelection,
  type Chip,
  type DriveDetail,
  type DriveEligibility,
  type DriveEligibilityOptions,
  type EligibilitySummary,
  type DriveStatus,
  type DriveStudentRow,
  type DriveStudentsFilterOptions,
  type DriveStudentsFilters,
} from '@/lib/drive-management'
import { hasChannel, type NotifyChannels } from '@/lib/notify-channels'
import type {
  SearchCondition,
  SearchGroup,
  StudentImportApi,
} from '@/lib/student-search'
import { cn } from '@/lib/utils'

const SCREEN_KEY = 'drive_management.drives.manage'
const LIST_ROUTE = '/drive-management/drives'

/**
 * An invite/reinvite/remind waiting on the channel dialog. All three share the
 * dialog because all three send the student a message — the only difference is
 * the copy and which endpoint runs on confirm.
 */
type PendingSend =
  | { kind: 'invite-all' }
  | { kind: 'invite' | 'remind'; row: DriveStudentRow }

/** Dialog copy for the pending action; `null` only while it animates closed. */
function sendCopy(p: PendingSend | null): {
  title: string
  description: string
  cta: string
} {
  if (!p || p.kind === 'invite-all') {
    return {
      title: 'Invite all imported students?',
      description:
        'Every student still at Imported moves to Invited and is asked to ' +
        'accept or deny this drive.',
      cta: 'Invite all',
    }
  }
  if (p.kind === 'remind') {
    return {
      title: `Remind ${p.row.display_name}?`,
      description:
        'Re-sends the invitation to a student who has not responded yet. ' +
        'Their status does not change.',
      cta: 'Send reminder',
    }
  }
  const reinvite =
    p.row.status === DRIVE_STUDENT_STATUS.REVOKED ||
    p.row.status === DRIVE_STUDENT_STATUS.DENIED
  return {
    title: `${reinvite ? 'Reinvite' : 'Invite'} ${p.row.display_name}?`,
    description: reinvite
      ? 'Their earlier response is cleared and they are asked to accept or ' +
        'deny this drive again.'
      : 'They move to Invited and are asked to accept or deny this drive.',
    cta: reinvite ? 'Reinvite' : 'Send invite',
  }
}

function errMsg(e: unknown, fallback: string): string {
  return e instanceof ApiError || e instanceof Error ? e.message : fallback
}

const TABS: TabDef[] = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'eligibility', label: 'Eligibility', icon: GraduationCap },
  { key: 'filter', label: 'Filter', icon: Filter },
  { key: 'students', label: 'Students', icon: Users },
  { key: 'analytics', label: 'Analytics', icon: BarChart3 },
]

export default function EmployeeDriveDetailPage() {
  const access = useScreenAccess(SCREEN_KEY)
  const actions = access?.actions ?? []
  const canEdit = actions.includes('edit')

  const params = useParams({ strict: false }) as { driveId?: string }
  const driveId = params.driveId ? Number(params.driveId) : null

  // Optional return path — set when the drive is opened from a company's Drives
  // tab so Back returns there instead of the standalone drives list.
  const { from } = useSearch({ strict: false }) as { from?: string }

  const [drive, setDrive] = useState<DriveDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [tab, setTab] = useState('overview')
  const [savingStatus, setSavingStatus] = useState(false)
  // The Filter tab mounts lazily on first visit and then STAYS mounted (just
  // hidden), so built-up filters and results survive tab switches.
  const [filterVisited, setFilterVisited] = useState(false)
  // Bumped after an import so the Students tab refetches next time it opens.
  const [studentsRefreshKey, setStudentsRefreshKey] = useState(0)
  // Bumped after an eligibility save so the Filter tab remounts and re-seeds
  // its prefill from the freshly saved criteria.
  const [filterSeedKey, setFilterSeedKey] = useState(0)

  useEffect(() => {
    if (tab === 'filter') setFilterVisited(true)
  }, [tab])

  useEffect(() => {
    document.title = 'Drive — Nucleus'
  }, [])

  useEffect(() => {
    if (driveId === null) return
    let cancelled = false
    setLoading(true)
    getDrive(driveId)
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

  const onStatusChange = async (status: DriveStatus) => {
    if (!drive) return
    const prev = drive.status
    setDrive({ ...drive, status })
    setSavingStatus(true)
    try {
      await updateDriveStatus(drive.id, status)
      toast.success(`Status set to ${DRIVE_STATUS_LABELS[status]}.`)
      // Refetch so the new entry shows in the Overview status history. The
      // change is already saved, so a failed refresh just defers the card
      // update to the next load rather than being an error.
      try {
        setDrive(await getDrive(drive.id))
      } catch {
        /* keep the optimistic status */
      }
    } catch (e) {
      setDrive({ ...drive, status: prev })
      toast.error(errMsg(e, 'Could not update the status.'))
    } finally {
      setSavingStatus(false)
    }
  }

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
            onClick={() => employeeNavigateTo(from ?? LIST_ROUTE)}
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

          <div className="flex items-center gap-2">
            <Badge variant={driveStatusVariant(drive.status)}>
              {DRIVE_STATUS_LABELS[drive.status]}
            </Badge>
            {canEdit && (
              <NativeSelect
                aria-label="Drive status"
                value={drive.status}
                disabled={savingStatus || drive.status === 'archived'}
                onChange={(e) => onStatusChange(e.target.value as DriveStatus)}
                className="w-44"
              >
                {/* Only the current status + its legal next states, so illegal
                    moves are unreachable (the server also enforces this). */}
                {driveStatusOptions(drive.status).map((s) => (
                  <option key={s} value={s}>
                    {DRIVE_STATUS_LABELS[s]}
                  </option>
                ))}
              </NativeSelect>
            )}
            {canEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  employeeNavigateTo(`${LIST_ROUTE}/${drive.id}/edit`)
                }
              >
                <Pencil className="size-4" /> Edit drive
              </Button>
            )}
          </div>
        </div>

        <TabBar tabs={TABS} active={tab} onChange={setTab} />
      </div>

      <div className="scrollbar-themed min-h-0 flex-1 overflow-y-auto">
        {tab === 'overview' && <OverviewTab drive={drive} />}
        {tab === 'analytics' && <DriveAnalyticsTab driveId={drive.id} />}
        {tab === 'eligibility' && (
          <EligibilityTab
            driveId={drive.id}
            canEdit={canEdit}
            onEligibilitySaved={() => setFilterSeedKey((k) => k + 1)}
          />
        )}
        {filterVisited && (
          <div className={tab === 'filter' ? 'h-full' : 'hidden'}>
            <DriveFilterTab
              key={filterSeedKey}
              driveId={drive.id}
              canEdit={canEdit}
              onImported={() => setStudentsRefreshKey((k) => k + 1)}
            />
          </div>
        )}
        {tab === 'students' && (
          <DriveStudentsTab
            drive={drive}
            canEdit={canEdit}
            drivePublished={drive.status === 'published'}
            refreshKey={studentsRefreshKey}
          />
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------

/**
 * The Overview tab — a read-only summary of the whole drive: key facts, SPOC and
 * classifiers, each designation with its JD and attachments, and the eligibility
 * criteria. Everything but eligibility comes from the already-loaded `drive`;
 * eligibility is fetched separately (labels resolved server-side) and stays
 * editable only in its own tab.
 */
function OverviewTab({ drive }: { drive: DriveDetail }) {
  const [eligibility, setEligibility] = useState<EligibilitySummary | null>(null)

  useEffect(() => {
    let cancelled = false
    getDriveEligibilitySummary(drive.id)
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
            <IconFact icon={Briefcase} label="Offer type" value={drive.offer_type.name} />
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
            <IconFact icon={Phone} label="SPOC contact" value={drive.spoc_contact} />
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
              <IconFact icon={Briefcase} label="Offer type" value={p.offer_type.name} />
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

/**
 * Recommended placement defaults every drive Filter tab opens with: only
 * active students the department has cleared and who opted into placements.
 * They render locked in the builder — the user is warned before changing them.
 */
const PLACEMENT_DEFAULTS: SearchCondition[] = [
  { attr: 'is_active', op: 'eq', value: true },
  { attr: 'allowed_by_dept_for_placements', op: 'eq', value: true },
  { attr: 'interested_in_placements_self', op: 'eq', value: true },
]
const LOCKED_ATTRS = PLACEMENT_DEFAULTS.map((c) => c.attr)

/**
 * The Filter tab: the full student search, seeded with the placement defaults
 * above plus this drive's eligibility criteria (editable). A failed prefill
 * degrades to just the defaults — the search itself still works.
 */
function DriveFilterTab({
  driveId,
  canEdit,
  onImported,
}: {
  driveId: number
  canEdit: boolean
  onImported: () => void
}) {
  const api = useMemo(() => driveStudentsSearchApi(driveId), [driveId])
  // Import is edit-gated; search-only users see no import affordance.
  const importApi = useMemo<StudentImportApi | undefined>(
    () =>
      canEdit
        ? {
            importSelected: (ids) => importDriveStudents(driveId, ids),
            importAll: (body) => importAllDriveStudents(driveId, body),
            onChanged: onImported,
          }
        : undefined,
    [driveId, canEdit, onImported],
  )
  // undefined = still loading the prefill; null = none / failed.
  const [prefill, setPrefill] = useState<SearchGroup | null | undefined>(
    undefined,
  )

  useEffect(() => {
    let cancelled = false
    getDriveStudentsFilterPrefill(driveId)
      .then((r) => {
        if (!cancelled) setPrefill(r.filters)
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setPrefill(null)
        toast.info(errMsg(e, 'Could not pre-fill from eligibility.'))
      })
    return () => {
      cancelled = true
    }
  }, [driveId])

  // Placement defaults first, then the eligibility conditions.
  const seeded = useMemo<SearchGroup>(
    () => ({ and: [...PLACEMENT_DEFAULTS, ...(prefill?.and ?? [])] }),
    [prefill],
  )

  if (prefill === undefined) {
    return (
      <div className="space-y-3 py-2">
        <div className="h-9 w-64 animate-pulse rounded-md bg-muted" />
        <div className="h-24 animate-pulse rounded-xl bg-muted" />
        <div className="h-64 animate-pulse rounded-xl bg-muted" />
      </div>
    )
  }

  return (
    <StudentSearchPanel
      api={api}
      initialFilters={seeded}
      lockedAttrs={LOCKED_ATTRS}
      importApi={importApi}
      showFilterHelp
    />
  )
}

// ---------------------------------------------------------------------------
// Students tab — the drive's imported shortlist
// ---------------------------------------------------------------------------

/** "Designation · CTC ₹6,00,000 LPA · Stipend ₹25,000 – ₹30,000/month" for a
 *  Selected row; null when nothing was recorded (legacy selections). */
/** The manage surface's fetchers for the row-click detail sheet. */
const manageStudentDetailApi: DriveStudentDetailApi = {
  getProfile: getDriveStudentProfile,
  getDriveActivity: getDriveStudentActivity,
  getTrack: getDriveStudentTrack,
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

function DriveStudentsTab({
  drive,
  canEdit,
  drivePublished,
  refreshKey,
}: {
  drive: DriveDetail
  canEdit: boolean
  drivePublished: boolean
  refreshKey: number
}) {
  const driveId = drive.id
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
  // Collapsed group keys of the grouped view (visual only — selection keeps
  // ids inside collapsed groups).
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [rows, setRows] = useState<DriveStudentRow[] | null>(null)
  const [total, setTotal] = useState(0)
  const [pageCount, setPageCount] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pendingRemove, setPendingRemove] = useState<DriveStudentRow | null>(
    null,
  )
  const [removing, setRemoving] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [selectionUploadOpen, setSelectionUploadOpen] = useState(false)
  // Re-fetch trigger, bumped locally on any mutation and externally via refreshKey.
  const [localKey, setLocalKey] = useState(0)

  // Lifecycle actions.
  const [invitingId, setInvitingId] = useState<number | null>(null)
  const [remindingId, setRemindingId] = useState<number | null>(null)
  const [invitingAll, setInvitingAll] = useState(false)
  // The action awaiting a channel choice. Every invite/reinvite/remind goes
  // through the same dialog so the sender always picks how it is delivered.
  const [pendingSend, setPendingSend] = useState<PendingSend | null>(null)
  // Remembered across actions — a coordinator inviting row after row should not
  // re-pick channels every time.
  const [channels, setChannels] = useState<NotifyChannels>({
    in_app: true,
    push: true,
    email: true,
  })
  // Selection covers revocable rows (Invited/Accepted); bulk outcome is further
  // gated to all-Accepted at submit time.
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [outcomeIds, setOutcomeIds] = useState<number[] | null>(null)
  const [outcomeChoice, setOutcomeChoice] = useState<50 | 60 | 70>(60)
  const [markingOutcome, setMarkingOutcome] = useState(false)
  // The designation + package captured with a Selected outcome (one set per
  // batch), prefilled from the drive/designation package when the dialog opens.
  const [selDraft, setSelDraft] = useState<SelectionDraft>({
    drive_profile_id: null,
    ctc: '',
    ctc_min: '',
    stipend: '',
    stipend_min: '',
  })
  // The Selected row whose recorded selection is being edited, if any.
  const [editSelectionRow, setEditSelectionRow] =
    useState<DriveStudentRow | null>(null)
  const [editDraft, setEditDraft] = useState<SelectionDraft | null>(null)
  const [savingSelection, setSavingSelection] = useState(false)
  // Revoke (single row or bulk): a reason + a notify toggle.
  const [revokeIds, setRevokeIds] = useState<number[] | null>(null)
  const [revokeReason, setRevokeReason] = useState('')
  const [revokeNotify, setRevokeNotify] = useState(true)
  const [revoking, setRevoking] = useState(false)
  // The student whose track sheet is open.
  const [trackStudent, setTrackStudent] = useState<DriveStudentRow | null>(null)

  // Reset to the first page (and re-expand groups) whenever a filter changes.
  useEffect(() => {
    setPage(1)
    setCollapsed(new Set())
  }, [search, statusFilter, filters])

  // Filter dropdown options — re-derived on refresh since imports/removals
  // change the membership the options are computed from. Errors are non-fatal:
  // the bar just keeps its last options.
  useEffect(() => {
    let cancelled = false
    getDriveStudentsFilterOptions(driveId)
      .then((opts) => {
        if (!cancelled) setFilterOptions(opts)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [driveId, refreshKey, localKey])

  const grouped = filters.groupBy !== 'none'

  const exportApi = useMemo(() => driveStudentsExportApi(driveId), [driveId])
  // The export replays the tab's filters, NOT its paging or grouping: grouping
  // is a display choice, and a download of "page 3" would be a bug.
  const exportFilters = useMemo(
    () =>
      driveStudentsExportFilters({
        search,
        status: statusFilter ?? undefined,
        programme_ids: filters.programmeIds,
        passout_years: filters.passoutYears,
        entry_type: filters.entryType ?? undefined,
      }),
    [search, statusFilter, filters],
  )

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    listDriveStudents(driveId, {
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
        // Keep the selection meaningful: drop ids no longer visible/revocable.
        setSelected((prev) => {
          const visible = new Set(
            res.rows
              .filter((r) => REVOCABLE_STATUSES.includes(r.status))
              .map((r) => r.id),
          )
          const next = new Set([...prev].filter((id) => visible.has(id)))
          return next.size === prev.size ? prev : next
        })
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
  }, [
    driveId,
    page,
    search,
    statusFilter,
    filters,
    grouped,
    refreshKey,
    localKey,
  ])

  const refetch = useCallback(() => setLocalKey((k) => k + 1), [])

  const onRemove = useCallback(async () => {
    if (!pendingRemove) return
    setRemoving(true)
    try {
      await removeDriveStudent(driveId, pendingRemove.id)
      toast.success(`${pendingRemove.display_name} removed from the drive.`)
      setPendingRemove(null)
      refetch()
    } catch (e) {
      toast.error(errMsg(e, 'Could not remove the student.'))
    } finally {
      setRemoving(false)
    }
  }, [driveId, pendingRemove, refetch])

  const onInviteRow = useCallback(async (r: DriveStudentRow) => {
    const verb =
      r.status === DRIVE_STUDENT_STATUS.REVOKED ||
      r.status === DRIVE_STUDENT_STATUS.DENIED
        ? 'reinvited'
        : 'invited'
    setInvitingId(r.id)
    try {
      const s = await inviteDriveStudents(driveId, [r.id], channels)
      if (s.invited > 0) toast.success(`${r.display_name} ${verb}.`)
      else toast.info(`${r.display_name} could not be ${verb}.`)
      refetch()
    } catch (e) {
      toast.error(errMsg(e, 'Could not send the invite.'))
    } finally {
      setInvitingId(null)
    }
  }, [driveId, refetch, channels])

  const onRemindRow = useCallback(async (r: DriveStudentRow) => {
    setRemindingId(r.id)
    try {
      const s = await remindDriveStudents(driveId, [r.id], channels)
      if (s.reminded > 0) toast.success(`Reminder sent to ${r.display_name}.`)
      else toast.info(`${r.display_name} is no longer awaiting a response.`)
      refetch()
    } catch (e) {
      toast.error(errMsg(e, 'Could not send the reminder.'))
    } finally {
      setRemindingId(null)
    }
  }, [driveId, refetch, channels])

  const onInviteAll = useCallback(async () => {
    setInvitingAll(true)
    try {
      const s = await inviteAllDriveStudents(driveId, channels)
      if (s.requested === 0) {
        toast.info('No imported students left to invite.')
      } else {
        toast.success(
          `${s.invited} invited${s.skipped > 0 ? ` · ${s.skipped} skipped` : ''}.`,
        )
      }
      refetch()
    } catch (e) {
      toast.error(errMsg(e, 'Could not send the invites.'))
    } finally {
      setInvitingAll(false)
    }
  }, [driveId, refetch, channels])

  /** Run whatever the channel dialog was opened for, then close it. */
  const onConfirmSend = useCallback(async () => {
    const p = pendingSend
    if (!p) return
    setPendingSend(null)
    if (p.kind === 'invite-all') await onInviteAll()
    else if (p.kind === 'remind') await onRemindRow(p.row)
    else await onInviteRow(p.row)
  }, [pendingSend, onInviteAll, onInviteRow, onRemindRow])

  // Opens the outcome dialog defaulting to Selected, with the selection draft
  // prefilled from the drive/designation package (auto-picks a lone profile).
  const openOutcome = useCallback(
    (ids: number[]) => {
      setOutcomeChoice(60)
      setSelDraft(
        prefillSelectionDraft(
          drive,
          drive.profiles.length === 1 ? drive.profiles[0].id : null,
        ),
      )
      setOutcomeIds(ids)
    },
    [drive],
  )

  const onMarkOutcome = useCallback(async () => {
    if (!outcomeIds || outcomeIds.length === 0) return
    setMarkingOutcome(true)
    try {
      const s = await markDriveStudentOutcome(
        driveId,
        outcomeIds,
        outcomeChoice,
        outcomeChoice === 60 ? selectionDraftToWrite(selDraft) : undefined,
      )
      setOutcomeIds(null)
      setSelected(new Set())
      toast.success(
        `${s.updated} marked ${DRIVE_STUDENT_STATUS_LABELS[outcomeChoice]}${
          s.skipped > 0 ? ` · ${s.skipped} skipped` : ''
        }.`,
      )
      refetch()
    } catch (e) {
      toast.error(errMsg(e, 'Could not record the outcome.'))
    } finally {
      setMarkingOutcome(false)
    }
  }, [driveId, outcomeIds, outcomeChoice, selDraft, refetch])

  const openEditSelection = useCallback(
    (r: DriveStudentRow) => {
      // Seeded from the stored row, so it may carry a lower bound this drive no
      // longer offers — sanitize or the hidden value would block Save.
      setEditDraft(
        sanitizeSelectionDraft(drive, {
          drive_profile_id: r.selected_drive_profile_id,
          ctc: r.ctc ?? '',
          ctc_min: r.ctc_min ?? '',
          stipend: r.stipend ?? '',
          stipend_min: r.stipend_min ?? '',
        }),
      )
      setEditSelectionRow(r)
    },
    [drive],
  )

  const onSaveSelection = useCallback(async () => {
    if (!editSelectionRow || !editDraft) return
    setSavingSelection(true)
    try {
      await updateDriveStudentSelection(
        driveId,
        editSelectionRow.id,
        selectionDraftToWrite(editDraft),
      )
      toast.success(`Selection updated for ${editSelectionRow.display_name}.`)
      setEditSelectionRow(null)
      setEditDraft(null)
      refetch()
    } catch (e) {
      toast.error(errMsg(e, 'Could not update the selection.'))
    } finally {
      setSavingSelection(false)
    }
  }, [driveId, editSelectionRow, editDraft, refetch])

  const openRevoke = useCallback((ids: number[]) => {
    setRevokeReason('')
    setRevokeNotify(true)
    setRevokeIds(ids)
  }, [])

  const onRevoke = useCallback(async () => {
    if (!revokeIds || revokeIds.length === 0 || !revokeReason.trim()) return
    setRevoking(true)
    try {
      const s = await revokeDriveStudents(
        driveId,
        revokeIds,
        revokeReason.trim(),
        revokeNotify,
      )
      setRevokeIds(null)
      setSelected(new Set())
      toast.success(
        `${s.revoked} revoked${s.skipped > 0 ? ` · ${s.skipped} skipped` : ''}.`,
      )
      refetch()
    } catch (e) {
      toast.error(errMsg(e, 'Could not revoke.'))
    } finally {
      setRevoking(false)
    }
  }, [driveId, revokeIds, revokeReason, revokeNotify, refetch])

  const revocableOnPage = (rows ?? []).filter((r) =>
    REVOCABLE_STATUSES.includes(r.status),
  )
  const allRevocableSelected =
    revocableOnPage.length > 0 &&
    revocableOnPage.every((r) => selected.has(r.id))
  const toggleSelectAll = () =>
    setSelected(
      allRevocableSelected
        ? new Set()
        : new Set(revocableOnPage.map((r) => r.id)),
    )
  const toggleSelect = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  // Bulk "Mark outcome" is valid only when every selected row is Accepted.
  const selectedRows = (rows ?? []).filter((r) => selected.has(r.id))
  const canBulkOutcome =
    selectedRows.length > 0 &&
    selectedRows.every((r) => r.status === DRIVE_STUDENT_STATUS.ACCEPTED)

  // An archived drive is closed: student records are frozen and no lifecycle
  // action is allowed (the server enforces this too). Hide the selection
  // checkboxes and every per-row action.
  const driveArchived = drive.status === 'archived'
  const showSelection = canEdit && !driveArchived

  const anyFilterActive =
    statusFilter !== null ||
    search.trim() !== '' ||
    filters.programmeIds.length > 0 ||
    filters.passoutYears.length > 0 ||
    filters.entryType !== null
  const colCount = 6 + (showSelection ? 1 : 0) + (canEdit ? 1 : 0)
  const activeFilterCount = countDriveStudentsFilters(filters)
  const toggleFilters = () => {
    const next = !filtersOpen
    setFiltersOpen(next)
    writeDriveStudentsFiltersOpen(next)
  }
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

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 py-1">
      {driveArchived && (
        <div className="shrink-0 rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
          This drive is archived — student records are read-only and no further
          actions can be taken.
        </div>
      )}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <span className="text-base font-semibold">
            {total.toLocaleString()}
          </span>
          <span className="text-sm text-muted-foreground">
            student{total === 1 ? '' : 's'}
            {statusFilter !== null
              ? ` · ${DRIVE_STUDENT_STATUS_LABELS[statusFilter]}`
              : ' in this drive'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && (
            <Button
              size="sm"
              disabled={invitingAll || !drivePublished}
              title={
                drivePublished
                  ? undefined
                  : 'Publish the drive to send invites.'
              }
              onClick={() => setPendingSend({ kind: 'invite-all' })}
            >
              {invitingAll ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
              Invite all imported
            </Button>
          )}
          {canEdit && (
            <Button
              variant="outline"
              size="sm"
              disabled={driveArchived}
              title={
                driveArchived
                  ? 'This drive is archived; student records are frozen.'
                  : undefined
              }
              onClick={() => setSelectionUploadOpen(true)}
            >
              <FileSpreadsheet className="size-4" />
              Upload selections
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setExportOpen(true)}
            disabled={total === 0}
          >
            <Download className="size-4" />
            Export
          </Button>
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

          {/* Bulk-action bar */}
          {selected.size > 0 && !driveArchived && (
            <div className="flex shrink-0 items-center gap-3 rounded-lg border bg-card px-3 py-2 text-sm">
              <span className="font-medium tabular-nums">
                {selected.size} selected
              </span>
              <Button
                size="sm"
                disabled={!canBulkOutcome}
                title={
                  canBulkOutcome
                    ? undefined
                    : 'Only Accepted students can be given an outcome.'
                }
                onClick={() => openOutcome([...selected])}
              >
                Mark outcome
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-destructive hover:text-destructive"
                onClick={() => openRevoke([...selected])}
              >
                Revoke
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelected(new Set())}
              >
                Clear
              </Button>
            </div>
          )}

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
                : 'No students imported yet — use the Filter tab to add candidates.'}
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-hidden rounded-lg border">
              <Table containerClassName="h-full max-h-[62vh] overflow-y-auto scrollbar-themed lg:max-h-none">
                <TableHeader className="sticky top-0 z-10 bg-card">
                  <TableRow>
                    {showSelection ? (
                      <TableHead className="w-8">
                        <input
                          type="checkbox"
                          className="accent-primary"
                          checked={allRevocableSelected}
                          disabled={revocableOnPage.length === 0}
                          onChange={toggleSelectAll}
                          aria-label="Select all loaded revocable students"
                        />
                      </TableHead>
                    ) : null}
                    <TableHead>Roll number</TableHead>
                    <TableHead>Full name</TableHead>
                    <TableHead>Programme</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Imported</TableHead>
                    <TableHead>Imported by</TableHead>
                    {canEdit ? <TableHead className="w-40" /> : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayItems.map((item) => {
                    if (item.kind === 'header') {
                      return (
                        <DriveStudentGroupHeaderRow
                          key={`group:${item.key}`}
                          item={item}
                          colSpan={colCount}
                          onToggle={() => toggleGroup(item.key)}
                        />
                      )
                    }
                    const r = item.row
                    return (
                    <TableRow
                      key={r.id}
                      className="cursor-pointer"
                      onClick={() => setTrackStudent(r)}
                    >
                      {showSelection ? (
                        <TableCell
                          className="w-8"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {REVOCABLE_STATUSES.includes(r.status) ? (
                            <input
                              type="checkbox"
                              className="accent-primary"
                              checked={selected.has(r.id)}
                              onChange={() => toggleSelect(r.id)}
                              aria-label={`Select ${r.display_name}`}
                            />
                          ) : null}
                        </TableCell>
                      ) : null}
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
                      {canEdit ? (
                        <TableCell
                          className="whitespace-nowrap"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div
                            className={cn(
                              'flex items-center justify-end gap-1',
                              driveArchived && 'hidden',
                            )}
                          >
                            {r.status === DRIVE_STUDENT_STATUS.IMPORTED && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7"
                                disabled={invitingId !== null || !drivePublished}
                                title={
                                  drivePublished
                                    ? undefined
                                    : 'Publish the drive to send invites.'
                                }
                                onClick={() =>
                                  setPendingSend({ kind: 'invite', row: r })
                                }
                              >
                                {invitingId === r.id ? (
                                  <Loader2 className="size-3.5 animate-spin" />
                                ) : (
                                  <Send className="size-3.5" />
                                )}
                                Invite
                              </Button>
                            )}
                            {r.status === DRIVE_STUDENT_STATUS.INVITED && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7"
                                disabled={remindingId !== null}
                                onClick={() =>
                                  setPendingSend({ kind: 'remind', row: r })
                                }
                              >
                                {remindingId === r.id ? (
                                  <Loader2 className="size-3.5 animate-spin" />
                                ) : (
                                  <BellRing className="size-3.5" />
                                )}
                                Remind
                              </Button>
                            )}
                            {(r.status === DRIVE_STUDENT_STATUS.REVOKED ||
                              r.status === DRIVE_STUDENT_STATUS.DENIED) && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7"
                                disabled={invitingId !== null || !drivePublished}
                                title={
                                  drivePublished
                                    ? undefined
                                    : 'Publish the drive to send invites.'
                                }
                                onClick={() =>
                                  setPendingSend({ kind: 'invite', row: r })
                                }
                              >
                                {invitingId === r.id ? (
                                  <Loader2 className="size-3.5 animate-spin" />
                                ) : (
                                  <Send className="size-3.5" />
                                )}
                                Reinvite
                              </Button>
                            )}
                            {r.status === DRIVE_STUDENT_STATUS.ACCEPTED && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7"
                                onClick={() => openOutcome([r.id])}
                              >
                                Mark outcome
                              </Button>
                            )}
                            {r.status === DRIVE_STUDENT_STATUS.SELECTED && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7"
                                onClick={() => openEditSelection(r)}
                              >
                                <Pencil className="size-3.5" />
                                Edit selection
                              </Button>
                            )}
                            {REVOCABLE_STATUSES.includes(r.status) && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-destructive hover:text-destructive"
                                onClick={() => openRevoke([r.id])}
                              >
                                <Ban className="size-3.5" />
                                Revoke
                              </Button>
                            )}
                            {r.status === DRIVE_STUDENT_STATUS.IMPORTED && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8 text-muted-foreground hover:text-destructive"
                                onClick={() => setPendingRemove(r)}
                                aria-label={`Delete ${r.display_name}`}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      ) : null}
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

          {!grouped && pageCount > 1 ? (
            <div className="flex shrink-0 justify-end">
              <Pagination page={page} totalPages={pageCount} onPage={setPage} />
            </div>
          ) : null}
        </div>
      </div>

      {/* Delete confirm — only reachable from Imported rows. */}
      <Dialog
        open={!!pendingRemove}
        onOpenChange={(open) => {
          if (!open) setPendingRemove(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remove from drive?</DialogTitle>
            <DialogDescription>
              {pendingRemove?.display_name} will be removed from this drive. You
              can import them again later from the Filter tab.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingRemove(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void onRemove()}
              disabled={removing}
            >
              {removing ? <Loader2 className="size-4 animate-spin" /> : null}
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Export — column pick + order, honouring the tab's live filters */}
      <DriveStudentsExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        api={exportApi}
        filters={exportFilters}
        total={total}
      />

      <DriveSelectionUploadDialog
        open={selectionUploadOpen}
        onOpenChange={setSelectionUploadOpen}
        drive={drive}
        onCommitted={refetch}
      />

      {/* Invite / reinvite / remind — confirm and pick the delivery channels */}
      <Dialog
        open={!!pendingSend}
        onOpenChange={(open) => {
          if (!open) setPendingSend(null)
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{sendCopy(pendingSend).title}</DialogTitle>
            <DialogDescription>
              {sendCopy(pendingSend).description}
            </DialogDescription>
          </DialogHeader>

          <ChannelPicker value={channels} onChange={setChannels} />
          {channels.email && (
            <p className="text-xs text-muted-foreground">
              The email carries the company, drive date and response deadline,
              and links straight to this drive.
            </p>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingSend(null)}>
              Cancel
            </Button>
            {/* Closes immediately — the row/header button owns the spinner. */}
            <Button
              onClick={() => void onConfirmSend()}
              disabled={!hasChannel(channels)}
            >
              <Send className="size-4" />
              {sendCopy(pendingSend).cta}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Outcome dialog (single row or bulk) */}
      <Dialog
        open={!!outcomeIds}
        onOpenChange={(open) => {
          if (!open) setOutcomeIds(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Mark outcome for {outcomeIds?.length ?? 0} student
              {(outcomeIds?.length ?? 0) === 1 ? '' : 's'}
            </DialogTitle>
            <DialogDescription>
              Records the drive-day result. Selected students are notified;
              other outcomes stay in-app only. The outcome itself cannot be
              changed later, but a Selected student's designation and package
              can be edited.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {DRIVE_OUTCOME_OPTIONS.map((o) => (
              <label
                key={o.value}
                className={cn(
                  'flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm transition-colors',
                  outcomeChoice === o.value
                    ? 'border-primary bg-primary/5'
                    : 'hover:bg-accent',
                )}
              >
                <input
                  type="radio"
                  name="drive-outcome"
                  className="accent-primary"
                  checked={outcomeChoice === o.value}
                  onChange={() => setOutcomeChoice(o.value)}
                />
                <span className="font-medium">{o.label}</span>
              </label>
            ))}
          </div>
          {outcomeChoice === 60 && (
            <div className="space-y-3 rounded-lg border p-3">
              <SelectionFields
                drive={drive}
                draft={selDraft}
                onChange={setSelDraft}
                idPrefix="outcome-selection"
              />
              {(outcomeIds?.length ?? 0) > 1 && (
                <p className="text-xs text-muted-foreground">
                  Applied to all {outcomeIds?.length} students in this batch.
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOutcomeIds(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => void onMarkOutcome()}
              disabled={
                markingOutcome ||
                (outcomeChoice === 60 && !selectionDraftValid(drive, selDraft))
              }
            >
              {markingOutcome ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit the designation/package recorded on a Selected student */}
      <Dialog
        open={!!editSelectionRow}
        onOpenChange={(open) => {
          if (!open) {
            setEditSelectionRow(null)
            setEditDraft(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Edit selection — {editSelectionRow?.display_name}
            </DialogTitle>
            <DialogDescription>
              Replaces the recorded designation and package. The change is
              saved to the student's track.
            </DialogDescription>
          </DialogHeader>
          {editDraft && (
            <SelectionFields
              drive={drive}
              draft={editDraft}
              onChange={setEditDraft}
              idPrefix="edit-selection"
            />
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditSelectionRow(null)
                setEditDraft(null)
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => void onSaveSelection()}
              disabled={
                savingSelection ||
                !editDraft ||
                !selectionDraftValid(drive, editDraft)
              }
            >
              {savingSelection ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke dialog (single row or bulk) — reason + notify toggle */}
      <Dialog
        open={!!revokeIds}
        onOpenChange={(open) => {
          if (!open) setRevokeIds(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Revoke {revokeIds?.length ?? 0} student
              {(revokeIds?.length ?? 0) === 1 ? '' : 's'}?
            </DialogTitle>
            <DialogDescription>
              They're pulled out of the drive but the record is kept. Give a
              reason — it's shown to the student and saved to their track.
            </DialogDescription>
          </DialogHeader>
          <textarea
            value={revokeReason}
            onChange={(e) => setRevokeReason(e.target.value)}
            maxLength={512}
            rows={4}
            placeholder="Reason for revoking…"
            className="w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="accent-primary"
              checked={revokeNotify}
              onChange={(e) => setRevokeNotify(e.target.checked)}
            />
            Notify the student
          </label>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevokeIds(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void onRevoke()}
              disabled={revoking || !revokeReason.trim()}
            >
              {revoking ? <Loader2 className="size-4 animate-spin" /> : null}
              Revoke
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Per-student detail (profile / drive activity / this drive's trail) */}
      <DriveStudentDetailSheet
        driveId={driveId}
        studentId={trackStudent?.id ?? null}
        studentName={trackStudent?.display_name}
        open={!!trackStudent}
        onOpenChange={(open) => {
          if (!open) setTrackStudent(null)
        }}
        api={manageStudentDetailApi}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Eligibility tab
// ---------------------------------------------------------------------------

/** "" for a blank input; the server treats null as "no restriction". */
const numOrNull = (s: string): number | null =>
  s.trim() === '' ? null : Number(s)
const strOf = (n: number | null): string => (n == null ? '' : String(n))

/** Local editable shape — numeric fields held as input strings. */
interface EligibilityForm {
  programme_ids: number[]
  entry_types: number[]
  genders: string[]
  passout_years: number[]
  allow_backlog_history: boolean
  max_current_backlogs: string
  min_tenth_percentage: string
  min_twelfth_percentage: string
  min_diploma_percentage: string
  min_btech_cgpa: string
}

function toForm(e: DriveEligibility): EligibilityForm {
  return {
    programme_ids: e.programme_ids,
    entry_types: e.entry_types,
    genders: e.genders,
    passout_years: e.passout_years,
    allow_backlog_history: e.allow_backlog_history,
    max_current_backlogs: strOf(e.max_current_backlogs),
    min_tenth_percentage: strOf(e.min_tenth_percentage),
    min_twelfth_percentage: strOf(e.min_twelfth_percentage),
    min_diploma_percentage: strOf(e.min_diploma_percentage),
    min_btech_cgpa: strOf(e.min_btech_cgpa),
  }
}

function EligibilityTab({
  driveId,
  canEdit,
  onEligibilitySaved,
}: {
  driveId: number
  canEdit: boolean
  onEligibilitySaved?: () => void
}) {
  const [form, setForm] = useState<EligibilityForm | null>(null)
  const [options, setOptions] = useState<DriveEligibilityOptions | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([getDriveEligibility(driveId), listDriveEligibilityOptions()])
      .then(([elig, opts]) => {
        if (cancelled) return
        setForm(toForm(elig))
        setOptions(opts)
        setError(null)
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(errMsg(e, 'Could not load eligibility.'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [driveId])

  const patch = (p: Partial<EligibilityForm>) =>
    setForm((f) => (f ? { ...f, ...p } : f))

  const onSave = async () => {
    if (!form) return
    setSaving(true)
    try {
      await saveDriveEligibility(driveId, {
        programme_ids: form.programme_ids,
        entry_types: form.entry_types,
        genders: form.genders,
        passout_years: form.passout_years,
        allow_backlog_history: form.allow_backlog_history,
        max_current_backlogs: numOrNull(form.max_current_backlogs),
        min_tenth_percentage: numOrNull(form.min_tenth_percentage),
        min_twelfth_percentage: numOrNull(form.min_twelfth_percentage),
        min_diploma_percentage: numOrNull(form.min_diploma_percentage),
        min_btech_cgpa: numOrNull(form.min_btech_cgpa),
      })
      toast.success('Eligibility saved.')
      onEligibilitySaved?.()
    } catch (e) {
      toast.error(errMsg(e, 'Could not save eligibility.'))
    } finally {
      setSaving(false)
    }
  }

  if (loading || !form || !options) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
        {error ?? 'Loading…'}
      </div>
    )
  }

  // Year options, unioned with any already-saved year not in the option set.
  const yearChips: Chip[] = mergeYears(
    options.passout_years,
    form.passout_years,
  )

  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-6">
      <p className="text-sm text-muted-foreground">
        Who this drive is open to. Passout year and programme are required before
        the drive can be marked Ready to publish; leave any other axis empty for
        "no restriction".
      </p>

      <Field
        label="Passout year"
        hint="Graduating batches this drive accepts."
        required
      >
        <SearchableMultiSelect
          options={yearChips}
          selected={form.passout_years}
          onChange={(ids) => patch({ passout_years: ids })}
          placeholder="Select passout years"
          searchPlaceholder="Search years…"
          showSelectAll
        />
      </Field>

      <Field label="Programs" hint="Programmes eligible to apply." required>
        <SearchableMultiSelect
          options={options.programmes}
          selected={form.programme_ids}
          onChange={(ids) => patch({ programme_ids: ids })}
          placeholder="Select programmes"
          searchPlaceholder="Search programmes…"
          showSelectAll
        />
      </Field>

      <Field label="Entry type">
        <PillGroup
          options={ENTRY_TYPE_OPTIONS}
          selected={form.entry_types}
          onChange={(v) => patch({ entry_types: v })}
        />
      </Field>

      <Field label="Gender">
        <PillGroup
          options={GENDER_OPTIONS}
          selected={form.genders}
          onChange={(v) => patch({ genders: v })}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Allow with history of backlogs">
          <NativeSelect
            value={form.allow_backlog_history ? 'yes' : 'no'}
            onChange={(e) =>
              patch({ allow_backlog_history: e.target.value === 'yes' })
            }
          >
            <option value="no">No</option>
            <option value="yes">Yes</option>
          </NativeSelect>
        </Field>

        {/* Independent of the history setting — both are always editable. */}
        <Field label="Allow current backlogs upto" hint="Blank = no limit.">
          <Input
            type="number"
            min={0}
            max={99}
            value={form.max_current_backlogs}
            onChange={(e) => patch({ max_current_backlogs: e.target.value })}
            placeholder="No limit"
          />
        </Field>
      </div>

      <div className="space-y-1.5">
        <p className="text-sm font-medium">Academic criteria</p>
        <p className="text-xs text-muted-foreground">
          Minimums; blank means no minimum for that stage.
        </p>
        <div className="grid gap-4 pt-1 sm:grid-cols-3">
          <Field label="Xth (min %)">
            <Input
              type="number"
              min={0}
              max={100}
              step="any"
              value={form.min_tenth_percentage}
              onChange={(e) => patch({ min_tenth_percentage: e.target.value })}
              placeholder="e.g. 60"
            />
          </Field>
          <Field label="12th (min %)" hint="Applies to regular entrants.">
            <Input
              type="number"
              min={0}
              max={100}
              step="any"
              value={form.min_twelfth_percentage}
              onChange={(e) => patch({ min_twelfth_percentage: e.target.value })}
              placeholder="e.g. 70"
            />
          </Field>
          <Field label="Diploma (min %)" hint="Applies to lateral entrants.">
            <Input
              type="number"
              min={0}
              max={100}
              step="any"
              value={form.min_diploma_percentage}
              onChange={(e) => patch({ min_diploma_percentage: e.target.value })}
              placeholder="e.g. 80"
            />
          </Field>
          <Field label="Btech (min CGPA /10)">
            <Input
              type="number"
              min={0}
              max={10}
              step="any"
              value={form.min_btech_cgpa}
              onChange={(e) => patch({ min_btech_cgpa: e.target.value })}
              placeholder="e.g. 6.5"
            />
          </Field>
        </div>
      </div>

      {canEdit && (
        <div className="flex justify-end pt-2">
          <Button onClick={onSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save eligibility'}
          </Button>
        </div>
      )}
    </div>
  )
}

/** Union option years with any saved year missing from them, newest first. */
function mergeYears(optionYears: number[], selected: number[]): Chip[] {
  const all = [...new Set([...optionYears, ...selected])].sort((a, b) => b - a)
  return all.map((y) => ({ id: y, name: String(y) }))
}

/** A toggle-chip multi-select over a small fixed value set (string or number). */
function PillGroup<T extends string | number>({
  options,
  selected,
  onChange,
}: {
  options: { value: T; name: string }[]
  selected: T[]
  onChange: (next: T[]) => void
}) {
  const toggle = (v: T) =>
    onChange(
      selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v],
    )
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = selected.includes(o.value)
        return (
          <button
            key={String(o.value)}
            type="button"
            aria-pressed={on}
            onClick={() => toggle(o.value)}
            className={cn(
              'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
              on
                ? 'border-primary bg-primary text-primary-foreground'
                : 'bg-card hover:bg-accent hover:text-accent-foreground',
            )}
          >
            {o.name}
          </button>
        )
      })}
    </div>
  )
}
