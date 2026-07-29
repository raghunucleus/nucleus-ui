import * as React from 'react'
import { Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ContactRows } from '@/components/corporate-relations/contact-rows'
import {
  emptyContact,
  fromSaved,
  keptDrafts,
  toWrites,
  validateDrafts,
  type ContactDraft,
} from '@/lib/cr-view-contacts'
import type {
  CrViewContact,
  CrViewContactWrite,
} from '@/lib/corporate-relations'

/**
 * The repeatable "Contact details" group for one (job role × passout year) —
 * HR name / designation / mobile / landline / mail, any number of sets.
 *
 * A dialog rather than inline cells because five fields × N contacts cannot
 * read inside a table cell; the cell shows a summary and this is the editor
 * behind it. One Save sends the COMPLETE set as `{ contacts }` — the server
 * deletes rows absent from it, so removals need no separate call.
 *
 * The row grid itself is {@link ContactRows}, shared with the full-row edit
 * sheet.
 */
export function CrViewContactsDialog({
  open,
  ...props
}: {
  open: boolean
  /** e.g. the role name. */
  title: string
  /** e.g. "TCS · 2026-2027". */
  subtitle: string
  /** What the record currently holds — the dialog seeds its drafts from this. */
  contacts: CrViewContact[]
  readOnly: boolean
  onOpenChange: (open: boolean) => void
  /** Resolves `true` on success — the dialog closes itself only then. */
  onSave: (contacts: CrViewContactWrite[]) => Promise<boolean>
}) {
  // Unmounted while closed, so each open MOUNTS fresh and the drafts seed in
  // a plain useState initializer — no seed-on-open effect, and stale drafts
  // from the last row can never leak into this one.
  if (!open) return null
  return <ContactsDialogBody {...props} />
}

function ContactsDialogBody({
  title,
  subtitle,
  contacts,
  readOnly,
  onOpenChange,
  onSave,
}: {
  title: string
  subtitle: string
  contacts: CrViewContact[]
  readOnly: boolean
  onOpenChange: (open: boolean) => void
  onSave: (contacts: CrViewContactWrite[]) => Promise<boolean>
}) {
  const [drafts, setDrafts] = React.useState<ContactDraft[]>(() =>
    contacts.length > 0 ? contacts.map(fromSaved) : [emptyContact()],
  )
  const [saving, setSaving] = React.useState(false)
  /** Errors stay hidden until the first save attempt — typing starts clean. */
  const [showErrors, setShowErrors] = React.useState(false)

  const validation = React.useMemo(() => validateDrafts(drafts), [drafts])

  const patch = (uid: string, p: Partial<ContactDraft>) =>
    setDrafts((prev) => prev.map((d) => (d.uid === uid ? { ...d, ...p } : d)))
  const add = () => setDrafts((prev) => [...prev, emptyContact()])
  const remove = (uid: string) =>
    setDrafts((prev) => prev.filter((d) => d.uid !== uid))

  async function save() {
    const kept = keptDrafts(drafts)
    const { firstError } = validateDrafts(kept)
    if (firstError) {
      setShowErrors(true)
      return
    }
    setSaving(true)
    try {
      const ok = await onSave(toWrites(kept))
      if (ok) onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Contact details — {title}</DialogTitle>
          <DialogDescription>{subtitle}</DialogDescription>
        </DialogHeader>

        <div className="-mx-1 flex-1 space-y-3 overflow-y-auto px-1 py-1">
          {readOnly && contacts.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No contacts recorded.
            </p>
          ) : readOnly ? (
            contacts.map((c) => (
              <div key={c.id} className="rounded-lg border px-3 py-2.5">
                <p className="text-sm font-medium">{c.hr_name}</p>
                {c.hr_designation && (
                  <p className="text-xs text-muted-foreground">
                    {c.hr_designation}
                  </p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  {[c.hr_mobile, c.hr_landline, c.hr_email]
                    .filter(Boolean)
                    .join(' · ') || '—'}
                </p>
              </div>
            ))
          ) : (
            <ContactRows
              drafts={drafts}
              errors={showErrors ? validation.byUid : {}}
              onPatch={patch}
              onAdd={add}
              onRemove={remove}
            />
          )}
        </div>

        {!readOnly && (
          <DialogFooter className="border-t pt-3">
            {showErrors && validation.firstError && (
              <p className="mr-auto self-center text-xs text-destructive">
                {validation.firstError}
              </p>
            )}
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={() => void save()} disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
