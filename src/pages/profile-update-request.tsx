import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import {
  ArrowLeft,
  Award,
  CircleAlert,
  ClipboardList,
  Hourglass,
  Info,
  Paperclip,
  Plus,
  RefreshCw,
  Upload,
  X,
} from 'lucide-react'
import { toast } from 'sonner'

import { Textarea } from '@/components/corporate-relations/bits'
import { PageHeader } from '@/components/portal-layout'
import { Button } from '@/components/ui/button'
import { Combobox, type ComboboxOption } from '@/components/ui/combobox'
import { DatePicker } from '@/components/ui/date-picker'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ApiError } from '@/lib/api'
import {
  fetchCountries,
  fetchDiplomaBoards,
  fetchDistricts,
  fetchEntranceExams,
  fetchIndustryCertifications,
  fetchSchoolBoardsX,
  fetchSchoolBoardsXii,
  fetchStates,
  stageCertificateFile,
  type LookupOption,
} from '@/lib/student-profile'
import {
  fetchMyRequest,
  fetchProfileUpdateContext,
  PROFILE_FIELD_LABELS,
  resubmitProfileUpdateRequest,
  submitProfileUpdateRequest,
  type CertificationAddInput,
  type ProfileUpdateContext,
  type ProfileUpdateInput,
  type StudentRequestDetail,
} from '@/lib/student-requests'
import { cn } from '@/lib/utils'

function errMsg(err: unknown, fallback: string): string {
  return err instanceof ApiError || err instanceof Error
    ? err.message
    : fallback
}

const CURRENT_YEAR = new Date().getFullYear()
const CERTIFICATION_KEY_PREFIX = 'certification:'
const CERT_FILE_TYPES = ['application/pdf', 'image/jpeg', 'image/png']
const CERT_FILE_MAX_BYTES = 5 * 1024 * 1024

const AUTO_REQUESTABLE_HINT =
  'System-computed from posted marks; the next marks upload overwrites manual changes.'

// --- client-side form layout ---------------------------------------------------
// The set of requestable keys comes from the server (context.current is already
// filtered to the student's entry type); this only decides grouping, control
// kind and validation. Fields absent from the context are simply not rendered.

type ControlKind =
  | 'text'
  | 'phone'
  | 'email'
  | 'date'
  | 'enum'
  | 'boolean'
  | 'multiline'
  | 'percentage'
  | 'cgpa'
  | 'int'
  | 'year'
  | 'fk'

type FkSource =
  | 'countries'
  | 'home_states'
  | 'home_districts'
  | 'states'
  | 'boards_x'
  | 'boards_xii'
  | 'diploma_boards'

interface FormFieldDef {
  key: string
  kind: ControlKind
  fk?: FkSource
  /** For 'enum': which context list feeds the options. */
  options?: 'blood_groups' | 'genders'
  hint?: string
  placeholder?: string
}

interface FormGroupDef {
  label: string
  fields: FormFieldDef[]
}

const FORM_GROUPS: FormGroupDef[] = [
  {
    label: 'Personal & identity',
    fields: [
      { key: 'full_name', kind: 'text' },
      { key: 'first_name', kind: 'text' },
      { key: 'middle_name', kind: 'text' },
      { key: 'last_name', kind: 'text' },
      { key: 'gender', kind: 'enum', options: 'genders' },
      { key: 'date_of_birth', kind: 'date' },
      { key: 'mobile_number', kind: 'phone' },
      { key: 'blood_group', kind: 'enum', options: 'blood_groups' },
      {
        key: 'abc_id',
        kind: 'text',
        placeholder: '12-digit Academic Bank of Credits ID',
      },
    ],
  },
  {
    label: 'Academic performance',
    fields: [
      { key: 'tenth_percentage', kind: 'percentage' },
      { key: 'twelfth_percentage', kind: 'percentage' },
      { key: 'diploma_percentage', kind: 'percentage' },
      { key: 'ug_cgpa', kind: 'cgpa', hint: AUTO_REQUESTABLE_HINT },
      { key: 'current_backlogs', kind: 'int', hint: AUTO_REQUESTABLE_HINT },
    ],
  },
  {
    label: 'Parent & guardian',
    fields: [
      { key: 'parent_name', kind: 'text' },
      { key: 'parent_mobile', kind: 'phone' },
      { key: 'parent_email', kind: 'email' },
      { key: 'guardian_name', kind: 'text' },
      { key: 'guardian_mobile', kind: 'phone' },
      { key: 'guardian_email', kind: 'email' },
    ],
  },
  {
    label: 'Home address',
    fields: [
      { key: 'home_address', kind: 'multiline' },
      { key: 'home_country', kind: 'fk', fk: 'countries' },
      { key: 'home_state', kind: 'fk', fk: 'home_states' },
      { key: 'home_district', kind: 'fk', fk: 'home_districts' },
      { key: 'home_pincode', kind: 'text', placeholder: '6-digit pincode' },
    ],
  },
  {
    label: 'Government IDs',
    fields: [
      { key: 'aadhaar_number', kind: 'text', placeholder: '12-digit Aadhaar' },
      { key: 'pan_number', kind: 'text', placeholder: 'AAAAA9999A' },
    ],
  },
  {
    label: 'Education history — 10th',
    fields: [
      { key: 'tenth_board', kind: 'fk', fk: 'boards_x' },
      { key: 'tenth_institution', kind: 'text' },
      { key: 'tenth_year_of_pass', kind: 'year' },
      { key: 'tenth_state', kind: 'fk', fk: 'states' },
    ],
  },
  {
    label: 'Education history — 12th',
    fields: [
      { key: 'twelfth_board', kind: 'fk', fk: 'boards_xii' },
      { key: 'twelfth_institution', kind: 'text' },
      { key: 'twelfth_year_of_pass', kind: 'year' },
      { key: 'twelfth_state', kind: 'fk', fk: 'states' },
    ],
  },
  {
    label: 'Education history — Diploma',
    fields: [
      { key: 'diploma_board', kind: 'fk', fk: 'diploma_boards' },
      { key: 'diploma_institution', kind: 'text' },
      { key: 'diploma_year_of_pass', kind: 'year' },
      { key: 'diploma_specialization', kind: 'text' },
      { key: 'diploma_state', kind: 'fk', fk: 'states' },
    ],
  },
  {
    label: 'Placements',
    fields: [{ key: 'interested_in_placements_self', kind: 'boolean' }],
  },
]

