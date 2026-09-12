import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { ChevronDown, Search, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { useScreenAccess } from '@/hooks/use-screen-access'
import {
  NoAccessEmptyState,
  NoScopeEmptyState,
} from '@/components/employee/empty-states'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PageHeader } from '@/components/ui/page-header'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  fetchExamMarksScope,
  type ExamMarksScopeItem,
} from '@/lib/exam-marks'
import { cn } from '@/lib/utils'

const SCREEN_KEY = 'examinations.marks.upload'

/** Cross-screen nav — mirrors the employee-portal imperative pattern. */
function navigateTo(path: string) {
  window.history.pushState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

interface Programme {
  id: number
  name: string
  code: string
}
interface YearOption {
  comboId: number
  yearId: number
  display: string
}

/**
 * A `DropdownMenu` with a sticky search box at the top that filters the items
 * client-side — radix has no combobox primitive and the project ships no cmdk,
 * so we layer an `Input` over the menu. `onOpenAutoFocus` is prevented so the
 * input (not the first item) takes focus on open; character keystrokes are kept
 * local with `stopPropagation` so radix's built-in typeahead doesn't swallow
 * them, while arrow/enter/escape still bubble for keyboard navigation.
 */
function SearchableMenu<T>({
  items,
  trigger,
  disabled,
  searchPlaceholder,
  emptyText,
  toText,
  getKey,
  renderItem,
  onSelect,
}: {
  items: T[]
  trigger: ReactNode
  disabled?: boolean
  searchPlaceholder: string
  emptyText: string
  /** Text searched against the query (lower-cased + `includes`). */
  toText: (item: T) => string
  getKey: (item: T) => React.Key
  renderItem: (item: T) => ReactNode
  onSelect: (item: T) => void
}) {
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const filtered = q
    ? items.filter((it) => toText(it).toLowerCase().includes(q))
    : items

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (!open) setQuery('')
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className="w-full justify-between font-normal"
        >
          {trigger}
          <ChevronDown className="ml-2 size-4 shrink-0 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        // Keep focus on the search input when the menu opens — radix would
        // otherwise jump to the first item and scroll past the search field.
        onOpenAutoFocus={(e: Event) => e.preventDefault()}
        className="max-h-72 w-(--radix-dropdown-menu-trigger-width) overflow-y-auto p-0"
      >
        <div className="sticky top-0 z-10 border-b bg-popover p-1">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              // Stop typing keys from bubbling to radix's menu type-ahead so
              // letters land in the input instead of matching items.
              onKeyDown={(e) => e.stopPropagation()}
              placeholder={searchPlaceholder}
              className="h-9 pl-8"
            />
          </div>
        </div>
        <div className="p-1">
          {filtered.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">
              {emptyText}
            </p>
          ) : (
            filtered.map((it) => (
              <DropdownMenuItem key={getKey(it)} onSelect={() => onSelect(it)}>
                {renderItem(it)}
              </DropdownMenuItem>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * Batch picker as two dependent dropdowns: pick a programme, then its
 * admission year (disabled until a programme is chosen). Selecting the year
 * resolves the single programme_admission_years id and routes to the upload
 * screen. Scales to many programmes/years without a long flat list.
 */
export default function EmployeeMarksUploadPage() {
  const access = useScreenAccess(SCREEN_KEY)
  const canUpload = !!access?.actions.includes('upload')

  const [batches, setBatches] = useState<ExamMarksScopeItem[] | null>(null)
  const [programmeId, setProgrammeId] = useState<number | null>(null)

  useEffect(() => {
    if (!canUpload) return
    let alive = true
    void (async () => {
      try {
        const data = await fetchExamMarksScope()
        if (alive) setBatches(data)
      } catch (err) {
        if (!alive) return
        setBatches([])
        toast.error(
          err instanceof Error ? err.message : 'Failed to load your batches',
        )
      }
    })()
    return () => {
      alive = false
    }
  }, [canUpload])

  // Distinct programmes (server already sorts programme ASC, year DESC).
  const programmes = useMemo<Programme[]>(() => {
    const m = new Map<number, Programme>()
    for (const b of batches ?? []) {
      if (!m.has(b.programme_id)) {
        m.set(b.programme_id, {
          id: b.programme_id,
          name: b.programme_name,
          code: b.programme_code,
        })
      }
    }
    return [...m.values()]
  }, [batches])

  const years = useMemo<YearOption[]>(() => {
    if (programmeId === null) return []
    return (batches ?? [])
      .filter((b) => b.programme_id === programmeId)
      .map((b) => ({
        comboId: b.id,
        yearId: b.admission_year_id,
        display: b.admission_year_display,
      }))
  }, [batches, programmeId])

  const selectedProgramme = programmes.find((p) => p.id === programmeId) ?? null

  // ---- access gates ----------------------------------------------------
  if (!access) return <NoAccessEmptyState />
  if (!canUpload) return <NoScopeEmptyState attributeLabel="upload permission" />
  if (batches !== null && batches.length === 0) {
    return (
      <NoScopeEmptyState attributeLabel="programme / admission-year batches" />
    )
  }

  const loading = batches === null

  return (
    <section className="mx-auto max-w-xl space-y-4">
      <PageHeader title="Upload marks" icon={Upload} />

      <Card>
        <CardContent className="space-y-5 pt-6">
          {/* Programme */}
          <div className="space-y-1.5">
            <Label>Programme</Label>
            <SearchableMenu
              items={programmes}
              disabled={loading}
              searchPlaceholder="Search programmes…"
              emptyText="No programmes match your search."
              toText={(p) => `${p.name} ${p.code}`}
              getKey={(p) => p.id}
              onSelect={(p) => setProgrammeId(p.id)}
              trigger={
                <span
                  className={cn(!selectedProgramme && 'text-muted-foreground')}
                >
                  {loading
                    ? 'Loading…'
                    : selectedProgramme
                      ? `${selectedProgramme.name}${selectedProgramme.code ? ` (${selectedProgramme.code})` : ''}`
                      : 'Select a programme…'}
                </span>
              }
              renderItem={(p) => (
                <>
                  {p.name}
                  {p.code && (
                    <span className="ml-1 text-xs text-muted-foreground">
                      ({p.code})
                    </span>
                  )}
                </>
              )}
            />
          </div>

          {/* Admission year — disabled until a programme is chosen */}
          <div className="space-y-1.5">
            <Label className={cn(programmeId === null && 'text-muted-foreground')}>
              Admission year
            </Label>
            <SearchableMenu
              items={years}
              disabled={programmeId === null}
              searchPlaceholder="Search admission years…"
              emptyText="No admission years match your search."
              toText={(y) => y.display}
              getKey={(y) => y.comboId}
              onSelect={(y) => navigateTo(`/marks/upload/${y.comboId}`)}
              trigger={
                <span className="text-muted-foreground">
                  {programmeId === null
                    ? 'Select a programme first'
                    : 'Select an admission year…'}
                </span>
              }
              renderItem={(y) => y.display}
            />
            {programmeId !== null && (
              <p className="text-xs text-muted-foreground">
                Choosing a year opens its upload screen.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </section>
  )
}
