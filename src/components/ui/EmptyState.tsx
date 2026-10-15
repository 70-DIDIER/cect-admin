import type { ReactNode } from 'react'

interface EmptyStateProps {
  title: string
  description?: string
  action?: ReactNode
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <svg width="88" height="72" viewBox="0 0 88 72" fill="none" aria-hidden>
        <rect x="8" y="30" width="72" height="34" rx="10" fill="var(--chart-track)" />
        <rect x="18" y="16" width="52" height="34" rx="10" fill="var(--color-border)" />
        <circle cx="44" cy="33" r="11" fill="var(--forest-900)" />
        <circle cx="44" cy="33" r="4" fill="var(--lime)" />
      </svg>
      <p className="mt-5 text-base font-bold text-[var(--color-text)]">{title}</p>
      {description && <p className="mt-1.5 max-w-sm text-sm leading-6 text-[var(--color-text-muted)]">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
