import { useEffect, useState, type ReactNode } from 'react'
import { History, ListChecks, User } from 'lucide-react'

import { CompanyLogo, TabBar } from '@/components/corporate-relations/bits'
import { DriveStudentTrackTimeline } from '@/components/employee/drive-student-track'
import { Badge } from '@/components/ui/badge'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { ApiError } from '@/lib/api'
import {
  DRIVE_STATUS_LABELS,
  DRIVE_STUDENT_STATUS,
  DRIVE_STUDENT_STATUS_BADGE,
  DRIVE_STUDENT_STATUS_LABELS,
  type DriveStudentActivityRow,
  type DriveStudentProfile,
  type DriveStudentTrack,
} from '@/lib/drive-management'

/**
 * The per-surface data layer: the manage page passes the drive-management
 * fetchers, the coordinator page its scope-checked equivalents — the sheet
 * itself is surface-agnostic.
 */
export interface DriveStudentDetailApi {
  getProfile(driveId: number, studentId: number): Promise<DriveStudentProfile>
  getDriveActivity(
    driveId: number,
    studentId: number,
  ): Promise<{ items: DriveStudentActivityRow[] }>
  getTrack(driveId: number, studentId: number): Promise<DriveStudentTrack>
}

const TABS = [
  { key: 'details', label: 'Details', icon: User },
  { key: 'activity', label: 'Drive Activity', icon: History },
  { key: 'track', label: 'This Drive', icon: ListChecks },
]

type TabKey = 'details' | 'activity' | 'track'

/** One lazily-fetched tab's slot: undefined = not requested yet. */
export interface Slot<T> {
  data?: T
  loading: boolean
  error: string | null
}

const EMPTY_SLOT = { loading: false, error: null }

function errorMessage(e: unknown): string {
  return e instanceof ApiError || e instanceof Error
    ? e.message
    : 'Could not load.'
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' })
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

/** "designation · CTC ₹x – ₹y LPA · Stipend ₹z/month" for a Selected row. */
function packageSummary(r: DriveStudentActivityRow): string | null {
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

/** The row's latest lifecycle moment, for the card's date line. */
function activityDateLine(r: DriveStudentActivityRow): string {
  if (r.revoked_at) return `Revoked ${formatDateTime(r.revoked_at)}`
  if (r.outcome_marked_at)
    return `Outcome ${formatDateTime(r.outcome_marked_at)}`
  if (r.responded_at) return `Responded ${formatDateTime(r.responded_at)}`
  if (r.invited_at) return `Invited ${formatDateTime(r.invited_at)}`
  return `Imported ${formatDateTime(r.imported_at)}`
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3 pt-2">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-10 animate-pulse rounded-lg bg-muted" />
      ))}
    </div>
  )
}

/**
 * The Students tab's row-click slide-over: the student's full profile
 * (Details), their lifecycle in every other drive (Drive Activity) and the
 * audit trail in this drive (This Drive). Each tab fetches lazily on first
 * activation; everything resets when the sheet opens on another student.
 */
