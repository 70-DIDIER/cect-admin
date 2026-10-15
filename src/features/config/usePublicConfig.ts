import { useQuery } from '@tanstack/react-query'
import { get } from '@/lib/api'

export interface PublicConfig {
  currency: string
  membership_fees: { natural_person: number; legal_person: number }
  rates_xof_per_yem: { purchase: number; sale: number; transfer: number }
  legal_forms: string[]
  rccm_required: boolean
  nif_required: boolean
  payment_methods: { code: string; label: string; channel: 'mobile_money' | 'manual' }[]
}

export function usePublicConfig() {
  return useQuery({ queryKey: ['public-config'], queryFn: () => get<PublicConfig>('/config'), staleTime: 5 * 60_000 })
}
