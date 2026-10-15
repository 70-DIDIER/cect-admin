import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { getRaw } from '@/lib/api'
import { authErrorMessage } from '@/features/auth/errors'
import { cn } from '@/lib/utils'

export const FIELD =
  'min-h-[44px] rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-sm text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]'

export function PageIntro({ title, description, actions }: { title: string; description: string; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-extrabold tracking-tight text-[var(--color-text)]">{title}</h1>
        <p className="mt-1 max-w-2xl text-sm text-[var(--color-text-muted)]">{description}</p>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}

export function PrimaryButton({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" {...props} className={cn('inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] px-4 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary-hover)] disabled:opacity-60', className)} />
}

export function GhostButton({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" {...props} className={cn('inline-flex min-h-[40px] items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--dash-card)] px-3.5 text-sm font-semibold text-[var(--color-text)] transition-colors hover:bg-[var(--chart-track)] disabled:opacity-60', className)} />
}

export function Tabs<T extends string>({ value, onChange, options }: { value: T; onChange: (value: T) => void; options: ReadonlyArray<{ value: T; label: string }> }) {
  return (
    <div role="tablist" className="inline-flex rounded-2xl bg-[var(--chart-track)] p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={option.value === value}
          onClick={() => onChange(option.value)}
          className={cn('min-h-[38px] rounded-xl px-4 text-sm font-semibold transition-colors', option.value === value ? 'bg-[var(--dash-card)] text-[var(--color-text)] shadow-sm' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]')}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export function LoadingBlock() {
  return <div className="mx-5 mb-5 h-32 animate-pulse rounded-2xl bg-[var(--chart-track)]" />
}

export function ErrorLine({ message }: { message: string }) {
  return (
    <p role="alert" className="px-6 pb-5 text-sm text-[var(--color-danger)]">
      {message}
    </p>
  )
}

interface CursorPage<T> {
  data: T[]
  meta?: { next_cursor?: string | null }
}

/** Liste paginée par curseur : charge la première page puis « Charger plus ». */
export function useCursorList<T>(path: string, params: Record<string, unknown>) {
  const [rows, setRows] = useState<T[]>([])
  const [next, setNext] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const key = JSON.stringify(params)

  const load = useCallback(
    async (cursor: string | null) => {
      setLoading(true)
      setError(null)
      try {
        const page = await getRaw<CursorPage<T>>(path, { ...(JSON.parse(key) as Record<string, unknown>), ...(cursor ? { cursor } : {}) })
        setRows((current) => (cursor ? [...current, ...page.data] : page.data))
        setNext(page.meta?.next_cursor ?? null)
      } catch (caught) {
        setError(authErrorMessage(caught))
      } finally {
        setLoading(false)
      }
    },
    [path, key]
  )

  useEffect(() => {
    void load(null)
  }, [load])

  return { rows, loading, error, hasMore: next !== null, more: () => void load(next), reload: () => void load(null) }
}

export function LoadMore({ hasMore, loading, onClick }: { hasMore: boolean; loading: boolean; onClick: () => void }) {
  if (!hasMore) return null
  return (
    <div className="flex justify-center px-6 pb-5 pt-2">
      <GhostButton onClick={onClick} disabled={loading}>
        {loading ? 'Chargement…' : 'Charger plus'}
      </GhostButton>
    </div>
  )
}

export function dateTime(value: string | null | undefined): string {
  if (!value) return '—'
  return new Date(value).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}
