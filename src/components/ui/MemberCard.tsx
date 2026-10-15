import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { RotateCw } from 'lucide-react'

interface MemberCardProps {
  name: string
  pernum: string
  memberNumber: string | null
  memberSince: string | null
  active: boolean
}

function sinceLabel(value: string | null): string {
  if (!value) return 'Adhésion en attente'
  return `Membre depuis ${new Date(value).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`
}

export function MemberCard({ name, pernum, memberNumber, memberSince, active }: MemberCardProps) {
  const [flipped, setFlipped] = useState(false)
  const face = 'absolute inset-0 overflow-hidden rounded-[24px] p-6 [backface-visibility:hidden]'

  return (
    <div className="[perspective:1400px]">
      <div className="relative aspect-[1.65/1] w-full max-w-[440px] transition-transform duration-[250ms] [transform-style:preserve-3d]" style={{ transform: flipped ? 'rotateY(180deg)' : 'none' }}>
        <div className={`${face} flex flex-col justify-between bg-[var(--forest-900)] text-white`} aria-hidden={flipped}>
          <svg aria-hidden className="pointer-events-none absolute -right-10 -top-12 h-52 w-52" viewBox="0 0 200 200">
            <circle cx="100" cy="100" r="100" fill="var(--forest-700)" />
            <circle cx="100" cy="100" r="62" fill="var(--forest-500)" />
          </svg>
          <div className="relative flex items-start justify-between">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white p-1">
              <img src="/logos/CECT_logo_transparent.png" alt="" className="h-full w-full object-contain" />
            </span>
            <span className={`rounded-full px-3 py-1 text-[11px] font-bold ${active ? 'bg-[var(--lime)] text-[var(--forest-900)]' : 'bg-white/15 text-white'}`}>{active ? 'Adhésion active' : 'Adhésion à régler'}</span>
          </div>
          <div className="relative">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--sidebar-muted)]">Pernum</p>
            <p className="mt-1 text-[22px] font-bold tracking-[0.08em] [font-variant-numeric:tabular-nums]">{pernum || '—'}</p>
          </div>
          <div className="relative flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-[17px] font-bold">{name}</p>
              <p className="truncate text-xs text-[var(--sidebar-muted)]">{sinceLabel(memberSince)}</p>
            </div>
            <button type="button" onClick={() => setFlipped(true)} className="flex shrink-0 items-center gap-1.5 rounded-lg border border-white/20 px-2.5 py-1.5 text-xs font-semibold text-white/90 hover:bg-[var(--forest-500)]">
              <RotateCw size={13} aria-hidden /> Retourner
            </button>
          </div>
        </div>

        <div className={`${face} flex items-center gap-5 bg-[var(--forest-700)] text-white [transform:rotateY(180deg)]`} aria-hidden={!flipped}>
          <div className="rounded-2xl bg-white p-3">
            <QRCodeSVG value={`CECT:${pernum}`} size={116} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">Carte de membre</p>
            <p className="mt-1 text-xs leading-5 text-[var(--sidebar-muted)]">Présentez ce code à un conseiller de la CECT pour vous identifier.</p>
            {memberNumber && <p className="mt-3 text-xs font-semibold text-white/90">N° {memberNumber}</p>}
            <button type="button" onClick={() => setFlipped(false)} className="mt-4 flex items-center gap-1.5 rounded-lg border border-white/20 px-2.5 py-1.5 text-xs font-semibold text-white/90 hover:bg-[var(--forest-500)]">
              <RotateCw size={13} aria-hidden /> Retourner
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