export function DriveStudentDetailSheet({
  driveId,
  studentId,
  studentName,
  open,
  onOpenChange,
  api,
}: {
  driveId: number
  studentId: number | null
  /** Row-sourced fallback for the header while the profile loads. */
  studentName?: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  api: DriveStudentDetailApi
}) {
  const [tab, setTab] = useState<TabKey>('details')
  const [profile, setProfile] = useState<Slot<DriveStudentProfile>>(EMPTY_SLOT)
  const [activity, setActivity] =
    useState<Slot<DriveStudentActivityRow[]>>(EMPTY_SLOT)
  const [track, setTrack] = useState<Slot<DriveStudentTrack>>(EMPTY_SLOT)

  // New student (or reopen) → back to Details, all three sections fetched
  // eagerly in one pass. The slot states deliberately stay OUT of the deps:
  // listing them re-triggers the effect on every set(), whose cleanup would
  // cancel the in-flight fetch and strand the slot at loading forever.
  useEffect(() => {
    if (!open || studentId === null) return
    let cancelled = false
    setTab('details')
    setProfile({ loading: true, error: null })
    setActivity({ loading: true, error: null })
    setTrack({ loading: true, error: null })
    const load = <T,>(set: (s: Slot<T>) => void, p: Promise<T>) =>
      p
        .then((data) => {
          if (!cancelled) set({ data, loading: false, error: null })
        })
        .catch((e: unknown) => {
          if (!cancelled) set({ loading: false, error: errorMessage(e) })
        })
    void load(setProfile, api.getProfile(driveId, studentId))
    void load(
      setActivity,
      api.getDriveActivity(driveId, studentId).then((r) => r.items),
    )
    void load(setTrack, api.getTrack(driveId, studentId))
    return () => {
      cancelled = true
    }
  }, [open, studentId, driveId, api])

  const p = profile.data

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>
            {p?.student.display_name ?? studentName ?? 'Student'}
          </SheetTitle>
          <SheetDescription>
            {p
              ? `${p.student.roll_no}${p.student.programme ? ` · ${p.student.programme}` : ''}`
              : 'Profile, drive activity and history in this drive.'}
          </SheetDescription>
        </SheetHeader>

        <div className="px-4">
          <TabBar tabs={TABS} active={tab} onChange={(k) => setTab(k as TabKey)} />
        </div>

        <div className="scrollbar-themed min-h-0 flex-1 overflow-y-auto px-4 pb-4">
          {tab === 'details' && <StudentProfileDetails slot={profile} />}
          {tab === 'activity' && <ActivityTab slot={activity} />}
          {tab === 'track' && (
            <>
              {track.loading ? (
                <LoadingSkeleton />
              ) : track.error ? (
                <p className="pt-4 text-sm text-destructive">{track.error}</p>
              ) : track.data ? (
                <DriveStudentTrackTimeline track={track.data} />
              ) : null}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

/**
 * The read-only rendering of an employee-facing student profile: entry-type
 * badges, the registry groups, certifications and resume links. Shared by this
 * sheet's Details tab and the placement-coordinator students sheet — `extra`
 * lets a host inject surface-specific content (a completion bar, placement
 * flags) above the badges without forking the renderer.
 */
export function StudentProfileDetails({
  slot,
  extra,
}: {
  slot: Slot<DriveStudentProfile>
  extra?: ReactNode
}) {
  if (slot.loading) return <LoadingSkeleton />
  if (slot.error)
    return <p className="pt-4 text-sm text-destructive">{slot.error}</p>
  const p = slot.data
  if (!p) return null

  return (
    <div className="space-y-5 pt-3">
      {extra}
      <div className="flex flex-wrap gap-1.5">
        <Badge variant="secondary">{p.student.entry_type_label}</Badge>
        <Badge variant="secondary">
          Admitted {p.student.admission_year_display}
        </Badge>
        {p.student.pass_out_year != null && (
          <Badge variant="secondary">Passout {p.student.pass_out_year}</Badge>
        )}
      </div>

      {[...p.groups]
        .sort((a, b) => a.order - b.order)
        .map((g) => (
          <section key={g.key}>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {g.label}
            </h3>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
              {g.fields.map((f) => (
                <div key={f.key} className="min-w-0">
                  <dt className="text-xs text-muted-foreground">{f.label}</dt>
                  <dd className="break-words text-sm">{f.display ?? '—'}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Industry certifications
        </h3>
        {p.certifications.length === 0 ? (
          <p className="text-sm text-muted-foreground">None recorded.</p>
        ) : (
          <ul className="space-y-1">
            {p.certifications.map((c) => (
              <li key={c.id} className="text-sm">
                {c.certificate_file_url ? (
                  <a
                    href={c.certificate_file_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary underline-offset-2 hover:underline"
                  >
                    {c.name}
                  </a>
                ) : (
                  c.name
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Resume
        </h3>
        {p.resume.external_url ? (
          <p className="text-sm">
            <a
              href={p.resume.external_url}
              target="_blank"
              rel="noreferrer"
              className="text-primary underline-offset-2 hover:underline"
            >
              Open resume
            </a>
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">No resume on file.</p>
        )}
      </section>
    </div>
  )
}

function ActivityTab({ slot }: { slot: Slot<DriveStudentActivityRow[]> }) {
  if (slot.loading) return <LoadingSkeleton />
  if (slot.error)
    return <p className="pt-4 text-sm text-destructive">{slot.error}</p>
  const items = slot.data
  if (!items) return null
  if (items.length === 0) {
    return (
      <p className="pt-4 text-sm text-muted-foreground">
        No other drive activity.
      </p>
    )
  }
  return (
    <ul className="space-y-3 pt-3">
      {items.map((r) => {
        const pkg =
          r.status === DRIVE_STUDENT_STATUS.SELECTED ? packageSummary(r) : null
        return (
          <li key={r.drive_id} className="rounded-lg border p-3">
            <div className="flex items-start gap-3">
              <CompanyLogo name={r.company.name} logoUrl={r.company.logo_url} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <p className="truncate text-sm font-medium">{r.drive_name}</p>
                  <Badge variant={DRIVE_STUDENT_STATUS_BADGE[r.status]}>
                    {DRIVE_STUDENT_STATUS_LABELS[r.status] ?? r.status}
                  </Badge>
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {r.company.name}
                  {r.offer_type ? ` · ${r.offer_type}` : ''}
                  {` · ${DRIVE_STATUS_LABELS[r.drive_status] ?? r.drive_status}`}
                  {r.drive_date ? ` · Drive ${formatDate(r.drive_date)}` : ''}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {activityDateLine(r)}
                </p>
                {pkg && <p className="mt-1 text-xs">{pkg}</p>}
                {r.rejection_reason && (
                  <p className="mt-1 break-words rounded-md bg-muted/50 px-2 py-1.5 text-xs">
                    {r.rejection_reason}
                  </p>
                )}
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
