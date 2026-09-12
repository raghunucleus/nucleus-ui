import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  StudentProfileDetails,
  type Slot,
} from '@/components/employee/drive-student-detail-sheet'
import { NoAccessEmptyState } from '@/components/employee/empty-states'
import { PageHeader } from '@/components/ui/page-header'
import {
  AcademicsCard,
  SelectionsCard,
} from '@/components/employee/student-search/eligibility-cards'
import {
  HoverCardStatus,
  HoverDetail,
} from '@/components/employee/student-search/hover-detail'
import { StudentSearchPanel } from '@/components/employee/student-search/student-search-panel'
import { useHoverCache } from '@/components/employee/student-search/use-hover-cache'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { useScreenAccess } from '@/hooks/use-screen-access'
import { ApiError } from '@/lib/api'
import {
  eligibilityCheckSearchApi,
  getEligibilityStudentAcademics,
  getEligibilityStudentPlacements,
  getEligibilityStudentProfile,
  type DriveStudentProfile,
  type StudentAcademics,
  type StudentSelection,
} from '@/lib/drive-management'
import type { SearchGroup } from '@/lib/student-search'

const SCREEN_KEY = 'drive_management.eligibility_check.view'

// Module-level so the panel's boot effect (keyed on `api`) sees one stable
// adapter identity for the page's lifetime.
const API = eligibilityCheckSearchApi()

/**
 * Same recommended defaults the drive Filter tab seeds — but NOT locked here:
 * this is an exploratory tool, and "who hasn't opted in yet?" is a legitimate
 * eligibility question, so the rows delete without a confirmation.
 */
const SEEDED: SearchGroup = {
  and: [
    { attr: 'is_active', op: 'eq', value: true },
    { attr: 'allowed_by_dept_for_placements', op: 'eq', value: true },
    { attr: 'interested_in_placements_self', op: 'eq', value: true },
  ],
}

/**
 * The screen's own default columns — roll number and full name arrive as
 * implicit columns, so they aren't listed. `placed_count` renders as a hover
 * trigger; the academic fields are deliberately NOT columns (see the Academics
 * card below).
 */
const DEFAULT_COLUMNS = [
  'programme',
  'pass_out_year',
  'mobile_number',
  'email',
  'placed_count',
]

/**
 * The raw database id — always returned, never useful here, and it would sit
 * left of the roll number and scroll out from under the pinned column.
 */
const HIDE_COLUMNS = ['id']

const EMPTY_SLOT: Slot<DriveStudentProfile> = { loading: false, error: null }

/** Which student a modal is open for, plus the row labels for its header. */
interface OpenStudent {
  id: number
  name: string
  rollNo: string
}

/** Read the row's identity columns, which are always present (implicit). */
function openStudentFrom(row: Record<string, unknown>): OpenStudent | null {
  if (typeof row.id !== 'number') return null
  return {
    id: row.id,
    name: typeof row.display_name === 'string' ? row.display_name : 'Student',
    rollNo: typeof row.student_id === 'string' ? row.student_id : '',
  }
}

/**
 * Eligibility check — the drive Filter tab's full student search without a
 * drive. The placement cell answers "who would qualify?" questions here before
 * (or without) creating a drive; results are institution-wide and export goes
 * through the async exports framework.
 *
 * Selections and academics are hover cards rather than columns: both are wide
 * (a list, and six fields) and most rows are never inspected, so they're
 * fetched per student on first hover instead of joined into every search. Each
 * also opens as a modal on click — the reliable way to read a long list, and
 * the only path on touch, where there is no hover at all. Clicking the roll
 * number opens the student's whole profile.
 */
