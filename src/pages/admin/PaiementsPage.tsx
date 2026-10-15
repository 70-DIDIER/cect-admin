import { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Panel } from '@/components/dashboard/Panel'
import { PAYMENT_STATUS, StatusBadge, StatusFrom } from '@/components/dashboard/StatusBadge'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatXof } from '@/lib/format'
import { dateTime, ErrorLine, FIELD, LoadingBlock, LoadMore, PageIntro, Tabs, useCursorList } from './shared'

interface Attempt {
  id: string
  provider: string
  method: string | null
  status: string
  amount: number
  fee_amount: number
  requires_review: boolean
  review_reason: string | null
  declared_reference: string | null
  created_at: string
  settled_at: string | null
  intent?: { purpose: string } | null
}

interface WebhookEvent {
  id: string
  provider: string
  event_name: string
  provider_transaction_id: string | null
  status: string
  received_at: string
  error: string | null
}

const STATUSES = [
  { value: '', label: 'Tous les statuts' },
  { value: 'pending', label: 'En attente' },
  { value: 'approved', label: 'Validés' },
  { value: 'declined', label: 'Refusés' },
  { value: 'failed', label: 'Échecs' },
]

function Attempts() {
  const [status, setStatus] = useState('')
  const [review, setReview] = useState(false)
  const list = useCursorList<Attempt>('/admin/payments/attempts', { ...(status ? { status } : {}), ...(review ? { requires_review: 1 } : {}), per_page: 30 })

  const columns: Column<Attempt>[] = [
    { key: 'ref', header: 'Référence', render: (row) => <span className="font-mono text-xs font-bold">PAY-{row.id.slice(-8).toUpperCase()}</span> },
    { key: 'provider', header: 'Canal', render: (row) => `${row.provider === 'manual' ? 'Manuel' : row.provider}${row.method ? ` · ${row.method}` : ''}` },
    { key: 'amount', header: 'Montant', align: 'right', render: (row) => formatXof(row.amount) },
    { key: 'fee', header: 'Frais', align: 'right', hideOnMobile: true, render: (row) => (row.fee_amount ? formatXof(row.fee_amount) : '—') },
    {
      key: 'status',
      header: 'Statut',
      render: (row) => (
        <span className="flex flex-wrap items-center gap-1.5">
          <StatusFrom statuses={PAYMENT_STATUS} value={row.status} />
          {row.requires_review && <StatusBadge label="À examiner" tone="danger" />}
        </span>
      ),
    },
    { key: 'date', header: 'Créé le', render: (row) => dateTime(row.created_at) },
  ]

  return (
    <Panel
      title="Tentatives de paiement"
      subtitle="Toutes les tentatives, plus récentes d’abord."
      flush
      action={
        <div className="flex flex-wrap items-center gap-2">
          <select aria-label="Statut" value={status} onChange={(event) => setStatus(event.target.value)} className={FIELD}>
            {STATUSES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          <label className="flex min-h-[44px] items-center gap-2 rounded-xl border border-[var(--color-border)] px-3 text-sm">
            <input type="checkbox" checked={review} onChange={(event) => setReview(event.target.checked)} />À examiner
          </label>
        </div>
      }
    >
      {list.error && <ErrorLine message={list.error} />}
      {list.loading && list.rows.length === 0 ? <LoadingBlock /> : <DataTable columns={columns} rows={list.rows} rowKey={(row) => row.id} empty={<EmptyState title="Aucun paiement" description="Aucune tentative ne correspond à ces critères." />} />}
      <LoadMore hasMore={list.hasMore} loading={list.loading} onClick={list.more} />
    </Panel>
  )
}

function Webhooks() {
  const list = useCursorList<WebhookEvent>('/admin/payments/webhook-events', { per_page: 30 })
  const columns: Column<WebhookEvent>[] = [
    { key: 'event', header: 'Évènement', render: (row) => <span className="font-semibold">{row.event_name}</span> },
    { key: 'provider', header: 'Prestataire', render: (row) => row.provider },
    { key: 'tx', header: 'Transaction', hideOnMobile: true, render: (row) => <span className="font-mono text-xs">{row.provider_transaction_id ?? '—'}</span> },
    {
      key: 'status',
      header: 'Statut',
      render: (row) => <StatusBadge label={row.status} tone={row.status === 'processed' ? 'success' : row.status === 'rejected' || row.error ? 'danger' : 'warning'} />,
    },
    { key: 'date', header: 'Reçu le', render: (row) => dateTime(row.received_at) },
  ]
  return (
    <Panel title="Webhooks reçus" subtitle="Notifications signées envoyées par les prestataires de paiement." flush>
      {list.error && <ErrorLine message={list.error} />}
      {list.loading && list.rows.length === 0 ? <LoadingBlock /> : <DataTable columns={columns} rows={list.rows} rowKey={(row) => row.id} empty={<EmptyState title="Aucun webhook" description="Aucune notification reçue pour le moment." />} />}
      <LoadMore hasMore={list.hasMore} loading={list.loading} onClick={list.more} />
    </Panel>
  )
}

export default function PaiementsPage() {
  const [tab, setTab] = useState<'attempts' | 'webhooks'>('attempts')
  return (
    <>
      <Helmet>
        <title>Paiements — CECT Admin</title>
      </Helmet>
      <div className="space-y-6">
        <PageIntro title="Paiements" description="Suivi des encaissements et des retours des prestataires." actions={<Tabs value={tab} onChange={setTab} options={[{ value: 'attempts', label: 'Tentatives' }, { value: 'webhooks', label: 'Webhooks' }]} />} />
        {tab === 'attempts' ? <Attempts /> : <Webhooks />}
      </div>
    </>
  )
}
