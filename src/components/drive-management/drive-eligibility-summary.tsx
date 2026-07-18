import { GraduationCap } from 'lucide-react'

import { Card } from '@/components/ui/card'
import type { EligibilitySummary } from '@/lib/drive-management'
import { Fact } from './facts'

/**
 * Read-only summary of who a drive is open to. Shared by the employee Overview
 * and the student drive view — both consume the identical, server-resolved
 * {@link EligibilitySummary} (labels, never ids), so there's a single rendering.
 *
 * Empty axes are omitted; when the drive has no restrictions at all it collapses
 * to a single "open to all" line. The backlog-history policy shows only when
 * there are other criteria — on its own it can't be told from an unconfigured
 * drive, so it never stands as the sole restriction.
 */
export function DriveEligibilitySummary({
  summary,
}: {
  summary: EligibilitySummary
}) {
  const {
    programmes,
    entry_types,
    genders,
    passout_years,
    allow_backlog_history,
    max_current_backlogs,
    min_tenth_percentage,
    min_twelfth_or_diploma_percentage,
    min_btech_cgpa,
    has_restrictions,
  } = summary

  const hasAcademicMins =
    min_tenth_percentage != null ||
    min_twelfth_or_diploma_percentage != null ||
    min_btech_cgpa != null

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center gap-2">
        <GraduationCap className="size-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">Eligibility</h2>
      </div>

      {!has_restrictions ? (
        <p className="text-sm text-muted-foreground">
          Open to all students — no eligibility restrictions.
        </p>
      ) : (
        <div className="space-y-4">
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {programmes.length > 0 ? (
              <Fact label="Programmes" value={programmes.join(', ')} />
            ) : null}
            {passout_years.length > 0 ? (
              <Fact
                label="Passout years"
                value={passout_years.join(', ')}
              />
            ) : null}
            {entry_types.length > 0 ? (
              <Fact label="Entry type" value={entry_types.join(', ')} />
            ) : null}
            {genders.length > 0 ? (
              <Fact label="Gender" value={genders.join(', ')} />
            ) : null}
            <Fact
              label="Backlog history"
              value={allow_backlog_history ? 'Allowed' : 'Not allowed'}
            />
            {max_current_backlogs != null ? (
              <Fact
                label="Current backlogs"
                value={`Up to ${max_current_backlogs}`}
              />
            ) : null}
          </dl>

          {hasAcademicMins ? (
            <div className="border-t pt-3">
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                Academic minimums
              </p>
              <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
                {min_tenth_percentage != null ? (
                  <Fact label="Xth" value={`${min_tenth_percentage}%`} />
                ) : null}
                {min_twelfth_or_diploma_percentage != null ? (
                  <Fact
                    label="12th / Diploma"
                    value={`${min_twelfth_or_diploma_percentage}%`}
                  />
                ) : null}
                {min_btech_cgpa != null ? (
                  <Fact label="Btech" value={`${min_btech_cgpa} CGPA`} />
                ) : null}
              </dl>
            </div>
          ) : null}
        </div>
      )}
    </Card>
  )
}
