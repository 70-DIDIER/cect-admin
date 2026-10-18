import { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Building2, ChevronLeft, ChevronRight, Search, User, UserPlus, UserX } from 'lucide-react'
import { useAuth } from '@/app/AuthContext'
import { Avatar } from '@/components/dashboard/Avatar'
import { Panel } from '@/components/dashboard/Panel'
import { SegmentedControl } from '@/components/dashboard/SegmentedControl'
import { StatusBadge } from '@/components/dashboard/StatusBadge'
import type { Tone } from '@/components/dashboard/tones'
import { FormDialog } from '@/components/ui/FormDialog'
import { get, getRaw, post, newIdempotencyKey } from '@/lib/api'
import { formatDateMedium, formatXof, formatYem } from '@/lib/format'
import { methodName } from '@/features/payments/types'

interface Member {
  id: string
  person_type: 'natural' | 'legal' | null
  member_number: string | null
  first_name: string
  last_name: string
  email: string
  phone: string | null
  status: string
  pernum: string | null
  membership_status: string | null
  active_families: string[]
  yem_balance: string
  organization?: { legal_name: string } | null
  created_at: string | null
}

interface MemberList {
  data: Member[]
  meta: { current_page: number; last_page: number; total: number }
}

interface MemberOverview {
  member: Omit<Member, 'yem_balance' | 'membership_status' | 'active_families'>
  packs: { id: string; family: string; status: string; plan: { code: string; name: string }; price_xof: number; balance: { available: string } | null }[]
  payments: { id: string; reference: string; method: string | null; status: string; amount: number; created_at: string }[]
  exchanges: { id: string; reference: string; status: string; quantity_requested: string; created_at: string }[]
  merchant_payments: { id: string; reference: string; status: string; quantity: string; created_at: string }[]
  audit_events: { id: string; action: string; result: string; occurred_at: string }[]
}

const ACCOUNT_STATUS: Record<string, { label: string; tone: Tone }> = {
  active: { label: 'Actif', tone: 'success' },
  pending_email_verification: { label: 'E-mail à vérifier', tone: 'warning' },
  pending_payment: { label: 'Adhésion à payer', tone: 'warning' },
  suspended: { label: 'Suspendu', tone: 'danger' },
  closed: { label: 'Clos', tone: 'neutral' },
}

const STATUS_FILTERS = [
  { value: '', label: 'Tous' },
  { value: 'active', label: 'Actifs' },
  { value: 'pending_payment', label: 'À payer' },
  { value: 'suspended', label: 'Suspendus' },
]

const OPERATION_STATUS: Record<string, string> = {
  created: 'Créé',
  pending: 'En attente',
  approved: 'Validé',
  declined: 'Refusé',
  canceled: 'Annulé',
  expired: 'Expiré',
  failed: 'Échec',
  awaiting_transfer: 'Envoi à effectuer',
  declared_sent: 'Envoi déclaré',
  yem_received: 'YEM reçus',
  completed: 'Terminé',
  rejected: 'Rejeté',
  disputed: 'Litige',
  reserved: 'Réservé',
  confirmed: 'Confirmé',
}

const AUDIT_LABELS: Record<string, string> = {
  'members.registered': 'Inscription',
  'members.email_verified': 'E-mail vérifié',
  'members.suspended': 'Compte suspendu',
  'members.reactivated': 'Compte réactivé',
}

const statusText = (status: string) => OPERATION_STATUS[status] ?? status

const FAMILY_LABELS: Record<string, string> = { VENDEUR: 'Vendeur', CONSOMMATEUR: 'Consommateur', PERSONNEL: 'Personnel', MARCHAND: 'Marchand' }

function displayName(member: Pick<Member, 'first_name' | 'last_name' | 'organization'>): string {
  return member.organization?.legal_name ?? `${member.first_name} ${member.last_name}`.trim()
}

