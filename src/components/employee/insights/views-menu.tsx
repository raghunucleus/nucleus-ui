import {
  Bookmark,
  BookmarkPlus,
  ChevronDown,
  Pencil,
  Star,
  Trash2,
} from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ApiError } from '@/lib/api'
import { searchToRecord, type SavedView } from '@/lib/insights-views'
import { cn } from '@/lib/utils'
import { go } from './insights-utils'
import {
  patchView,
  removeView,
  saveView,
  useSavedViews,
} from './views-store'

const SCREEN_LABEL: Record<string, string> = {
  'insights.overview.view': 'Overview',
  'insights.attendance.view': 'Attendance',
  'insights.results.view': 'Results',
  'insights.placements.view': 'Placements',
  'insights.students.view': 'Students',
  'insights.requests.view': 'Requests & leaves',
}

function applyView(v: SavedView) {
  // Exact, not merged: a view with no department narrowing must not inherit
  // the department currently in the address.
  go(v.route, searchToRecord(v.search), { merge: false })
}

/**
 * The "Views" control in every insights header: save the current address
 * under a name, reopen a saved one, pin it to the Overview, rename, delete.
 * Personal only. The current address (tab, scope, the screen's own filters)
 * is what gets saved — so every filter must be mirrored into the URL.
 */
