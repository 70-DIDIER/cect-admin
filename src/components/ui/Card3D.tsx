import { useRef } from 'react'
import { motion, useMotionValue, useTransform, useSpring, MotionValue } from 'framer-motion'
import { cn } from '@/lib/utils'

interface Card3DProps {
  children: React.ReactNode
  className?: string
  glare?: boolean
  intensity?: number
}

function useGlareBackground(glareX: MotionValue<number>, glareY: MotionValue<number>) {
  return useTransform(
    [glareX, glareY] as MotionValue<number>[],
    ([x, y]: number[]) =>
      `radial-gradient(circle at ${x}% ${y}%, rgba(255,255,255,0.50) 0%, transparent 60%)`
  )
}

export function Card3D({ children, className, glare = true, intensity = 10 }: Card3DProps) {
  const ref = useRef<HTMLDivElement>(null)

  const rawX = useMotionValue(0)
  const rawY = useMotionValue(0)

  const springCfg = { stiffness: 260, damping: 28 }
  const rotateX = useSpring(useTransform(rawY, [-0.5, 0.5], [intensity, -intensity]), springCfg)
  const rotateY = useSpring(useTransform(rawX, [-0.5, 0.5], [-intensity, intensity]), springCfg)
  const glareX = useTransform(rawX, [-0.5, 0.5], [0, 100])
  const glareY = useTransform(rawY, [-0.5, 0.5], [0, 100])
  const glareOpacity = useSpring(0, { stiffness: 200, damping: 22 })
  const glareBg = useGlareBackground(glareX, glareY)

  function onMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    rawX.set((e.clientX - rect.left) / rect.width - 0.5)
    rawY.set((e.clientY - rect.top) / rect.height - 0.5)
    glareOpacity.set(1)
  }

  function onMouseLeave() {
    rawX.set(0)
    rawY.set(0)
    glareOpacity.set(0)
  }

  return (
    <div
      ref={ref}
      className="[perspective:900px]"
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
    >
      <motion.div
        style={{ rotateX, rotateY, transformStyle: 'preserve-3d' }}
        className={cn('relative', className)}
      >
        {children}

        {glare && (
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-[inherit] overflow-hidden"
            style={{ opacity: glareOpacity }}
          >
            <motion.div
              className="absolute inset-0"
              style={{ background: glareBg }}
            />
          </motion.div>
        )}
      </motion.div>
    </div>
  )
}
