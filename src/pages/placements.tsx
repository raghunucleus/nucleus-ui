import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import {
  ArrowLeft,
  Briefcase,
  Check,
  CircleAlert,
  Globe,
  Goal,
  Loader2,
  Mailbox,
  MapPin,
  RefreshCw,
  ScrollText,
  Tag,
  Wallet,
  X,
} from 'lucide-react'
import { toast } from 'sonner'

import {
  CompanyBadge,
  DenyInviteDialog,
  PlacementInviteCard,
  PlacementRecordRow,
  formatPlacementDate,
  formatPlacementDateTime,
} from '@/components/placement-invite'
import { DriveEligibilitySummary } from '@/components/drive-management/drive-eligibility-summary'
import {
  BondFact,
  Fact,
  IconBondFact,
  IconFact,
  IconMoneyFact,
  MoneyFact,
} from '@/components/drive-management/facts'
import { FilterChips } from '@/components/placement-filter-chips'
import { PlacementHistoryTimeline } from '@/components/placement-history'
import { PageHeader } from '@/components/portal-layout'
import { StateView } from '@/components/state-view'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { RichTextView } from '@/components/ui/rich-text/rich-text-view'
import { ApiError } from '@/lib/api'
import {
  companyWebsiteHref,
  companyWebsiteLabel,
} from '@/lib/drive-management'
import {
  DRIVE_FILTERS,
  INVITE_FILTERS,
  PLACEMENT_STATUS,
  PLACEMENT_STATUS_BADGE,
  PLACEMENT_STATUS_LABELS,
  acceptPlacementInvite,
  driveFilterOf,
  fetchPlacementDrive,
  fetchPlacementDrives,
  inviteFilterOf,
  type DriveFilter,
  type InviteFilter,
  type PlacementDriveDetail,
  type PlacementDriveRecord,
} from '@/lib/student-placements'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'

function errMsg(err: unknown, fallback: string): string {
  return err instanceof ApiError || err instanceof Error
    ? err.message
    : fallback
}

type Tab = 'invites' | 'drives'

const INVITE_FILTER_LABELS: Record<InviteFilter, string> = {
  pending: 'Pending',
  accepted: 'Accepted',
  rejected: 'Rejected',
}

const INVITE_FILTER_TONES: Record<InviteFilter, string> = {
  pending: 'border-warning bg-warning/10 text-warning',
  accepted: 'border-success bg-success/10 text-success',
  rejected: 'border-destructive bg-destructive/10 text-destructive',
}

const DRIVE_FILTER_LABELS: Record<DriveFilter, string> = {
  accepted: 'Accepted',
  selected: 'Selected',
  not_selected: 'Not Selected',
  rejected: 'Rejected',
  others: 'Others',
  all: 'All',
}

const DRIVE_FILTER_TONES: Record<DriveFilter, string> = {
  accepted: 'border-primary bg-primary/10 text-primary',
  selected: 'border-success bg-success/10 text-success',
  not_selected: 'border-destructive bg-destructive/10 text-destructive',
  rejected: 'border-destructive bg-destructive/10 text-destructive',
  others: 'border-muted-foreground/40 bg-muted text-muted-foreground',
  all: 'border-primary bg-primary/10 text-primary',
}

const INVITE_EMPTY: Record<InviteFilter, { title: string; description: string }> = {
  pending: {
    title: 'No pending invitations',
    description:
      'When the placement cell invites you to a drive, it will show up here.',
  },
  accepted: {
    title: 'No accepted invitations',
    description: 'Invitations you accept will be listed here.',
  },
  rejected: {
    title: 'No rejected invitations',
    description: "You haven't declined any invitations.",
  },
}

const DRIVE_EMPTY: Record<DriveFilter, { title: string; description: string }> = {
  accepted: {
    title: 'No accepted drives',
    description: 'Accept an invitation and the drive will show up here.',
  },
  selected: {
    title: 'No selections yet',
    description: 'Drives where you are selected will show up here.',
  },
  not_selected: {
    title: 'Nothing here',
    description: 'Drives where you were not selected will show up here.',
  },
  rejected: {
    title: 'No rejected drives',
    description: "You haven't declined any drive invitations.",
  },
  others: {
    title: 'Nothing here',
    description:
      'Pending invitations, revoked and not-attended drives will show up here.',
  },
  all: {
    title: 'No drives yet',
    description:
      'When the placement cell invites you to a drive, it will show up here.',
  },
}

/**
 * The student Placements module: Invites (accept / deny with reason) and
 * Drives — the full history of every drive the student was invited to, both
 * filterable by status chips.
 */
