import { ArrowDownRight, ArrowUpRight, type LucideIcon } from 'lucide-react'
import { motion } from 'framer-motion'
import { CountUp } from './CountUp'
import { Sparkline } from './Sparkline'
import { TONES, type Tone } from './tones'

export interface Trend {
  direction: 'up' | 'down'
  percent: number
}

interface StatCardProps {
  label: string
  value: number
  format?: (value: number) => string
  icon: LucideIcon
  tone: Tone
  trend?: Trend | null
  trendLabel?: string
  hint?: string
  spark?: number[]
  index?: number
}

export function StatCard({
  label,
  value,
  format,
  icon: Icon,
  tone,
  trend,
  trendLabel = 'par rapport à la période précédente',
  hint,
  spark,
  index = 0,
}: StatCardProps) {
  const style = TONES[tone]
  const TrendIcon = trend?.direction === 'down' ? ArrowDownRight : ArrowUpRight
  const trendTone = trend?.direction === 'down' ? TONES.danger : TONES.success

  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -3 }}
      className="relative overflow-hidden rounded-3xl border border-[var(--color-border)] bg-[var(--dash-card)] p-5 shadow-[var(--shadow-card)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl" style={{ background: style.bg, color: style.fg }}>
          <Icon size={20} aria-hidden />
        </div>
        {trend && (
          <span className="inline-flex items-center gap-0.5 rounded-full px-2 py-1 text-xs font-bold" style={{ background: trendTone.bg, color: trendTone.fg }}>
            <TrendIcon size={13} aria-hidden />
            <span aria-hidden>{trend.percent} %</span>
            <span className="sr-only">
              {trend.direction === 'up' ? 'En hausse de' : 'En baisse de'} {trend.percent} pour cent {trendLabel}
            </span>
          </span>
        )}
      </div>

      <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">{label}</p>
      <p className="relative z-10 mt-1 text-2xl font-extrabold leading-tight tracking-tight text-[var(--color-text)] sm:text-[1.65rem]">
        <CountUp value={value} format={format} />
      </p>
      {hint && <p className="relative z-10 mt-1 text-xs text-[var(--color-text-muted)]">{hint}</p>}

      {spark && spark.length > 1 && (
        <Sparkline values={spark} color={style.solid} className="pointer-events-none absolute bottom-0 right-0 h-14 w-[44%] opacity-80" />
      )}
    </motion.article>
  )
}
