import type { ApprovalRow } from '@/lib/employee-requests'
import type { CatalogModule } from '@/lib/student-requests'
import { renderModuleIcon } from './module-icons'
import { rendererFor } from './payloads'

/**
 * The leading thumbnail for a request row. A type that can identify itself
 * visually — a company by its logo — supplies an `Avatar`; everything else
 * falls back to the icon of the module the type belongs to, so every row still
 * reads as something rather than an empty cell.
 *
 * The payload has to be enriched for a logo to resolve, which the list
 * endpoints now do (presigns are cached server-side).
 */
export function RequestAvatar({
  row,
  catalog,
}: {
  row: ApprovalRow
  catalog: CatalogModule[]
}) {
  const renderer = rendererFor(row.request_type)
  if (renderer.Avatar) return <>{renderer.Avatar({ row })}</>

  return (
    <div className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-muted">
      {renderModuleIcon(catalog, row.request_type, 'size-4 text-muted-foreground')}
    </div>
  )
}
