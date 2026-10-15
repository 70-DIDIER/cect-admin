import type { ReactNode } from 'react'

interface StatTileProps {
  label: string
  value: ReactNode
  hint?: string
}

export function StatTile({ label, value, hint }: StatTileProps) {
  return (
    <div className="rounded-[18px] border border-[var(--color-border)] bg-[var(--dash-card)] p-5">
      <p className="text-xs font-semibold text-[var(--color-text-muted)]">{label}</p>
      <p className="mt-2 text-[26px] font-bold leading-8 tracking-tight text-[var(--color-text)] [font-variant-numeric:tabular-nums]">{value}</p>
      {hint && <p className="mt-1 text-xs text-[var(--color-text-muted)]">{hint}</p>}
    </div>
  )
}
