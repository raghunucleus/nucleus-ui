import { useEffect } from 'react'
import { ChevronRight, LogOut, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { NucleusLogo } from '@/components/brand'
import { ParentLanguageSwitcher } from '@/components/parent-language-switcher'
import { ThemeToggle } from '@/components/theme-toggle'
import { Button } from '@/components/ui/button'
import { EmptyState as EmptyStatePanel } from '@/components/ui/empty-state'
import { parentLogout, type LinkedStudent } from '@/lib/parent-auth'
import { cn } from '@/lib/utils'
import { useParentAuthStore } from '@/stores/parent-auth-store'
import { withGlobalLoader } from '@/stores/loader-store'

// Six deterministic gradients so each child card gets a stable, distinct color.
const CARD_GRADIENTS = [
  'from-icon-violet to-icon-blue',
  'from-icon-blue to-icon-cyan',
  'from-icon-emerald to-icon-cyan',
  'from-icon-amber to-icon-orange',
  'from-icon-rose to-icon-violet',
  'from-icon-orange to-icon-rose',
] as const

function gradientFor(id: number): string {
  return CARD_GRADIENTS[id % CARD_GRADIENTS.length]
}

function initials(source: string): string {
  return (
    source
      .replace(/[^A-Za-z0-9 ]/g, '')
      .split(/\s+/)
      .filter(Boolean)
      .map((p) => p[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?'
  )
}

/**
 * Full-screen gate shown after a guardian signs in (rendered by App.tsx, not
 * the parent router) whenever no child is selected — e.g. a multi-child
 * guardian on first login, or after tapping "Switch student". Picking a child
 * stores the selection and the portal router takes over.
 */
export default function SelectChild() {
  const { t } = useTranslation()
  const guardian = useParentAuthStore((s) => s.guardian)
  const students = useParentAuthStore((s) => s.students)
  const selectStudent = useParentAuthStore((s) => s.selectStudent)
  const signOut = useParentAuthStore((s) => s.signOut)

  useEffect(() => {
    document.title = 'Select a student — Nucleus'
  }, [])

  async function handleSignOut() {
    try {
      await withGlobalLoader(() => parentLogout(), 'Signing out…')
    } finally {
      signOut()
    }
  }

  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground">
      <header className="flex h-16 shrink-0 items-center justify-between border-b bg-card/80 px-4 backdrop-blur sm:px-6">
        <div className="flex items-center">
          <NucleusLogo />
        </div>
        <div className="flex items-center gap-2">
          <ParentLanguageSwitcher />
          <ThemeToggle />
          <Button variant="outline" size="sm" onClick={() => void handleSignOut()}>
            <LogOut className="size-4" />
            {t('common.signOut')}
          </Button>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-4 py-10 sm:px-6">
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wider text-primary">
            {t('brand.parentPortal')}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t('selectChild.title')}
          </h1>
          {guardian && (
            <p className="text-sm text-muted-foreground">
              {t('selectChild.signedInAs', { name: guardian.display_name })}
            </p>
          )}
        </div>

        {students.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {students.map((s) => (
              <ChildCard
                key={s.id}
                student={s}
                onSelect={() => selectStudent(s.id)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

function ChildCard({
  student,
  onSelect,
}: {
  student: LinkedStudent
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="group flex items-center gap-4 rounded-xl border bg-card p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <div
        className={cn(
          'grid size-14 shrink-0 place-items-center rounded-xl bg-gradient-to-br text-lg font-semibold text-white shadow-md',
          gradientFor(student.id),
        )}
      >
        {initials(student.display_name)}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{student.display_name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {student.student_id}
          {student.programme ? ` · ${student.programme.code}` : ''}
        </p>
        {student.relationship && (
          <span className="mt-1.5 inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium capitalize text-primary">
            {student.relationship}
          </span>
        )}
      </div>
      <ChevronRight className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </button>
  )
}

function EmptyState() {
  const { t } = useTranslation()
  return (
    <EmptyStatePanel
      className="mt-8"
      icon={Users}
      title={t('selectChild.emptyTitle')}
      description={t('selectChild.emptyDesc')}
    />
  )
}
