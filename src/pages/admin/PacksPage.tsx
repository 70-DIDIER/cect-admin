import { useMemo, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Archive, BadgePercent, CircleCheck, CirclePause, Copy, FileClock, FilePlus2,
  Layers3, Pencil, Plus, Search, ShieldCheck, SlidersHorizontal, X,
} from 'lucide-react'
import { useAuth } from '@/app/AuthContext'
import { Panel } from '@/components/dashboard/Panel'
import { StatusBadge } from '@/components/dashboard/StatusBadge'
import type { Tone } from '@/components/dashboard/tones'
import { EmptyState } from '@/components/ui/EmptyState'
import { FormDialog, type FormField } from '@/components/ui/FormDialog'
import { get, getRaw, newIdempotencyKey, post, put } from '@/lib/api'
import { formatXof, formatYem } from '@/lib/format'
import { ErrorLine, FIELD, GhostButton, LoadingBlock, PageIntro } from './shared'

type Family = 'VENDEUR' | 'CONSOMMATEUR' | 'PERSONNEL' | 'MARCHAND'
type Status = 'draft' | 'published' | 'suspended' | 'retired' | 'archived'
type PersonEligibility = 'natural' | 'legal'
interface Version {
  id: string
  version: number
  price_xof: number
  period: { unit: string; every: number; cycles: number } | null
  quota_per_period: string | null
  total_quota: string | null
  cumulative: boolean | null
  end_of_term: string | null
  min_operation: string | null
  max_operation: string | null
  eligible_person_types: PersonEligibility[]
  rules: Record<string, unknown>
  reason?: string
  published_at: string | null
  created_at: string
}
interface Plan {
  id: string
  family: Family
  code: string
  name: string
  level: number | null
  description: string | null
  status: Status
  current_version: Version | null
  versions?: Version[]
}
interface Setting { key: string; current_value: number; edit_level: string }
const FAMILIES: Record<Family, { label: string; tone: Tone; hint: string }> = {
  VENDEUR: { label: 'Vendeur', tone: 'gold', hint: 'Cession de YEM à la CECT · quotas mensuels' },
  CONSOMMATEUR: { label: 'Consommateur', tone: 'primary', hint: 'Achats YEM et consommation chez les marchands' },
  PERSONNEL: { label: 'Personnel', tone: 'info', hint: 'Solde rechargeable sans quota ni durée imposés' },
  MARCHAND: { label: 'Marchand', tone: 'violet', hint: 'Encaissement et rééchange YEM · personne morale' },
}
const STATES: Record<Status, { label: string; tone: Tone }> = {
  draft: { label: 'Brouillon', tone: 'neutral' },
  published: { label: 'Publié', tone: 'success' },
  suspended: { label: 'Suspendu', tone: 'warning' },
  retired: { label: 'Retiré', tone: 'neutral' },
  archived: { label: 'Archivé', tone: 'neutral' },
}
const PERIODS = [
  { value: 'month', label: 'Mensuelle' },
  { value: 'week', label: 'Hebdomadaire' },
  { value: 'day', label: 'Quotidienne' },
]
const END_TERM = [
  { value: 'expire', label: 'Expiration du quota restant' },
  { value: 'keep', label: 'Conservation du quota restant' },
]
const FEES = [
  { key: 'membership.fee.natural_person', label: 'Adhésion personne physique', short: 'PF' },
  { key: 'membership.fee.legal_person', label: 'Adhésion personne morale', short: 'PM' },
] as const

