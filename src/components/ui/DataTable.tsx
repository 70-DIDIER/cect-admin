import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface Column<T> {
  key: string
  header: string
  align?: 'left' | 'right'
  render: (row: T) => ReactNode
  /** Masquée sur mobile (la première colonne sert de titre à la ligne). */
  hideOnMobile?: boolean
}

interface DataTableProps<T> {
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => string
  onRowClick?: (row: T) => void
  empty?: ReactNode
}

export function DataTable<T>({ columns, rows, rowKey, onRowClick, empty }: DataTableProps<T>) {
  if (rows.length === 0 && empty) return <>{empty}</>
  const [first, ...rest] = columns

  return (
    <>
      <table className="hidden w-full text-sm md:table">
        <thead>
          <tr className="border-b border-[var(--color-border)]">
            {columns.map((column) => (
              <th key={column.key} scope="col" className={cn('px-6 py-3 text-xs font-semibold text-[var(--color-text-muted)]', column.align === 'right' ? 'text-right' : 'text-left')}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={cn('border-b border-[var(--color-border)] last:border-0', onRowClick && 'cursor-pointer transition-colors hover:bg-[var(--color-surface)]')}
            >
              {columns.map((column) => (
                <td key={column.key} className={cn('px-6 py-4 align-middle text-[var(--color-text)]', column.align === 'right' && 'text-right [font-variant-numeric:tabular-nums]')}>
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <ul className="divide-y divide-[var(--color-border)] md:hidden">
        {rows.map((row) => (
          <li key={rowKey(row)} onClick={onRowClick ? () => onRowClick(row) : undefined} className={cn('px-5 py-4', onRowClick && 'cursor-pointer')}>
            {first && <div className="text-sm font-semibold text-[var(--color-text)]">{first.render(row)}</div>}
            <dl className="mt-2 space-y-1">
              {rest
                .filter((column) => !column.hideOnMobile)
                .map((column) => (
                  <div key={column.key} className="flex items-center justify-between gap-4 text-sm">
                    <dt className="text-[var(--color-text-muted)]">{column.header}</dt>
                    <dd className="text-right font-medium text-[var(--color-text)] [font-variant-numeric:tabular-nums]">{column.render(row)}</dd>
                  </div>
                ))}
            </dl>
          </li>
        ))}
      </ul>
    </>
  )
}
