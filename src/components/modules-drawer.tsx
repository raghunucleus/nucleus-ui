import { useEffect, useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { LayoutGrid, Search } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { ModuleTile } from '@/components/module-tile'
import { MODULES } from '@/lib/modules'
import { useAppDrawerStore } from '@/stores/app-drawer-store'

/** macOS shows the ⌘ glyph; every other platform shows "Ctrl". */
const IS_MAC =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.userAgent)
const SHORTCUT_LABEL = IS_MAC ? '⌘ K' : 'Ctrl K'

const ARROW_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']

/**
 * The app drawer — a full-screen, frosted-glass launcher. The search header
 * and the keyboard legend stay pinned while the module grid scrolls between
 * them, so it scales cleanly from a handful of modules to a hundred. Arrow
 * keys move the selection (and scroll it into view), Enter opens it, Esc
 * hides the drawer; Ctrl/⌘+K opens it from anywhere.
 */
export function ModulesDrawer() {
  const navigate = useNavigate()
  const open = useAppDrawerStore((state) => state.open)
  const setOpen = useAppDrawerStore((state) => state.setOpen)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const gridRef = useRef<HTMLDivElement>(null)

  // Ctrl/⌘+K opens the drawer from anywhere. Esc closing is handled by the
  // Sheet (Radix dialog) itself, which also reaches changeOpen below.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setOpen(true)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [setOpen])

  // Keep the selected tile in view as the selection moves through the grid.
  useEffect(() => {
    const tile = gridRef.current?.children[selected] as HTMLElement | undefined
    tile?.scrollIntoView({ block: 'nearest' })
  }, [selected])

  const q = query.trim().toLowerCase()
  const results = q
    ? MODULES.filter(
        (module) =>
          module.title.toLowerCase().includes(q) ||
          module.description.toLowerCase().includes(q),
      )
    : MODULES

  /** Reset search and selection whenever the drawer is dismissed. */
  function changeOpen(next: boolean) {
    setOpen(next)
    if (!next) {
      setQuery('')
      setSelected(0)
    }
  }

  /** A new search resets the selection to the first result. */
  function changeQuery(value: string) {
    setQuery(value)
    setSelected(0)
  }

  /** Tiles in the first row — the grid's current column count. */
  function columnCount(): number {
    const grid = gridRef.current
    if (!grid || grid.children.length === 0) return 1
    const firstTop = (grid.children[0] as HTMLElement).offsetTop
    let columns = 0
    for (const child of grid.children) {
      if ((child as HTMLElement).offsetTop !== firstTop) break
      columns += 1
    }
    return Math.max(1, columns)
  }

  /** Arrow keys move the selection; the grid is treated as a 2-D layout. */
  function handleSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!ARROW_KEYS.includes(event.key) || results.length === 0) return
    event.preventDefault()
    const columns = columnCount()
    setSelected((index) => {
      let next = index
      if (event.key === 'ArrowLeft') next = index - 1
      else if (event.key === 'ArrowRight') next = index + 1
      else if (event.key === 'ArrowUp') next = index - columns
      else if (event.key === 'ArrowDown') next = index + columns
      return Math.max(0, Math.min(results.length - 1, next))
    })
  }

  /** Enter opens the currently selected module. */
  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const target = results[selected]?.to
    if (target) {
      navigate({ to: target })
      changeOpen(false)
    }
  }

  /** Clicking the empty glass area around the grid dismisses the drawer. */
  function handleBackdropClick(event: React.MouseEvent) {
    if (event.target === event.currentTarget) changeOpen(false)
  }

  return (
    <Sheet open={open} onOpenChange={changeOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          className="cursor-pointer gap-2 hover:bg-background hover:text-foreground sm:min-w-64 dark:hover:bg-input/30"
          aria-label="Open modules drawer"
          aria-keyshortcuts="Control+K Meta+K"
        >
          <LayoutGrid />
          <span className="hidden text-sm font-normal text-muted-foreground sm:inline">
            Modules
          </span>
          <kbd className="ml-auto hidden items-center rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground sm:inline-flex">
            {SHORTCUT_LABEL}
          </kbd>
        </Button>
      </SheetTrigger>
      <SheetContent
        side="top"
        overlayClassName="bg-transparent"
        className="inset-0 flex h-svh w-full flex-col gap-0 bg-background/40 backdrop-blur-2xl backdrop-saturate-150"
      >
        {/* Pinned header — title and search stay in place while the grid scrolls. */}
        <div className="shrink-0 border-b border-border/60 px-4 pt-12 pb-5 sm:pt-14">
          <div className="mx-auto w-full max-w-4xl space-y-5">
            <SheetHeader className="items-center gap-1 p-0 text-center">
              <SheetTitle className="text-xl">All modules</SheetTitle>
              <SheetDescription>
                Search, then use the arrow keys to move and Enter to open.
              </SheetDescription>
            </SheetHeader>
            <form onSubmit={handleSubmit} className="mx-auto w-full max-w-md">
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  autoFocus
                  type="search"
                  placeholder="Search modules…"
                  value={query}
                  onChange={(event) => changeQuery(event.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  aria-label="Search modules"
                  className="pl-10"
                />
              </div>
            </form>
          </div>
        </div>

        {/* Scrollable module grid. */}
        <div
          onClick={handleBackdropClick}
          className="min-h-0 flex-1 overflow-y-auto px-4 py-7"
        >
          {results.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No modules match &ldquo;{query}&rdquo;.
            </p>
          ) : (
            <div
              ref={gridRef}
              className="mx-auto flex max-w-4xl flex-wrap justify-center gap-x-4 gap-y-7 sm:gap-x-6"
            >
              {results.map((module, index) => (
                <ModuleTile
                  key={module.title}
                  module={module}
                  selected={index === selected}
                  onNavigate={() => changeOpen(false)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Pinned keyboard legend. */}
        <div className="shrink-0 border-t border-border/60 px-4 py-3">
          <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
            <Hint keys={['↑', '↓', '←', '→']} label="Navigate" />
            <Hint keys={['↵']} label="Open" />
            <Hint keys={['Esc']} label="Close" />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

/** A single keyboard-shortcut hint — one or more key caps plus a label. */
function Hint({ keys, label }: { keys: string[]; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="flex gap-1">
        {keys.map((key) => (
          <kbd
            key={key}
            className="inline-flex h-5 min-w-5 items-center justify-center rounded border bg-muted px-1.5 font-mono text-[11px] font-medium text-foreground/70"
          >
            {key}
          </kbd>
        ))}
      </span>
      {label}
    </span>
  )
}
