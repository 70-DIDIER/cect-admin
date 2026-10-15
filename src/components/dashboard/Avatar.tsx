import { cn } from '@/lib/utils'
import { initialsOf } from '@/lib/format'

interface AvatarProps {
  name: string
  size?: 'sm' | 'md' | 'lg'
  /** `lime` sur fond forêt, `soft` sur fond clair. */
  tone?: 'lime' | 'soft'
  className?: string
}

const SIZES = { sm: 'h-8 w-8 text-xs', md: 'h-10 w-10 text-sm', lg: 'h-16 w-16 text-xl' }
const TONES = { lime: 'bg-[var(--lime)] text-[var(--forest-900)]', soft: 'bg-[var(--chart-track)] text-[var(--color-primary)]' }

export function Avatar({ name, size = 'md', tone = 'soft', className }: AvatarProps) {
  return (
    <span aria-hidden className={cn('inline-flex shrink-0 items-center justify-center rounded-full font-bold', SIZES[size], TONES[tone], className)}>
      {initialsOf(name)}
    </span>
  )
}
