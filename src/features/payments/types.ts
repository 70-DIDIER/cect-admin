import { usePublicConfig } from '@/features/config/usePublicConfig'

export type PaymentStatus = 'created' | 'pending' | 'approved' | 'declined' | 'canceled' | 'expired' | 'failed' | 'mismatch'

export interface PaymentAttempt {
  id: string
  reference: string
  method: string | null
  mode: 'psp' | 'manual'
  status: PaymentStatus
  net_amount: number
  fee_amount: number
  amount: number
  currency: string
  checkout_url: string | null
  instructions: string | null
  declared_reference: string | null
  declared_at: string | null
  validated_at: string | null
  created_at: string
}

export const PAYMENT_METHODS: ReadonlyArray<{ code: string; label: string; hint: string }> = [
  { code: 'TMONEY', label: 'T-Money', hint: 'Paiement mobile' },
  { code: 'FLOOZ', label: 'Flooz', hint: 'Paiement mobile' },
]

const OFFERED_METHOD_CODES: ReadonlyArray<string> = ['TMONEY', 'FLOOZ']

export function usePaymentMethods(): ReadonlyArray<{ code: string; label: string; hint: string }> {
  const config = usePublicConfig().data
  if (!config) return PAYMENT_METHODS
  return config.payment_methods.filter((method) => OFFERED_METHOD_CODES.includes(method.code)).map((method) => ({
    code: method.code,
    label: method.label,
    hint: method.channel === 'mobile_money' ? 'Paiement mobile' : 'Validé par la Comptabilité après réception',
  }))
}

export function methodName(code: string | null): string {
  return PAYMENT_METHODS.find((method) => method.code === code)?.label ?? code ?? '—'
}

export function isInFlight(status: PaymentStatus): boolean {
  return status === 'created' || status === 'pending'
}

export const PAYMENT_FAILURE_LABELS: Partial<Record<PaymentStatus, string>> = {
  declined: 'Le paiement a été refusé.',
  canceled: 'Le paiement a été annulé.',
  expired: 'Le paiement a expiré.',
  failed: 'Le paiement a échoué.',
  mismatch: 'Le montant reçu ne correspond pas au montant dû : la CECT va vous contacter.',
}
