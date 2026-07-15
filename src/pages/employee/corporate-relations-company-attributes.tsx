import { Check, Loader2, Pencil, Plus, SlidersHorizontal, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { NoAccessEmptyState } from '@/components/employee/empty-states'
import { useScreenAccess } from '@/hooks/use-screen-access'
import { cn } from '@/lib/utils'
import {
  createAttribute,
  listAttributes,
  setAttributeStatus,
  updateAttribute,
  LOOKUP_KINDS,
  type LookupKind,
  type LookupValue,
} from '@/lib/corporate-relations'

const SCREEN_KEY = 'corporate_relations.company_attributes.manage'

function msg(e: unknown, fallback: string): string {
  return e instanceof Error ? e.message : fallback
}

export default function EmployeeCompanyAttributesPage() {
  useEffect(() => {
    document.title = 'Company Attributes — Nucleus'
  }, [])

  const access = useScreenAccess(SCREEN_KEY)
  const actions = access?.actions ?? []
  const [kind, setKind] = useState<LookupKind>('categories')

  if (!access) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <NoAccessEmptyState />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex items-center gap-2">
        <SlidersHorizontal className="size-5 text-muted-foreground" />
        <div>
          <h1 className="text-lg font-semibold tracking-tight">
            Company Attributes
          </h1>
          <p className="text-sm text-muted-foreground">
            Configure the classifiers companies can be tagged with.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
        <nav className="flex gap-1 overflow-x-auto sm:flex-col sm:overflow-visible">
          {LOOKUP_KINDS.map((k) => (
            <button
              key={k.key}
              type="button"
              onClick={() => setKind(k.key)}
              className={cn(
                'whitespace-nowrap rounded-md px-3 py-2 text-left text-sm font-medium transition-colors',
                kind === k.key
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-accent hover:text-accent-foreground',
              )}
            >
              {k.label}
            </button>
          ))}
        </nav>

        <LookupEditor
          kind={kind}
          canCreate={actions.includes('create')}
          canEdit={actions.includes('edit')}
          canActivate={actions.includes('activate')}
        />
      </div>
    </div>
  )
}

function LookupEditor({
  kind,
  canCreate,
  canEdit,
  canActivate,
}: {
  kind: LookupKind
  canCreate: boolean
  canEdit: boolean
  canActivate: boolean
}) {
  const [values, setValues] = useState<LookupValue[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [busy, setBusy] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')

  async function load() {
    setValues(null)
    setError(null)
    try {
      setValues(await listAttributes(kind))
    } catch (e) {
      setError(msg(e, 'Could not load values.'))
    }
  }

  useEffect(() => {
    void load()
    setNewName('')
    setEditId(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind])

  async function add() {
    if (!newName.trim()) return
    setBusy(true)
    try {
      await createAttribute(kind, { name: newName.trim() })
      setNewName('')
      toast.success('Added.')
      await load()
    } catch (e) {
      toast.error(msg(e, 'Could not add.'))
    } finally {
      setBusy(false)
    }
  }

  async function saveEdit(id: number) {
    if (!editName.trim()) return
    try {
      await updateAttribute(kind, id, { name: editName.trim() })
      setEditId(null)
      toast.success('Renamed.')
      await load()
    } catch (e) {
      toast.error(msg(e, 'Could not rename.'))
    }
  }

  async function toggle(v: LookupValue) {
    try {
      await setAttributeStatus(kind, v.id, !v.is_active)
      await load()
    } catch (e) {
      toast.error(msg(e, 'Could not update.'))
    }
  }

  return (
    <div className="space-y-3">
      {canCreate && (
        <div className="flex gap-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void add()}
            placeholder="Add a value…"
          />
          <Button onClick={() => void add()} disabled={busy || !newName.trim()}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            Add
          </Button>
        </div>
      )}

      {values === null ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="mr-2 size-4 animate-spin" /> Loading…
        </div>
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : values.length === 0 ? (
        <p className="rounded-xl border border-dashed bg-muted/20 p-8 text-center text-sm text-muted-foreground">
          No values yet.
        </p>
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {values.map((v) => (
            <li key={v.id} className="flex items-center gap-2 px-4 py-2.5">
              {editId === v.id ? (
                <>
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && void saveEdit(v.id)}
                    className="h-8"
                    autoFocus
                  />
                  <Button size="icon" variant="ghost" className="size-8" onClick={() => void saveEdit(v.id)}>
                    <Check className="size-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="size-8" onClick={() => setEditId(null)}>
                    <X className="size-4" />
                  </Button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm">
                    {v.name}
                    {!v.is_active && (
                      <Badge variant="muted" className="ml-2">
                        Inactive
                      </Badge>
                    )}
                  </span>
                  {canEdit && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-8"
                      onClick={() => {
                        setEditId(v.id)
                        setEditName(v.name)
                      }}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                  )}
                  {canActivate && (
                    <Switch
                      checked={v.is_active}
                      onCheckedChange={() => void toggle(v)}
                    />
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
