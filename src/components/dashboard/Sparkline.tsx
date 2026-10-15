
interface SparklineProps {
  values: number[]
  color: string
  className?: string
}

export function Sparkline({ values, color, className }: SparklineProps) {
  if (values.length < 2) return null

  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const step = 100 / (values.length - 1)
  const points = values.map((value, index) => [index * step, 28 - ((value - min) / span) * 24] as const)
  const line = points.map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ')
  const area = `${line} L100,32 L0,32 Z`

  return (
    <svg viewBox="0 0 100 32" preserveAspectRatio="none" className={className} aria-hidden focusable="false">
      <path d={area} fill={color} fillOpacity={0.12} />
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}
