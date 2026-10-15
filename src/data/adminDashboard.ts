import { get } from '@/lib/api'
import { formatDateShort } from '@/lib/format'

export type PeriodDays = 7 | 30 | 90

export interface Breakdown {
  key: string
  label: string
  amount_xof: number
  share_bps: number
}

export interface TopMember {
  id: string
  name: string
  member_number: string
  amount_xof: number
}

export interface RecentPayment {
  id: string
  label: string
  member: string
  method: string | null
  amount_xof: number
  date: string
}

export interface HealthCheck {
  key: string
  label: string
  ok: boolean
  detail: string
}

export interface AdminDashboardData {
  period: { from: string; to: string; days: PeriodDays }
  kpis: {
    total_collected_xof: number
    confirmed_payments: number
    average_payment_xof: number
    new_members: number
    registrations: number
    manual_validations: number
    manual_rejections: number
    pending_payments: number
    pending_amount_xof: number
    yem_in_circulation: number
  }
  trend: { direction: 'up' | 'down'; percent: number } | null
  series: { days: string[]; collected_xof: number[]; new_members: number[] }
  by_source: Breakdown[]
  by_method: Breakdown[]
  top_members: TopMember[]
  recent_payments: RecentPayment[]
  payouts: { owed_xof: number; in_progress: number; needing_action: number; paid_xof: number }
  pending_validations: { payments: number; yem: number; merchant: number }
  overview: { members: number; active_members: number }
  health: HealthCheck[]
  access: { report: boolean; paymentsToValidate: boolean; yemToValidate: boolean; health: boolean }
}

interface ApiBreakdownRow {
  key?: string
  label?: string
  method?: string
  amount_xof: number
  share_bps: number
}

interface ApiDashboard {
  summary: {
    kpis: Omit<AdminDashboardData['kpis'], 'yem_in_circulation'> & { yem_in_circulation: string }
    payouts: { paid_by_provider_xof: number; paid_manually_xof: number; remaining_due_xof: number; remaining_due_batches: number; batches_needing_action: number }
    by_source: ApiBreakdownRow[]
    by_method: ApiBreakdownRow[]
    top_members: { user_id: string; name: string; member_number: string | null; pernum: string | null; amount_xof: number }[]
  } | null
  trend: { direction: 'up' | 'down'; percent: number } | null
  series: { days: string[]; collected_xof: number[]; new_members: number[] } | null
  recent_payments: { id: string; label: string; member: string; method: string | null; amount_xof: number; date: string }[] | null
  overview: { members: number; active_members: number } | null
  pending_validations: { payments: number | null; yem: number | null; merchant: number | null }
  health: { code: string; ok: boolean; message: string }[] | null
}

const METHOD_LABELS: Record<string, string> = {
  TMONEY: 'T-Money',
  FLOOZ: 'Flooz',
  CASH: 'Espèces',
  BANK_TRANSFER: 'Virement bancaire',
}

export function methodLabel(method: string | null): string | null {
  if (!method) return null
  return METHOD_LABELS[method.toUpperCase()] ?? method
}

const HEALTH_LABELS: Record<string, string> = {
  suspicious_payments: 'Paiements suspects',
  payout_failures: 'Versements en échec',
  outbox_dead: 'Messages abandonnés',
  outbox_backlog: 'Relais des messages',
  failed_jobs: 'Tâches en échec',
  webhook_rejections: 'Webhooks rejetés',
  snapshot_failed: 'Dernier snapshot',
  ledger_divergence: 'Intégrité des soldes',
  audit_chain_broken: 'Chaîne d’audit',
}

const EMPTY_KPIS: AdminDashboardData['kpis'] = {
  total_collected_xof: 0,
  confirmed_payments: 0,
  average_payment_xof: 0,
  new_members: 0,
  registrations: 0,
  manual_validations: 0,
  manual_rejections: 0,
  pending_payments: 0,
  pending_amount_xof: 0,
  yem_in_circulation: 0,
}

export function adaptAdminDashboard(api: ApiDashboard, days: PeriodDays, from: Date, to: Date): AdminDashboardData {
  const summary = api.summary
  const series = api.series
  const payouts = summary?.payouts

  return {
    period: { from: from.toISOString(), to: to.toISOString(), days },
    kpis: summary ? { ...summary.kpis, yem_in_circulation: Number.parseFloat(summary.kpis.yem_in_circulation) } : EMPTY_KPIS,
    trend: api.trend,
    series: series ? { ...series, days: series.days.map((day) => formatDateShort(day)) } : { days: [], collected_xof: [], new_members: [] },
    by_source: (summary?.by_source ?? []).map((row) => ({ key: row.key ?? '', label: row.label ?? row.key ?? '', amount_xof: row.amount_xof, share_bps: row.share_bps })),
    by_method: (summary?.by_method ?? []).map((row) => ({ key: row.method ?? '', label: methodLabel(row.method ?? '') ?? 'Autre', amount_xof: row.amount_xof, share_bps: row.share_bps })),
    top_members: (summary?.top_members ?? []).map((member) => ({ id: member.user_id, name: member.name, member_number: member.member_number ?? member.pernum ?? '', amount_xof: member.amount_xof })),
    recent_payments: (api.recent_payments ?? []).map((payment) => ({ ...payment, method: methodLabel(payment.method) })),
    payouts: {
      owed_xof: payouts?.remaining_due_xof ?? 0,
      in_progress: payouts?.remaining_due_batches ?? 0,
      needing_action: payouts?.batches_needing_action ?? 0,
      paid_xof: (payouts?.paid_by_provider_xof ?? 0) + (payouts?.paid_manually_xof ?? 0),
    },
    pending_validations: {
      payments: api.pending_validations.payments ?? 0,
      yem: api.pending_validations.yem ?? 0,
      merchant: api.pending_validations.merchant ?? 0,
    },
    overview: api.overview ?? { members: 0, active_members: 0 },
    health: (api.health ?? []).map((check) => ({
      key: check.code,
      label: HEALTH_LABELS[check.code] ?? check.code,
      ok: check.ok,
      detail: check.ok ? 'Aucune alerte' : check.message,
    })),
    access: {
      report: summary !== null,
      paymentsToValidate: api.pending_validations.payments !== null,
      yemToValidate: api.pending_validations.yem !== null,
      health: api.health !== null,
    },
  }
}

function isoDay(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

export async function fetchAdminDashboard(days: PeriodDays): Promise<AdminDashboardData> {
  const to = new Date()
  const from = new Date(to.getFullYear(), to.getMonth(), to.getDate() - (days - 1))
  const api = await get<ApiDashboard>('/admin/dashboard', { from: isoDay(from), to: isoDay(to) })
  return adaptAdminDashboard(api, days, from, to)
}
