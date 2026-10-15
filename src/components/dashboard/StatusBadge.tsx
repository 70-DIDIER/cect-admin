import { AlertTriangle, CheckCircle2, CircleDashed, Clock3, Hourglass, Send, XCircle, type LucideIcon } from 'lucide-react'
import { TONES, type Tone } from './tones'

interface StatusBadgeProps {
  label: string
  tone: Tone
  icon?: LucideIcon
}

export function StatusBadge({ label, tone, icon: Icon }: StatusBadgeProps) {
  const style = TONES[tone]
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold" style={{ background: style.bg, color: style.fg }}>
      {Icon && <Icon size={13} aria-hidden />}
      {label}
    </span>
  )
}

interface StatusMeta {
  label: string
  tone: Tone
  icon: LucideIcon
}

export const PAYMENT_STATUS: Record<string, StatusMeta> = {
  approved: { label: 'Validé', tone: 'success', icon: CheckCircle2 },
  pending: { label: 'En attente', tone: 'warning', icon: Hourglass },
  declined: { label: 'Refusé', tone: 'danger', icon: XCircle },
  failed: { label: 'Échec', tone: 'danger', icon: XCircle },
  expired: { label: 'Expiré', tone: 'neutral', icon: Clock3 },
  mismatch: { label: 'Écart de montant', tone: 'danger', icon: AlertTriangle },
}

export const MERCHANT_PAYMENT_STATUS: Record<string, StatusMeta> = {
  reserved: { label: 'Réservé', tone: 'info', icon: CircleDashed },
  declared_sent: { label: 'Envoi déclaré', tone: 'warning', icon: Send },
  confirmed: { label: 'Confirmé', tone: 'success', icon: CheckCircle2 },
  rejected: { label: 'Non confirmé', tone: 'danger', icon: XCircle },
  disputed: { label: 'Litige', tone: 'danger', icon: AlertTriangle },
  expired: { label: 'Expiré', tone: 'neutral', icon: Clock3 },
  canceled: { label: 'Annulé', tone: 'neutral', icon: XCircle },
}

export const EXCHANGE_STATUS: Record<string, StatusMeta> = {
  awaiting_transfer: { label: 'Envoi à effectuer', tone: 'info', icon: CircleDashed },
  declared_sent: { label: 'Envoi déclaré', tone: 'warning', icon: Send },
  yem_received: { label: 'YEM reçus', tone: 'success', icon: CheckCircle2 },
  completed: { label: 'Terminé', tone: 'success', icon: CheckCircle2 },
  rejected: { label: 'Refusé', tone: 'danger', icon: XCircle },
  disputed: { label: 'Litige', tone: 'danger', icon: AlertTriangle },
  expired: { label: 'Expiré', tone: 'neutral', icon: Clock3 },
  canceled: { label: 'Annulé', tone: 'neutral', icon: XCircle },
}

export const PAYOUT_STATUS: Record<string, StatusMeta> = {
  awaiting_dispatch: { label: 'À envoyer', tone: 'warning', icon: Hourglass },
  processing: { label: 'En cours', tone: 'info', icon: Send },
  paid: { label: 'Payé', tone: 'success', icon: CheckCircle2 },
  failed: { label: 'Échec', tone: 'danger', icon: XCircle },
  manual_required: { label: 'Règlement manuel', tone: 'violet', icon: AlertTriangle },
}

export function StatusFrom({ statuses, value }: { statuses: Record<string, StatusMeta>; value: string }) {
  const meta = statuses[value] ?? { label: value, tone: 'neutral' as const, icon: CircleDashed }
  return <StatusBadge label={meta.label} tone={meta.tone} icon={meta.icon} />
}
