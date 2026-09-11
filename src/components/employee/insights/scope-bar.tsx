import { X } from 'lucide-react'
import type { ReactNode } from 'react'

import {
  AppliedFilterChip,
  type AppliedFacet,
} from '@/components/corporate-relations/bits'
import { Button } from '@/components/ui/button'
import { FacetMenu } from '@/components/ui/facet-menu'
import { EMPTY_SELECTION } from '@/lib/insights'
import type { InsightsScopeState } from './use-insights-scope'

/**
 * The one-row scope bar every insights screen shares: four cascading facet
 * menus (each hidden when it offers a single choice — an HOD never picks
 * their own department), a divider, the screen's own controls, and a
 * "Clear all" at the far end while anything is narrowed. Applied values are
 * NOT drawn here — `AppliedScopeChips` lists them under the bar.
 */
export function ScopeBar({
  scope,
  children,
}: {
  scope: InsightsScopeState
  children?: ReactNode
}) {
  const { visible, sel, setSel } = scope
  const narrowed = countNarrowed(scope) > 0

  return (
    <div className="flex flex-wrap items-center gap-2">
      {visible.departments.length > 1 && (
        <FacetMenu
          label="Departments"
          options={visible.departments.map((d) => ({
            id: d.id,
            name: d.code,
            sub: d.name,
          }))}
          selected={sel.department_ids}
          onChange={(ids) => setSel({ department_ids: ids })}
          searchPlaceholder="Search departments…"
          size="sm"
        />
      )}
      {visible.programmes.length > 1 && (
        <FacetMenu
          label="Programmes"
          options={visible.programmes.map((p) => ({
            id: p.id,
            name: p.code,
            sub: p.display_name || p.name,
          }))}
          selected={sel.programme_ids}
          onChange={(ids) => setSel({ programme_ids: ids })}
          searchPlaceholder="Search programmes…"
          size="sm"
        />
      )}
      {visible.batches.length > 1 && (
        <FacetMenu
          label="Batches"
          options={visible.batches.map((b) => ({
            id: b.pay_id,
            name: `${b.programme_code} · ${b.display_year}`,
            hint: b.student_count,
          }))}
          selected={sel.programme_admission_year_ids}
          onChange={(ids) => setSel({ programme_admission_year_ids: ids })}
          searchPlaceholder="Search batches…"
          size="sm"
        />
      )}
      {visible.groups.length > 1 && (
        <FacetMenu
          label="Sections"
          options={visible.groups.map((g) => ({
            id: g.id,
            name: g.name,
            sub: g.code,
            hint: g.member_count,
          }))}
          selected={sel.attendance_group_ids}
          onChange={(ids) => setSel({ attendance_group_ids: ids })}
          searchPlaceholder="Search sections…"
          size="sm"
        />
      )}
      {children && <span className="mx-1 h-5 w-px bg-border" aria-hidden />}
      {children}
      {narrowed && (
        <Button
          size="sm"
          variant="ghost"
          className="ml-auto h-8 px-2 text-xs text-muted-foreground"
          onClick={() => setSel(EMPTY_SELECTION)}
        >
          <X className="size-3.5" /> Clear scope
        </Button>
      )}
    </div>
  )
}

function countNarrowed(scope: InsightsScopeState): number {
  const { sel } = scope
  return (
    (sel.department_ids.length ? 1 : 0) +
    (sel.programme_ids.length ? 1 : 0) +
    (sel.programme_admission_year_ids.length ? 1 : 0) +
    (sel.attendance_group_ids.length ? 1 : 0)
  )
}

/**
 * What is applied, one chip per facet, under the bar — the same row the
 * Drives and Management View pages draw, so an applied scope reads the same
 * everywhere in the portal.
 */
export function AppliedScopeChips({ scope }: { scope: InsightsScopeState }) {
  const { tree, sel, setSel } = scope
  if (!tree) return null
  const chips: AppliedFacet[] = []
  if (sel.department_ids.length) {
    chips.push({
      id: 'departments',
      label: 'Departments',
      values: sel.department_ids.map(
        (id) => tree.departments.find((d) => d.id === id)?.code ?? String(id),
      ),
      onClear: () => setSel({ department_ids: [] }),
    })
  }
  if (sel.programme_ids.length) {
    chips.push({
      id: 'programmes',
      label: 'Programmes',
      values: sel.programme_ids.map(
        (id) => tree.programmes.find((p) => p.id === id)?.code ?? String(id),
      ),
      onClear: () => setSel({ programme_ids: [] }),
    })
  }
  if (sel.programme_admission_year_ids.length) {
    chips.push({
      id: 'batches',
      label: 'Batches',
      values: sel.programme_admission_year_ids.map((id) => {
        const b = tree.batches.find((x) => x.pay_id === id)
        return b ? `${b.programme_code} ${b.display_year}` : String(id)
      }),
      onClear: () => setSel({ programme_admission_year_ids: [] }),
    })
  }
  if (sel.attendance_group_ids.length) {
    chips.push({
      id: 'sections',
      label: 'Sections',
      values: sel.attendance_group_ids.map(
        (id) => tree.groups.find((g) => g.id === id)?.name ?? String(id),
      ),
      onClear: () => setSel({ attendance_group_ids: [] }),
    })
  }
  if (chips.length === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
      <span className="text-xs font-medium text-muted-foreground">
        Scope · {chips.length}
      </span>
      <div className="flex flex-wrap items-center gap-1.5">
        {chips.map((c) => (
          <AppliedFilterChip key={c.id} {...c} />
        ))}
      </div>
    </div>
  )
}
