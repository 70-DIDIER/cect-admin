import { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Banknote, CheckCircle2, CircleDashed, CircleX, Hourglass, Printer, RefreshCw, Send, TriangleAlert, type LucideIcon } from 'lucide-react'
import { useAuth } from '@/app/AuthContext'
import { HBarList } from '@/components/dashboard/HBarList'
import { Panel } from '@/components/dashboard/Panel'
import { SegmentedControl } from '@/components/dashboard/SegmentedControl'
import { StatusBadge } from '@/components/dashboard/StatusBadge'
import type { Tone } from '@/components/dashboard/tones'
import { FormDialog } from '@/components/ui/FormDialog'
import { apiUrl, get, getRaw, newIdempotencyKey, post } from '@/lib/api'
import { formatBps, formatDateMedium, formatXof, formatYem } from '@/lib/format'
import { methodName, usePaymentMethods } from '@/features/payments/types'

type View = 'report' | 'payouts'

interface Breakdown {
  key?: string
  label?: string
  method?: string
  amount_xof: number
  share_bps: number
  count?: number
}

interface Report {
  kpis: {
    total_collected_xof: number
    transaction_fees_xof: number
    confirmed_payments: number
    average_payment_xof: number
    new_members: number
    registrations: number
    manual_validations: number
    manual_rejections: number
    rejection_rate_bps: number
    pending_payments: number
    pending_amount_xof: number
    yem_in_circulation: string
  }
  yem_activity: { sold_to_cect: string; sold_to_cect_xof: number; paid_to_merchants: string; merchant_payments: number; redeemed_by_merchants: string; redeemed_by_merchants_xof: number; active_merchants: number }
  by_source: Breakdown[]
  by_method: Breakdown[]
  top_members: { user_id: string; name: string; member_number: string | null; pernum: string | null; amount_xof: number; count: number; share_bps: number }[]
}

const COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)']

function isoDay(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

const PRESETS = [
  { value: '30', label: '30 jours' },
  { value: '90', label: '90 jours' },
  { value: 'year', label: 'Cette année' },
] as const

function periodFor(preset: string): { from: string; to: string } {
  const now = new Date()
  const from = preset === 'year' ? new Date(now.getFullYear(), 0, 1) : new Date(now.getFullYear(), now.getMonth(), now.getDate() - (Number(preset) - 1))
  return { from: isoDay(from), to: isoDay(now) }
}

function Figure({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--dash-card)] p-4 shadow-[var(--shadow-card)]">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">{label}</p>
      <p className="mt-1 text-xl font-extrabold leading-tight text-[var(--color-text)]">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">{hint}</p>}
    </div>
  )
}

