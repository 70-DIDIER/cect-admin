import { motion, useReducedMotion } from 'framer-motion'

export interface HBarItem {
  key: string
  label: string
  value: number
  valueLabel: string
  color: string
  note?: string
}

export function HBarList({ items }: { items: HBarItem[] }) {
  const reduce = useReducedMotion()
  const max = Math.max(...items.map((item) => item.value), 1)

  return (
    <ul className="space-y-4">
      {items.map((item, index) => (
        <li key={item.key}>
          <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate font-semibold text-[var(--color-text)]">{item.label}</span>
            <span className="shrink-0 text-[var(--color-text-muted)]">
              <strong className="font-bold text-[var(--color-text)]">{item.valueLabel}</strong>
              {item.note && <span className="ml-2 text-xs">{item.note}</span>}
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-[var(--chart-track)]" role="presentation">
            <motion.div
              className="h-full rounded-full"
              style={{ background: item.color }}
              initial={{ width: reduce ? `${(item.value / max) * 100}%` : 0 }}
              animate={{ width: `${(item.value / max) * 100}%` }}
              transition={{ duration: 0.8, delay: 0.1 + index * 0.07, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}
