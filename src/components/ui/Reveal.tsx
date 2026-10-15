import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import { cn } from '@/lib/utils'
import { ease, transition } from '@/lib/motion'

type Direction = 'up' | 'down' | 'left' | 'right' | 'none'

interface RevealProps {
  children: React.ReactNode
  className?: string
  direction?: Direction
  delay?: number
  duration?: number
  amount?: number
  once?: boolean
}

const offsets: Record<Direction, { x?: number; y?: number }> = {
  up:    { y: 22 },
  down:  { y: -22 },
  left:  { x: 22 },
  right: { x: -22 },
  none:  {},
}

export function Reveal({
  children,
  className,
  direction = 'up',
  delay = 0,
  duration = transition.base.duration,
  amount = 0.15,
  once = true,
}: RevealProps) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once, amount })

  const offset = offsets[direction]

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, ...offset }}
      animate={inView ? { opacity: 1, x: 0, y: 0 } : { opacity: 0, ...offset }}
      transition={{ duration, ease: ease.out, delay }}
      className={cn(className)}
    >
      {children}
    </motion.div>
  )
}
