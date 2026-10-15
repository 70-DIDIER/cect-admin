import { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CircleCheck, CircleX, Clock } from 'lucide-react'
import { useAuth } from '@/app/AuthContext'
import { Panel } from '@/components/dashboard/Panel'
import { SegmentedControl } from '@/components/dashboard/SegmentedControl'
import { StatusBadge } from '@/components/dashboard/StatusBadge'
import { FormDialog, type FormField } from '@/components/ui/FormDialog'
import { getRaw, newIdempotencyKey, post } from '@/lib/api'
import { formatDateMedium, formatXof, formatYem } from '@/lib/format'
import { methodName } from '@/features/payments/types'

type Kind = 'payment' | 'yem_receipt' | 'merchant_payment'
type Decision = 'approve' | 'reject' | 'confirm' | 'dispute'

interface QueueItem {
  id: string
  kind: Kind
  label: string
  member: { name: string; member_number: string | null; pernum: string | null }
  amount_xof: number | null
  quantity: string | null
  method: string | null
  declared_reference: string | null
  declared_at: string | null
  status: 'pending' | 'validated' | 'rejected' | 'disputed'
  decided_at: string | null
  date: string
}

interface QueueResponse {
  data: QueueItem[]
  meta: { pending_count: number | null }
}

const STATUS_BADGES = {
  pending: { label: 'En attente', tone: 'warning', icon: Clock },
  validated: { label: 'Validé', tone: 'success', icon: CircleCheck },
  rejected: { label: 'Rejeté', tone: 'danger', icon: CircleX },
  disputed: { label: 'Litige', tone: 'danger', icon: AlertTriangle },
} as const

const KIND_LABELS: Record<Kind, string> = {
  payment: 'Paiement',
  yem_receipt: 'Réception de YEM',
  merchant_payment: 'Paiement marchand',
}

interface DecisionSpec {
  title: string
  submit: string
  danger?: boolean
  path: string
  fields: FormField[]
  body: (values: Record<string, string>) => Record<string, unknown> | undefined
  idempotent?: boolean
}

function specFor(item: QueueItem, decision: Decision): DecisionSpec | null {
  const reason: FormField = { name: 'reason', label: 'Motif (5 caractères minimum)', type: 'textarea', required: true }
  if (item.kind === 'payment') {
    if (decision === 'approve') {
      return {
        title: 'Valider le paiement',
        submit: 'Valider',
        path: `/validations/payments/${item.id}/approve`,
        idempotent: true,
        fields: [
          { name: 'received_amount', label: 'Montant reçu (FCFA)', type: 'number', required: true, initial: String(item.amount_xof ?? '') },
          { name: 'reference', label: 'Référence du dépôt ou du virement', required: true, initial: item.declared_reference ?? '' },
          { name: 'comment', label: 'Commentaire (facultatif)', type: 'textarea' },
        ],
        body: (v) => ({ received_amount: Number(v.received_amount), reference: v.reference, comment: v.comment || null }),
      }
    }
    if (decision === 'reject') return { title: 'Rejeter le paiement', submit: 'Rejeter', danger: true, path: `/validations/payments/${item.id}/reject`, fields: [reason], body: (v) => ({ reason: v.reason }) }
  }
  if (item.kind === 'yem_receipt') {
    if (decision === 'confirm') {
      return {
        title: 'Confirmer la réception des YEM',
        submit: 'Confirmer',
        path: `/validations/${item.id}/confirm`,
        idempotent: true,
        fields: [
          { name: 'quantity_received', label: 'Quantité reçue (YEM)', required: true, initial: item.quantity ?? '' },
          { name: 'external_reference', label: 'Référence de la transaction YEM', required: true, initial: item.declared_reference ?? '' },
          { name: 'comment', label: 'Commentaire (facultatif)', type: 'textarea' },
        ],
        body: (v) => ({ quantity_received: v.quantity_received, external_reference: v.external_reference, comment: v.comment || null }),
      }
    }
    if (decision === 'dispute') {
      return { title: 'Placer en litige', submit: 'Placer en litige', danger: true, path: `/validations/${item.id}/dispute`, fields: [{ name: 'comment', label: 'Motif du litige (5 caractères minimum)', type: 'textarea', required: true }], body: (v) => ({ comment: v.comment }) }
    }
    if (decision === 'reject') return { title: 'Rejeter la demande', submit: 'Rejeter', danger: true, path: `/validations/${item.id}/reject`, fields: [reason], body: (v) => ({ reason: v.reason }) }
  }
  if (item.kind === 'merchant_payment') {
    if (decision === 'confirm') return { title: 'Confirmer le paiement marchand', submit: 'Confirmer', path: `/validations/merchant-payments/${item.id}/confirm`, idempotent: true, fields: [], body: () => undefined }
    if (decision === 'reject') return { title: 'Rejeter le paiement marchand', submit: 'Rejeter', danger: true, path: `/validations/merchant-payments/${item.id}/reject`, fields: [reason], body: (v) => ({ reason: v.reason }) }
  }
  return null
}

