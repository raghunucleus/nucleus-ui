import * as DialogPrimitive from '@radix-ui/react-dialog'
import { CornerDownLeft, Search, SearchX } from 'lucide-react'
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from 'react'

import { MODULE_TONES, iconFor, toneFor } from '@/components/employee/module-icons'
import type { EffectiveAccess } from '@/lib/employee-access'
import { menuGroups, navigateTo, sortModules, type MenuScreen } from '@/lib/employee-menu'
import { cn } from '@/lib/utils'

const isMac =
  typeof navigator !== 'undefined' &&
  /Mac|iPod|iPhone|iPad/.test(navigator.platform)

/** Header button that opens the menu search — central's command-palette
 * trigger. The shortcut hint is decorative below `md`. */
export function MenuSearchTrigger({
  onOpen,
  className,
}: {
  onOpen: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="Search menu"
      aria-keyshortcuts={isMac ? 'Meta+K' : 'Control+K'}
      className={cn(
        'flex h-9 items-center gap-2 rounded-lg border bg-background px-3 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
        className,
      )}
    >
      <Search className="size-4 shrink-0" />
      <span className="hidden md:inline">Search menu…</span>
      <kbd className="hidden rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] font-medium md:inline">
        {isMac ? '⌘' : 'Ctrl'} K
      </kbd>
    </button>
  )
}

/**
 * Menu search dialog (Ctrl/⌘-K). Lists every screen the employee can open,
 * grouped by module, narrowed as they type; ↑/↓ move, Enter opens, Escape
 * closes. State lives in the inner panel, which Radix unmounts on close, so
 * every opening starts with an empty query and nothing needs resetting.
 */
export function MenuSearchDialog({
  open,
  onOpenChange,
  access,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  access: EffectiveAccess | null
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[18%] left-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-lg duration-150"
        >
          <DialogPrimitive.Title className="sr-only">Search menu</DialogPrimitive.Title>
          <MenuSearchPanel access={access} onClose={() => onOpenChange(false)} />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

function MenuSearchPanel({
  access,
  onClose,
}: {
  access: EffectiveAccess | null
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)
  const q = query.trim().toLowerCase()

  const modules = useMemo(() => sortModules(access), [access])
  const groups = useMemo(
    () => menuGroups(access, modules, q).filter((g) => g.screens.length > 0),
    [access, modules, q],
  )
  const flat = useMemo(() => groups.flatMap((g) => g.screens), [groups])
  // Derived, never stored: a shrinking result list can't strand the cursor.
  const active = Math.min(cursor, Math.max(0, flat.length - 1))

  // Keep the highlighted row in view while arrowing through a long list.
  useEffect(() => {
    document
      .querySelector('[data-menu-search-row][data-active="true"]')
      ?.scrollIntoView({ block: 'nearest' })
  }, [active])

  function select(screen: MenuScreen) {
    onClose()
    if (screen.web_route) navigateTo(screen.web_route)
  }

  function onKeyDown(e: ReactKeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setCursor(Math.min(active + 1, Math.max(0, flat.length - 1)))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setCursor(Math.max(active - 1, 0))
    } else if (e.key === 'Enter') {
      const hit = flat[active]
      if (hit) {
        e.preventDefault()
        select(hit)
      }
    }
  }

  let index = -1

  return (
    <div className="flex flex-col">
      <div className="flex h-11 items-center gap-2 border-b px-3">
        <Search className="size-4 shrink-0 text-muted-foreground" />
        <input
          autoFocus
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setCursor(0)
          }}
          onKeyDown={onKeyDown}
          placeholder="Search menu"
          aria-label="Search menu"
          role="combobox"
          aria-expanded
          aria-controls="menu-search-results"
          aria-autocomplete="list"
          className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        <kbd className="hidden rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground sm:inline">
          Esc
        </kbd>
      </div>

      <div
        id="menu-search-results"
        role="listbox"
        className="scrollbar-themed max-h-80 overflow-y-auto p-1"
      >
        {!access ? (
          <p className="px-3 py-6 text-center text-xs text-muted-foreground">
            Loading your menu…
          </p>
        ) : modules.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs text-muted-foreground">
            No modules assigned yet. Contact an administrator.
          </p>
        ) : flat.length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 px-3 py-6 text-center">
            <SearchX className="size-5 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">
              No menu items match{' '}
              <span className="font-medium text-foreground">&ldquo;{query}&rdquo;</span>
            </p>
          </div>
        ) : (
          groups.map(({ mod, screens }) => {
            const Icon = iconFor(mod.icon)
            const tone = MODULE_TONES[toneFor(mod.icon)]
            return (
              <div key={mod.key} className="py-1">
                <div className="flex items-center gap-1.5 px-2 py-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                  <Icon className={cn('size-3.5', tone.text)} />
                  {mod.label}
                </div>
                {screens.map((s) => {
                  index += 1
                  const i = index
                  const on = i === active
                  return (
                    <button
                      key={s.key}
                      type="button"
                      role="option"
                      aria-selected={on}
                      data-menu-search-row
                      data-active={on || undefined}
                      onMouseEnter={() => setCursor(i)}
                      onClick={() => select(s)}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors',
                        on ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/60',
                      )}
                    >
                      <span className="min-w-0 flex-1 truncate">
                        {highlight(s.label, q)}
                      </span>
                      {on && (
                        <CornerDownLeft className="size-3.5 shrink-0 text-muted-foreground" />
                      )}
                    </button>
                  )
                })}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

function highlight(text: string, q: string): ReactNode {
  if (!q) return text
  const i = text.toLowerCase().indexOf(q)
  if (i < 0) return text
  return (
    <>
      {text.slice(0, i)}
      <mark className="rounded-sm bg-primary/15 px-0.5 text-primary">
        {text.slice(i, i + q.length)}
      </mark>
      {text.slice(i + q.length)}
    </>
  )
}
