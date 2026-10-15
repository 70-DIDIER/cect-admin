import { cn } from '@/lib/utils'

interface CardProps {
  className?: string
  children: React.ReactNode
}

export function Card({ className, children }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-5 lg:p-6 shadow-sm transition-shadow hover:shadow-md',
        className
      )}
    >
      {children}
    </div>
  )
}

export function CardHeader({ className, children }: CardProps) {
  return <div className={cn('mb-3 sm:mb-4', className)}>{children}</div>
}

export function CardTitle({ className, children }: CardProps) {
  return (
    <h3 className={cn('text-base sm:text-lg font-semibold text-[var(--color-text)]', className)}>
      {children}
    </h3>
  )
}

export function CardDescription({ className, children }: CardProps) {
  return (
    <p className={cn('text-xs sm:text-sm text-[var(--color-text-muted)]', className)}>
      {children}
    </p>
  )
}

export function CardContent({ className, children }: CardProps) {
  return <div className={cn('', className)}>{children}</div>
}

export function CardFooter({ className, children }: CardProps) {
  return <div className={cn('mt-3 sm:mt-4 flex items-center', className)}>{children}</div>
}
