import { BarChart3, UserCheck, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { TabBar, type TabDef } from '@/components/corporate-relations/bits'
import { CoordinatorStudentsAnalyticsTab } from '@/components/employee/coordinator-students-analytics'
import {
  StudentProfileDetails,
  type Slot,
} from '@/components/employee/drive-student-detail-sheet'
import { NoAccessEmptyState } from '@/components/employee/empty-states'
import { StudentSearchPanel } from '@/components/employee/student-search/student-search-panel'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Combobox } from '@/components/ui/combobox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import { useScreenAccess } from '@/hooks/use-screen-access'
import { ApiError } from '@/lib/api'
import {
  coordinatorStudentsSearchApi,
  getCoordinatorStudentProfile,
  listCoordinatorBatches,
  setCoordinatorStudentAllowed,
  type AllowedBucket,
  type CoordinatorBatch,
  type CoordinatorStudentProfile,
  type ProfileCompletion,
} from '@/lib/placement-coordinator-students'
import { cn } from '@/lib/utils'

/**
 * Placement Coordinator > Students — the coordinator's own cohort, in two tabs:
 * Students (the registry-driven search, scoped to the selected batch) and
 * Analytics (placement readiness for the whole batch).
 *
 * The batch dropdown sits above the tabs because it scopes both. Its options
 * are the programme × batch pairs this employee is a profile verifier for; the
 * server re-checks the selected id on every request, so the dropdown is a
 * convenience, not the security boundary.
 *
 * Programme / Department / Pass-out year are hidden from the search pickers —
 * the batch already pins them, and the server's scope makes a hand-written
 * filter on those unable to widen anything.
 */

const SCREEN_KEY = 'placement_coordinator.students.view'
const BATCH_STORAGE_KEY = 'nucleus.coordinator-students.batch'

/** Fixed axes the batch dropdown already decides. Module-scope = stable. */
const HIDDEN_ATTRS = ['programme', 'department', 'pass_out_year']

const TABS: TabDef[] = [
  { key: 'students', label: 'Students', icon: Users },
  { key: 'analytics', label: 'Analytics', icon: BarChart3 },
]

function errMsg(e: unknown, fallback: string): string {
  return e instanceof ApiError || e instanceof Error ? e.message : fallback
}

/** Read the remembered batch once, defensively — garbage must not throw. */
function initialBatch(): number | null {
  if (typeof window === 'undefined') return null
  const raw = Number(window.localStorage.getItem(BATCH_STORAGE_KEY))
  return Number.isInteger(raw) && raw > 0 ? raw : null
}

/** Green above 80%, amber from 50%, red below. */
function completionTone(pct: number): string {
  if (pct >= 80) return 'bg-emerald-500'
  if (pct >= 50) return 'bg-amber-500'
  return 'bg-destructive'
}