function amount(value?: string | null): string {
  return value == null ? 'À définir' : formatYem(value)
}
function versionFields(plan: Plan, base: Version | null): FormField[] {
  const fields: FormField[] = [
    { name: 'price_xof', label: 'Prix du pack / droit d’accès (FCFA)', type: 'number', required: true, initial: String(base?.price_xof ?? 0) },
    {
      name: 'eligible', label: 'Personnes autorisées à souscrire', type: 'select', required: true,
      initial: plan.family === 'MARCHAND' ? 'legal' : (base?.eligible_person_types?.length === 1 ? base.eligible_person_types[0] : 'both'),
      options: plan.family === 'MARCHAND'
        ? [{ value: 'legal', label: 'Personnes morales uniquement' }]
        : [
            { value: 'both', label: 'Personnes physiques et morales' },
            { value: 'natural', label: 'Personnes physiques uniquement' },
            { value: 'legal', label: 'Personnes morales uniquement' },
          ],
    },
    { name: 'min_operation', label: 'Montant minimum d’une opération (YEM, facultatif)', initial: base?.min_operation ?? '' },
    { name: 'max_operation', label: 'Montant maximum d’une opération (YEM, facultatif)', initial: base?.max_operation ?? '' },
  ]
  if (plan.family !== 'PERSONNEL') {
    fields.push(
      { name: 'unit', label: 'Périodicité des quotas', type: 'select', options: PERIODS, initial: base?.period?.unit ?? 'month' },
      { name: 'every', label: 'Fréquence (nombre d’unités)', type: 'number', required: true, initial: String(base?.period?.every ?? 1) },
      { name: 'cycles', label: 'Nombre de cycles du pack', type: 'number', required: true, initial: String(base?.period?.cycles ?? 12) },
      { name: 'quota_per_period', label: 'YEM autorisés par cycle (facultatif si calcul automatique Consommateur)', required: plan.family !== 'CONSOMMATEUR', initial: base?.quota_per_period ?? '' },
      { name: 'cumulative', label: 'Cumuler les quotas non utilisés', type: 'select', options: [{ value: 'true', label: 'Oui' }, { value: 'false', label: 'Non' }], initial: String(base?.cumulative ?? (plan.family === 'VENDEUR')) },
      { name: 'end_of_term', label: 'Règle en fin de pack', type: 'select', options: END_TERM, initial: base?.end_of_term ?? 'expire' },
      { name: 'first_credit_delay_periods', label: 'Délai du premier crédit (nombre de cycles)', type: 'number', initial: String(base?.rules?.first_credit_delay_periods ?? 0) },
    )
    if (plan.family === 'CONSOMMATEUR') {
      fields.push({
        name: 'reference_value_xof',
        label: 'Valeur de référence consommateur (FCFA, facultatif)',
        type: 'number',
        initial: String(base?.rules?.reference_value_xof ?? ''),
      })
    }
  } else {
    fields.push({
      name: 'min_topup_xof', label: 'Rechargement minimum (FCFA)', type: 'number',
      initial: String(base?.rules?.min_topup_xof ?? 5000),
    })
  }
  fields.push(
    { name: 'reason', label: 'Motif de cette nouvelle version', type: 'textarea', required: true },
    { name: 'publish', label: 'Mise en ligne', type: 'select', options: [
      { value: 'no', label: 'Enregistrer comme brouillon' },
      { value: 'yes', label: 'Publier pour les prochains souscripteurs' },
    ] },
  )
  return fields
}
function versionPayload(plan: Plan, values: Record<string, string>, base: Version | null): Record<string, unknown> {
  const price = Number(values.price_xof)
  if (!Number.isSafeInteger(price) || price < 0) throw new Error('Le prix doit être un montant entier positif ou nul.')
  const eligibilities = values.eligible === 'both' ? ['natural', 'legal'] : [values.eligible]
  const payload: Record<string, unknown> = {
    price_xof: price,
    eligible_person_types: plan.family === 'MARCHAND' ? ['legal'] : eligibilities,
    reason: values.reason,
    min_operation: values.min_operation?.trim() || null,
    max_operation: values.max_operation?.trim() || null,
  }
  const rules: Record<string, unknown> = { ...(base?.rules ?? {}) }
  if (plan.family !== 'PERSONNEL') {
    payload.period = { unit: values.unit, every: Number(values.every), cycles: Number(values.cycles) }
    payload.cumulative = values.cumulative === 'true'
    payload.end_of_term = values.end_of_term
    rules.first_credit_delay_periods = Number(values.first_credit_delay_periods || 0)
    if (plan.family === 'CONSOMMATEUR') {
      const reference = values.reference_value_xof?.trim()
      if (reference) {
        rules.reference_value_xof = Number(reference)
        rules.rate_setting_key = 'rates.sale_xof_per_yem'
        // The backend derives the quota and freezes the sale rate when the
        // reference changes; don't reuse the previous version's old quota.
        if (reference !== String(base?.rules?.reference_value_xof ?? '')) {
          // A reference-based pack is bought at the full reference amount.
          payload.price_xof = Number(reference)
          delete payload.quota_per_period
        } else {
          payload.quota_per_period = values.quota_per_period
        }
      } else {
        delete rules.reference_value_xof
        delete rules.rate_xof_per_yem
        payload.quota_per_period = values.quota_per_period
      }
    } else {
      payload.quota_per_period = values.quota_per_period
    }
  } else {
    rules.min_topup_xof = Number(values.min_topup_xof)
    rules.rate_setting_key = 'rates.sale_xof_per_yem'
  }
  payload.rules = rules
  return payload
}
function VersionHistory({ plan, close, changed, manage }: { plan: Plan; close: () => void; changed: () => Promise<unknown>; manage: boolean }) {
  const query = useQuery({ queryKey: ['plan', plan.id], queryFn: () => get<Plan>('/admin/packs/plans/' + plan.id) })
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')
  const versions = query.data?.versions ?? []
  async function perform(version: Version, action: 'publish' | 'discard') {
    setBusy(version.id)
    setError('')
    try {
      if (action === 'publish') {
        await post('/admin/packs/plans/' + plan.id + '/versions/' + version.id + '/publish')
        if (plan.status === 'draft') {
          await post('/admin/packs/plans/' + plan.id + '/transition', { to: 'published', reason: 'Publication de la version ' + version.version + ' après validation des conditions.' })
        }
      } else {
        const { http } = await import('@/lib/api')
        await http.delete('/admin/packs/plans/' + plan.id + '/versions/' + version.id)
      }
      await changed()
      await query.refetch()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Opération impossible.')
    } finally {
      setBusy(null)
    }
  }
  return (
    <div role="dialog" aria-modal="true" aria-label={'Historique de ' + plan.code} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={close}>
      <section className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-[var(--color-border)] bg-[var(--dash-card)] p-6" onClick={event => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div><h2 className="text-lg font-extrabold">{plan.name} · {plan.code}</h2><p className="text-xs text-[var(--color-text-muted)]">Versions et conditions commerciales conservées sans modification rétroactive.</p></div>
          <button aria-label="Fermer" onClick={close} className="rounded-xl border border-[var(--color-border)] p-2"><X size={18}/></button>
        </div>
        {query.isPending && <LoadingBlock />}
        {query.isError && <ErrorLine message="Impossible de consulter l’historique." />}
        {error && <p role="alert" className="mt-4 text-sm text-[var(--color-danger)]">{error}</p>}
        <div className="mt-4 space-y-3">
          {versions.length === 0 && query.isSuccess && <p className="text-sm text-[var(--color-text-muted)]">Aucune version créée. Ce pack n'est pas souscriptible.</p>}
          {versions.map(version => (
            <div key={version.id} className="rounded-2xl border border-[var(--color-border)] p-4">
              <div className="flex items-center justify-between gap-2">
                <strong>Version {version.version} · {formatXof(version.price_xof)}</strong>
                <StatusBadge label={version.published_at ? 'Publiée' : 'Brouillon'} tone={version.published_at ? 'success' : 'neutral'}/>
              </div>
              <div className="mt-2 grid gap-2 text-xs sm:grid-cols-2">
                <p>Quota : {amount(version.quota_per_period)} {version.period?.unit === 'month' ? '/mois' : '/cycle'}</p>
                <p>Durée : {version.period ? version.period.cycles + ' cycles' : 'Sans durée imposée'}</p>
                <p>Éligibilité : {(version.eligible_person_types ?? []).map(t => t === 'natural' ? 'PF' : 'PM').join(' / ')}</p>
                <p>Cumul : {version.cumulative == null ? 'Sans objet' : version.cumulative ? 'Oui' : 'Non'}</p>
                <p>Min / max : {version.min_operation ?? '—'} / {version.max_operation ?? '—'} YEM</p>
                <p>Création : {new Date(version.created_at).toLocaleString('fr-FR')}</p>
              </div>
              {version.reason && <p className="mt-2 text-xs text-[var(--color-text-muted)]">Motif : {version.reason}</p>}
              {!version.published_at && manage && plan.status !== 'archived' && plan.status !== 'retired' && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <GhostButton onClick={() => void perform(version, 'publish')} disabled={busy !== null}><CircleCheck size={14}/> Publier</GhostButton>
                  <GhostButton onClick={() => void perform(version, 'discard')} disabled={busy !== null}><Archive size={14}/> Supprimer le brouillon</GhostButton>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function MembershipFees({ superadmin }: { superadmin: boolean }) {
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: ['pack-admin-fees'], queryFn: () => get<Setting[]>('/admin/settings', { group: 'membership' }), staleTime: 0 })
  const [editing, setEditing] = useState<(typeof FEES)[number] | null>(null)
  const settings = query.data ?? []
  return (
    <section className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-extrabold"><ShieldCheck className="text-[var(--color-primary)]" size={20}/> Frais d’adhésion de la coopérative</h2>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">Fixés par le SuperAdmin, répercutés depuis l’API sur l’inscription PF/PM. Les anciens paiements ne changent pas.</p>
        </div>
        <Link to="/admin/configuration?group=membership&search=membership.fee." className="text-sm font-bold text-[var(--color-primary)]">Historique et configuration ↗</Link>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {FEES.map(fee => {
          const setting = settings.find(item => item.key === fee.key)
          return (
            <div key={fee.key} className="rounded-2xl bg-[var(--dash-bg)] p-4">
              <p className="text-xs text-[var(--color-text-muted)]">{fee.label}</p>
              <p className="mt-1 text-xl font-extrabold">{setting ? formatXof(setting.current_value) : query.isPending ? 'Chargement…' : 'Indisponible'}</p>
              {superadmin && setting && <button onClick={() => setEditing(fee)} className="mt-2 rounded-xl border border-[var(--color-border)] px-3 py-2 text-xs font-bold hover:border-[var(--color-primary)]">Modifier le tarif {fee.short}</button>}
            </div>
          )
        })}
      </div>
      {query.isError && <ErrorLine message="Impossible de charger les frais d’adhésion." />}
      {editing && (
        <FormDialog
          title={'Modifier les frais ' + editing.short}
          subtitle="Seul le SuperAdmin peut créer une nouvelle valeur historisée."
          submitLabel="Enregistrer le tarif"
          fields={[
            { name: 'value', label: 'Nouveau tarif (FCFA)', type: 'number', required: true, initial: String(settings.find(item => item.key === editing.key)?.current_value ?? 0) },
            { name: 'reason', label: 'Motif de modification (obligatoire)', type: 'textarea', required: true },
            { name: 'effective_from', label: 'Entrée en vigueur (facultatif)', type: 'date' },
          ]}
          onClose={() => setEditing(null)}
          onSubmit={async values => {
            const next = Number(values.value)
            if (!Number.isSafeInteger(next) || next < 0) throw new Error('Le tarif doit être un entier positif ou nul.')
            await put('/admin/settings/' + editing.key, {
              value: next,
              reason: values.reason,
              effective_from: values.effective_from ? new Date(values.effective_from + 'T00:00:00').toISOString() : null,
            }, newIdempotencyKey())
            await queryClient.invalidateQueries({ queryKey: ['pack-admin-fees'] })
            await queryClient.invalidateQueries({ queryKey: ['settings'] })
          }}
        />
      )}
    </section>
  )
}

export default function PacksPage() {
  const { can, user } = useAuth()
  const queryClient = useQueryClient()
  const [family, setFamily] = useState('')
  const [search, setSearch] = useState('')
  const [target, setTarget] = useState<{ plan: Plan; to: Status } | null>(null)
  const [versionTarget, setVersionTarget] = useState<Plan | null>(null)
  const [details, setDetails] = useState<Plan | null>(null)
  const [creating, setCreating] = useState(false)
  const [duplicating, setDuplicating] = useState<Plan | null>(null)
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null)
  const mayManage = can('packs.manage')
  const superadmin = user?.role === 'superadmin' && can('settings.update_critical')
  const query = useQuery({
    queryKey: ['admin-plans', family],
    queryFn: () => getRaw<{ data: Plan[] }>('/admin/packs/plans', { per_page: 100, ...(family ? { family } : {}) }),
    staleTime: 0,
  })
  const plans = query.data?.data ?? []
  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return plans.filter(plan => !needle || [plan.name, plan.code, plan.description ?? ''].some(v => v.toLowerCase().includes(needle)))
  }, [plans, search])
  const counts = useMemo(() => ({
    total: plans.length,
    published: plans.filter(plan => plan.status === 'published').length,
    drafts: plans.filter(plan => plan.status === 'draft' || !plan.current_version).length,
  }), [plans])
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin-plans'] })

  return (
    <>
      <Helmet><title>Gestion des packs — CECT Admin</title></Helmet>
      <div className="space-y-6">
        <PageIntro title="Administration des packs"
          description="Paramétrez chacune des formules Vendeur, Consommateur, Personnel et Marchand. Les versions publiées sont immuables ; les détenteurs existants conservent les conditions achetées."
          actions={mayManage && (
            <button onClick={() => setCreating(true)} className="flex min-h-[44px] items-center gap-2 rounded-xl bg-[var(--color-primary)] px-4 text-sm font-bold text-white">
              <Plus size={17}/> Créer une formule
            </button>
          )}
        />
        {superadmin && <MembershipFees superadmin={superadmin} />}
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { label: 'Formules du catalogue', value: counts.total },
            { label: 'Formules publiées', value: counts.published },
            { label: 'À paramétrer / brouillons', value: counts.drafts },
          ].map(stat => (
            <div key={stat.label} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
              <span className="text-xs text-[var(--color-text-muted)]">{stat.label}</span>
              <p className="mt-1 text-2xl font-extrabold">{query.isPending ? '…' : stat.value}</p>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="relative min-w-0 flex-1 basis-56">
            <Search size={16} className="absolute left-3 top-3 text-[var(--color-text-muted)]"/>
            <span className="sr-only">Rechercher un pack</span>
            <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Rechercher une formule ou un code" className={FIELD + ' w-full pl-10'}/>
          </label>
          <label className="flex items-center gap-2">
            <SlidersHorizontal size={16}/>
            <span className="sr-only">Filtrer par famille</span>
            <select aria-label="Famille" value={family} onChange={event => setFamily(event.target.value)} className={FIELD}>
              <option value="">Toutes les familles</option>
              {Object.entries(FAMILIES).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}
            </select>
          </label>
        </div>
        {query.isPending && <LoadingBlock />}
        {query.isError && <ErrorLine message="Impossible de charger les packs." />}
        {query.isSuccess && visible.length === 0 && <EmptyState title="Aucune formule" description="Aucun résultat pour le filtre sélectionné." />}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map(plan => {
            const v = plan.current_version
            const familyMeta = FAMILIES[plan.family]
            return (
              <Panel key={plan.id} title={plan.name} subtitle={plan.code + ' · ' + familyMeta.label + (plan.level !== null ? ' · Niveau ' + plan.level : '')}
                action={<StatusBadge label={STATES[plan.status].label} tone={STATES[plan.status].tone}/>}>
                <p className="mb-3 text-xs text-[var(--color-text-muted)]">{familyMeta.hint}</p>
                <dl className="space-y-2 text-sm">
                  <Row label="Prix" value={v ? formatXof(v.price_xof) : 'À configurer'}/>
                  <Row label="Version en vigueur" value={v ? 'v' + v.version : 'Aucune version publiée'}/>
                  <Row label="Quota par cycle" value={plan.family === 'PERSONNEL' ? 'Recharge libre' : amount(v?.quota_per_period)}/>
                  <Row label="Quota total" value={plan.family === 'PERSONNEL' ? 'Selon le solde' : amount(v?.total_quota)}/>
                  <Row label="Cycles" value={v?.period ? v.period.cycles + ' × ' + v.period.every + ' ' + v.period.unit : 'À définir'}/>
                  <Row label="Cumul" value={v?.cumulative == null ? '—' : v.cumulative ? 'Oui' : 'Non'}/>
                  <Row label="Admissibilité" value={v?.eligible_person_types?.map(t => t === 'natural' ? 'PF' : 'PM').join(' / ') ?? (plan.family === 'MARCHAND' ? 'PM' : 'À définir')}/>
                </dl>
                {plan.description && <p className="mt-3 line-clamp-2 text-xs text-[var(--color-text-muted)]">{plan.description}</p>}
                {!v && <p className="mt-3 rounded-lg border border-amber-500/30 p-2 text-xs">Formule sans version publiée : non souscriptible.</p>}
                <div className="mt-4 flex flex-wrap gap-2">
                  <GhostButton onClick={() => setDetails(plan)}><FileClock size={14}/> Versions</GhostButton>
                  {mayManage && !['archived', 'retired'].includes(plan.status) && (
                    <GhostButton onClick={() => setVersionTarget(plan)}><FilePlus2 size={14}/> Paramétrer</GhostButton>
                  )}
                  {mayManage && plan.status !== 'archived' && (
                    <GhostButton onClick={() => setEditingPlan(plan)}><Pencil size={14}/> Modifier la fiche</GhostButton>
                  )}
                  {mayManage && (
                    <GhostButton onClick={() => setDuplicating(plan)}><Copy size={14}/> Dupliquer</GhostButton>
                  )}
                  {mayManage && plan.status === 'published' && <GhostButton onClick={() => setTarget({ plan, to: 'suspended' })}><CirclePause size={14}/> Suspendre</GhostButton>}
                  {mayManage && plan.status === 'suspended' && <GhostButton onClick={() => setTarget({ plan, to: 'published' })}><CircleCheck size={14}/> Réactiver</GhostButton>}
                  {mayManage && plan.status === 'published' && <GhostButton onClick={() => setTarget({ plan, to: 'retired' })}><Archive size={14}/> Retirer</GhostButton>}
                  {mayManage && ['draft', 'retired'].includes(plan.status) && <GhostButton onClick={() => setTarget({ plan, to: 'archived' })}><Archive size={14}/> Archiver</GhostButton>}
                </div>
              </Panel>
            )
          })}
        </div>
        <div className="rounded-2xl border border-[var(--color-border)] p-4 text-sm">
          <p className="flex items-center gap-2 font-bold"><Layers3 size={18}/> Règles de souscription</p>
          <p className="mt-1 text-[var(--color-text-muted)]">Deux packs structurés actifs au maximum par défaut ; le pack Personnel est exclu de cette limite. Ces règles sont modifiables dans Configuration. Le cashback YEM se configure séparément dans « Cashback & pays ». Aucun tarif historique n’est écrasé.</p>
          <div className="mt-3 flex flex-wrap gap-3 text-xs font-semibold">
            <Link to="/admin/configuration?group=packs" className="text-[var(--color-primary)]">Règles et limite des packs ↗</Link>
            <Link to="/admin/cashback" className="flex items-center gap-1 text-[var(--color-primary)]"><BadgePercent size={14}/> Cashback ↗</Link>
          </div>
        </div>
      </div>
      {creating && (
        <FormDialog title="Créer une formule" subtitle="La formule sera créée en brouillon. Configurez ensuite ses conditions et publiez-les après vérification."
          submitLabel="Créer le pack" onClose={() => setCreating(false)}
          fields={[
            { name: 'family', label: 'Famille', type: 'select', options: Object.entries(FAMILIES).map(([value, item]) => ({ value, label: item.label })) },
            { name: 'code', label: 'Code unique (ex. V13)', required: true },
            { name: 'name', label: 'Nom commercial', required: true },
            { name: 'level', label: 'Niveau (facultatif)', type: 'number' },
            { name: 'description', label: 'Description', type: 'textarea' },
          ]}
          onSubmit={async values => {
            await post('/admin/packs/plans', {
              family: values.family,
              code: values.code.trim().toUpperCase(),
              name: values.name.trim(),
              level: values.level ? Number(values.level) : null,
              description: values.description.trim() || null,
            }, newIdempotencyKey())
            await refresh()
          }}
        />
      )}
      {versionTarget && <VersionDialog plan={versionTarget} close={() => setVersionTarget(null)} changed={refresh}/>}
      {details && <VersionHistory plan={details} close={() => setDetails(null)} changed={refresh} manage={mayManage}/>}
      {editingPlan && (
        <FormDialog title={'Modifier la fiche ' + editingPlan.code}
          subtitle="Seuls le nom, la description et le niveau changent. Les prix et quotas passent toujours par de nouvelles versions."
          submitLabel="Enregistrer la fiche" onClose={() => setEditingPlan(null)}
          fields={[
            { name: 'name', label: 'Nom commercial', initial: editingPlan.name, required: true },
            { name: 'level', label: 'Niveau de formule', type: 'number', initial: editingPlan.level === null ? '' : String(editingPlan.level) },
            { name: 'description', label: 'Description', type: 'textarea', initial: editingPlan.description ?? '' },
            { name: 'reason', label: 'Motif de modification', type: 'textarea', required: true },
          ]}
          onSubmit={async values => {
            await put('/admin/packs/plans/' + editingPlan.id, {
              name: values.name.trim(),
              level: values.level.trim() ? Number(values.level) : null,
              description: values.description.trim() || null,
              reason: values.reason,
            }, newIdempotencyKey())
            await refresh()
          }}
        />
      )}
      {duplicating && (
        <FormDialog title="Dupliquer la formule" subtitle={'Créer une copie de ' + duplicating.code + ' comme nouveau brouillon.'}
          submitLabel="Dupliquer" onClose={() => setDuplicating(null)}
          fields={[
            { name: 'code', label: 'Nouveau code unique', required: true, initial: duplicating.code + '_COPIE' },
            { name: 'name', label: 'Nouveau nom', required: true, initial: duplicating.name + ' — copie' },
          ]}
          onSubmit={async values => {
            await post('/admin/packs/plans/' + duplicating.id + '/duplicate', { code: values.code.trim().toUpperCase(), name: values.name.trim() }, newIdempotencyKey())
            await refresh()
          }}
        />
      )}
      {target && (
        <FormDialog title={'Modifier le statut : ' + STATES[target.to].label} subtitle={target.plan.name + ' (' + target.plan.code + ')'} submitLabel={STATES[target.to].label}
          danger={['retired', 'archived', 'suspended'].includes(target.to)} onClose={() => setTarget(null)}
          fields={[{ name: 'reason', label: 'Motif obligatoire', type: 'textarea', required: true }]}
          onSubmit={async values => {
            await post('/admin/packs/plans/' + target.plan.id + '/transition', { to: target.to, reason: values.reason })
            await refresh()
          }}
        />
      )}
    </>
  )
}
function VersionDialog({ plan, close, changed }: { plan: Plan; close: () => void; changed: () => Promise<unknown> }) {
  const details = useQuery({ queryKey: ['plan-version-edit', plan.id], queryFn: () => get<Plan>('/admin/packs/plans/' + plan.id), staleTime: 0 })
  const base = details.data?.versions?.[0] ?? plan.current_version
  if (details.isPending) return (
    <div role="dialog" aria-modal="true" aria-label="Chargement des conditions" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="rounded-3xl bg-[var(--dash-card)] p-8"><LoadingBlock/></div>
    </div>
  )
  if (details.isError) return (
    <div role="alert" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="rounded-3xl bg-[var(--dash-card)] p-6"><ErrorLine message="Impossible de charger les conditions du pack."/><button className="mt-4" onClick={close}>Fermer</button></div>
    </div>
  )
  return (
    <FormDialog title={'Paramétrer ' + plan.code} subtitle="Prix, quotas, éligibilité et conditions. La version précédente reste intacte."
      submitLabel="Créer cette version" fields={versionFields(plan, base)} onClose={close}
      onSubmit={async values => {
        const payload = versionPayload(plan, values, base)
        const created = await post<Version>('/admin/packs/plans/' + plan.id + '/versions', payload, newIdempotencyKey())
        if (values.publish === 'yes') {
          await post('/admin/packs/plans/' + plan.id + '/versions/' + created.id + '/publish')
          if (plan.status === 'draft') {
            await post('/admin/packs/plans/' + plan.id + '/transition', { to: 'published', reason: 'Publication initiale du pack après configuration de sa version.' })
          }
        }
        await changed()
      }}
    />
  )
}
function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-4"><dt className="text-[var(--color-text-muted)]">{label}</dt><dd className="text-right font-semibold tabular-nums">{value}</dd></div>
}
