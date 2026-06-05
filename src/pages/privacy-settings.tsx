import { useCallback, useEffect, useState } from 'react'
import {
  Cake,
  Droplet,
  Image as ImageIcon,
  Lock,
  Mail,
  Phone,
  User,
  type LucideIcon,
} from 'lucide-react'
import { toast } from 'sonner'

import { PageHeader } from '@/components/portal-layout'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'
import { ApiError } from '@/lib/api'
import {
  HIDEABLE_FIELDS,
  fetchProfilePrivacy,
  updateProfilePrivacy,
  type HideableField,
} from '@/lib/student-privacy'
import { useAuthStore } from '@/stores/auth-store'

const ICONS: Record<HideableField, LucideIcon> = {
  photo: ImageIcon,
  email: Mail,
  mobile: Phone,
  birthday: Cake,
  blood_group: Droplet,
  gender: User,
}

export default function PrivacySettingsPage() {
  const signOut = useAuthStore((state) => state.signOut)
  const [hidden, setHidden] = useState<Set<HideableField> | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Confirm dialog for hiding the birthday (it also drops you from Birthdays).
  const [confirmBirthday, setConfirmBirthday] = useState(false)

  useEffect(() => {
    document.title = 'Privacy — Nucleus'
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchProfilePrivacy()
      setHidden(new Set(res.hidden))
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        signOut()
        return
      }
      setError(
        err instanceof Error
          ? err.message
          : 'Could not load your privacy settings.',
      )
    } finally {
      setLoading(false)
    }
  }, [signOut])

  useEffect(() => {
    void load()
  }, [load])

  function applyToggle(key: HideableField, visible: boolean) {
    setHidden((prev) => {
      const next = new Set(prev ?? [])
      if (visible) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function toggleVisible(key: HideableField, visible: boolean) {
    // Hiding the birthday also drops the student from the Birthdays module, so
    // confirm before switching it off.
    if (key === 'birthday' && !visible) {
      setConfirmBirthday(true)
      return
    }
    applyToggle(key, visible)
  }

  async function save() {
    if (!hidden) return
    setSaving(true)
    try {
      const res = await updateProfilePrivacy([...hidden])
      setHidden(new Set(res.hidden))
      toast.success('Privacy settings saved.')
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        signOut()
        return
      }
      toast.error(
        err instanceof Error ? err.message : 'Could not save your settings.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Privacy"
        subtitle="Choose what classmates can see on your profile. Your name and roll number are always visible."
        icon={Lock}
        accent="violet"
      />

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : error ? (
        <div className="space-y-3 rounded-xl border p-6 text-center">
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" onClick={() => void load()}>
            Try again
          </Button>
        </div>
      ) : hidden ? (
        <div className="space-y-4">
          <div className="divide-y rounded-xl border bg-card">
            {HIDEABLE_FIELDS.map((field) => {
              const Icon = ICONS[field.key]
              const visible = !hidden.has(field.key)
              return (
                <div
                  key={field.key}
                  className="flex items-center gap-3 p-4"
                >
                  <div className="grid size-9 shrink-0 place-items-center rounded-md bg-muted">
                    <Icon className="size-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{field.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {field.description}
                    </p>
                  </div>
                  <Switch
                    checked={visible}
                    onCheckedChange={(v) => toggleVisible(field.key, v)}
                    aria-label={`${field.label} visible to classmates`}
                  />
                </div>
              )
            })}
          </div>

          <div className="flex justify-end">
            <Button onClick={() => void save()} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      ) : null}

      <Dialog open={confirmBirthday} onOpenChange={setConfirmBirthday}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Hide your birthday?</DialogTitle>
            <DialogDescription>
              This also removes you from the Birthdays list, so classmates won't
              see your birthday or get a reminder.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmBirthday(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                applyToggle('birthday', false)
                setConfirmBirthday(false)
              }}
            >
              Hide
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
