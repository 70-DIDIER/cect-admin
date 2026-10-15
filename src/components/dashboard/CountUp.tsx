import { useEffect } from 'react'
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'framer-motion'

interface CountUpProps {
  value: number
  format?: (value: number) => string
  className?: string
}

const defaultFormat = (value: number): string => Math.round(value).toLocaleString('fr-FR')

export function CountUp({ value, format = defaultFormat, className }: CountUpProps) {
  const reduce = useReducedMotion()
  const motionValue = useMotionValue(reduce ? value : 0)
  const text = useTransform(motionValue, (latest) => format(latest))

  useEffect(() => {
    if (reduce) {
      motionValue.set(value)
      return
    }
    const controls = animate(motionValue, value, { duration: 1.2, ease: [0.16, 1, 0.3, 1] })
    return () => controls.stop()
  }, [value, reduce, motionValue])

  return <motion.span className={className}>{text}</motion.span>
}
