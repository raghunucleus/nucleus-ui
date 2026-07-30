import { ExternalLink, History, Mail, Phone, User } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  ChipRow,
  CompanyLogo,
  CompanyStatusBadge,
  formatDate,
  formatDateTime,
} from '@/components/corporate-relations/bits'
import { RecordCodePill } from '@/components/corporate-relations/cr-view-record-sheet'
import { StatusValue } from '@/components/corporate-relations/inline-cells'
import type { CrViewYearOption } from '@/lib/corporate-relations'
import type { Chip } from '@/lib/corporate-relations'
import type { ManagementRow } from '@/lib/management-view'

/** One labelled read-only row. */
function Row({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="grid grid-cols-[9rem_1fr] gap-3 border-b py-2 last:border-b-0">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="min-w-0 text-sm">{children}</div>
    </div>
  )
}

/** Chips, or an em dash when the field is empty. */
function Chips({ items }: { items: Chip[] }) {
  if (items.length === 0) {
    return <span className="text-muted-foreground">—</span>
  }
  return <ChipRow items={items} />
}

/**
 * The whole of one (job role × passout year) as management reads it — every
 * field at full length, with nothing editable.
 *
 * Deliberately NOT `CrViewRecordSheet` with a `readOnly` flag: that component is
 * a form (drafts, validation, one big PATCH), and the useful half of it here is
 * only the layout. This renders straight off the row the table already holds —
 * no fetch, because there is no save to race and the list is the same data.
 *
 * The table shows truncated chips and clamped remarks to stay one line tall;
 * this is where the full values live, plus the record code (which by convention
 * appears only in a full-row sheet, never in the table).
 */
export function ManagementRecordSheet({
  row,
  year,
  defaultStatus,
  onOpenChange,
  onShowHistory,
}: {
  /** The row to show; `null` closes the sheet. */
  row: ManagementRow | null
  year: CrViewYearOption
  /** `scope.default_status` — what a record with no status of its own shows. */
  defaultStatus: Chip | null
  onOpenChange: (open: boolean) => void
  onShowHistory: (row: ManagementRow) => void
}) {
  if (!row) return null

  const { company, record } = row
  const contacts = record?.contacts ?? []

  return (
    <Sheet open onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-xl">
        <SheetHeader className="px-4 sm:px-6">
          <SheetTitle>{row.role_name}</SheetTitle>
          <SheetDescription>
            {company.name} · {year.display_year}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 px-4 pb-6 sm:px-6">
          <div className="flex items-start gap-3 rounded-lg border bg-muted/40 px-3 py-2.5">
            <CompanyLogo name={company.name} logoUrl={company.logo_url} />
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate text-sm font-medium">{company.name}</p>
                <CompanyStatusBadge company={company} />
              </div>
              {company.website && (
                <a
                  href={company.website}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                >
                  {company.website}
                  <ExternalLink className="size-3" />
                </a>
              )}
              {/* Only when there are any — `ChipRow` renders an em dash for an
                  empty list, which reads as a typo next to the website line. */}
              {company.categories.length > 0 && (
                <ChipRow items={company.categories} />
              )}
              {record?.record_code ? (
                <RecordCodePill code={record.record_code} />
              ) : (
                <p className="text-xs text-muted-foreground">
                  Nothing recorded for {year.display_year} yet — this row has no
                  record code.
                </p>
              )}
            </div>
          </div>

          <div>
            <Row label="CR">
              <span className="inline-flex items-center gap-1.5">
                <User className="size-3.5 text-muted-foreground" />
                {row.responsible_employee.emp_display_name}
                <span className="text-xs text-muted-foreground">
                  {row.responsible_employee.emp_code}
                </span>
              </span>
            </Row>
            <Row label="Current status">
              <span className="flex flex-wrap items-center gap-2">
                <StatusValue
                  status={record?.current_status ?? null}
                  fallback={defaultStatus}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 gap-1 px-1.5 text-xs text-muted-foreground"
                  onClick={() => onShowHistory(row)}
                >
                  <History className="size-3.5" /> History
                </Button>
              </span>
            </Row>
            <Row label="Relationship type">
              <Chips items={record?.relationship_types ?? []} />
            </Row>
            <Row label="Designation">
              <Chips items={record?.designations ?? []} />
            </Row>
            <Row label="Programme">
              <Chips items={record?.programmes ?? []} />
            </Row>
            <Row label="Location">
              <Chips items={record?.job_locations ?? []} />
            </Row>
            <Row label="Next follow up">
              {record?.next_follow_up_date ? (
                formatDate(record.next_follow_up_date)
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </Row>
            <Row label="Remarks">
              {record?.remarks ? (
                // Full text, wrapped — the table cell clamps it to one line.
                <p className="whitespace-pre-wrap break-words">
                  {record.remarks}
                </p>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </Row>
            <Row label="Last updated">
              {record ? (
                formatDateTime(record.updated_at)
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </Row>
          </div>

          <div>
            <h3 className="mb-2 text-xs font-medium text-muted-foreground">
              HR contacts{contacts.length > 0 ? ` (${contacts.length})` : ''}
            </h3>
            {contacts.length === 0 ? (
              <p className="rounded-lg border border-dashed py-6 text-center text-sm text-muted-foreground">
                No contacts recorded.
              </p>
            ) : (
              <ul className="space-y-2">
                {contacts.map((c) => (
                  <li key={c.id} className="rounded-lg border px-3 py-2">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className="text-sm font-medium">{c.hr_name}</span>
                      {c.hr_designation && (
                        <span className="text-xs text-muted-foreground">
                          {c.hr_designation}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {c.hr_mobile && (
                        <a
                          href={`tel:${c.hr_mobile}`}
                          className="inline-flex items-center gap-1 hover:text-foreground"
                        >
                          <Phone className="size-3" />
                          {c.hr_mobile}
                        </a>
                      )}
                      {c.hr_landline && (
                        <span className="inline-flex items-center gap-1">
                          <Phone className="size-3" />
                          {c.hr_landline}
                        </span>
                      )}
                      {c.hr_email && (
                        <a
                          href={`mailto:${c.hr_email}`}
                          className="inline-flex items-center gap-1 hover:text-foreground"
                        >
                          <Mail className="size-3" />
                          {c.hr_email}
                        </a>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