function ReportView() {
  const [preset, setPreset] = useState<string>('30')
  const period = periodFor(preset)
  const query = useQuery({ queryKey: ['finance-report', period.from, period.to], queryFn: () => get<Report>('/admin/reports/summary', period) })
  const data = query.data

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl label="Période" value={preset} onChange={setPreset} options={PRESETS.map((item) => ({ value: item.value, label: item.label }))} />
        <a
          href={apiUrl('/admin/reports/summary/print', period)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-[var(--color-border)] px-4 text-sm font-semibold hover:bg-[var(--dash-bg)]"
        >
          <Printer size={15} aria-hidden />
          Version imprimable
        </a>
      </div>

      {query.isPending && <div className="h-48 animate-pulse rounded-3xl bg-[var(--chart-track)]" />}
      {query.isError && (
        <p role="alert" className="rounded-2xl border border-[var(--color-border)] p-5 text-sm">
          Impossible de charger le rapport.{' '}
          <button type="button" onClick={() => void query.refetch()} className="font-semibold text-[var(--color-primary)] underline">
            Réessayer
          </button>
        </p>
      )}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <Figure label="Total collecté" value={formatXof(data.kpis.total_collected_xof)} hint={`Frais de transaction : ${formatXof(data.kpis.transaction_fees_xof)}`} />
            <Figure label="Paiements confirmés" value={String(data.kpis.confirmed_payments)} hint={`Panier moyen : ${formatXof(data.kpis.average_payment_xof)}`} />
            <Figure label="Nouveaux adhérents" value={String(data.kpis.new_members)} hint={`${data.kpis.registrations} inscriptions`} />
            <Figure label="Taux de rejet" value={formatBps(data.kpis.rejection_rate_bps)} hint={`${data.kpis.manual_rejections} rejet(s) · ${data.kpis.manual_validations} validation(s)`} />
            <Figure label="En attente" value={formatXof(data.kpis.pending_amount_xof)} hint={`${data.kpis.pending_payments} paiement(s)`} />
            <Figure label="YEM en circulation" value={formatYem(data.kpis.yem_in_circulation)} hint="Soldes disponibles" />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Panel title="Revenus par source" subtitle="Paiements confirmés">
              {data.by_source.length === 0 ? (
                <p className="text-sm text-[var(--color-text-muted)]">Aucun paiement sur la période.</p>
              ) : (
                <HBarList items={data.by_source.map((row, index) => ({ key: row.key ?? String(index), label: row.label ?? '', value: row.amount_xof, valueLabel: formatXof(row.amount_xof), note: formatBps(row.share_bps), color: COLORS[index % COLORS.length] ?? COLORS[0] ?? '' }))} />
              )}
            </Panel>
            <Panel title="Moyens de paiement">
              {data.by_method.length === 0 ? (
                <p className="text-sm text-[var(--color-text-muted)]">Aucun paiement sur la période.</p>
              ) : (
                <HBarList items={data.by_method.map((row, index) => ({ key: row.method ?? String(index), label: `${methodName(row.method ?? null)} (${row.count ?? 0})`, value: row.amount_xof, valueLabel: formatXof(row.amount_xof), note: formatBps(row.share_bps), color: COLORS[index % COLORS.length] ?? COLORS[0] ?? '' }))} />
              )}
            </Panel>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Panel title="Activité YEM">
              <dl className="space-y-2.5 text-sm">
                {[
                  ['Vendus à la CECT', `${formatYem(data.yem_activity.sold_to_cect)} · ${formatXof(data.yem_activity.sold_to_cect_xof)}`],
                  ['Payés aux marchands', `${formatYem(data.yem_activity.paid_to_merchants)} · ${data.yem_activity.merchant_payments} paiement(s)`],
                  ['Rééchangés par les marchands', `${formatYem(data.yem_activity.redeemed_by_merchants)} · ${formatXof(data.yem_activity.redeemed_by_merchants_xof)}`],
                  ['Marchands actifs', String(data.yem_activity.active_merchants)],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-4">
                    <dt className="text-[var(--color-text-muted)]">{label}</dt>
                    <dd className="text-right font-bold text-[var(--color-text)]">{value}</dd>
                  </div>
                ))}
              </dl>
            </Panel>
            <Panel title="Meilleurs membres" subtitle="Par montant payé">
              {data.top_members.length === 0 ? (
                <p className="text-sm text-[var(--color-text-muted)]">Aucun paiement sur la période.</p>
              ) : (
                <ol className="space-y-2.5">
                  {data.top_members.map((member, index) => (
                    <li key={member.user_id} className="flex items-center gap-3 text-sm">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)]/10 text-xs font-bold text-[var(--color-primary)]">{index + 1}</span>
                      <span className="min-w-0 flex-1 truncate font-semibold text-[var(--color-text)]">{member.name}</span>
                      <span className="shrink-0 font-bold text-[var(--color-text)]">{formatXof(member.amount_xof)}</span>
                    </li>
                  ))}
                </ol>
              )}
            </Panel>
          </div>
        </>
      )}
    </div>
  )
}

interface PayoutItem {
  id: string
  sequence: number
  kind: string
  amount: number
  fee_amount: number
  status: string
  provider_reference: string | null
  attempts: number
  last_error: string | null
  settled_at: string | null
}