function StatusPill({ status }: { status: string }) {
  const meta = ACCOUNT_STATUS[status] ?? { label: status, tone: 'neutral' as Tone }
  return <StatusBadge label={meta.label} tone={meta.tone} />
}

function MemberDialog({ memberId, onClose }: { memberId: string; onClose: () => void }) {
  const queryClient = useQueryClient()
  const { can } = useAuth()
  const [confirming, setConfirming] = useState<'suspend' | 'reactivate' | 'close' | null>(null)
  const query = useQuery({ queryKey: ['member-overview', memberId], queryFn: () => get<MemberOverview>(`/admin/members/${memberId}/overview`), staleTime: 0 })
  const data = query.data
  const member = data?.member

  if (confirming && member) {
    const suspend = confirming === 'suspend'
    const closing = confirming === 'close'
    return (
      <FormDialog
        title={closing ? 'Clore l’adhésion' : suspend ? 'Suspendre le compte' : 'Réactiver le compte'}
        subtitle={displayName(member)}
        fields={[{ name: 'reason', label: 'Motif de la décision (obligatoire)', type: 'textarea', required: true }]}
        submitLabel={closing ? 'Clore définitivement l’accès' : suspend ? 'Suspendre' : 'Réactiver'}
        danger={suspend || closing}
        confirmText={closing ? 'Le compte sera clos et retiré des comptes actifs. Les paiements et YEM resteront conservés dans les journaux pour la traçabilité.' : suspend ? 'Le membre ne pourra plus se connecter ni effectuer d’opération.' : 'Le membre retrouvera l’accès à son espace.'}
        onClose={() => setConfirming(null)}
        onSubmit={async values => {
          await post(`/admin/members/${member.id}/${confirming}`, { reason: values.reason })
          await queryClient.invalidateQueries({ queryKey: ['member-overview', memberId] })
          await queryClient.invalidateQueries({ queryKey: ['members'] })
        }}
      />
    )
  }

  return (
    <FormDialog title={member ? displayName(member) : 'Membre'} subtitle={member ? `${member.pernum ?? ''} · ${member.email}` : undefined} fields={[]} submitLabel="Fermer" onClose={onClose} onSubmit={async () => undefined}>
      {query.isPending && <div className="h-32 animate-pulse rounded-2xl bg-[var(--chart-track)]" />}
      {query.isError && <p role="alert" className="text-sm text-[var(--color-danger)]">Impossible de charger la fiche.</p>}
      {data && member && (
        <div className="space-y-5 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill status={member.status} />
            <span className="text-[var(--color-text-muted)]">{member.person_type === 'legal' ? 'Personne morale' : 'Personne physique'}</span>
          </div>

          <Section title="Packs">
            {data.packs.length === 0 ? <Empty /> : data.packs.map((pack) => <Line key={pack.id} left={pack.plan.name} right={`${pack.status === 'active' ? 'Actif' : pack.status} · ${pack.balance ? formatYem(pack.balance.available) : formatXof(pack.price_xof)}`} />)}
          </Section>
          <Section title="Paiements">
            {data.payments.length === 0 ? <Empty /> : data.payments.slice(0, 5).map((payment) => <Line key={payment.id} left={`${payment.reference} · ${methodName(payment.method)}`} right={`${formatXof(payment.amount)} · ${statusText(payment.status)}`} />)}
          </Section>
          <Section title="Ventes de YEM">
            {data.exchanges.length === 0 ? <Empty /> : data.exchanges.slice(0, 5).map((exchange) => <Line key={exchange.id} left={exchange.reference} right={`${formatYem(exchange.quantity_requested)} · ${statusText(exchange.status)}`} />)}
          </Section>
          <Section title="Paiements marchands">
            {data.merchant_payments.length === 0 ? <Empty /> : data.merchant_payments.slice(0, 5).map((payment) => <Line key={payment.id} left={payment.reference} right={`${formatYem(payment.quantity)} · ${statusText(payment.status)}`} />)}
          </Section>
          <Section title="Journal">
            {data.audit_events.length === 0 ? <Empty /> : data.audit_events.slice(0, 5).map((event) => <Line key={event.id} left={AUDIT_LABELS[event.action] ?? event.action} right={formatDateMedium(event.occurred_at)} />)}
          </Section>

          {can('members.manage') && (member.status === 'active' || member.status === 'suspended') && (
            <button
              type="button"
              onClick={() => setConfirming(member.status === 'active' ? 'suspend' : 'reactivate')}
              className={`inline-flex min-h-[40px] items-center rounded-xl px-4 text-xs font-bold ${member.status === 'active' ? 'border border-[var(--color-danger)]/40 text-[var(--color-danger)]' : 'bg-[var(--color-primary)] text-white'}`}
            >
              {member.status === 'active' ? 'Suspendre le compte' : 'Réactiver le compte'}
            </button>
          )}
          {can('members.manage') && member.status !== 'closed' && (
            <button type="button" onClick={() => setConfirming('close')}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-[var(--color-danger)]/40 px-4 text-xs font-bold text-[var(--color-danger)]">
              <UserX size={15}/> Clore / retirer l’adhésion
            </button>
          )}
        </div>
      )}
    </FormDialog>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-[var(--color-text-muted)]">{title}</p>
      <ul className="divide-y divide-[var(--color-border)] rounded-xl border border-[var(--color-border)]">{children}</ul>
    </div>
  )
}