// --- form state helpers ------------------------------------------------------------

/** A staged certification entry — file already uploaded, key in hand. */
interface CertEntry {
  industry_certification_id: number
  name: string
  certificate_file_key: string
  file_name: string
}

interface EntranceState {
  na: boolean
  examId: number | null
  rank: string
  year: string
}

interface GapState {
  years: string
  reason: string
}

function asFormValue(v: unknown): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  return String(v)
}

/**
 * The full-screen "request profile changes" form — every requestable field,
 * grouped like the profile screen, prefilled from the live context. Submits a
 * diff (only touched fields); with `?edit=<id>` it revises a sent-back request
 * instead (PUT over the same request, which re-queues it).
 */
export default function ProfileUpdateRequestPage() {
  const navigate = useNavigate()
  const search = useSearch({ strict: false }) as { edit?: number }
  const editId = search.edit ?? null

  const [context, setContext] = useState<ProfileUpdateContext | null>(null)
  const [editRequest, setEditRequest] = useState<StudentRequestDetail | null>(
    null,
  )
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  // Lookups behind the FK comboboxes. States are loaded once, unfiltered —
  // the address cascade filters them client-side by country_id; districts are
  // the only per-parent fetch (there are too many to load up front).
  const [countries, setCountries] = useState<LookupOption[]>([])
  const [states, setStates] = useState<LookupOption[]>([])
  const [districts, setDistricts] = useState<LookupOption[]>([])
  const [entranceExams, setEntranceExams] = useState<LookupOption[]>([])
  const [certOptions, setCertOptions] = useState<LookupOption[]>([])
  const [boardsX, setBoardsX] = useState<LookupOption[]>([])
  const [boardsXII, setBoardsXII] = useState<LookupOption[]>([])
  const [diplomaBoards, setDiplomaBoards] = useState<LookupOption[]>([])

  const [values, setValues] = useState<Record<string, string>>({})
  const [entrance, setEntrance] = useState<EntranceState>({
    na: false,
    examId: null,
    rank: '',
    year: '',
  })
  const [gapState, setGapState] = useState<GapState>({ years: '', reason: '' })
  // Once the student edits the gap years by hand, the auto-suggestion backs
  // off for good — their value (even a cleared one) must never be overwritten.
  const [gapTouched, setGapTouched] = useState(false)
  const [certsAdd, setCertsAdd] = useState<CertEntry[]>([])
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    document.title = 'Request profile changes — Nucleus'
  }, [])

  useEffect(() => {
    let cancelled = false
    setContext(null)
    setEditRequest(null)
    setLoadError(null)
    Promise.all([
      fetchProfileUpdateContext(),
      editId !== null ? fetchMyRequest(editId) : Promise.resolve(null),
    ])
      .then(([ctx, req]) => {
        if (cancelled) return
        setContext(ctx)
        setEditRequest(req)
        setNote(req?.requester_note ?? '')

        // Start from the live profile, then overlay whatever the request being
        // revised was asking for — so a revise opens showing the student's own
        // values plus their previous asks.
        const next: Record<string, string> = {}
        for (const [key, value] of Object.entries(ctx.current)) {
          // Dates may come back with a time part — the form speaks YYYY-MM-DD.
          next[key] =
            key === 'date_of_birth'
              ? asFormValue(value).slice(0, 10)
              : asFormValue(value)
        }
        const nextEntrance: EntranceState = {
          na: ctx.entrance_exam.na,
          examId: ctx.entrance_exam.entrance_exam_id,
          rank: asFormValue(ctx.entrance_exam.entrance_exam_rank),
          year: asFormValue(ctx.entrance_exam.entrance_exam_year),
        }
        const nextGap: GapState = {
          years: asFormValue(ctx.gap.year_of_gap),
          reason: asFormValue(ctx.gap.reason_of_gap),
        }
        const nextCerts: CertEntry[] = []
        for (const c of req?.payload.changes ?? []) {
          if (c.field.startsWith(CERTIFICATION_KEY_PREFIX)) {
            const to = c.to as {
              industry_certification_id?: number
              name?: string
              certificate_file_key?: string
            } | null
            if (to?.industry_certification_id && to.certificate_file_key) {
              nextCerts.push({
                industry_certification_id: to.industry_certification_id,
                name: to.name ?? 'Certification',
                certificate_file_key: to.certificate_file_key,
                file_name: 'Previously uploaded file',
              })
            }
          } else if (c.field === 'entrance_exam') {
            const to = c.to as {
              na?: boolean
              entrance_exam_id?: number | null
              entrance_exam_rank?: number | null
              entrance_exam_year?: number | null
            } | null
            if (to) {
              nextEntrance.na = to.na ?? false
              nextEntrance.examId = to.entrance_exam_id ?? null
              nextEntrance.rank = asFormValue(to.entrance_exam_rank)
              nextEntrance.year = asFormValue(to.entrance_exam_year)
            }
          } else if (c.field === 'gap') {
            const to = c.to as {
              year_of_gap?: number | null
              reason_of_gap?: string | null
            } | null
            if (to) {
              nextGap.years = asFormValue(to.year_of_gap)
              nextGap.reason = asFormValue(to.reason_of_gap)
            }
          } else if (c.field in next) {
            next[c.field] = asFormValue(c.to)
          }
        }
        setValues(next)
        setEntrance(nextEntrance)
        setGapState(nextGap)
        setGapTouched(false)
        setCertsAdd(nextCerts)

        // Lookups: only the tables this entry type's fields draw from.
        fetchCountries().then(setCountries).catch(() => {})
        fetchStates().then(setStates).catch(() => {})
        fetchEntranceExams().then(setEntranceExams).catch(() => {})
        fetchIndustryCertifications().then(setCertOptions).catch(() => {})
        fetchSchoolBoardsX().then(setBoardsX).catch(() => {})
        if ('twelfth_board' in ctx.current) {
          fetchSchoolBoardsXii().then(setBoardsXII).catch(() => {})
        }
        if ('diploma_board' in ctx.current) {
          fetchDiplomaBoards().then(setDiplomaBoards).catch(() => {})
        }
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setLoadError(errMsg(err, 'Could not load your current details.'))
      })
    return () => {
      cancelled = true
    }
  }, [editId, reloadToken])

  // Address cascade: districts always belong to the selected state.
  const homeStateId = values.home_state ? Number(values.home_state) : null
  useEffect(() => {
    if (homeStateId === null) {
      setDistricts([])
      return
    }
    let cancelled = false
    fetchDistricts(homeStateId)
      .then((rows) => !cancelled && setDistricts(rows))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [homeStateId])

  /**
   * Item keys locked by some OTHER open request. The request being revised is
   * excluded — its own items are in the server's open set, so leaving them in
   * would disable the very fields the student was asked to fix.
   */
  const pendingKeys = useMemo(() => {
    const own = new Set(
      (editRequest?.payload.changes ?? []).map((c) => c.field),
    )
    return new Set(
      (context?.pending_fields ?? []).filter((f) => !own.has(f)),
    )
  }, [context, editRequest])

  /** Certification ids already claimed by open requests (theirs stay pickable on revise). */
  const pendingCertIds = useMemo(() => {
    const ids = new Set<number>()
    for (const k of pendingKeys) {
      if (k.startsWith(CERTIFICATION_KEY_PREFIX)) {
        const id = Number(k.slice(CERTIFICATION_KEY_PREFIX.length))
        if (Number.isFinite(id)) ids.add(id)
      }
    }
    return ids
  }, [pendingKeys])

  /** Every mandatory key (units included) — drives the red asterisks. */
  const mandatorySet = useMemo(
    () => new Set(context?.mandatory_fields ?? []),
    [context],
  )

  /**
   * Mandatory keys still empty on the profile — the server refuses the
   * request unless every one of them is included, so each empty one gets a
   * blocking 'Required' error below.
   */
  const requiredNow = useMemo(
    () => new Set(context?.required_now ?? []),
    [context],
  )

  /**
   * Education-gap suggestion: the server's (from the stored year of pass), but
   * recomputed locally the moment the student types a 12th/diploma year of
   * pass in THIS form — local wins. Basis follows entry type: regular → 12th,
   * lateral → diploma.
   */
  const suggestedGap = useMemo(() => {
    if (!context) return null
    const lateral = context.entry_type === 2
    const basisKey = lateral ? 'diploma_year_of_pass' : 'twelfth_year_of_pass'
    const typedRaw = (values[basisKey] ?? '').trim()
    const typed = typedRaw === '' ? null : Number(typedRaw)
    if (
      typed !== null &&
      Number.isInteger(typed) &&
      typed >= 1950 &&
      typed <= CURRENT_YEAR + 1
    ) {
      return {
        years: Math.max(0, context.join_year - typed),
        basis: lateral ? ('diploma' as const) : ('twelfth' as const),
      }
    }
    return context.suggested_gap
  }, [context, values])

  /**
   * The suggestion IN EFFECT: only while the gap-years input is empty and the
   * student hasn't touched it. Purely derived — typing a year of pass above
   * live-updates it, typing the gap itself dismisses it.
   */
  const gapSuggestion =
    !gapTouched && !pendingKeys.has('gap') && gapState.years.trim() === ''
      ? suggestedGap
      : null

  /** What the gap-years input shows and the diff reads. */
  const effectiveGapYears = gapSuggestion
    ? String(gapSuggestion.years)
    : gapState.years

  function setValue(key: string, value: string) {
    setValues((prev) => {
      const next = { ...prev, [key]: value }
      // Cascade resets — a state belongs to a country, a district to a state.
      if (key === 'home_country') {
        next.home_state = ''
        next.home_district = ''
      } else if (key === 'home_state') {
        next.home_district = ''
      }
      return next
    })
  }

  // --- diff + validation (recomputed per render, like the profile dialog did) ---

  const diffResult = useMemo(() => {
    if (!context) {
      return {
        changes: {} as ProfileUpdateInput['changes'],
        errors: {} as Record<string, string>,
        gapWarning: null as string | null,
      }
    }
    const changes: ProfileUpdateInput['changes'] = {}
    const errors: Record<string, string> = {}

    const defs = FORM_GROUPS.flatMap((g) => g.fields).filter(
      (f) => f.key in context.current,
    )
    for (const def of defs) {
      if (pendingKeys.has(def.key)) continue
      const raw = values[def.key] ?? ''
      const cur = context.current[def.key]

      if (def.kind === 'fk') {
        const id = raw ? Number(raw) : null
        const curId = cur === null || cur === undefined ? null : Number(cur)
        // Mandatory-and-still-empty: the server refuses the request without it.
        if (id === null && requiredNow.has(def.key)) {
          errors[def.key] = 'Required'
        }
        if (id !== null && id !== curId) changes[def.key] = id
        continue
      }
      if (def.kind === 'boolean') {
        if (raw !== 'true' && raw !== 'false') {
          if (requiredNow.has(def.key)) errors[def.key] = 'Required'
          continue
        }
        const val = raw === 'true'
        if (typeof cur !== 'boolean' || val !== cur) changes[def.key] = val
        continue
      }

      const trimmed = raw.trim()
      if (trimmed === '') {
        // Mandatory-and-still-empty: the server refuses the request without it.
        if (requiredNow.has(def.key)) errors[def.key] = 'Required'
        continue // clearing a value is an admin operation
      }

      if (
        def.kind === 'percentage' ||
        def.kind === 'cgpa' ||
        def.kind === 'int' ||
        def.kind === 'year'
      ) {
        const num = Number(trimmed)
        const curNum = cur === null || cur === undefined ? null : Number(cur)
        if (Number.isNaN(num)) {
          errors[def.key] = 'Enter a number'
          continue
        }
        if (curNum !== null && num === curNum) continue
        if (def.kind === 'percentage' && (num < 0 || num > 100)) {
          errors[def.key] = 'Must be between 0 and 100'
        } else if (def.kind === 'cgpa' && (num < 0 || num > 10)) {
          errors[def.key] = 'Must be between 0 and 10'
        } else if (
          def.kind === 'int' &&
          (!Number.isInteger(num) || num < 0 || num > 60)
        ) {
          errors[def.key] = 'Enter a whole number between 0 and 60'
        } else if (
          def.kind === 'year' &&
          (!Number.isInteger(num) || num < 1950 || num > CURRENT_YEAR + 1)
        ) {
          errors[def.key] = `Enter a year between 1950 and ${CURRENT_YEAR + 1}`
        } else {
          changes[def.key] = num
        }
        continue
      }

      // String kinds. Normalize the few formatted ones before comparing.
      let value = trimmed
      if (def.kind === 'email') value = trimmed.toLowerCase()
      if (def.key === 'pan_number') value = trimmed.toUpperCase()
      let curStr = cur === null || cur === undefined ? '' : String(cur)
      if (def.kind === 'date') curStr = curStr.slice(0, 10)
      if (def.kind === 'email' ? value === curStr.toLowerCase() : value === curStr)
        continue

      if (def.kind === 'phone' && !/^[6-9]\d{9}$/.test(value)) {
        errors[def.key] = 'Enter a 10-digit Indian mobile number'
      } else if (
        def.kind === 'email' &&
        (!/^\S+@\S+\.\S+$/.test(value) || value.length > 255)
      ) {
        errors[def.key] = 'Enter a valid email address'
      } else if (
        (def.key === 'abc_id' || def.key === 'aadhaar_number') &&
        !/^\d{12}$/.test(value)
      ) {
        errors[def.key] = 'Must be exactly 12 digits'
      } else if (
        def.key === 'pan_number' &&
        !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(value)
      ) {
        errors[def.key] = 'Enter a valid PAN (AAAAA9999A)'
      } else if (def.key === 'home_pincode' && !/^\d{6}$/.test(value)) {
        errors[def.key] = 'Pincode must be exactly 6 digits'
      } else {
        changes[def.key] = value
      }
    }

    // Entrance exam — one atomic unit; only sent when something changed.
    if (!pendingKeys.has('entrance_exam')) {
      const ctxE = context.entrance_exam
      const rank = entrance.rank.trim() === '' ? null : Number(entrance.rank)
      const year = entrance.year.trim() === '' ? null : Number(entrance.year)
      const touched = entrance.na
        ? !ctxE.na
        : ctxE.na ||
          entrance.examId !== ctxE.entrance_exam_id ||
          rank !== ctxE.entrance_exam_rank ||
          year !== ctxE.entrance_exam_year
      if (touched) {
        if (entrance.na) {
          changes.entrance_exam = { na: true }
        } else if (
          entrance.examId === null &&
          rank === null &&
          year === null
        ) {
          // Untouched empty trio — nothing to request.
        } else if (entrance.examId === null || rank === null || year === null) {
          errors.entrance_exam =
            'Select the exam and enter both rank and year (or mark it not applicable).'
        } else if (
          Number.isNaN(rank) ||
          !Number.isInteger(rank) ||
          rank <= 0
        ) {
          errors.entrance_exam = 'The rank must be a positive whole number.'
        } else if (
          Number.isNaN(year) ||
          !Number.isInteger(year) ||
          year < 1950 ||
          year > CURRENT_YEAR
        ) {
          errors.entrance_exam = `The exam year must be between 1950 and ${CURRENT_YEAR}.`
        } else {
          changes.entrance_exam = {
            na: false,
            entrance_exam_id: entrance.examId,
            entrance_exam_rank: rank,
            entrance_exam_year: year,
          }
        }
      }
      // Mandatory-and-still-empty unit: satisfied by N/A ON or the full trio.
      if (
        requiredNow.has('entrance_exam') &&
        !entrance.na &&
        changes.entrance_exam === undefined &&
        errors.entrance_exam === undefined
      ) {
        errors.entrance_exam = 'Required'
      }
    }

    // Education gap — also one atomic unit.
    let gapWarning: string | null = null
    if (!pendingKeys.has('gap')) {
      const years =
        effectiveGapYears.trim() === '' ? null : Number(effectiveGapYears)
      const reason = gapState.reason.trim()
      const curYears = context.gap.year_of_gap
      const curReason = context.gap.reason_of_gap ?? ''
      const touched =
        years !== null && (years !== curYears || reason !== curReason)
      if (touched) {
        if (Number.isNaN(years) || !Number.isInteger(years!) || years! < 0 || years! > 10) {
          errors.gap = 'Years of gap must be a whole number between 0 and 10.'
        } else if (years! > 0 && reason === '') {
          errors.gap = 'Explain the reason for the gap.'
        } else {
          changes.gap = {
            year_of_gap: years!,
            ...(years! > 0 ? { reason_of_gap: reason } : {}),
          }
        }
      }
      // Mandatory-and-still-empty unit: a year entered satisfies it (0 counts).
      if (
        requiredNow.has('gap') &&
        years === null &&
        errors.gap === undefined
      ) {
        errors.gap = 'Required'
      }
      if (years !== null && years > 0) {
        gapWarning =
          'An education gap is fine — it just goes to your verifiers along with the reason.'
      }
    }

    if (certsAdd.length > 0) {
      changes.certifications_add = certsAdd.map(
        (c): CertificationAddInput => ({
          industry_certification_id: c.industry_certification_id,
          certificate_file_key: c.certificate_file_key,
        }),
      )
    }

    return { changes, errors, gapWarning }
  }, [
    context,
    values,
    entrance,
    gapState,
    effectiveGapYears,
    certsAdd,
    pendingKeys,
    requiredNow,
  ])

  const { changes, errors, gapWarning } = diffResult
  const hasErrors = Object.keys(errors).length > 0
  const hasChanges = Object.keys(changes).length > 0

  /** Mandatory keys still not filled in — drives the top banner, live. */
  const requiredRemaining = useMemo(
    () => [...requiredNow].filter((k) => errors[k] === 'Required').length,
    [requiredNow, errors],
  )

  /** The "Calculated N years…" confirm note under the gap block. */
  const gapSuggestionNote =
    gapSuggestion !== null && gapSuggestion.years > 0
      ? `Calculated ${gapSuggestion.years} year${gapSuggestion.years === 1 ? '' : 's'} of gap from your ${gapSuggestion.basis === 'diploma' ? 'diploma' : '12th'} year of pass and admission year — please confirm.`
      : null

  async function onSubmit() {
    if (!hasChanges || hasErrors || busy) return
    setBusy(true)
    try {
      const input: ProfileUpdateInput = {
        changes,
        note: note.trim() || undefined,
      }
      if (editId !== null) {
        await resubmitProfileUpdateRequest(editId, input)
        toast.success('Request resubmitted for approval.')
        void navigate({ to: '/my-requests', search: { open: editId } })
      } else {
        await submitProfileUpdateRequest(input)
        toast.success(
          'Request submitted for approval — track it in My Requests.',
        )
        void navigate({ to: '/my-requests' })
      }
    } catch (err) {
      toast.error(errMsg(err, 'Could not submit the request.'))
    } finally {
      setBusy(false)
    }
  }

  const isEdit = editId !== null

  // FK options per source, mapped for the combobox.
  const fkOptions = (source: FkSource): ComboboxOption[] => {
    const countryId = values.home_country ? Number(values.home_country) : null
    let rows: LookupOption[]
    switch (source) {
      case 'countries':
        rows = countries
        break
      case 'home_states':
        rows =
          countryId === null
            ? states
            : states.filter((s) => s.country_id === countryId)
        break
      case 'home_districts':
        rows = districts
        break
      case 'states':
        rows = states
        break
      case 'boards_x':
        rows = boardsX
        break
      case 'boards_xii':
        rows = boardsXII
        break
      case 'diploma_boards':
        rows = diplomaBoards
        break
    }
    return rows.map((r) => ({ value: r.id, label: r.name }))
  }

  const pendingLabels = [...pendingKeys]
    .map((k) =>
      k.startsWith(CERTIFICATION_KEY_PREFIX)
        ? (certOptions.find(
            (o) => o.id === Number(k.slice(CERTIFICATION_KEY_PREFIX.length)),
          )?.name ?? 'a certification')
        : (PROFILE_FIELD_LABELS[k] ?? k),
    )
    .join(', ')

  return (
    <>
      <PageHeader
        title={isEdit ? 'Revise your request' : 'Request profile changes'}
        subtitle={
          isEdit
            ? 'Update the values and resubmit — this replaces your earlier request and sends it back for review.'
            : 'Edit the values you want changed — your batch’s profile verifiers will review them.'
        }
        icon={ClipboardList}
        accent="orange"
      />
      <div className="-mt-2 mb-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            void navigate({
              to: isEdit ? '/my-requests' : '/profile',
              search: isEdit ? { open: editId } : undefined,
            })
          }
        >
          <ArrowLeft className="size-4" />
          {isEdit ? 'Back to my requests' : 'Back to profile'}
        </Button>
      </div>

      {loadError ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border bg-card p-10 text-center">
          <CircleAlert className="size-6 text-destructive" />
          <p className="text-sm text-muted-foreground">{loadError}</p>
          <Button size="sm" onClick={() => setReloadToken((t) => t + 1)}>
            <RefreshCw className="size-4" /> Try again
          </Button>
        </div>
      ) : !context ? (
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-48 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : (
        <div className="mx-auto max-w-3xl space-y-4">
          {requiredRemaining > 0 && (
            <div className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 p-3.5">
              <CircleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">
                  {requiredRemaining} mandatory field
                  {requiredRemaining === 1 ? '' : 's'}
                </span>{' '}
                must be filled before you can submit — they&rsquo;re marked
                with <span className="text-destructive">*</span> and{' '}
                <span className="font-medium text-destructive">Required</span>{' '}
                below.
              </p>
            </div>
          )}
          {pendingKeys.size > 0 && (
            <div className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 p-3.5">
              <Hourglass className="mt-0.5 size-4 shrink-0 text-warning" />
              <p className="text-sm text-muted-foreground">
                Already awaiting approval: {pendingLabels}. Those fields are
                locked until that request is decided — you can still request
                changes to everything else.
              </p>
            </div>
          )}

          {FORM_GROUPS.map((group) => {
            const fields = group.fields.filter((f) => f.key in context.current)
            if (fields.length === 0) return null
            return (
              <FormSection key={group.label} label={group.label}>
                <div className="grid gap-4 sm:grid-cols-2">
                  {fields.map((def) => (
                    <FormField
                      key={def.key}
                      def={def}
                      context={context}
                      value={values[def.key] ?? ''}
                      pending={pendingKeys.has(def.key)}
                      required={mandatorySet.has(def.key)}
                      error={errors[def.key]}
                      fkOptions={fkOptions}
                      homeStateChosen={homeStateId !== null}
                      onChange={(v) => setValue(def.key, v)}
                    />
                  ))}
                </div>
              </FormSection>
            )
          })}

          <FormSection label="Industry certifications">
            <CertificationsAdd
              options={certOptions}
              heldIds={context.held_certification_ids}
              pendingIds={pendingCertIds}
              entries={certsAdd}
              onChange={setCertsAdd}
            />
          </FormSection>

          <FormSection
            label="Entrance exam"
            required={mandatorySet.has('entrance_exam')}
          >
            <EntranceExamUnit
              state={entrance}
              exams={entranceExams}
              pending={pendingKeys.has('entrance_exam')}
              error={errors.entrance_exam}
              currentExamName={context.entrance_exam.exam_name}
              onChange={setEntrance}
            />
          </FormSection>

          <FormSection label="Education gap" required={mandatorySet.has('gap')}>
            <GapUnit
              state={{ years: effectiveGapYears, reason: gapState.reason }}
              pending={pendingKeys.has('gap')}
              error={errors.gap}
              warning={gapWarning}
              suggestionNote={gapSuggestionNote}
              onChange={(next) => {
                if (next.years !== effectiveGapYears) {
                  // Typed by hand — the suggestion backs off for good.
                  setGapTouched(true)
                  setGapState(next)
                } else {
                  // Only the reason changed — keep the stored years as they
                  // are so an active suggestion stays live (and recomputes).
                  setGapState((prev) => ({ ...prev, reason: next.reason }))
                }
              }}
            />
          </FormSection>

          <FormSection label="Note for the reviewer">
            <Textarea
              id="req-note"
              placeholder="Anything the reviewer should know (optional)"
              value={note}
              maxLength={1000}
              onChange={(e) => setNote(e.target.value)}
            />
          </FormSection>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground">
              {hasChanges
                ? `${Object.keys(changes).length} change${Object.keys(changes).length === 1 ? '' : 's'} will be sent for approval.`
                : isEdit
                  ? 'Every value now matches your profile — change one to resubmit, or cancel the request instead.'
                  : 'Change at least one value to submit a request.'}
            </p>
            <Button
              disabled={busy || !hasChanges || hasErrors}
              onClick={() => void onSubmit()}
            >
              {busy
                ? 'Submitting…'
                : isEdit
                  ? 'Resubmit for approval'
                  : 'Submit for approval'}
            </Button>
          </div>
        </div>
      )}
    </>
  )
}