interface ManualSettlement {
  id: string
  amount: number
  method: string
  reference: string
  status: string
  paid_at: string
}

interface Payout {
  id: string
  reference: string
  status: string
  blocked_reason: string | null
  route: string
  method: string | null
  destination: string | null
  total_amount: number
  paid_amount: number
  remaining_amount: number
  beneficiary: { id: string; name: string; member_number: string | null }
  operation: { reference: string; quantity_received: string | null } | null
  items?: PayoutItem[]
  manual_settlements?: ManualSettlement[]
  created_at: string
}

interface PayoutList {
  data: Payout[]
  summary: { owed_amount: number; needing_action: number; pending_settlements: number }
}

const PAYOUT_STATUS: Record<string, { label: string; tone: Tone; icon: LucideIcon }> = {
  awaiting_dispatch: { label: 'À envoyer', tone: 'warning', icon: Hourglass },
  processing: { label: 'En cours', tone: 'info', icon: Send },
  partially_paid: { label: 'Partiel', tone: 'info', icon: CircleDashed },
  paid: { label: 'Payé', tone: 'success', icon: CheckCircle2 },
  failed: { label: 'En échec', tone: 'danger', icon: CircleX },
  manual_required: { label: 'Règlement manuel', tone: 'warning', icon: TriangleAlert },
}

const STATUS_FILTERS = [
  { value: '', label: 'Tous' },
  { value: 'awaiting_dispatch', label: 'À envoyer' },
  { value: 'processing', label: 'En cours' },
  { value: 'failed', label: 'En échec' },
  { value: 'manual_required', label: 'Manuel' },
  { value: 'paid', label: 'Payés' },
]

type PayoutAction = 'dispatch' | 'retry' | 'settle'

