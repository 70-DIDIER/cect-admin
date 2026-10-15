import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StepsProps {
  steps: string[]
  /** Étape en cours, à partir de 0. */
  current: number
}

export function Steps({ steps, current }: StepsProps) {
  return (
    <div>
    <p className="mb-3 text-sm font-semibold text-[var(--color-text)] sm:hidden">
      Étape {Math.min(current + 1, steps.length)} sur {steps.length} · <span className="text-[var(--color-text-muted)]">{steps[Math.min(current, steps.length - 1)]}</span>
    </p>
    <ol className="flex items-center gap-2" aria-label="Étapes">
      {steps.map((label, index) => {
        const done = index < current
        const active = index === current
        return (
          <li key={label} aria-current={active ? 'step' : undefined} className="flex flex-1 items-center gap-2 last:flex-none">
            <span
              className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                done && 'bg-[var(--color-primary)] text-white',
                active && 'bg-[var(--forest-900)] text-[var(--lime)]',
                !done && !active && 'bg-[var(--chart-track)] text-[var(--color-text-muted)]'
              )}
            >
              {done ? <Check size={15} aria-hidden /> : index + 1}
            </span>
            <span className={cn('hidden text-sm font-semibold sm:block', active ? 'text-[var(--color-text)]' : 'text-[var(--color-text-muted)]')}>{label}</span>
            {index < steps.length - 1 && <span aria-hidden className={cn('h-px flex-1', done ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-border)]')} />}
          </li>
        )
      })}
    </ol>
    </div>
  )
}
