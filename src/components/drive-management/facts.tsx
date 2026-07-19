import type { LucideIcon } from 'lucide-react'

import type { DriveAmountMode } from '@/lib/drive-management'

/** A label / value pair inside a `<dl>` facts grid. */
export function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  )
}

/** "₹6,00,000" / "₹5,00,000 – ₹7,00,000"-style money value; null when unset. */
function formatMoney(
  mode: DriveAmountMode | null,
  min: string | null,
  max: string | null,
): string | null {
  if (!mode || min == null) return null
  const fmt = (v: string) => `₹${Number(v).toLocaleString('en-IN')}`
  return mode === 'range' && max != null ? `${fmt(min)} – ${fmt(max)}` : fmt(min)
}

/** "Yes · 2 years" / "No" bond value; null when the drive doesn't say. */
function formatBond(hasBond: boolean | null, bondYears: number | null): string | null {
  if (hasBond == null) return null
  return hasBond
    ? `Yes${bondYears ? ` · ${bondYears} year${bondYears === 1 ? '' : 's'}` : ''}`
    : 'No'
}

/** "₹6,00,000" / "₹5,00,000 – ₹7,00,000"-style money fact; null when unset. */
export function MoneyFact({
  label,
  mode,
  min,
  max,
}: {
  label: string
  mode: DriveAmountMode | null
  min: string | null
  max: string | null
}) {
  const value = formatMoney(mode, min, max)
  if (value == null) return null
  return <Fact label={label} value={value} />
}

/** "Yes · 2 years" / "No" bond fact; null when the drive doesn't say. */
export function BondFact({
  hasBond,
  bondYears,
}: {
  hasBond: boolean | null
  bondYears: number | null
}) {
  const value = formatBond(hasBond, bondYears)
  if (value == null) return null
  return <Fact label="Bond" value={value} />
}

/**
 * An icon-led label / value row: icon on the left, a muted caption label above a
 * medium-weight value. Wraps cleanly for long values (e.g. location lists).
 */
export function IconFact({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon
  label: string
  value: string
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div>
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="font-medium">{value}</dd>
      </div>
    </div>
  )
}

/** Icon-led money row; null when unset. */
export function IconMoneyFact({
  icon,
  label,
  mode,
  min,
  max,
}: {
  icon: LucideIcon
  label: string
  mode: DriveAmountMode | null
  min: string | null
  max: string | null
}) {
  const value = formatMoney(mode, min, max)
  if (value == null) return null
  return <IconFact icon={icon} label={label} value={value} />
}

/** Icon-led bond row; null when the drive doesn't say. */
export function IconBondFact({
  icon,
  hasBond,
  bondYears,
}: {
  icon: LucideIcon
  hasBond: boolean | null
  bondYears: number | null
}) {
  const value = formatBond(hasBond, bondYears)
  if (value == null) return null
  return <IconFact icon={icon} label="Bond" value={value} />
}