export default function EmployeePlacementCoordinatorStudentsPage() {
  useEffect(() => {
    document.title = 'Students — Placement Coordinator — Nucleus'
  }, [])

  const access = useScreenAccess(SCREEN_KEY)
  const canEdit = access?.actions.includes('edit') ?? false

  const [tab, setTab] = useState('students')
  const [batches, setBatches] = useState<CoordinatorBatch[]>([])
  const [batchesLoaded, setBatchesLoaded] = useState(false)
  const [batchId, setBatchId] = useState<number | null>(initialBatch)

  // Optimistic overrides for rows the coordinator has toggled this session.
  // The search panel owns its result rows, so the toggle can't mutate them —
  // this map is layered over `row._allowed` when rendering the row action.
  const [allowedOverrides, setAllowedOverrides] = useState<
    Record<number, boolean | null>
  >({})
  const [savingId, setSavingId] = useState<number | null>(null)

  // The allowed/not-allowed bucket, and a nonce that asks the panel to refetch
  // once the new adapter is in place.
  const [bucket, setBucket] = useState<AllowedBucket>('all')
  const [searchNonce, setSearchNonce] = useState(0)

  // The toggle writes only after the user confirms.
  const [pendingToggle, setPendingToggle] = useState<{
    id: number
    name: string
    current: boolean | null
    next: boolean
  } | null>(null)

  const [openStudent, setOpenStudent] = useState<{
    id: number
    name: string
    rollNo: string
  } | null>(null)
  const [profile, setProfile] = useState<Slot<CoordinatorStudentProfile>>({
    loading: false,
    error: null,
  })

  // The verified batches, once. A remembered id that is no longer verified
  // must not stick around — fall back to the first available batch.
  useEffect(() => {
    let cancelled = false
    listCoordinatorBatches()
      .then((rows) => {
        if (cancelled) return
        setBatches(rows)
        setBatchId((current) => {
          const stillValid = rows.some(
            (b) => b.programme_admission_year_id === current,
          )
          return stillValid
            ? current
            : (rows[0]?.programme_admission_year_id ?? null)
        })
      })
      .catch(() => {
        /* The empty state below covers this; no toast on a boot read. */
      })
      .finally(() => {
        if (!cancelled) setBatchesLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // The panel boots once keyed on the adapter's identity, so this must be
  // memoised — and a new adapter per batch is exactly the re-boot we want.
  // Rebuilt when the batch or the bucket changes. That does NOT re-boot the
  // panel — its boot is guarded by an internal `booted` ref — so the user's
  // filters survive a bucket switch; only the next request's URL changes.
  const searchApi = useMemo(
    () =>
      batchId === null
        ? null
        : coordinatorStudentsSearchApi(batchId, bucket),
    [batchId, bucket],
  )

  const changeBatch = (next: number | null) => {
    setBatchId(next)
    setAllowedOverrides({})
    if (next !== null) {
      window.localStorage.setItem(BATCH_STORAGE_KEY, String(next))
    }
  }

  const changeBucket = (next: AllowedBucket) => {
    setBucket(next)
    setAllowedOverrides({})
    // The panel refetches on the nonce, by which point the memo above has
    // produced an adapter carrying the new bucket.
    setSearchNonce((n) => n + 1)
  }

  const toggleAllowed = async (
    studentId: number,
    current: boolean | null,
    name: string,
  ) => {
    if (batchId === null || savingId !== null) return
    const next = current !== true
    setSavingId(studentId)
    setAllowedOverrides((m) => ({ ...m, [studentId]: next }))
    try {
      await setCoordinatorStudentAllowed(batchId, studentId, next)
    } catch (e: unknown) {
      // Revert to the value we started from, not to `null` — the row may have
      // been toggled earlier in this session.
      setAllowedOverrides((m) => ({ ...m, [studentId]: current }))
      toast.error(errMsg(e, `Could not update ${name}'s placement approval.`))
    } finally {
      setSavingId(null)
    }
  }

  const openProfile = (id: number, name: string, rollNo: string) => {
    if (batchId === null) return
    setOpenStudent({ id, name, rollNo })
    setProfile({ loading: true, error: null })
    getCoordinatorStudentProfile(batchId, id)
      .then((data) => setProfile({ data, loading: false, error: null }))
      .catch((e: unknown) =>
        setProfile({
          loading: false,
          error: errMsg(e, 'Could not load the profile.'),
        }),
      )
  }

  if (!access) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <NoAccessEmptyState />
      </div>
    )
  }

  return (
    <div className="mx-auto flex h-full max-w-7xl flex-col gap-4 pb-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <UserCheck className="size-5 text-muted-foreground" />
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Students</h1>
            <p className="text-sm text-muted-foreground">
              Placement readiness for the batches you verify.
            </p>
          </div>
        </div>
        {batches.length > 0 && (
          <div className="min-w-64">
            <Combobox
              value={batchId}
              options={batches.map((b) => ({
                value: b.programme_admission_year_id,
                label: b.label,
              }))}
              onChange={changeBatch}
              placeholder="Select a batch…"
              searchPlaceholder="Search batches…"
            />
          </div>
        )}
      </div>

      {batchesLoaded && batches.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <p className="text-sm font-medium">No batches assigned</p>
          <p className="mt-1 text-sm text-muted-foreground">
            This screen shows the students of the programme &amp; batch
            combinations you are a profile verifier for. Ask an administrator to
            add you as a verifier.
          </p>
        </div>
      ) : (
        <>
          <TabBar tabs={TABS} active={tab} onChange={setTab} />

          {/* The search panel needs a height-bounded parent; the analytics tab
              scrolls on its own. Both are kept mounted-on-demand so switching
              tabs refetches rather than holding two result sets. */}
          {tab === 'students' ? (
            <div className="min-h-0 flex-1">
              {searchApi && (
                <StudentSearchPanel
                  api={searchApi}
                  hiddenAttrs={HIDDEN_ATTRS}
                  showFilterHelp
                  searchNonce={searchNonce}
                  toolbarExtra={
                    <BucketSwitch value={bucket} onChange={changeBucket} />
                  }
                  rowColumns={[
                    {
                      key: 'allowed',
                      header: 'Allowed',
                      className: 'w-28',
                      render: (row) => {
                        const id = Number(row.id)
                        const name = String(row.display_name ?? 'this student')
                        const allowed = allowedOf(row, allowedOverrides)
                        return (
                          <Switch
                            checked={allowed === true}
                            onCheckedChange={(next) =>
                              setPendingToggle({
                                id,
                                name,
                                current: allowed,
                                next,
                              })
                            }
                            disabled={!canEdit || savingId === id}
                            aria-label={`Allowed for placements: ${name}`}
                          />
                        )
                      },
                    },
                    {
                      key: 'profile',
                      header: 'Profile',
                      className: 'w-32',
                      render: (row) => {
                        const completion = row._completion as
                          | ProfileCompletion
                          | undefined
                        if (!completion) return null
                        const id = Number(row.id)
                        const name = String(row.display_name ?? 'this student')
                        const rollNo = String(row.student_id ?? '')
                        return (
                          <button
                            type="button"
                            onClick={() => openProfile(id, name, rollNo)}
                            className="flex items-center gap-1.5"
                            title="Open full profile"
                          >
                            <Progress
                              value={completion.pct}
                              className="h-1.5 w-14"
                              indicatorClassName={completionTone(
                                completion.pct,
                              )}
                            />
                            <span className="text-xs tabular-nums text-muted-foreground">
                              {completion.pct}%
                            </span>
                          </button>
                        )
                      },
                    },
                  ]}
                />
              )}
            </div>
          ) : (
            batchId !== null && (
              <div className="scrollbar-themed min-h-0 flex-1 overflow-y-auto">
                <CoordinatorStudentsAnalyticsTab payId={batchId} />
              </div>
            )
          )}
        </>
      )}

      {/* Confirm before writing — the switch is a one-click change to a
          student's placement eligibility, so a mis-click must not commit. */}
      <Dialog
        open={pendingToggle !== null}
        onOpenChange={(open) => {
          if (!open) setPendingToggle(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {pendingToggle?.next
                ? `Allow ${pendingToggle.name} for placements?`
                : `Mark ${pendingToggle?.name} as not allowed?`}
            </DialogTitle>
            <DialogDescription>
              {pendingToggle?.next
                ? 'They will appear in drive eligibility checks and can be imported into drives.'
                : 'They will stop appearing in drive eligibility checks and cannot be imported into new drives. Existing drive records are untouched.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingToggle(null)}>
              Cancel
            </Button>
            <Button
              variant={pendingToggle?.next ? 'default' : 'destructive'}
              disabled={savingId !== null}
              onClick={() => {
                if (!pendingToggle) return
                const { id, current, name } = pendingToggle
                setPendingToggle(null)
                void toggleAllowed(id, current, name)
              }}
            >
              {pendingToggle?.next ? 'Allow' : 'Mark not allowed'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet
        open={openStudent !== null}
        onOpenChange={(open) => {
          if (!open) setOpenStudent(null)
        }}
      >
        <SheetContent side="right" className="flex w-full flex-col sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle>{openStudent?.name ?? 'Student'}</SheetTitle>
            <SheetDescription>
              {openStudent?.rollNo || 'Full profile'}
            </SheetDescription>
          </SheetHeader>
          <div className="scrollbar-themed min-h-0 flex-1 overflow-y-auto px-4 pb-4">
            <StudentProfileDetails
              slot={profile}
              extra={
                profile.data && (
                  <div className="space-y-3 rounded-lg border p-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        Profile completion
                      </span>
                      <span className="font-medium tabular-nums">
                        {profile.data.completion.pct}% (
                        {profile.data.completion.filled}/
                        {profile.data.completion.required})
                      </span>
                    </div>
                    <Progress
                      value={profile.data.completion.pct}
                      className="h-1.5"
                      indicatorClassName={completionTone(
                        profile.data.completion.pct,
                      )}
                    />
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant="secondary">
                        Allowed by dept:{' '}
                        {profile.data.placement
                          .allowed_by_dept_for_placements === null
                          ? 'Not set'
                          : profile.data.placement
                                .allowed_by_dept_for_placements
                            ? 'Yes'
                            : 'No'}
                      </Badge>
                      <Badge variant="secondary">
                        Interested:{' '}
                        {profile.data.placement
                          .interested_in_placements_self === null
                          ? 'Not set'
                          : profile.data.placement.interested_in_placements_self
                            ? 'Yes'
                            : 'No'}
                      </Badge>
                    </div>
                  </div>
                )
              }
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}

/**
 * The row's effective allowed value: an optimistic override from this session
 * if the coordinator has toggled it, otherwise whatever the server hydrated
 * onto the row.
 */
function allowedOf(
  row: Record<string, unknown>,
  overrides: Record<number, boolean | null>,
): boolean | null {
  const id = Number(row.id)
  if (id in overrides) return overrides[id]
  return (row._allowed ?? null) as boolean | null
}

const BUCKETS: Array<{ value: AllowedBucket; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'allowed', label: 'Allowed' },
  { value: 'not_allowed', label: 'Not allowed' },
]

/**
 * The allowed / not-allowed bucket switch. Applied server-side as scope, so it
 * composes with — rather than competing against — whatever is in the filter
 * builder. The two non-"All" buckets partition the batch exactly: a student
 * whose flag was never set counts as not allowed.
 */
function BucketSwitch({
  value,
  onChange,
}: {
  value: AllowedBucket
  onChange: (next: AllowedBucket) => void
}) {
  return (
    <div className="inline-flex rounded-lg border p-0.5">
      {BUCKETS.map((b) => (
        <button
          key={b.value}
          type="button"
          onClick={() => onChange(b.value)}
          aria-pressed={value === b.value}
          className={cn(
            'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
            value === b.value
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-muted',
          )}
        >
          {b.label}
        </button>
      ))}
    </div>
  )
}
