import { Badge } from '@/components/ui/badge'
import type {
  StudentAcademics,
  StudentSelection,
} from '@/lib/drive-management'
import { cn } from '@/lib/utils'

/**
 * The two eligibility-check detail bodies, rendered identically by the hover
 * card and by the modal its cell opens. Presentational only — the caller owns
 * fetching and caching, so the peek and the pinned view can never drift.
 */

/** A fixed amount, or a range when the `_min` column was recorded. */
function amount(value: number | null, min: number | null, suffix: string) {
  if (value === null) return null
  return min === null ? `${value} ${suffix}` : `${min}–${value} ${suffix}`
}

function SelectionRow({ s }: { s: StudentSelection }) {
  const pay = s.is_internship
    ? amount(s.stipend, s.stipend_min, '₹/mo')
    : amount(s.ctc, s.ctc_min, 'LPA')
  return (
    <li className="flex items-start justify-between gap-3 py-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{s.company_name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {s.designation ?? s.drive_name}
        </p>
      </div>
      {pay ? (
        <Badge variant="secondary" className="shrink-0 tabular-nums">
          {pay}
        </Badge>
      ) : (
        <span className="shrink-0 text-xs text-muted-foreground">
          Not recorded
        </span>
      )}
    </li>
  )
}

/** A labelled group of selections, omitted entirely when it has none. */
function SelectionGroup({
  label,
  rows,
}: {
  label: string
  rows: StudentSelection[]
}) {
  if (rows.length === 0) return null
  return (
    <section>
      <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </h4>
      <ul className="divide-y">
        {rows.map((s) => (
          <SelectionRow key={s.drive_id} s={s} />
        ))}
      </ul>
    </section>
  )
}

/**
 * Every drive the student was Selected in. Full-time offers first, internships
 * under their own heading — the two carry different amounts (LPA vs ₹/month)
 * and mixing them in one list reads as one inconsistent column of numbers.
 */
export function SelectionsCard({ data }: { data: StudentSelection[] }) {
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">No selections recorded.</p>
  }
  const internships = data.filter((s) => s.is_internship)
  const fullTime = data.filter((s) => !s.is_internship)
  return (
    <div className="space-y-3">
      <SelectionGroup label="Full-time" rows={fullTime} />
      <SelectionGroup label="Internship" rows={internships} />
    </div>
  )
}

/** One `dt`/`dd` pair, matching StudentProfileDetails' field idiom. */
function Fact({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'default' | 'warn'
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          'text-sm font-medium tabular-nums',
          tone === 'warn' && 'text-destructive',
        )}
      >
        {value}
      </dd>
    </div>
  )
}

const pct = (v: number | null) => (v === null ? '—' : `${v}%`)

/**
 * Prior qualifications, CGPA and backlogs. 12th and Diploma are mutually
 * exclusive — a lateral entrant (2) came in on a diploma, a regular one (1) on
 * 12th — so only the applicable row is shown. A live backlog is toned as a
 * problem, since that's the field that disqualifies.
 */
export function AcademicsCard({ data }: { data: StudentAcademics }) {
  const backlogs = data.current_backlogs
  return (
    <dl className="divide-y">
      <Fact label="10th %" value={pct(data.tenth_percentage)} />
      {data.entry_type === 2 ? (
        <Fact label="Diploma %" value={pct(data.diploma_percentage)} />
      ) : (
        <Fact label="12th %" value={pct(data.twelfth_percentage)} />
      )}
      <Fact
        label="UG CGPA"
        value={data.ug_cgpa === null ? '—' : String(data.ug_cgpa)}
      />
      <Fact
        label="Current backlogs"
        value={backlogs === null ? '—' : String(backlogs)}
        tone={backlogs !== null && backlogs > 0 ? 'warn' : 'default'}
      />
      <Fact
        label="History of backlogs"
        value={data.backlog_history ? 'Yes' : 'No'}
      />
    </dl>
  )
}
