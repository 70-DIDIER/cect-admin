import { useId, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface PanelProps {
  title: string
  subtitle?: string
  action?: ReactNode
  children: ReactNode
  className?: string
  id?: string
  flush?: boolean
}

export function Panel({ title, subtitle, action, children, className, id, flush = false }: PanelProps) {
  const headingId = useId()
  return (
    <section id={id} aria-labelledby={headingId} className={cn('min-w-0 rounded-[18px] border border-[var(--color-border)] bg-[var(--dash-card)]', className)}>
      <header className="flex flex-wrap items-start justify-between gap-3 px-6 pt-6">
        <div className="min-w-0 flex-1 basis-48">
          <h2 id={headingId} className="text-base font-bold tracking-tight text-[var(--color-text)]">
            {title}
          </h2>
          {subtitle && <p className="mt-1 text-sm text-[var(--color-text-muted)]">{subtitle}</p>}
        </div>
        {action && <div className="max-w-full">{action}</div>}
      </header>
      <div className={cn('pt-5', flush ? 'pb-2' : 'px-6 pb-6')}>{children}</div>
    </section>
  )
}
