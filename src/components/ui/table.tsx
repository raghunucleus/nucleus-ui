import * as React from 'react'

import { cn } from '@/lib/utils'

function Table({
  className,
  containerClassName,
  zebra = false,
  ...props
}: React.HTMLAttributes<HTMLTableElement> & {
  /**
   * Extra classes for the scroll wrapper — e.g. `max-h-[62vh] overflow-y-auto`
   * to turn it into a single bounded scroll box so a `sticky` header resolves
   * against it. Omitted by default, so existing callers are unaffected.
   */
  containerClassName?: string
  /**
   * Stripe even body rows (long lists). Implemented by a `[data-zebra]` rule
   * in index.css that sits below utilities, so a row's own `bg-*` class —
   * selected, warning — still wins.
   */
  zebra?: boolean
}) {
  return (
    <div
      data-zebra={zebra || undefined}
      className={cn('relative w-full overflow-x-auto', containerClassName)}
    >
      <table
        data-slot="table"
        className={cn('w-full caption-bottom text-sm', className)}
        {...props}
      />
    </div>
  )
}

function TableHeader({
  className,
  sticky = false,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement> & {
  /**
   * Pin the header row to the top of the table's scroll box (pair with a
   * `containerClassName` that bounds and scrolls it). Under `border-collapse`
   * a sticky `<thead>`'s bottom border scrolls away with the first row, so an
   * inset shadow draws the divider instead.
   */
  sticky?: boolean
}) {
  return (
    <thead
      data-slot="table-header"
      className={cn(
        '[&_tr]:border-b',
        sticky && 'sticky top-0 z-10 bg-card shadow-[inset_0_-1px_0_var(--border)]',
        className,
      )}
      {...props}
    />
  )
}

function TableBody({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody
      data-slot="table-body"
      className={cn('[&_tr:last-child]:border-0', className)}
      {...props}
    />
  )
}

function TableFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        'border-t bg-muted/40 font-medium [&>tr]:last:border-b-0',
        className,
      )}
      {...props}
    />
  )
}

function TableRow({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        'border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted',
        className,
      )}
      {...props}
    />
  )
}

function TableHead({
  className,
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        // Sentence case, like central. Uppercase Segoe at this size runs
        // ~15% wider and costs a column on a laptop.
        'h-9 px-3 text-left align-middle text-xs font-medium text-muted-foreground whitespace-nowrap',
        className,
      )}
      {...props}
    />
  )
}

function TableCell({
  className,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      data-slot="table-cell"
      className={cn('px-3 py-2 align-middle', className)}
      {...props}
    />
  )
}

function TableCaption({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableCaptionElement>) {
  return (
    <caption
      data-slot="table-caption"
      className={cn('mt-4 text-sm text-muted-foreground', className)}
      {...props}
    />
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
