import { Bell, Loader2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import { Textarea } from '@/components/corporate-relations/bits'
import { ChannelPicker } from '@/components/employee/channel-picker'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ApiError } from '@/lib/api'
import { hasChannel, type NotifyChannels } from '@/lib/notify-channels'
import {
  notifyCoordinatorStudent,
  type CoordinatorStudentProfile,
} from '@/lib/placement-coordinator-students'
import { cn } from '@/lib/utils'

/** A field the coordinator can ask the student to fill, grouped as the profile is. */
interface PickableField {
  key: string
  label: string
  group: string
  /** Empty on the student's profile — these are pre-selected. */
  missing: boolean
}

/**
 * Compose a "please update these fields" notification for one student.
 *
 * The field list and the pre-selection both come from the profile already
 * loaded in the sheet — `groups` supplies the labels, `completion.missing`
 * decides what starts checked — so opening this dialog costs no extra request
 * and can never disagree with what the coordinator is looking at.
 */
export function NotifyStudentDialog({
  open,
  onOpenChange,
  payId,
  studentId,
  studentName,
  profile,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  payId: number
  studentId: number
  studentName: string
  profile: CoordinatorStudentProfile
}) {
  const fields = useMemo<PickableField[]>(() => {
    const missing = new Set(profile.completion.missing)
    const seen = new Set<string>()
    const out: PickableField[] = []
    for (const g of profile.groups) {
      for (const f of g.fields) {
        seen.add(f.key)
        out.push({
          key: f.key,
          label: f.label,
          group: g.label,
          missing: missing.has(f.key),
        })
      }
    }
    // Missing keys the profile payload renders as its own section rather than a
    // group row (resume, certifications) still belong in the picker.
    for (const key of profile.completion.missing) {
      if (seen.has(key)) continue
      out.push({ key, label: prettify(key), group: 'Other', missing: true })
    }
    return out
  }, [profile])

  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(profile.completion.missing),
  )
  const [message, setMessage] = useState(
    'Please complete the pending fields in your Nucleus profile so you can be considered for upcoming placement drives.',
  )
  const [channels, setChannels] = useState<NotifyChannels>({
    in_app: true,
    push: true,
    email: false,
  })
  const [sending, setSending] = useState(false)

  const canSend = hasChannel(channels) && message.trim().length > 0 && !sending

  const toggleField = (key: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const send = async () => {
    setSending(true)
    try {
      await notifyCoordinatorStudent(payId, studentId, {
        field_keys: [...selected],
        message: message.trim(),
        channels,
      })
      toast.success(`Notification sent to ${studentName}.`)
      onOpenChange(false)
    } catch (e: unknown) {
      toast.error(
        e instanceof ApiError || e instanceof Error
          ? e.message
          : 'Could not send the notification.',
      )
    } finally {
      setSending(false)
    }
  }

  // Group headings, in the order the profile already presents them.
  const grouped = useMemo(() => {
    const map = new Map<string, PickableField[]>()
    for (const f of fields) {
      const list = map.get(f.group)
      if (list) list.push(f)
      else map.set(f.group, [f])
    }
    return [...map]
  }, [fields])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Notify {studentName}</DialogTitle>
          <DialogDescription>
            Ask them to update specific profile fields. The fields they are
            missing are selected already.
          </DialogDescription>
        </DialogHeader>

        <div className="scrollbar-themed min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">
                Fields to update
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  {selected.size} selected
                </span>
              </h3>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() =>
                    setSelected(new Set(profile.completion.missing))
                  }
                >
                  Missing only
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setSelected(new Set())}
                >
                  Clear
                </Button>
              </div>
            </div>

            <div className="max-h-64 space-y-3 overflow-y-auto rounded-lg border p-3 scrollbar-themed">
              {grouped.map(([group, list]) => (
                <div key={group}>
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {group}
                  </p>
                  <div className="grid gap-1 sm:grid-cols-2">
                    {list.map((f) => (
                      <label
                        key={f.key}
                        className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-sm hover:bg-muted/50"
                      >
                        <input
                          type="checkbox"
                          checked={selected.has(f.key)}
                          onChange={() => toggleField(f.key)}
                          className="accent-primary"
                        />
                        <span
                          className={cn(
                            'truncate',
                            f.missing && 'text-amber-600 dark:text-amber-500',
                          )}
                          title={f.missing ? `${f.label} — empty` : f.label}
                        >
                          {f.label}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-medium">Message</h3>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={1000}
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              The selected field names are appended to this message
              automatically.
            </p>
          </section>

        </div>

        {/* Outside the scroll area on purpose: the channel choice governs the
            Send button, so it — and its "pick at least one" warning — must stay
            visible however far the field list is scrolled. */}
        <div className="shrink-0 border-t pt-3">
          <ChannelPicker value={channels} onChange={setChannels} />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!canSend} onClick={() => void send()}>
            {sending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Bell className="size-4" />
            )}
            Send notification
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** `industry_certifications` → `Industry certifications`. */
function prettify(key: string): string {
  const words = key.replace(/_/g, ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}
