import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import { cn } from '@/lib/utils'
import { ease } from '@/lib/motion'

interface SectionProps {
  className?: string
  children: React.ReactNode
  id?: string
  alt?: boolean
}

export function Section({ className, children, id, alt }: SectionProps) {
  return (
    <section
      id={id}
      className={cn(
        'py-14 md:py-20 lg:py-24',
        alt && 'bg-[var(--color-surface)]',
        className
      )}
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl">
        {children}
      </div>
    </section>
  )
}

interface SectionHeaderProps {
  title: string
  subtitle?: string
  className?: string
  centered?: boolean
}

export function SectionHeader({ title, subtitle, className, centered = true }: SectionHeaderProps) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, amount: 0.4 })

  return (
    <div ref={ref} className={cn('mb-10 md:mb-14', centered && 'text-center', className)}>
      <motion.h2
        initial={{ opacity: 0, y: 16 }}
        animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.5, ease: ease.out }}
        className="text-2xl sm:text-3xl md:text-4xl font-bold text-[var(--color-text)] mb-3 text-balance leading-tight"
      >
        {title}
      </motion.h2>

      {/* Animated underline — expands from center */}
      <motion.div
        className={cn(
          'h-0.5 bg-[var(--color-primary)] rounded-full mb-4',
          centered ? 'mx-auto' : ''
        )}
        initial={{ width: 0 }}
        animate={inView ? { width: '3rem' } : { width: 0 }}
        transition={{ duration: 0.55, ease: ease.out, delay: 0.18 }}
      />

      {subtitle && (
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.45, ease: ease.out, delay: 0.25 }}
          className="text-sm sm:text-base md:text-lg text-[var(--color-text-muted)] max-w-2xl mx-auto text-balance leading-relaxed"
        >
          {subtitle}
        </motion.p>
      )}
    </div>
  )
}