export default function EmployeeEligibilityCheckPage() {
  useEffect(() => {
    document.title = 'Students & Eligibility — Nucleus'
  }, [])

  const access = useScreenAccess(SCREEN_KEY)

  const placements = useHoverCache<StudentSelection[]>(
    getEligibilityStudentPlacements,
  )
  const academics = useHoverCache<StudentAcademics>(
    getEligibilityStudentAcademics,
  )

  // The click-through surfaces. All three reuse the hover caches, so a modal
  // opened after a hover costs no second request.
  const [selectionsFor, setSelectionsFor] = useState<OpenStudent | null>(null)
  const [academicsFor, setAcademicsFor] = useState<OpenStudent | null>(null)
  const [profileFor, setProfileFor] = useState<OpenStudent | null>(null)
  const [profile, setProfile] = useState<Slot<DriveStudentProfile>>(EMPTY_SLOT)

  // Profile is NOT hover-cached: it is a large payload behind a deliberate
  // click, and re-reading it on reopen keeps a stale profile off the screen.
  // Fetched from the handler rather than an effect (the house pattern — see
  // `openProfile` in placement-coordinator-students.tsx); `latestProfileId`
  // drops a slow response for a student the user has already navigated past.
  const latestProfileId = useRef<number | null>(null)
  const openProfile = useCallback((student: OpenStudent) => {
    latestProfileId.current = student.id
    setProfileFor(student)
    setProfile({ loading: true, error: null })
    const settle = (slot: Slot<DriveStudentProfile>) => {
      if (latestProfileId.current === student.id) setProfile(slot)
    }
    getEligibilityStudentProfile(student.id).then(
      (data) => settle({ data, loading: false, error: null }),
      (e: unknown) =>
        settle({
          loading: false,
          error:
            e instanceof ApiError || e instanceof Error
              ? e.message
              : 'Could not load the profile.',
        }),
    )
  }, [])

  const rollNumberCell = useCallback(
    (row: Record<string, unknown>) => {
      const student = openStudentFrom(row)
      const text = typeof row.student_id === 'string' ? row.student_id : '—'
      if (!student) return <span>{text}</span>
      return (
        <button
          type="button"
          onClick={() => openProfile(student)}
          className="font-medium text-primary underline-offset-2 hover:underline"
        >
          {text}
        </button>
      )
    },
    [openProfile],
  )

  const placedCell = useCallback(
    (row: Record<string, unknown>) => {
      const student = openStudentFrom(row)
      const count = typeof row.placed_count === 'number' ? row.placed_count : 0
      if (!student) return <span>{count}</span>
      const data = placements.byId[student.id]
      return (
        <HoverDetail
          label="Selection details"
          onOpen={() => placements.ensure(student.id)}
          onClick={() => {
            placements.ensure(student.id)
            setSelectionsFor(student)
          }}
          trigger={<span className="tabular-nums">{count}</span>}
        >
          {data === undefined ? (
            <HoverCardStatus text="Loading…" />
          ) : data === null ? (
            <HoverCardStatus text="Couldn't load the selections." />
          ) : (
            <SelectionsCard data={data} />
          )}
        </HoverDetail>
      )
    },
    [placements],
  )

  const academicsColumn = useMemo(
    () => [
      {
        key: 'academics',
        header: 'Academics',
        render: (row: Record<string, unknown>) => {
          const student = openStudentFrom(row)
          if (!student) return <span className="text-sm">—</span>
          const data = academics.byId[student.id]
          return (
            <HoverDetail
              label="Academic details"
              onOpen={() => academics.ensure(student.id)}
              onClick={() => {
                academics.ensure(student.id)
                setAcademicsFor(student)
              }}
              trigger={<span className="text-sm">View</span>}
              width={260}
            >
              {data === undefined ? (
                <HoverCardStatus text="Loading…" />
              ) : data === null ? (
                <HoverCardStatus text="Couldn't load the academics." />
              ) : (
                <AcademicsCard data={data} />
              )}
            </HoverDetail>
          )
        },
      },
    ],
    [academics],
  )

  const cellRenderers = useMemo(
    () => ({ student_id: rollNumberCell, placed_count: placedCell }),
    [rollNumberCell, placedCell],
  )

  const selectionsData = selectionsFor
    ? placements.byId[selectionsFor.id]
    : undefined
  const academicsData = academicsFor ? academics.byId[academicsFor.id] : undefined

  if (!access) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <NoAccessEmptyState />
      </div>
    )
  }

  return (
    <div className="mx-auto flex h-full max-w-7xl flex-col gap-4 pb-4">
      <PageHeader title="Students & Eligibility" />
      <div className="min-h-0 flex-1">
        <StudentSearchPanel
          api={API}
          initialFilters={SEEDED}
          showFilterHelp
          defaultColumns={DEFAULT_COLUMNS}
          hideColumns={HIDE_COLUMNS}
          stickyColumn="student_id"
          cellRenderers={cellRenderers}
          appendColumns={academicsColumn}
          exportStorageKey="eligibility-check-export-columns"
        />
      </div>

      {/* The two hover cards, pinned open. Same bodies, roomier frame. */}
      <Dialog
        open={selectionsFor !== null}
        onOpenChange={(open) => {
          if (!open) setSelectionsFor(null)
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Selections</DialogTitle>
            <DialogDescription>
              {selectionsFor?.name}
              {selectionsFor?.rollNo ? ` · ${selectionsFor.rollNo}` : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="scrollbar-themed max-h-[60vh] overflow-y-auto">
            {selectionsData === undefined ? (
              <HoverCardStatus text="Loading…" />
            ) : selectionsData === null ? (
              <HoverCardStatus text="Couldn't load the selections." />
            ) : (
              <SelectionsCard data={selectionsData} />
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={academicsFor !== null}
        onOpenChange={(open) => {
          if (!open) setAcademicsFor(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Academics</DialogTitle>
            <DialogDescription>
              {academicsFor?.name}
              {academicsFor?.rollNo ? ` · ${academicsFor.rollNo}` : ''}
            </DialogDescription>
          </DialogHeader>
          {academicsData === undefined ? (
            <HoverCardStatus text="Loading…" />
          ) : academicsData === null ? (
            <HoverCardStatus text="Couldn't load the academics." />
          ) : (
            <AcademicsCard data={academicsData} />
          )}
        </DialogContent>
      </Dialog>

      {/* Roll-number click — the whole profile, in the same renderer the drive
          Students tab and the coordinator students screen use. */}
      <Sheet
        open={profileFor !== null}
        onOpenChange={(open) => {
          if (!open) setProfileFor(null)
        }}
      >
        {/* Near-full-width: ~50 attributes across a dozen groups, which a 2xl
            panel would force into a one-column crawl. */}
        <SheetContent
          side="right"
          className="flex w-full flex-col sm:max-w-[92vw] lg:max-w-6xl"
        >
          <SheetHeader>
            {/* pr-12 clears SheetContent's own close button, pinned at
                `absolute top-4 right-4`. */}
            <div className="pr-12">
              <SheetTitle>{profileFor?.name ?? 'Student'}</SheetTitle>
              <SheetDescription>
                {profileFor?.rollNo || 'Full profile'}
              </SheetDescription>
            </div>
          </SheetHeader>
          <div className="scrollbar-themed min-h-0 flex-1 overflow-y-auto px-4 pb-4">
            <StudentProfileDetails slot={profile} />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