export function ViewsMenu({
  screenKey,
  route,
}: {
  screenKey: string
  route: string
}) {
  const { views } = useSavedViews()
  const [saving, setSaving] = useState(false)
  const [renaming, setRenaming] = useState<SavedView | null>(null)

  const mine = useMemo(
    () => (views ?? []).filter((v) => v.screen_key === screenKey),
    [views, screenKey],
  )
  const others = useMemo(
    () => (views ?? []).filter((v) => v.screen_key !== screenKey),
    [views, screenKey],
  )

  const togglePin = async (v: SavedView) => {
    try {
      await patchView(v.id, { is_pinned: !v.is_pinned })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not update the view.')
    }
  }
  const del = async (v: SavedView) => {
    try {
      await removeView(v.id)
      toast.success(`Deleted “${v.name}”.`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not delete the view.')
    }
  }

  const row = (v: SavedView, showScreen: boolean) => (
    <DropdownMenuItem
      key={v.id}
      onSelect={() => applyView(v)}
      className="group gap-2"
    >
      <Bookmark className="size-3.5" />
      <span className="min-w-0 flex-1">
        <span className="block truncate">{v.name}</span>
        {showScreen && (
          <span className="block truncate text-xs text-muted-foreground">
            {SCREEN_LABEL[v.screen_key] ?? v.screen_key}
          </span>
        )}
      </span>
      <span className="flex shrink-0 items-center gap-0.5 opacity-70 group-hover:opacity-100">
        <button
          type="button"
          aria-label={v.is_pinned ? 'Unpin from Overview' : 'Pin to Overview'}
          aria-pressed={v.is_pinned}
          onClick={(e) => {
            e.stopPropagation()
            e.preventDefault()
            void togglePin(v)
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className="rounded p-1 hover:bg-accent"
        >
          <Star
            className={cn(
              'size-3.5',
              v.is_pinned && 'fill-icon-amber text-icon-amber',
            )}
          />
        </button>
        <button
          type="button"
          aria-label="Rename"
          onClick={(e) => {
            e.stopPropagation()
            e.preventDefault()
            setRenaming(v)
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className="rounded p-1 hover:bg-accent"
        >
          <Pencil className="size-3.5" />
        </button>
        <button
          type="button"
          aria-label="Delete"
          onClick={(e) => {
            e.stopPropagation()
            e.preventDefault()
            void del(v)
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-destructive"
        >
          <Trash2 className="size-3.5" />
        </button>
      </span>
    </DropdownMenuItem>
  )

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 px-2.5 text-xs font-normal"
          >
            <Bookmark className="size-3.5" />
            Views
            {mine.length > 0 && (
              <span className="rounded bg-muted px-1.5 text-[11px] leading-4 tabular-nums">
                {mine.length}
              </span>
            )}
            <ChevronDown className="size-3.5 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          <DropdownMenuItem onSelect={() => setSaving(true)} className="gap-2">
            <BookmarkPlus className="size-4" />
            Save current view…
          </DropdownMenuItem>
          {views === null ? (
            <p className="px-2 py-3 text-xs text-muted-foreground">Loading…</p>
          ) : (
            <>
              {mine.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-xs text-muted-foreground">
                    This screen
                  </DropdownMenuLabel>
                  {mine.map((v) => row(v, false))}
                </>
              )}
              {others.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-xs text-muted-foreground">
                    Other screens
                  </DropdownMenuLabel>
                  {others.map((v) => row(v, true))}
                </>
              )}
              {mine.length === 0 && others.length === 0 && (
                <p className="px-2 py-3 text-xs text-muted-foreground">
                  No saved views yet. Set up a scope and filters, then save
                  them here to come back in one click.
                </p>
              )}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <SaveViewDialog
        open={saving}
        onOpenChange={setSaving}
        screenKey={screenKey}
        route={route}
      />
      <RenameViewDialog view={renaming} onClose={() => setRenaming(null)} />
    </>
  )
}

function SaveViewDialog({
  open,
  onOpenChange,
  screenKey,
  route,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  screenKey: string
  route: string
}) {
  const [name, setName] = useState('')
  const [pin, setPin] = useState(false)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    setBusy(true)
    try {
      await saveView({
        screen_key: screenKey,
        route,
        name: trimmed,
        search: window.location.search.replace(/^\?/, ''),
        is_pinned: pin,
      })
      toast.success(`Saved “${trimmed}”.`)
      setName('')
      setPin(false)
      onOpenChange(false)
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        toast.info('You already have a view with that name on this screen.')
      } else {
        toast.error(
          err instanceof Error ? err.message : 'Could not save the view.',
        )
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Save this view</DialogTitle>
            <DialogDescription>
              Keeps the current screen, tab, scope and filters under a name.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="save-view-name">Name</Label>
            <Input
              id="save-view-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={pin}
              onChange={(e) => setPin(e.target.checked)}
              className="size-4 accent-primary"
            />
            Pin to the Overview
          </label>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !name.trim()}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function RenameViewDialog({
  view,
  onClose,
}: {
  view: SavedView | null
  onClose: () => void
}) {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  // Seed the field from the view being renamed; keyed on the view id so a
  // different row starts fresh (no effect writing state).
  const key = view?.id ?? 0
  const [seededFor, setSeededFor] = useState(0)
  if (view && seededFor !== key) {
    setSeededFor(key)
    setName(view.name)
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!view) return
    const trimmed = name.trim()
    if (!trimmed || trimmed === view.name) {
      onClose()
      return
    }
    setBusy(true)
    try {
      await patchView(view.id, { name: trimmed })
      toast.success('Renamed.')
      onClose()
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        toast.info('You already have a view with that name on this screen.')
      } else {
        toast.error(err instanceof Error ? err.message : 'Could not rename.')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={view !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Rename view</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="rename-view-name">Name</Label>
            <Input
              id="rename-view-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !name.trim()}>
              Rename
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** Pinned views across every screen, one chip each — the Overview's shortcut row. */
export function PinnedViewsStrip() {
  const { views } = useSavedViews()
  const pinned = useMemo(
    () => (views ?? []).filter((v) => v.is_pinned),
    [views],
  )
  if (pinned.length === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">Pinned</span>
      {pinned.map((v) => (
        <button
          key={v.id}
          type="button"
          onClick={() => applyView(v)}
          className="inline-flex items-center gap-1 rounded-full border bg-card px-2.5 py-1 text-xs transition-colors hover:bg-accent"
          title={SCREEN_LABEL[v.screen_key] ?? v.screen_key}
        >
          <Star className="size-3 fill-icon-amber text-icon-amber" />
          {v.name}
          <span className="text-muted-foreground">
            · {SCREEN_LABEL[v.screen_key] ?? ''}
          </span>
        </button>
      ))}
    </div>
  )
}
