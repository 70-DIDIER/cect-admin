import { useEffect, useRef } from 'react'
import { useInView, useMotionValue, useTransform, animate, motion } from 'framer-motion'

interface AnimatedCounterProps {
  value: string
  className?: string
}

function parseNumericValue(raw: string): { prefix: string; num: number; suffix: string } {
  const match = raw.match(/^([^0-9]*)(\d+(?:\.\d+)?)(.*)$/)
  if (!match) return { prefix: '', num: 0, suffix: raw }
  return { prefix: match[1], num: parseFloat(match[2]), suffix: match[3] }
}

export function AnimatedCounter({ value, className }: AnimatedCounterProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, amount: 0.5 })
  const { prefix, num, suffix } = parseNumericValue(value)
  const motionVal = useMotionValue(0)
  const rounded = useTransform(motionVal, (v) => Math.round(v).toLocaleString('fr-FR'))

  useEffect(() => {
    if (!inView) return
    const controls = animate(motionVal, num, {
      duration: 1.6,
      ease: [0.16, 1, 0.3, 1],
    })
    return () => controls.stop()
  }, [inView, num, motionVal])

  // No numeric part → just render as-is
  if (num === 0 && suffix === value) {
    return <span className={className}>{value}</span>
  }

  return (
    <span ref={ref} className={className}>
      {prefix}
      <motion.span>{rounded}</motion.span>
      {suffix}
    </span>
  )
}