// --- sections + generic field --------------------------------------------------------

function FormSection({
  label,
  required,
  children,
}: {
  label: string
  /** Mandatory unit — red asterisk on the section header. */
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border bg-card p-5 text-card-foreground shadow-sm">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
        {required && (
          <span aria-hidden="true" className="ml-1 text-destructive">
            *
          </span>
        )}
      </h3>
      {children}
    </section>
  )
}

/** Label + control + per-field "pending approval" hint / validation error. */
function FieldBlock({
  id,
  label,
  pending,
  required,
  error,
  hint,
  className,
  children,
}: {
  id: string
  label: string
  pending: boolean
  /** Mandatory for this entry type — red asterisk beside the label. */
  required?: boolean
  error?: string
  hint?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id}>
          {label}
          {required && (
            <span aria-hidden="true" className="ml-0.5 text-destructive">
              *
            </span>
          )}
        </Label>
        {pending && (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-warning">
            <Hourglass className="size-3" /> Awaiting approval
          </span>
        )}
      </div>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
      {!error && hint && (
        <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  )
}

const selectClass = cn(
  'h-9 w-full rounded-md border border-input bg-background px-2 text-sm shadow-xs',
  'outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30',
  'disabled:cursor-not-allowed disabled:opacity-50',
)

function FormField({
  def,
  context,
  value,
  pending,
  required,
  error,
  fkOptions,
  homeStateChosen,
  onChange,
}: {
  def: FormFieldDef
  context: ProfileUpdateContext
  value: string
  pending: boolean
  required: boolean
  error?: string
  fkOptions: (source: FkSource) => ComboboxOption[]
  homeStateChosen: boolean
  onChange: (value: string) => void
}) {
  const id = `req-${def.key}`
  const label = PROFILE_FIELD_LABELS[def.key] ?? def.key
  const wide = def.kind === 'multiline'

  let control: React.ReactNode
  switch (def.kind) {
    case 'multiline':
      control = (
        <Textarea
          id={id}
          value={value}
          disabled={pending}
          maxLength={1000}
          onChange={(e) => onChange(e.target.value)}
        />
      )
      break
    case 'date':
      control = (
        <DatePicker
          value={value || '2005-01-01'}
          disabled={pending}
          onChange={onChange}
          aria-label={label}
          className="[&>button]:w-full [&>button]:justify-start"
        />
      )
      break
    case 'enum': {
      const options =
        def.options === 'genders' ? context.genders : context.blood_groups
      control = (
        <select
          id={id}
          value={value}
          disabled={pending}
          onChange={(e) => onChange(e.target.value)}
          className={selectClass}
        >
          <option value="">Not set</option>
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      )
      break
    }
    case 'boolean':
      control = (
        <select
          id={id}
          value={value}
          disabled={pending}
          onChange={(e) => onChange(e.target.value)}
          className={selectClass}
        >
          <option value="">Not set</option>
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
      )
      break
    case 'fk': {
      const isDistrict = def.fk === 'home_districts'
      control = (
        <Combobox
          id={id}
          value={value ? Number(value) : null}
          options={fkOptions(def.fk!)}
          disabled={pending || (isDistrict && !homeStateChosen)}
          placeholder={
            isDistrict && !homeStateChosen ? 'Select a state first' : 'Select…'
          }
          onChange={(v) => onChange(v === null ? '' : String(v))}
        />
      )
      break
    }
    default:
      control = (
        <Input
          id={id}
          type={def.kind === 'email' ? 'email' : 'text'}
          inputMode={
            def.kind === 'phone' ||
            def.kind === 'int' ||
            def.kind === 'year' ||
            def.kind === 'percentage' ||
            def.kind === 'cgpa'
              ? 'decimal'
              : undefined
          }
          placeholder={def.placeholder}
          value={value}
          disabled={pending}
          onChange={(e) => onChange(e.target.value)}
        />
      )
  }

  return (
    <FieldBlock
      id={id}
      label={label}
      pending={pending}
      required={required}
      error={error}
      hint={def.hint}
      className={wide ? 'sm:col-span-2' : undefined}
    >
      {control}
    </FieldBlock>
  )
}

// --- entrance exam unit ------------------------------------------------------------

function EntranceExamUnit({
  state,
  exams,
  pending,
  error,
  currentExamName,
  onChange,
}: {
  state: EntranceState
  exams: LookupOption[]
  pending: boolean
  error?: string
  currentExamName: string | null
  onChange: (next: EntranceState) => void
}) {
  return (
    <div className="space-y-4">
      {pending && (
        <p className="inline-flex items-center gap-1 text-[11px] font-medium text-warning">
          <Hourglass className="size-3" /> Awaiting approval — locked until
          that request is decided
        </p>
      )}
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={state.na}
          disabled={pending}
          onChange={(e) =>
            // The trio is cleared when N/A — the server requires it empty.
            onChange(
              e.target.checked
                ? { na: true, examId: null, rank: '', year: '' }
                : { ...state, na: false },
            )
          }
          className="size-4 accent-primary"
        />
        I don&rsquo;t have a rank / not applicable
      </label>
      {!state.na && (
        <div className="grid gap-4 sm:grid-cols-3">
          <FieldBlock
            id="req-entrance-exam"
            label="Entrance exam"
            pending={pending}
          >
            <Combobox
              id="req-entrance-exam"
              value={state.examId}
              options={exams.map((e) => ({ value: e.id, label: e.name }))}
              disabled={pending}
              placeholder={currentExamName ?? 'Select…'}
              onChange={(v) => onChange({ ...state, examId: v })}
            />
          </FieldBlock>
          <FieldBlock
            id="req-entrance-rank"
            label="Entrance exam rank"
            pending={pending}
          >
            <Input
              id="req-entrance-rank"
              inputMode="numeric"
              value={state.rank}
              disabled={pending}
              onChange={(e) => onChange({ ...state, rank: e.target.value })}
            />
          </FieldBlock>
          <FieldBlock
            id="req-entrance-year"
            label="Entrance exam year"
            pending={pending}
          >
            <Input
              id="req-entrance-year"
              inputMode="numeric"
              placeholder={`e.g. ${CURRENT_YEAR}`}
              value={state.year}
              disabled={pending}
              onChange={(e) => onChange({ ...state, year: e.target.value })}
            />
          </FieldBlock>
        </div>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
      <p className="text-xs text-muted-foreground">
        The exam, rank and year travel together — a reviewer approves or
        rejects them as one item.
      </p>
    </div>
  )
}

// --- education gap unit -----------------------------------------------------------

function GapUnit({
  state,
  pending,
  error,
  warning,
  suggestionNote,
  onChange,
}: {
  state: GapState
  pending: boolean
  error?: string
  warning: string | null
  /** The auto-computed "Calculated N years…" confirm note, when in effect. */
  suggestionNote: string | null
  onChange: (next: GapState) => void
}) {
  const years = Number(state.years)
  const showReason = state.years.trim() !== '' && !Number.isNaN(years) && years > 0
  return (
    <div className="space-y-4">
      {pending && (
        <p className="inline-flex items-center gap-1 text-[11px] font-medium text-warning">
          <Hourglass className="size-3" /> Awaiting approval — locked until
          that request is decided
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <FieldBlock id="req-gap-years" label="Years of gap" pending={pending}>
          <Input
            id="req-gap-years"
            inputMode="numeric"
            placeholder="0–10"
            value={state.years}
            disabled={pending}
            onChange={(e) => onChange({ ...state, years: e.target.value })}
          />
        </FieldBlock>
      </div>
      {showReason && (
        <FieldBlock id="req-gap-reason" label="Reason of gap" pending={pending}>
          <Textarea
            id="req-gap-reason"
            placeholder="Explain the gap — required when it is more than zero years"
            value={state.reason}
            disabled={pending}
            maxLength={1000}
            onChange={(e) => onChange({ ...state, reason: e.target.value })}
          />
        </FieldBlock>
      )}
      {suggestionNote && (
        <p className="flex items-start gap-1.5 text-xs font-medium text-warning">
          <Info className="mt-0.5 size-3.5 shrink-0" />
          {suggestionNote}
        </p>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
      {!error && !suggestionNote && warning && (
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0 text-warning" />
          {warning}
        </p>
      )}
    </div>
  )
}

// --- certifications add-list ---------------------------------------------------------

function CertificationsAdd({
  options,
  heldIds,
  pendingIds,
  entries,
  onChange,
}: {
  options: LookupOption[]
  heldIds: number[]
  pendingIds: Set<number>
  entries: CertEntry[]
  onChange: (entries: CertEntry[]) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [pickId, setPickId] = useState<number | null>(null)
  const [staged, setStaged] = useState<{ key: string; name: string } | null>(
    null,
  )
  const [uploading, setUploading] = useState(false)

  // Held, pending elsewhere, or already in this request → not offered again.
  const taken = new Set<number>([
    ...heldIds,
    ...pendingIds,
    ...entries.map((e) => e.industry_certification_id),
  ])
  const available = options.filter((o) => !taken.has(o.id))

  async function onPickFile(file: File | undefined) {
    if (!file) return
    if (!CERT_FILE_TYPES.includes(file.type)) {
      toast.info('The certificate must be a PDF, JPEG or PNG file.')
      return
    }
    if (file.size > CERT_FILE_MAX_BYTES) {
      toast.info('The certificate file must be 5 MB or smaller.')
      return
    }
    setUploading(true)
    try {
      const { certificate_file_key } = await stageCertificateFile(file)
      setStaged({ key: certificate_file_key, name: file.name })
    } catch (err) {
      toast.error(errMsg(err, 'Could not upload the certificate file.'))
    } finally {
      setUploading(false)
    }
  }

  function addEntry() {
    if (pickId === null || !staged) return
    const option = options.find((o) => o.id === pickId)
    if (!option) return
    onChange([
      ...entries,
      {
        industry_certification_id: pickId,
        name: option.name,
        certificate_file_key: staged.key,
        file_name: staged.name,
      },
    ])
    setPickId(null)
    setStaged(null)
  }

  return (
    <div className="space-y-4">
      {entries.length > 0 && (
        <ul className="space-y-2">
          {entries.map((e) => (
            <li
              key={e.industry_certification_id}
              className="flex items-center gap-3 rounded-lg border bg-muted/20 px-3 py-2"
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                <Award className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {e.name}
                </span>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Paperclip className="size-3" /> {e.file_name}
                </span>
              </span>
              <button
                type="button"
                aria-label={`Remove ${e.name}`}
                onClick={() =>
                  onChange(
                    entries.filter(
                      (x) =>
                        x.industry_certification_id !==
                        e.industry_certification_id,
                    ),
                  )
                }
                className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="grid items-end gap-3 sm:grid-cols-[1fr_auto_auto]">
        <div className="space-y-1.5">
          <Label htmlFor="req-cert-pick">Add a certification</Label>
          <Combobox
            id="req-cert-pick"
            value={pickId}
            options={available.map((o) => ({ value: o.id, label: o.name }))}
            emptyMessage="No more certifications to add"
            onChange={setPickId}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={uploading || pickId === null}
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="size-4" />
          {uploading
            ? 'Uploading…'
            : staged
              ? 'Replace file'
              : 'Certificate file'}
        </Button>
        <Button
          type="button"
          disabled={pickId === null || !staged || uploading}
          onClick={addEntry}
        >
          <Plus className="size-4" /> Add
        </Button>
      </div>
      {staged && (
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <Paperclip className="size-3" /> {staged.name} — ready to add
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        Each entry needs its certificate file (PDF, JPEG or PNG, up to 5 MB)
        before it can be added. Certifications you already hold aren&rsquo;t
        listed again.
      </p>
      <input
        ref={fileRef}
        type="file"
        accept="application/pdf,image/jpeg,image/png"
        className="hidden"
        onChange={(e) => {
          void onPickFile(e.target.files?.[0])
          e.target.value = ''
        }}
      />
    </div>
  )
}
