import { useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { cn } from '@/lib/utils'

export interface DonutSegment {
  key: string
  label: string
  value: number
  valueLabel: string
  color: string
}

interface DonutChartProps {
  segments: DonutSegment[]
  centerLabel: string
  centerValue: string
  size?: number
  thickness?: number
}

const GAP = 3

export function DonutChart({ segments, centerLabel, centerValue, size = 190, thickness = 24 }: DonutChartProps) {
  const reduce = useReducedMotion()
  const [hovered, setHovered] = useState<string | null>(null)
  const radius = (size - thickness) / 2
  const circumference = 2 * Math.PI * radius
  const total = segments.reduce((sum, segment) => sum + segment.value, 0) || 1

  let cursor = 0
  const arcs = segments.map((segment) => {
    const length = Math.max((segment.value / total) * circumference - GAP, 0)
    const arc = { ...segment, length, offset: cursor }
    cursor += (segment.value / total) * circumference
    return arc
  })

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center lg:flex-col xl:flex-row">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${centerLabel} : ${centerValue}`}>
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--chart-track)" strokeWidth={thickness} />
          <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
            {arcs.map((arc, index) => (
              <motion.circle
                key={arc.key}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={arc.color}
                strokeWidth={hovered === arc.key ? thickness + 4 : thickness}
                strokeLinecap="butt"
                strokeDashoffset={-arc.offset}
                initial={{ strokeDasharray: reduce ? `${arc.length} ${circumference}` : `0 ${circumference}` }}
                animate={{ strokeDasharray: `${arc.length} ${circumference}` }}
                transition={{ duration: 0.9, delay: 0.1 + index * 0.08, ease: [0.16, 1, 0.3, 1] }}
                opacity={hovered && hovered !== arc.key ? 0.35 : 1}
                style={{ transition: 'opacity .2s, stroke-width .2s' }}
              />
            ))}
          </g>
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">{centerLabel}</span>
          <span className="mt-0.5 px-4 text-lg font-extrabold leading-tight text-[var(--color-text)]">{centerValue}</span>
        </div>
      </div>

      <ul className="w-full min-w-0 flex-1 space-y-1.5">
        {segments.map((segment) => {
          const share = Math.round((segment.value / total) * 100)
          return (
            <li key={segment.key}>
              <button
                type="button"
                onMouseEnter={() => setHovered(segment.key)}
                onMouseLeave={() => setHovered(null)}
                onFocus={() => setHovered(segment.key)}
                onBlur={() => setHovered(null)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors',
                  hovered === segment.key ? 'bg-[var(--chart-track)]' : 'hover:bg-[var(--chart-track)]'
                )}
              >
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: segment.color }} aria-hidden />
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--color-text)]">{segment.label}</span>
                <span className="text-xs text-[var(--color-text-muted)]">{segment.valueLabel}</span>
                <span className="w-10 text-right text-sm font-bold text-[var(--color-text)]">{share} %</span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