function Line({ left, right }: { left: string; right: string }) {
  return (
    <li className="flex items-center justify-between gap-3 px-3 py-2">
      <span className="min-w-0 truncate font-semibold text-[var(--color-text)]">{left}</span>
      <span className="shrink-0 text-xs text-[var(--color-text-muted)]">{right}</span>
    </li>
  )
}

function Empty() {
  return <li className="px-3 py-2 text-[var(--color-text-muted)]">Aucun élément.</li>
}

export default function MembresPage() {
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [openId, setOpenId] = useState<string | null>(null)
  const [inviting, setInviting] = useState(false)
  const { can } = useAuth()
  const queryClient = useQueryClient()

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(search.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  const query = useQuery({
    queryKey: ['members', debounced, status, page],
    queryFn: () => getRaw<MemberList>('/admin/members', { page, per_page: 20, ...(debounced ? { search: debounced } : {}), ...(status ? { status } : {}) }),
    staleTime: 0,
    placeholderData: (previous) => previous,
  })

  const members = query.data?.data ?? []
  const meta = query.data?.meta

  return (
    <>
      <Helmet>
        <title>Membres — CECT Admin</title>
      </Helmet>

      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-extrabold tracking-tight text-[var(--color-text)]">Membres</h1>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">{meta ? `${meta.total} membre(s)` : 'Recherche par nom, e-mail, numéro de membre, Pernum ou raison sociale.'}</p>
          {can('members.manage') && <button type="button" onClick={() => setInviting(true)}
            className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[var(--color-primary)] px-4 text-sm font-bold text-white">
            <UserPlus size={18}/> Nouvelle adhésion
          </button>}
        </header>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-0 flex-1 basis-64">
            <Search size={16} aria-hidden className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Nom, e-mail, Pernum…"
              aria-label="Rechercher un membre"
              className="min-h-[44px] w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            />
          </div>
          <SegmentedControl
            label="Statut du compte"
            value={status}
            onChange={(value) => {
              setStatus(value)
              setPage(1)
            }}
            options={STATUS_FILTERS}
          />
        </div>

        <Panel title="Liste des membres" flush>
          {query.isPending && <div className="mx-5 mb-4 h-32 animate-pulse rounded-2xl bg-[var(--chart-track)]" />}
          {query.isError && (
            <p role="alert" className="px-6 pb-4 text-sm">
              Impossible de charger les membres.{' '}
              <button type="button" onClick={() => void query.refetch()} className="font-semibold text-[var(--color-primary)] underline">
                Réessayer
              </button>
            </p>
          )}
          {query.data && members.length === 0 && <p className="px-6 pb-5 text-sm text-[var(--color-text-muted)]">Aucun membre ne correspond.</p>}
          <ul className="divide-y divide-[var(--color-border)]">
            {members.map((member) => {
              const name = displayName(member)
              const Icon = member.person_type === 'legal' ? Building2 : User
              return (
                <li key={member.id}>
                  <button type="button" onClick={() => setOpenId(member.id)} className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5 text-left transition-colors hover:bg-[var(--dash-bg)] sm:px-6">
                    <Avatar name={name} />
                    <span className="min-w-0 flex-1 basis-48">
                      <span className="flex items-center gap-1.5 truncate text-sm font-bold text-[var(--color-text)]">
                        <Icon size={13} aria-hidden className="shrink-0 text-[var(--color-text-muted)]" />
                        {name}
                      </span>
                      <span className="block truncate text-xs text-[var(--color-text-muted)]">{[member.pernum, member.email, member.phone].filter(Boolean).join(' · ')}</span>
                    </span>
                    <span className="hidden flex-wrap gap-1 md:flex">
                      {member.active_families.map((family) => (
                        <span key={family} className="rounded-full bg-[var(--color-primary)]/10 px-2 py-0.5 text-[11px] font-bold text-[var(--color-primary)]">
                          {FAMILY_LABELS[family] ?? family}
                        </span>
                      ))}
                    </span>
                    <span className="w-24 text-right text-sm font-bold text-[var(--color-text)]">{formatYem(member.yem_balance)}</span>
                    <StatusPill status={member.status} />
                  </button>
                </li>
              )
            })}
          </ul>

          {meta && meta.last_page > 1 && (
            <nav aria-label="Pagination" className="flex items-center justify-between gap-3 border-t border-[var(--color-border)] px-5 py-3 sm:px-6">
              <button type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)} className="inline-flex min-h-[40px] items-center gap-1 rounded-xl border border-[var(--color-border)] px-3 text-sm font-semibold disabled:opacity-40">
                <ChevronLeft size={15} aria-hidden /> Précédent
              </button>
              <span className="text-sm text-[var(--color-text-muted)]">
                Page {meta.current_page} sur {meta.last_page}
              </span>
              <button type="button" disabled={page >= meta.last_page} onClick={() => setPage((current) => current + 1)} className="inline-flex min-h-[40px] items-center gap-1 rounded-xl border border-[var(--color-border)] px-3 text-sm font-semibold disabled:opacity-40">
                Suivant <ChevronRight size={15} aria-hidden />
              </button>
            </nav>
          )}
        </Panel>
      </div>

      {inviting && (
        <FormDialog title="Inviter un nouvel adhérent" subtitle="Un e-mail contenant le formulaire est envoyé au candidat. Le candidat complète lui-même ses informations, choisit son mot de passe et accepte les statuts. Aucun paiement n’est simulé à cette étape."
          submitLabel="Envoyer l’invitation" onClose={() => setInviting(false)}
          fields={[
            { name: 'person_type', label: 'Type d’adhérent', type: 'select', options: [{ value: 'natural', label: 'Personne physique' }, { value: 'legal', label: 'Personne morale' }] },
            { name: 'first_name', label: 'Prénom', required: true },
            { name: 'last_name', label: 'Nom', required: true },
            { name: 'email', label: 'E-mail du futur adhérent', required: true },
          ]}
          onSubmit={async values => {
            await post('/admin/members/invitations', values, newIdempotencyKey())
            await queryClient.invalidateQueries({ queryKey: ['members'] })
          }}
        />
      )}
      {openId && <MemberDialog memberId={openId} onClose={() => setOpenId(null)} />}
    </>
  )
}
