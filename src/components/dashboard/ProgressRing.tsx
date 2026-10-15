import type { ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

interface ProgressRingProps {
  value: number
  size?: number
  stroke?: number
  color?: string
  label: string
  children?: ReactNode
}

export function ProgressRing({ value, size = 120, stroke = 12, color = 'var(--chart-1)', label, children }: ProgressRingProps) {
  const reduce = useReducedMotion()
  const clamped = Math.min(1, Math.max(0, value))
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${label} : ${Math.round(clamped * 100)} pour cent`}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--chart-track)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: reduce ? circumference * (1 - clamped) : circumference }}
          animate={{ strokeDashoffset: circumference * (1 - clamped) }}
          transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  )
}
