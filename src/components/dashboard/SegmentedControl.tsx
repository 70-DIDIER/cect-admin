import { useId } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

export interface SegmentOption<T extends string | number> {
  value: T
  label: string
}

interface SegmentedControlProps<T extends string | number> {
  options: SegmentOption<T>[]
  value: T
  onChange: (value: T) => void
  label: string
  onDark?: boolean
}

export function SegmentedControl<T extends string | number>({ options, value, onChange, label, onDark = false }: SegmentedControlProps<T>) {
  const groupId = useId()
  return (
    <div
      role="group"
      aria-label={label}
      className={cn('inline-flex rounded-2xl p-1', onDark ? 'bg-white/12' : 'bg-[var(--chart-track)]')}
    >
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={String(option.value)}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              'relative min-h-[36px] rounded-xl px-3.5 text-sm font-semibold transition-colors',
              selected
                ? onDark
                  ? 'text-[var(--brand-green-900)]'
                  : 'text-[var(--color-text)]'
                : onDark
                  ? 'text-white/80 hover:text-white'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
            )}
          >
            {selected && (
              <motion.span
                layoutId={`segment-${groupId}`}
                className={cn('absolute inset-0 rounded-xl shadow-sm', onDark ? 'bg-white' : 'bg-[var(--dash-card)]')}
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              />
            )}
            <span className="relative">{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}
