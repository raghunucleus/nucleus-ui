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
  if (!mode || min == null) return null
  const fmt = (v: string) => `₹${Number(v).toLocaleString('en-IN')}`
  const value =
    mode === 'range' && max != null ? `${fmt(min)} – ${fmt(max)}` : fmt(min)
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
  if (hasBond == null) return null
  const value = hasBond
    ? `Yes${bondYears ? ` · ${bondYears} year${bondYears === 1 ? '' : 's'}` : ''}`
    : 'No'
  return <Fact label="Bond" value={value} />
}
