import { Check } from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

export interface Step {
  label: string
  description?: string
}

interface StepperProps {
  steps: Step[]
  current: number
}

export function Stepper({ steps, current }: StepperProps) {
  return (
    <ol className="grid gap-4 sm:grid-flow-col sm:auto-cols-fr sm:gap-2">
      {steps.map((step, index) => {
        const done = index < current
        const isCurrent = index === current
        return (
          <li key={step.label} aria-current={isCurrent ? 'step' : undefined} className="relative flex gap-3 sm:flex-col sm:gap-2">
            <div className="flex items-center gap-3 sm:gap-0">
              <motion.span
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1 + index * 0.08 }}
                className={cn(
                  'relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold',
                  done && 'border-[var(--chart-1)] bg-[var(--chart-1)] text-white',
                  isCurrent && 'border-[var(--chart-2)] bg-[var(--tone-warning-bg)] text-[var(--tone-warning-fg)]',
                  !done && !isCurrent && 'border-[var(--color-border)] bg-[var(--dash-card)] text-[var(--color-text-muted)]'
                )}
              >
                {done ? <Check size={16} aria-hidden /> : index + 1}
                {isCurrent && <span className="absolute inset-0 animate-ping rounded-full border-2 border-[var(--chart-2)] opacity-40 motion-reduce:animate-none" aria-hidden />}
              </motion.span>
              {index < steps.length - 1 && (
                <span
                  aria-hidden
                  className={cn('hidden h-0.5 flex-1 sm:block', done ? 'bg-[var(--chart-1)]' : 'bg-[var(--color-border)]')}
                />
              )}
            </div>
            <div className="min-w-0 pb-1 sm:pr-2">
              <p className={cn('text-sm font-bold', done || isCurrent ? 'text-[var(--color-text)]' : 'text-[var(--color-text-muted)]')}>
                {step.label}
                <span className="sr-only">{done ? ' (terminée)' : isCurrent ? ' (en cours)' : ' (à venir)'}</span>
              </p>
              {step.description && <p className="mt-0.5 text-xs leading-snug text-[var(--color-text-muted)]">{step.description}</p>}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
