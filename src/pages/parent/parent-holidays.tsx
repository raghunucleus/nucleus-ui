import { useCallback, useEffect, useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  PalmtreeIcon,
  RefreshCw,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { HolidayEmptyState, HolidayList } from '@/components/holiday-list'
import { PageHeader } from '@/components/portal-layout'
import { Button } from '@/components/ui/button'
import { ApiError } from '@/lib/api'
import { type AcademicHoliday } from '@/lib/holidays'
import { fetchChildHolidaysPaged, toIsoDate } from '@/lib/parent-academics'
import { useParentAuthStore } from '@/stores/parent-auth-store'

type Scope = 'upcoming' | 'past'

const PAGE_SIZE = 10

export default function ParentHolidays() {
  const { t } = useTranslation()
  const signOut = useParentAuthStore((s) => s.signOut)
  const today = toIsoDate(new Date())

  const [scope, setScope] = useState<Scope>('upcoming')
  const [page, setPage] = useState(1)

  const [holidays, setHolidays] = useState<AcademicHoliday[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    document.title = 'Academic holidays — Nucleus'
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchChildHolidaysPaged({
        scope,
        page,
        page_size: PAGE_SIZE,
      })
      setHolidays(res.items)
      setTotal(res.total)
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        signOut()
        return
      }
      setError(err instanceof Error ? err.message : 'Could not load holidays.')
    } finally {
      setLoading(false)
    }
  }, [scope, page, signOut])

  useEffect(() => {
    void load()
  }, [load])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const rangeEnd = Math.min(page * PAGE_SIZE, total)

  return (
    <>
      <PageHeader
        title={t('holidays.title')}
        subtitle={t('holidays.subtitle')}
        icon={PalmtreeIcon}
        accent="rose"
      />

      <ScopeTabs
        value={scope}
        onChange={(s) => {
          setScope(s)
          setPage(1)
        }}
      />

      <div className="mt-6">
        {loading ? (
          <ListSkeleton />
        ) : error ? (
          <ErrorState message={error} onRetry={() => void load()} />
        ) : holidays.length === 0 ? (
          <HolidayEmptyState
            message={
              scope === 'upcoming'
                ? t('holidays.emptyUpcoming')
                : t('holidays.emptyPast')
            }
          />
        ) : (
          <div className="space-y-6">
            <HolidayList
              holidays={holidays}
              today={today}
              order={scope === 'past' ? 'desc' : 'asc'}
              dimPast={false}
            />
            <Pagination
              page={page}
              totalPages={totalPages}
              rangeStart={rangeStart}
              rangeEnd={rangeEnd}
              total={total}
              onPrev={() => setPage((p) => Math.max(1, p - 1))}
              onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
            />
          </div>
        )}
      </div>
    </>
  )
}

function ScopeTabs({
  value,
  onChange,
}: {
  value: Scope
  onChange: (s: Scope) => void
}) {
  const { t } = useTranslation()
  const tabs: { value: Scope; labelKey: string }[] = [
    { value: 'upcoming', labelKey: 'holidays.tabUpcoming' },
    { value: 'past', labelKey: 'holidays.tabPast' },
  ]
  return (
    <div className="inline-flex rounded-lg border bg-muted/40 p-0.5">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          onClick={() => onChange(tab.value)}
          className={
            value === tab.value
              ? 'rounded-md bg-background px-3.5 py-1.5 text-xs font-semibold shadow-sm'
              : 'rounded-md px-3.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground'
          }
        >
          {t(tab.labelKey)}
        </button>
      ))}
    </div>
  )
}

function Pagination({
  page,
  totalPages,
  rangeStart,
  rangeEnd,
  total,
  onPrev,
  onNext,
}: {
  page: number
  totalPages: number
  rangeStart: number
  rangeEnd: number
  total: number
  onPrev: () => void
  onNext: () => void
}) {
  const { t } = useTranslation()
  return (
    <div className="flex items-center justify-between rounded-2xl border bg-card px-4 py-3 text-card-foreground shadow-sm">
      <p className="text-xs text-muted-foreground">
        {t('holidays.showing', { start: rangeStart, end: rangeEnd, total })}
      </p>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={onPrev} disabled={page <= 1}>
          <ChevronLeft />
          {t('holidays.prev')}
        </Button>
        <span className="text-xs text-muted-foreground">
          {t('holidays.pageOf', { page, total: totalPages })}
        </span>
        <Button
          size="sm"
          variant="outline"
          onClick={onNext}
          disabled={page >= totalPages}
        >
          {t('holidays.next')}
          <ChevronRight />
        </Button>
      </div>
    </div>
  )
}

function ListSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-48 animate-pulse rounded-2xl bg-muted" />
      <div className="h-32 animate-pulse rounded-2xl bg-muted" />
    </div>
  )
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border bg-card p-10 text-center text-card-foreground">
      <div className="grid size-12 place-items-center rounded-full bg-destructive/10 text-destructive">
        <CircleAlert className="size-6" />
      </div>
      <div className="space-y-1">
        <h2 className="text-sm font-semibold">{t('holidays.errTitle')}</h2>
        <p className="max-w-sm text-xs text-muted-foreground">{message}</p>
      </div>
      <Button size="sm" onClick={onRetry}>
        <RefreshCw />
        {t('common.tryAgain')}
      </Button>
    </div>
  )
}
