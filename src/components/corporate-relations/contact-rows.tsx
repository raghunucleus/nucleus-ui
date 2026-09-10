import { Plus, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/corporate-relations/bits'
import type { ContactDraft, ContactErrors } from '@/lib/cr-view-contacts'
import { cn } from '@/lib/utils'

/**
 * The repeatable HR-contact row grid — one bordered block per contact plus the
 * "Add contact" button. Purely controlled: the parent owns the drafts, the
 * validation (pass `errors` only once they should show), and the save. Shared
 * by the contacts dialog and the full-row edit sheet so the two can never
 * drift apart.
 */
export function ContactRows({
  drafts,
  errors,
  onPatch,
  onAdd,
  onRemove,
}: {
  drafts: ContactDraft[]
  /** Per-uid field errors; pass `{}` until the first save attempt. */
  errors: Record<string, ContactErrors>
  onPatch: (uid: string, p: Partial<ContactDraft>) => void
  onAdd: () => void
  onRemove: (uid: string) => void
}) {
  return (
    <div className="space-y-3">
      {drafts.map((d, i) => {
        const rowErrors = errors[d.uid] ?? {}
        return (
          <div
            key={d.uid}
            className={cn(
              'space-y-3 rounded-lg border p-3',
              errors[d.uid] && 'border-destructive/40 bg-destructive/5',
            )}
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Contact {i + 1}
              </p>
              <Button
                size="icon"
                variant="ghost"
                className="size-7"
                aria-label={`Remove contact ${i + 1}`}
                onClick={() => onRemove(d.uid)}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="HR name" required>
                <Input
                  value={d.hr_name}
                  maxLength={160}
                  onChange={(e) => onPatch(d.uid, { hr_name: e.target.value })}
                  aria-invalid={!!rowErrors.hr_name}
                  className={cn(rowErrors.hr_name && 'border-destructive')}
                />
                {rowErrors.hr_name && (
                  <p className="text-xs text-destructive">
                    {rowErrors.hr_name}
                  </p>
                )}
              </Field>
              <Field label="HR designation">
                <Input
                  value={d.hr_designation}
                  maxLength={160}
                  onChange={(e) =>
                    onPatch(d.uid, { hr_designation: e.target.value })
                  }
                />
              </Field>
              <Field label="HR number">
                <Input
                  value={d.hr_mobile}
                  inputMode="numeric"
                  maxLength={10}
                  onChange={(e) =>
                    onPatch(d.uid, { hr_mobile: e.target.value })
                  }
                  aria-invalid={!!rowErrors.hr_mobile}
                  className={cn(rowErrors.hr_mobile && 'border-destructive')}
                />
                {rowErrors.hr_mobile && (
                  <p className="text-xs text-destructive">
                    {rowErrors.hr_mobile}
                  </p>
                )}
              </Field>
              <Field label="HR landline">
                <Input
                  value={d.hr_landline}
                  maxLength={32}
                  onChange={(e) =>
                    onPatch(d.uid, { hr_landline: e.target.value })
                  }
                />
              </Field>
              <Field label="HR mail ID" className="sm:col-span-2">
                <Input
                  type="email"
                  value={d.hr_email}
                  maxLength={255}
                  onChange={(e) => onPatch(d.uid, { hr_email: e.target.value })}
                  aria-invalid={!!rowErrors.hr_email}
                  className={cn(rowErrors.hr_email && 'border-destructive')}
                />
                {rowErrors.hr_email && (
                  <p className="text-xs text-destructive">
                    {rowErrors.hr_email}
                  </p>
                )}
              </Field>
            </div>
          </div>
        )
      })}

      <Button variant="outline" size="sm" onClick={onAdd}>
        <Plus className="size-4" /> Add contact
      </Button>
    </div>
  )
}