function PayoutDialog({ payoutId, onClose }: { payoutId: string; onClose: () => void }) {
  const queryClient = useQueryClient()
  const { can } = useAuth()
  const [action, setAction] = useState<PayoutAction | null>(null)
  const methods = usePaymentMethods()
  const query = useQuery({ queryKey: ['payout', payoutId], queryFn: () => get<Payout>(`/finance/payouts/${payoutId}`), staleTime: 0 })
  const payout = query.data

  async function refreshAll() {
    await queryClient.invalidateQueries({ queryKey: ['payout', payoutId] })
    await queryClient.invalidateQueries({ queryKey: ['payouts'] })
  }

  if (action && payout) {
    if (action === 'dispatch') {
      return <FormDialog title="Envoyer les transferts" subtitle={payout.reference} fields={[]} submitLabel="Envoyer" confirmText={`Envoyer ${formatXof(payout.remaining_amount)} à ${payout.beneficiary.name} ?`} onClose={() => setAction(null)} onSubmit={async () => { await post(`/finance/payouts/${payout.id}/dispatch`); await refreshAll() }} />
    }
    if (action === 'retry') {
      return <FormDialog title="Relancer les transferts en échec" subtitle={payout.reference} fields={[{ name: 'reason', label: 'Motif (5 caractères minimum)', type: 'textarea', required: true }]} submitLabel="Relancer" onClose={() => setAction(null)} onSubmit={async (values) => { await post(`/finance/payouts/${payout.id}/retry`, { reason: values.reason }); await refreshAll() }} />
    }
    return (
      <FormDialog
        title="Enregistrer un règlement manuel"
        subtitle={`${payout.reference} · reste dû ${formatXof(payout.remaining_amount)}`}
        fields={[
          { name: 'method', label: 'Moyen utilisé', type: 'select', options: methods.map((method) => ({ value: method.code, label: method.label })) },
          { name: 'amount', label: 'Montant réglé (FCFA)', type: 'number', required: true, initial: String(payout.remaining_amount) },
          { name: 'reference', label: 'Référence du règlement', required: true },
          { name: 'note', label: 'Note (facultatif)', type: 'textarea' },
        ]}
        submitLabel="Enregistrer"
        confirmText=""
        onClose={() => setAction(null)}
        onSubmit={async (values) => {
          await post(`/finance/payouts/${payout.id}/manual-settlements`, { method: values.method, amount: Number(values.amount), reference: values.reference, paid_at: new Date().toISOString(), note: values.note || null }, newIdempotencyKey())
          await refreshAll()
        }}
      />
    )
  }

  const status = payout ? PAYOUT_STATUS[payout.status] : undefined
  return (
    <FormDialog title={payout ? `Versement ${payout.reference}` : 'Versement'} subtitle={payout?.beneficiary.name} fields={[]} submitLabel="Fermer" onClose={onClose} onSubmit={async () => undefined}>
      {query.isPending && <div className="h-24 animate-pulse rounded-2xl bg-[var(--chart-track)]" />}
      {payout && (
        <div className="space-y-4 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            {status && <StatusBadge label={status.label} tone={status.tone} icon={status.icon} />}
            <span className="text-[var(--color-text-muted)]">{payout.route === 'mobile_money' ? 'Mobile Money' : 'Règlement manuel'}</span>
          </div>
          {payout.blocked_reason && <p className="rounded-xl bg-[var(--color-danger)]/5 p-3 text-[var(--color-danger)]">{payout.blocked_reason}</p>}
          <dl className="space-y-1.5">
            {[
              ['Total', formatXof(payout.total_amount)],
              ['Déjà payé', formatXof(payout.paid_amount)],
              ['Reste dû', formatXof(payout.remaining_amount)],
              ['Destination', [payout.method ? methodName(payout.method) : null, payout.destination].filter(Boolean).join(' · ') || '—'],
              ['Opération', payout.operation ? `${payout.operation.reference}${payout.operation.quantity_received ? ` · ${formatYem(payout.operation.quantity_received)}` : ''}` : '—'],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4">
                <dt className="text-[var(--color-text-muted)]">{label}</dt>
                <dd className="text-right font-semibold text-[var(--color-text)]">{value}</dd>
              </div>
            ))}
          </dl>
          {payout.items && payout.items.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-[var(--color-text-muted)]">Transferts</p>
              <ul className="divide-y divide-[var(--color-border)] rounded-xl border border-[var(--color-border)]">
                {payout.items.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-3 px-3 py-2">
                    <span>
                      <span className="font-semibold text-[var(--color-text)]">#{item.sequence} · {formatXof(item.amount)}</span>
                      {item.last_error && <span className="block text-xs text-[var(--color-danger)]">{item.last_error}</span>}
                    </span>
                    <span className="text-xs text-[var(--color-text-muted)]">{PAYOUT_STATUS[item.status]?.label ?? item.status}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {payout.manual_settlements && payout.manual_settlements.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-[var(--color-text-muted)]">Règlements manuels</p>
              <ul className="divide-y divide-[var(--color-border)] rounded-xl border border-[var(--color-border)]">
                {payout.manual_settlements.map((settlement) => (
                  <li key={settlement.id} className="flex items-center justify-between gap-3 px-3 py-2">
                    <span className="font-semibold text-[var(--color-text)]">{formatXof(settlement.amount)} · {methodName(settlement.method)}</span>
                    <span className="text-xs text-[var(--color-text-muted)]">{settlement.status === 'pending_approval' ? 'En attente d’approbation' : settlement.status}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {payout.remaining_amount > 0 && (
            <div className="flex flex-wrap gap-2">
              {payout.status === 'awaiting_dispatch' && can('payouts.retry') && <ActionButton onClick={() => setAction('dispatch')}>Envoyer</ActionButton>}
              {(payout.status === 'failed' || payout.status === 'manual_required') && can('payouts.retry') && <ActionButton onClick={() => setAction('retry')}>Relancer</ActionButton>}
              {can('payouts.settle_manual') && <ActionButton onClick={() => setAction('settle')} plain>Règlement manuel</ActionButton>}
              {payout.status === 'processing' && (
                <ActionButton plain onClick={() => void post(`/finance/payouts/${payout.id}/refresh`).then(refreshAll)}>
                  <RefreshCw size={13} aria-hidden /> Actualiser
                </ActionButton>
              )}
            </div>
          )}
        </div>
      )}
    </FormDialog>
  )
}

function ActionButton({ children, onClick, plain = false }: { children: React.ReactNode; onClick: () => void; plain?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-xl px-4 text-xs font-bold ${plain ? 'border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--dash-bg)]' : 'bg-[var(--color-primary)] text-white'}`}
    >
      {children}
    </button>
  )
}

function PayoutsView() {
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const query = useQuery({
    queryKey: ['payouts', status, search],
    queryFn: () => getRaw<PayoutList>('/finance/payouts', { ...(status ? { status } : {}), ...(search ? { search } : {}) }),
    staleTime: 0,
  })
  const summary = query.data?.summary

  return (
    <div className="space-y-6">
      {summary && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Figure label="Reste à verser" value={formatXof(summary.owed_amount)} />
          <Figure label="À traiter" value={String(summary.needing_action)} hint="Échecs et règlements manuels" />
          <Figure label="Règlements à approuver" value={String(summary.pending_settlements)} />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <SegmentedControl label="Statut" value={status} onChange={setStatus} options={STATUS_FILTERS} />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Référence"
          aria-label="Rechercher par référence"
          className="min-h-[40px] flex-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] sm:max-w-xs"
        />
      </div>

      <Panel title="Versements" subtitle="Montants dus aux vendeurs et aux marchands" flush>
        {query.isPending && <div className="mx-5 mb-4 h-24 animate-pulse rounded-2xl bg-[var(--chart-track)]" />}
        {query.data && query.data.data.length === 0 && <p className="px-6 pb-5 text-sm text-[var(--color-text-muted)]">Aucun versement.</p>}
        <ul className="divide-y divide-[var(--color-border)]">
          {query.data?.data.map((payout) => {
            const badge = PAYOUT_STATUS[payout.status]
            return (
              <li key={payout.id}>
                <button type="button" onClick={() => setOpenId(payout.id)} className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 text-left transition-colors hover:bg-[var(--dash-bg)] sm:px-6">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                    <Banknote size={18} aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1 basis-48">
                    <span className="block truncate text-sm font-bold text-[var(--color-text)]">{payout.beneficiary.name}</span>
                    <span className="block truncate text-xs text-[var(--color-text-muted)]">
                      {payout.reference} · {formatDateMedium(payout.created_at)}
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="block text-sm font-extrabold text-[var(--color-text)]">{formatXof(payout.total_amount)}</span>
                    <span className="block text-xs text-[var(--color-text-muted)]">reste {formatXof(payout.remaining_amount)}</span>
                  </span>
                  {badge && <StatusBadge label={badge.label} tone={badge.tone} icon={badge.icon} />}
                </button>
              </li>
            )
          })}
        </ul>
      </Panel>

      {openId && <PayoutDialog payoutId={openId} onClose={() => setOpenId(null)} />}
    </div>
  )
}

export default function FinancePage() {
  const { can } = useAuth()
  const [view, setView] = useState<View>(can('reports.view') ? 'report' : 'payouts')

  return (
    <>
      <Helmet>
        <title>Finance — CECT Admin</title>
      </Helmet>

      <div className="space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-[var(--color-text)]">Finance</h1>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">Rapports d’activité et versements aux membres.</p>
          </div>
          <SegmentedControl
            label="Section"
            value={view}
            onChange={setView}
            options={[
              ...(can('reports.view') ? [{ value: 'report' as View, label: 'Rapports' }] : []),
              ...(can('payouts.view') ? [{ value: 'payouts' as View, label: 'Versements' }] : []),
            ]}
          />
        </header>

        {view === 'report' ? <ReportView /> : <PayoutsView />}
      </div>
    </>
  )
}
