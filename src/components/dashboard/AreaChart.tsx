import { useMemo, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { formatCompact } from '@/lib/format'
import { useElementWidth } from './useElementWidth'

export interface AreaPoint {
  label: string
  value: number
}

interface AreaChartProps {
  data: AreaPoint[]
  ariaLabel: string
  height?: number
  color?: string
  formatValue?: (value: number) => string
}

const PADDING = { top: 14, right: 14, bottom: 28, left: 46 }

function smoothPath(points: ReadonlyArray<readonly [number, number]>, floor: number): string {
  const first = points[0]
  if (!first) return ''
  let path = `M${first[0].toFixed(2)},${first[1].toFixed(2)}`
  const tension = 0.18

  for (let index = 0; index < points.length - 1; index += 1) {
    const p1 = points[index] ?? first
    const p2 = points[index + 1] ?? p1
    const p0 = points[index - 1] ?? p1
    const p3 = points[index + 2] ?? p2
    const c1y = Math.min(p1[1] + (p2[1] - p0[1]) * tension, floor)
    const c2y = Math.min(p2[1] - (p3[1] - p1[1]) * tension, floor)
    const c1x = p1[0] + (p2[0] - p0[0]) * tension
    const c2x = p2[0] - (p3[0] - p1[0]) * tension
    path += ` C${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${p2[0].toFixed(2)},${p2[1].toFixed(2)}`
  }
  return path
}

function niceCeil(value: number): number {
  if (value <= 0) return 1
  const exponent = 10 ** Math.floor(Math.log10(value))
  const fraction = value / exponent
  const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 2.5 ? 2.5 : fraction <= 5 ? 5 : 10
  return nice * exponent
}

export function AreaChart({ data, ariaLabel, height = 260, color = 'var(--chart-1)', formatValue = (v) => formatCompact(v) }: AreaChartProps) {
  const reduce = useReducedMotion()
  const [wrapperRef, width] = useElementWidth<HTMLDivElement>()
  const [active, setActive] = useState<number | null>(null)

  const geometry = useMemo(() => {
    const innerWidth = Math.max(width - PADDING.left - PADDING.right, 10)
    const innerHeight = height - PADDING.top - PADDING.bottom
    const max = niceCeil(Math.max(...data.map((point) => point.value), 1) * 1.08)
    const x = (index: number): number => PADDING.left + (data.length <= 1 ? innerWidth / 2 : (index / (data.length - 1)) * innerWidth)
    const y = (value: number): number => PADDING.top + innerHeight - (value / max) * innerHeight
    const points = data.map((point, index) => [x(index), y(point.value)] as const)
    const floor = PADDING.top + innerHeight
    const line = smoothPath(points, floor)
    const lastPoint = points[points.length - 1]
    const firstPoint = points[0]
    const area = lastPoint && firstPoint ? `${line} L${lastPoint[0]},${floor} L${firstPoint[0]},${floor} Z` : ''
    const ticks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => ({ value: max * ratio, y: y(max * ratio) }))
    const labelEvery = Math.max(1, Math.ceil(data.length / Math.max(2, Math.floor(innerWidth / 78))))
    return { innerWidth, innerHeight, points, line, area, ticks, floor, labelEvery, x }
  }, [data, height, width])

  function indexFromClientX(clientX: number, element: Element): number {
    const bounds = element.getBoundingClientRect()
    const ratio = (clientX - bounds.left - PADDING.left) / geometry.innerWidth
    return Math.min(data.length - 1, Math.max(0, Math.round(ratio * (data.length - 1))))
  }

  function onPointerMove(event: PointerEvent<SVGSVGElement>): void {
    setActive(indexFromClientX(event.clientX, event.currentTarget))
  }

  function onKeyDown(event: KeyboardEvent<SVGSVGElement>): void {
    if (event.key === 'ArrowRight') {
      event.preventDefault()
      setActive((current) => Math.min(data.length - 1, (current ?? -1) + 1))
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault()
      setActive((current) => Math.max(0, (current ?? data.length) - 1))
    } else if (event.key === 'Escape') {
      setActive(null)
    }
  }

  const activePoint = active === null ? null : data[active]
  const activeXY = active === null ? null : geometry.points[active]
  const tooltipLeft = activeXY ? Math.min(Math.max(activeXY[0], 70), width - 70) : 0

  return (
    <div ref={wrapperRef} className="relative w-full" style={{ height }}>
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={ariaLabel}
        tabIndex={0}
        onPointerMove={onPointerMove}
        onPointerLeave={() => setActive(null)}
        onKeyDown={onKeyDown}
        onBlur={() => setActive(null)}
        className="block touch-pan-y rounded-xl outline-offset-2"
      >

        {geometry.ticks.map((tick) => (
          <g key={tick.value}>
            <line x1={PADDING.left} x2={width - PADDING.right} y1={tick.y} y2={tick.y} stroke="var(--chart-grid)" strokeDasharray={tick.value === 0 ? undefined : '3 5'} />
            <text x={PADDING.left - 10} y={tick.y + 4} textAnchor="end" fontSize="11" fill="var(--color-text-muted)">
              {formatCompact(tick.value)}
            </text>
          </g>
        ))}

        {data.map((point, index) =>
          index % geometry.labelEvery === 0 || index === data.length - 1 ? (
            <text
              key={point.label + index}
              x={geometry.x(index)}
              y={height - 8}
              textAnchor={index === data.length - 1 ? 'end' : index === 0 ? 'start' : 'middle'}
              fontSize="11"
              fill="var(--color-text-muted)"
            >
              {point.label}
            </text>
          ) : null
        )}

        <motion.path d={geometry.area} fill={color} fillOpacity={0.12} initial={{ opacity: reduce ? 1 : 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.9, delay: 0.25 }} />
        <motion.path
          d={geometry.line}
          fill="none"
          stroke={color}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: reduce ? 1 : 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
        />

        {activeXY && (
          <g pointerEvents="none">
            <line x1={activeXY[0]} x2={activeXY[0]} y1={PADDING.top} y2={geometry.floor} stroke={color} strokeOpacity={0.35} strokeDasharray="4 4" />
            <circle cx={activeXY[0]} cy={activeXY[1]} r={9} fill={color} fillOpacity={0.18} />
            <circle cx={activeXY[0]} cy={activeXY[1]} r={4.5} fill="var(--dash-card)" stroke={color} strokeWidth={2.5} />
          </g>
        )}
      </svg>

      {activePoint && activeXY && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-xl border border-[var(--color-border)] bg-[var(--dash-card)] px-3 py-2 text-center shadow-[var(--shadow-pop)]"
          style={{ left: tooltipLeft, top: Math.max(activeXY[1] - 14, 40) }}
        >
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">{activePoint.label}</p>
          <p className="text-sm font-extrabold text-[var(--color-text)]">{formatValue(activePoint.value)}</p>
        </div>
      )}

      <p className="sr-only" aria-live="polite">
        {activePoint ? `${activePoint.label} : ${formatValue(activePoint.value)}` : ''}
      </p>
    </div>
  )
}