export default function Placements() {
  const signOut = useAuthStore((state) => state.signOut)
  const search = useSearch({ strict: false }) as {
    tab?: Tab
    drive?: number
    invitesFilter?: InviteFilter
    drivesFilter?: DriveFilter
  }
  const navigate = useNavigate()
  const tab: Tab = search.tab ?? 'invites'
  const inviteFilter: InviteFilter = search.invitesFilter ?? 'pending'
  const driveFilter: DriveFilter = search.drivesFilter ?? 'accepted'

  const [records, setRecords] = useState<PlacementDriveRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    document.title = 'Placements — Nucleus'
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const drv = await fetchPlacementDrives()
      setRecords(drv.items)
      setError(null)
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        signOut()
        return
      }
      setError(errMsg(err, 'Could not load placements.'))
    } finally {
      setLoading(false)
    }
  }, [signOut])

  useEffect(() => {
    void load()
  }, [load])

  // Each tab remembers its own chip; both survive tab switches via the URL.
  const filters = {
    invitesFilter: search.invitesFilter,
    drivesFilter: search.drivesFilter,
  }
  const setTab = (next: Tab) =>
    void navigate({ to: '/placements', search: { tab: next, ...filters } })
  const setInviteFilter = (next: InviteFilter) =>
    void navigate({
      to: '/placements',
      search: { tab, ...filters, invitesFilter: next },
    })
  const setDriveFilter = (next: DriveFilter) =>
    void navigate({
      to: '/placements',
      search: { tab, ...filters, drivesFilter: next },
    })
  const openDrive = (driveId: number) =>
    void navigate({
      to: '/placements',
      search: { tab, ...filters, drive: driveId },
    })

  if (search.drive != null) {
    return (
      <DriveDetailView
        driveId={search.drive}
        onBack={() =>
          void navigate({ to: '/placements', search: { tab, ...filters } })
        }
        onChanged={load}
      />
    )
  }

  const inviteCounts: Record<InviteFilter, number> = {
    pending: 0,
    accepted: 0,
    rejected: 0,
  }
  const driveCounts: Record<DriveFilter, number> = {
    accepted: 0,
    selected: 0,
    not_selected: 0,
    rejected: 0,
    others: 0,
    all: records.length,
  }
  for (const r of records) {
    inviteCounts[inviteFilterOf(r)]++
    driveCounts[driveFilterOf(r)]++
  }
  const inviteRows = records.filter((r) => inviteFilterOf(r) === inviteFilter)
  const driveRows =
    driveFilter === 'all'
      ? records
      : records.filter((r) => driveFilterOf(r) === driveFilter)

  return (
    <>
      <PageHeader
        title="Placements"
        subtitle="Drive invitations and your placement journey"
        icon={Goal}
        accent="blue"
      />

      {/* Tab strip */}
      <div className="mb-4 inline-flex rounded-lg border bg-card p-0.5">
        {(
          [
            { key: 'invites', label: `Invites (${inviteCounts.pending})` },
            { key: 'drives', label: `Drives (${records.length})` },
          ] as { key: Tab; label: string }[]
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            aria-pressed={tab === t.key}
            className={cn(
              'rounded-md px-4 py-1.5 text-sm font-medium transition-colors',
              tab === t.key
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error ? (
        <StateView
          icon={CircleAlert}
          title="Could not load placements"
          description={error}
          action={{ label: 'Retry', onClick: () => void load(), icon: RefreshCw }}
        />
      ) : loading ? (
        <div className="space-y-2.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : tab === 'invites' ? (
        <div className="space-y-4">
          <FilterChips
            value={inviteFilter}
            onChange={setInviteFilter}
            items={INVITE_FILTERS.map((f) => ({
              value: f,
              label: INVITE_FILTER_LABELS[f],
              count: inviteCounts[f],
              tone: INVITE_FILTER_TONES[f],
            }))}
          />
          {inviteRows.length === 0 ? (
            <StateView
              icon={Mailbox}
              title={INVITE_EMPTY[inviteFilter].title}
              description={INVITE_EMPTY[inviteFilter].description}
            />
          ) : inviteFilter === 'pending' ? (
            <div className="space-y-2.5">
              {inviteRows.map((inv) => (
                <PlacementInviteCard
                  key={inv.drive_id}
                  invite={inv}
                  onView={() => openDrive(inv.drive_id)}
                  onChanged={() => void load()}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-2.5">
              {inviteRows.map((r) => (
                <PlacementRecordRow
                  key={r.drive_id}
                  record={r}
                  onOpen={openDrive}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <FilterChips
            value={driveFilter}
            onChange={setDriveFilter}
            items={DRIVE_FILTERS.map((f) => ({
              value: f,
              label: DRIVE_FILTER_LABELS[f],
              count: driveCounts[f],
              tone: DRIVE_FILTER_TONES[f],
            }))}
          />
          {driveRows.length === 0 ? (
            <StateView
              icon={Goal}
              title={DRIVE_EMPTY[driveFilter].title}
              description={DRIVE_EMPTY[driveFilter].description}
            />
          ) : (
            <div className="space-y-2.5">
              {driveRows.map((r) => (
                <PlacementRecordRow
                  key={r.drive_id}
                  record={r}
                  onOpen={openDrive}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// Drive detail — company, package, designations with JD, accept/deny actions
// ---------------------------------------------------------------------------

function DriveDetailView({
  driveId,
  onBack,
  onChanged,
}: {
  driveId: number
  onBack: () => void
  onChanged: () => void
}) {
  const [detail, setDetail] = useState<PlacementDriveDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [accepting, setAccepting] = useState(false)
  const [denyOpen, setDenyOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setDetail(await fetchPlacementDrive(driveId))
      setError(null)
    } catch (err) {
      setError(errMsg(err, 'Could not load the drive.'))
    } finally {
      setLoading(false)
    }
  }, [driveId])

  useEffect(() => {
    void load()
  }, [load])

  const onAccept = async () => {
    if (!detail) return
    setAccepting(true)
    try {
      await acceptPlacementInvite(driveId)
      toast.success(
        `You're in — ${detail.drive.drive_name} added to your Drives.`,
      )
      onChanged()
      void load()
    } catch (err) {
      toast.error(errMsg(err, 'Could not accept the invitation.'))
    } finally {
      setAccepting(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-9 w-40 animate-pulse rounded-md bg-muted" />
        <div className="h-24 animate-pulse rounded-xl bg-muted" />
        <div className="h-64 animate-pulse rounded-xl bg-muted" />
      </div>
    )
  }
  if (error || !detail) {
    return (
      <StateView
        icon={CircleAlert}
        title="Could not load the drive"
        description={error ?? undefined}
        action={{ label: 'Back', onClick: onBack, icon: ArrowLeft }}
      />
    )
  }

  const { drive, membership } = detail
  const isPendingInvite = membership.status === PLACEMENT_STATUS.INVITED

  return (
    <div className="space-y-5 pb-6">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to Placements
      </button>

      <div className="grid gap-5 lg:grid-cols-[1fr_20rem] lg:items-start">
        <div className="space-y-5">
      {/* Header card */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <CompanyBadge
            name={drive.company.name}
            logoUrl={drive.company.logo_url}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-base font-semibold">
                {drive.drive_name}
              </h1>
              <Badge variant={PLACEMENT_STATUS_BADGE[membership.status]}>
                {PLACEMENT_STATUS_LABELS[membership.status] ?? membership.status}
              </Badge>
            </div>
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
          {isPendingInvite && (
            <div className="flex shrink-0 items-center gap-1.5">
              <Button onClick={() => void onAccept()} disabled={accepting}>
                {accepting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Check className="size-4" />
                )}
                Accept
              </Button>
              <Button
                variant="outline"
                onClick={() => setDenyOpen(true)}
                disabled={accepting}
              >
                <X className="size-4" />
                Deny
              </Button>
            </div>
          )}
        </div>
        {membership.status === PLACEMENT_STATUS.DENIED &&
        membership.rejection_reason ? (
          <p className="mt-3 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
            You denied this invitation: {membership.rejection_reason}
          </p>
        ) : membership.status === PLACEMENT_STATUS.REVOKED ? (
          <p className="mt-3 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
            This invitation was revoked by the placement cell
            {membership.rejection_reason
              ? `: ${membership.rejection_reason}`
              : '.'}
          </p>
        ) : null}
      </Card>

      {/* Key facts */}
      <Card className="p-4">
        <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <Fact label="Drive date" value={formatPlacementDate(drive.drive_date)} />
          <Fact
            label="Register by"
            value={formatPlacementDateTime(drive.registration_end_date)}
          />
          {drive.offer_type ? (
            <Fact label="Offer type" value={drive.offer_type.name} />
          ) : null}
          {drive.job_locations.length > 0 ? (
            <Fact
              label="Job locations"
              value={drive.job_locations.map((l) => l.name).join(', ')}
            />
          ) : null}
          <MoneyFact
            label="Stipend"
            mode={drive.stipend_mode}
            min={drive.stipend_min}
            max={drive.stipend_max}
          />
          <MoneyFact
            label="CTC"
            mode={drive.ctc_mode}
            min={drive.ctc_min}
            max={drive.ctc_max}
          />
          <BondFact hasBond={drive.has_bond} bondYears={drive.bond_years} />
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

      {/* Eligibility — who this drive is open to */}
      <DriveEligibilitySummary summary={detail.eligibility} />

      {/* Designations */}
      {drive.profiles.map((p) => (
        <Card key={p.id} className="p-4">
          <h2 className="mb-3 text-base font-semibold">{p.designation.name}</h2>
          <dl className="mb-3 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            {p.offer_type ? (
              <IconFact icon={Tag} label="Job type" value={p.offer_type.name} />
            ) : null}
            {p.job_locations.length > 0 ? (
              <IconFact
                icon={MapPin}
                label="Locations"
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
              icon={Briefcase}
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

        {/* Action history */}
        <div className="space-y-5">
          <PlacementHistoryTimeline history={detail.history} />
        </div>
      </div>

      <DenyInviteDialog
        invite={
          denyOpen
            ? {
                drive_id: driveId,
                drive_name: drive.drive_name,
                company: drive.company,
                offer_type: drive.offer_type?.name ?? null,
                job_locations: drive.job_locations.map((l) => l.name),
                registration_end_date: drive.registration_end_date,
                drive_date: drive.drive_date,
                invited_at: membership.invited_at,
              }
            : null
        }
        onClose={() => setDenyOpen(false)}
        onDenied={() => {
          onChanged()
          void load()
        }}
      />
    </div>
  )
}