function DecisionDialog({ item, decision, onClose }: { item: QueueItem; decision: Decision; onClose: () => void }) {
  const queryClient = useQueryClient()
  const spec = specFor(item, decision)
  const [key] = useState(newIdempotencyKey)
  if (!spec) return null

  return (
    <FormDialog
      title={spec.title}
      subtitle={`${item.member.name} · ${item.label}`}
      fields={spec.fields}
      submitLabel={spec.submit}
      danger={spec.danger}
      confirmText="Confirmez-vous avoir constaté ce paiement ?"
      onClose={onClose}
      onSubmit={async (values) => {
        await post(spec.path, spec.body(values), spec.idempotent ? key : undefined)
        await queryClient.invalidateQueries({ queryKey: ['validations'] })
        await queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] })
      }}
    />
  )
}

function amountLabel(item: QueueItem): string {
  if (item.amount_xof !== null) return formatXof(item.amount_xof)
  if (item.quantity !== null) return formatYem(item.quantity)
  return '—'
}

function Row({ item, actions, onDecide }: { item: QueueItem; actions: Decision[]; onDecide: (decision: Decision) => void }) {
  const badge = STATUS_BADGES[item.status]
  const confirmLabel = item.kind === 'payment' ? 'Valider' : 'Confirmer'
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-4 sm:px-6">
      <div className="min-w-0 flex-1 basis-56">
        <p className="truncate text-sm font-bold text-[var(--color-text)]">{item.member.name}</p>
        <p className="truncate text-xs text-[var(--color-text-muted)]">
          {KIND_LABELS[item.kind]} · {item.label}
        </p>
        <p className="truncate text-xs text-[var(--color-text-muted)]">
          {[item.method ? methodName(item.method) : null, item.declared_reference ? `réf. ${item.declared_reference}` : null, item.member.pernum].filter(Boolean).join(' · ')}
        </p>
      </div>
      <div className="text-right">
        <p className="text-sm font-extrabold text-[var(--color-text)]">{amountLabel(item)}</p>
        <p className="text-xs text-[var(--color-text-muted)]">{formatDateMedium(item.decided_at ?? item.date)}</p>
      </div>
      <StatusBadge label={badge.label} tone={badge.tone} icon={badge.icon} />
      {actions.length > 0 && (
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          {actions.map((decision) => (
            <button
              key={decision}
              type="button"
              onClick={() => onDecide(decision)}
              className={`inline-flex min-h-[40px] items-center rounded-xl px-4 text-xs font-bold ${
                decision === 'approve' || decision === 'confirm' ? 'bg-[var(--color-primary)] text-white' : 'border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--dash-bg)]'
              }`}
            >
              {decision === 'approve' || decision === 'confirm' ? confirmLabel : decision === 'dispute' ? 'Litige' : 'Rejeter'}
            </button>
          ))}
        </div>
      )}
    </li>
  )
}

export default function ValidationsPage() {
  const { can } = useAuth()
  const [view, setView] = useState<'pending' | 'history'>('pending')
  const [target, setTarget] = useState<{ item: QueueItem; decision: Decision } | null>(null)

  const query = useQuery({
    queryKey: ['validations', view],
    queryFn: () => getRaw<QueueResponse>('/validations/queue', { status: view }),
    staleTime: 0,
  })

  function actionsFor(item: QueueItem): Decision[] {
    if (item.status !== 'pending' && item.status !== 'disputed') return []
    if (item.kind === 'payment') return can('payments.validate_manual') ? ['approve', 'reject'] : []
    if (!can('yem_validations.confirm')) return []
    if (item.kind === 'yem_receipt') return can('yem_validations.dispute') ? ['confirm', 'dispute', 'reject'] : ['confirm', 'reject']
    return ['confirm', 'reject']
  }

  const items = query.data?.data ?? []
  const pendingCount = query.data?.meta.pending_count

  return (
    <>
      <Helmet>
        <title>Validations — CECT Admin</title>
      </Helmet>

      <div className="space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-[var(--color-text)]">Validations</h1>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">Paiements reçus hors prestataire, réceptions de YEM sur le Pernum CECT et paiements marchands à arbitrer.</p>
          </div>
          <SegmentedControl
            label="Affichage"
            value={view}
            onChange={setView}
            options={[
              { value: 'pending', label: pendingCount ? `En attente (${pendingCount})` : 'En attente' },
              { value: 'history', label: 'Historique' },
            ]}
          />
        </header>

        <Panel title={view === 'pending' ? 'À traiter' : 'Décisions récentes'} flush>
          {query.isPending && <div className="mx-5 mb-4 h-32 animate-pulse rounded-2xl bg-[var(--chart-track)]" />}
          {query.isError && (
            <p role="alert" className="px-6 pb-4 text-sm">
              Impossible de charger la file.{' '}
              <button type="button" onClick={() => void query.refetch()} className="font-semibold text-[var(--color-primary)] underline">
                Réessayer
              </button>
            </p>
          )}
          {query.data && items.length === 0 && <p className="px-6 pb-5 text-sm text-[var(--color-text-muted)]">{view === 'pending' ? 'Rien à traiter pour le moment.' : 'Aucune décision récente.'}</p>}
          <ul className="divide-y divide-[var(--color-border)]">
            {items.map((item) => (
              <Row key={`${item.kind}-${item.id}`} item={item} actions={view === 'pending' ? actionsFor(item) : []} onDecide={(decision) => setTarget({ item, decision })} />
            ))}
          </ul>
        </Panel>
      </div>

      {target && <DecisionDialog item={target.item} decision={target.decision} onClose={() => setTarget(null)} />}
    </>
  )
}
