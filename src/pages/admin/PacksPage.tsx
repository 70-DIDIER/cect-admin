import { useMemo, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Archive, CircleCheck, CirclePause, Copy, FileClock, FilePlus2,
  Pencil, Plus, Search, ShieldCheck, X,
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
  first_credit_delay_periods?: number | null
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
interface CashbackPolicy { enabled: boolean; rate_bps: number; families: string[] }
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

type BonusTerms = { enabled?: boolean; rate_bps?: number; max_yem?: string | null; rounding?: string }
function packBonus(version?: Version | null): BonusTerms | null {
  const value = version?.rules?.cashback
  return value && typeof value === 'object' && !Array.isArray(value) ? value as BonusTerms : null
}
function describeBonus(version?: Version | null): string {
  const terms = packBonus(version)
  if (!terms) return 'Règle historique'
  return terms.enabled ? `${((terms.rate_bps ?? 0) / 100).toLocaleString('fr-FR')} % de YEM bonus` : 'Sans cashback'
}

function amount(value?: string | null): string {
  return value == null ? 'À définir' : formatYem(value)
}
function versionFields(plan: Plan, base: Version | null): FormField[] {
  const fields: FormField[] = [
    { name: 'price_xof', label: plan.family === 'PERSONNEL' ? 'Coût d’ouverture du pack (FCFA)' : 'Prix payé à la souscription (FCFA)', type: 'number', required: true, initial: String(base?.price_xof ?? 0), hint: plan.family === 'CONSOMMATEUR' ? 'Si vous renseignez la valeur de référence plus bas, le prix sera égal à cette valeur.' : 'Le membre paie ce montant en FCFA pour accéder à la formule.' },
    {
      name: 'eligible', label: 'Qui peut souscrire ?', type: 'select', required: true,
      initial: plan.family === 'MARCHAND' ? 'legal' : 'natural',
      options: plan.family === 'MARCHAND'
        ? [{ value: 'legal', label: 'Personnes morales uniquement (PM)' }]
        : [{ value: 'natural', label: 'Personnes physiques uniquement (PF)' }],
      hint: 'Règle métier CECT : seules les PM souscrivent Marchand ; les autres familles sont réservées aux PF.',
    },
    { name: 'min_operation', label: 'Minimum par transaction (YEM)', section: 'advanced', hint: 'Laisser vide s’il n’y a pas de minimum.', initial: base?.min_operation ?? '' },
    { name: 'max_operation', label: 'Maximum par transaction (YEM)', section: 'advanced', hint: 'Doit être inférieur ou égal au quota par période.', initial: base?.max_operation ?? '' },
  ]
  if (plan.family !== 'PERSONNEL') {
    fields.push(
      { name: 'unit', label: 'Fréquence de distribution des YEM', type: 'select', options: PERIODS, initial: base?.period?.unit ?? 'month', hint: 'Choisissez mensuelle pour une formule de 12 mensualités.' },
      { name: 'every', label: 'Tous les combien de cycles ?', type: 'number', section: 'advanced', required: true, initial: String(base?.period?.every ?? 1), hint: '1 = tous les mois si la fréquence choisie est mensuelle.' },
      { name: 'cycles', label: 'Durée : nombre de versements de YEM', type: 'number', required: true, initial: String(base?.period?.cycles ?? 12), hint: '12 signifie douze crédits YEM. La période initiale d’attente s’ajoute avant le premier crédit.' },
      ...(plan.family === 'CONSOMMATEUR' ? [] : [{
        name: 'quota_per_period', label: plan.family === 'VENDEUR' ? 'Quota de vente autorisé (YEM par période)' : 'Plafond YEM par période',
        required: true, initial: base?.quota_per_period ?? '', hint: 'Exemple : 500 YEM autorisés chaque mois pendant 12 mois.',
      }]),
      { name: 'cumulative', label: 'Reporter les YEM non utilisés à la période suivante ?', section: 'advanced', type: 'select', options: [{ value: 'true', label: 'Oui' }, { value: 'false', label: 'Non' }], initial: String(base?.cumulative ?? (plan.family === 'VENDEUR')) },
      { name: 'end_of_term', label: 'Que deviennent les YEM restants en fin de pack ?', section: 'advanced', type: 'select', options: END_TERM, initial: base?.end_of_term ?? 'expire' },
      { name: 'first_credit_delay_periods', label: 'Attente avant le 1er crédit YEM (en périodes)', type: 'number', required: true, initial: String(base?.rules?.first_credit_delay_periods ?? (plan.family === 'VENDEUR' ? 1 : 0)), hint: '0 = à la confirmation du paiement ; 1 = après une période entière ; jusqu’à 12. Fixé dans cette version, il ne modifie pas les contrats déjà actifs.' },
    )
  } else {
    fields.push({
      name: 'min_topup_xof', label: 'Rechargement minimum autorisé (FCFA)', type: 'number',
      initial: String(base?.rules?.min_topup_xof ?? 5000),
    })
  }
  if (plan.family === 'CONSOMMATEUR' || plan.family === 'PERSONNEL') {
    const packBonus = base?.rules?.cashback as { enabled?: boolean; rate_bps?: number; max_yem?: string | null; rounding?: string } | undefined
    fields.push(
      {
        name: 'cashback_mode',
        label: 'Offrir des YEM bonus sur cette formule ?',
        section: 'cashback',
        type: 'select',
        initial: packBonus ? (packBonus.enabled ? 'yes' : 'no') : base ? 'legacy' : 'no',
        options: [
          { value: 'no', label: 'Non, aucun bonus' },
          { value: 'yes', label: 'Oui, activer un bonus sur cette formule' },
          ...(base && !packBonus ? [{ value: 'legacy', label: 'Garder la règle historique de ce pack' }] : []),
        ],
        hint: plan.family === 'CONSOMMATEUR'
          ? 'Bonus calculé une seule fois sur les YEM du pack, puis réparti sur les périodes.'
          : 'Bonus calculé au moment de chaque rechargement, sans limite mensuelle de quota.',
      },
      { name: 'cashback_percent', section: 'cashback', showWhen: { name: 'cashback_mode', value: 'yes' }, label: 'Bonus en %', type: 'number', step: '0.01',
        initial: String((packBonus?.rate_bps ?? 0) / 100), hint: 'Exemple : 5 signifie 5 YEM offerts pour 100 YEM achetés. Maximum 99,99 %.' },
      { name: 'cashback_max_yem', section: 'cashback', showWhen: { name: 'cashback_mode', value: 'yes' }, label: 'Maximum de YEM offerts (facultatif)',
        initial: packBonus?.max_yem ?? '', hint: plan.family === 'CONSOMMATEUR'
          ? 'Plafond de bonus sur la totalité du pack. Laisser vide pour aucun plafond.'
          : 'Plafond de bonus par rechargement. Laisser vide pour aucun plafond.' },
    )
  }
  fields.push(
    { name: 'reason', label: 'Pourquoi modifiez-vous cette formule ?', section: 'final', type: 'textarea', required: true, hint: 'Ce motif est conservé dans l’historique. Minimum cinq caractères.' },
    { name: 'publish', label: 'Que faire de cette nouvelle version ?', section: 'final', type: 'select', options: [
      { value: 'no', label: 'Enregistrer comme brouillon' },
      { value: 'yes', label: 'Publier pour les prochains souscripteurs' },
    ] },
  )
  return fields
}
function versionPayload(plan: Plan, values: Record<string, string>, base: Version | null): Record<string, unknown> {
  const price = Number(values.price_xof)
  if (!Number.isSafeInteger(price) || price < 0) throw new Error('Le prix doit être un montant entier positif ou nul.')
  const eligibilities = plan.family === 'MARCHAND' ? ['legal'] : ['natural']
  const payload: Record<string, unknown> = {
    price_xof: price,
    eligible_person_types: eligibilities,
    reason: values.reason,
    min_operation: values.min_operation?.trim() || null,
    max_operation: values.max_operation?.trim() || null,
  }
  const rules: Record<string, unknown> = { ...(base?.rules ?? {}) }
  if (plan.family !== 'PERSONNEL') {
    payload.period = { unit: values.unit, every: Number(values.every), cycles: Number(values.cycles) }
    payload.cumulative = values.cumulative === 'true'
    payload.end_of_term = values.end_of_term
    const delay = Number(values.first_credit_delay_periods)
    if (!Number.isSafeInteger(delay) || delay < 0 || delay > 12) {
      throw new Error('Le délai avant le premier crédit doit être un nombre entier de 0 à 12 périodes.')
    }
    rules.first_credit_delay_periods = delay
    if (plan.family === 'CONSOMMATEUR') {
      if (price <= 0) throw new Error('Le prix du pack Consommateur doit être supérieur à zéro.')
      // One FCFA amount is the source of truth. The API snapshots its YEM
      // sale rate and derives periodic allowances; no duplicate amount field.
      rules.reference_value_xof = price
      rules.rate_setting_key = 'rates.sale_xof_per_yem'
      delete rules.rate_xof_per_yem
      delete payload.quota_per_period
    } else {
      payload.quota_per_period = values.quota_per_period
    }
  } else {
    rules.min_topup_xof = Number(values.min_topup_xof)
    rules.rate_setting_key = 'rates.sale_xof_per_yem'
  }
  if (plan.family === 'CONSOMMATEUR' || plan.family === 'PERSONNEL') {
    if (values.cashback_mode === 'legacy') {
      delete rules.cashback
    } else {
      const bonusPercent = Number(values.cashback_percent || 0)
      const enabled = values.cashback_mode === 'yes'
      if (enabled && (!Number.isFinite(bonusPercent) || bonusPercent <= 0 || bonusPercent > 99.99)) {
        throw new Error('Le bonus doit être supérieur à 0 % et inférieur ou égal à 99,99 %.')
      }
      const cap = values.cashback_max_yem?.trim() || null
      if (enabled && cap !== null && !/^\d{1,22}(\.\d{1,6})?$/.test(cap)) {
        throw new Error('Le plafond YEM doit être positif, avec au maximum 6 décimales.')
      }
      rules.cashback = {
        enabled,
        rate_bps: enabled ? Math.round(bonusPercent * 100) : 0,
        max_yem: enabled ? cap : null,
        rounding: 'down',
      }
    }
  } else {
    delete rules.cashback
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
                <p>Crédits prévus : {version.period ? version.period.cycles + ' périodes' : 'Aucun crédit périodique'}</p>
                {version.period && <p>Premier crédit : {(version.first_credit_delay_periods ?? (plan.family === 'VENDEUR' ? 1 : 0)) === 0 ? 'À l’activation, après paiement intégral' : 'Après ' + (version.first_credit_delay_periods ?? (plan.family === 'VENDEUR' ? 1 : 0)) + ' période(s) depuis l’activation'}</p>}
                <p>Éligibilité : {(version.eligible_person_types ?? []).map(t => t === 'natural' ? 'PF' : 'PM').join(' / ')}</p>
                <p>Cumul : {version.cumulative == null ? 'Sans objet' : version.cumulative ? 'Oui' : 'Non'}</p>
                <p>Min / max : {version.min_operation ?? '—'} / {version.max_operation ?? '—'} YEM</p>
                <p>Création : {new Date(version.created_at).toLocaleString('fr-FR')}</p>
                {(plan.family === 'CONSOMMATEUR' || plan.family === 'PERSONNEL') && <p>Cashback : {describeBonus(version)}</p>}
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
  const [searchParams, setSearchParams] = useSearchParams()
  const section = searchParams.get('section') === 'conditions' ? 'conditions' : 'formules'
  const changeSection = (next: 'formules' | 'conditions') => setSearchParams(next === 'formules' ? {} : { section: next })
  const [family, setFamily] = useState(() => searchParams.get('family') || (searchParams.get('section') === 'cashback' ? 'CONSOMMATEUR' : 'VENDEUR'))
  const [showArchives, setShowArchives] = useState(false)
  const [removing, setRemoving] = useState<Plan | null>(null)
  const [search, setSearch] = useState('')
  const [target, setTarget] = useState<{ plan: Plan; to: Status } | null>(null)
  const [versionTarget, setVersionTarget] = useState<Plan | null>(null)
  const [details, setDetails] = useState<Plan | null>(null)
  const [creating, setCreating] = useState(false)
  const [duplicating, setDuplicating] = useState<Plan | null>(null)
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null)
  const mayManage = can('packs.manage')
  const superadmin = user?.role === 'superadmin' && can('settings.update_critical')
  const cashbackPolicy = useQuery({
    queryKey: ['packs-cashback-summary'],
    queryFn: () => get<{ current_value: CashbackPolicy }>('/admin/settings/cashback.rules'),
    enabled: superadmin && section === 'formules',
    staleTime: 30_000,
  })
  const query = useQuery({
    queryKey: ['admin-plans', family],
    queryFn: () => getRaw<{ data: Plan[] }>('/admin/packs/plans', { per_page: 100, ...(family ? { family } : {}) }),
    staleTime: 0,
  })
  const plans = query.data?.data ?? []
  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return plans.filter(plan => (showArchives ? plan.status === 'archived' : plan.status !== 'archived') && (!needle || [plan.name, plan.code, plan.description ?? ''].some(v => v.toLowerCase().includes(needle))))
  }, [plans, search, showArchives])
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
        <PageIntro title="Packs, quotas et avantages"
          description="Un espace unique : prix du pack, YEM autorisés, durée et cashback directement dans les formules Consommateur et Personnel. Les anciennes souscriptions conservent leurs conditions."
          actions={mayManage && section === 'formules' && (
            <button onClick={() => setCreating(true)} className="flex min-h-[44px] items-center gap-2 rounded-xl bg-[var(--color-primary)] px-4 text-sm font-bold text-white">
              <Plus size={17}/> Créer une formule
            </button>
          )}
        />
        <nav aria-label="Sections de gestion des packs" className="flex flex-wrap gap-2 rounded-2xl bg-[var(--dash-bg)] p-2">
          {([
            ['formules', 'Formules, quotas et cashback'],
            ['conditions', 'Adhésion et règles'],
          ] as const).map(([id, title]) => (
            <button key={id} type="button" aria-current={section === id ? 'page' : undefined}
              onClick={() => changeSection(id)}
              className={`rounded-xl px-4 py-3 text-sm font-bold transition-colors ${section === id ? 'bg-[var(--color-primary)] text-white' : 'text-[var(--color-text)] hover:bg-[var(--color-surface)]'}`}>
              {title}
            </button>
          ))}
        </nav>
        {section === 'conditions' && (
          <div className="space-y-5">
            {superadmin && <MembershipFees superadmin={superadmin}/>}
            <div className="rounded-2xl border border-[var(--color-border)] p-5">
              <p className="text-base font-extrabold">Limite de packs et autres règles générales</p>
              <p className="mt-2 text-sm text-[var(--color-text-muted)]">Jusqu'à deux packs structurés actifs par membre selon la politique actuelle. Personnel est exclu de cette limite. Les règles sont versionnées et modifiables sous contrôle des permissions.</p>
              <Link to="/admin/configuration?group=packs" className="mt-3 inline-flex text-sm font-bold text-[var(--color-primary)]">Ouvrir les règles avancées et leur historique ↗</Link>
            </div>
          </div>
        )}
        {section === 'formules' && (
          <>
          <div className="rounded-2xl border border-[var(--color-border)] p-4 text-sm">
            <p className="font-bold">Comment configurer une formule ?</p>
            <p className="mt-1 text-[var(--color-text-muted)]">Choisissez une formule → cliquez sur « Paramétrer » → saisissez le prix et les YEM prévus. Pour Consommateur et Personnel, définissez directement le bonus cashback dans ce même formulaire. Publiez ensuite la nouvelle version pour les prochaines souscriptions.</p>
          </div>
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
        {family === 'MARCHAND' && (
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--dash-card)] p-4 sm:p-5">
            <h3 className="font-extrabold">Comment la CECT rachète les YEM aux Marchands ?</h3>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              Le SuperAdmin peut choisir un taux fixe ou le cours de vente diminué de frais de gestion.
              Cette politique s'applique aux nouvelles demandes ; chaque pack garde ses droits et ses plafonds indépendants.
            </p>
            <Link to="/admin/configuration?group=rates" className="mt-3 inline-flex rounded-xl bg-[var(--color-primary)] px-4 py-2 text-sm font-bold text-white">
              Gérer les cours et les frais Marchands
            </Link>
          </div>
        )}
        <nav aria-label="Familles de packs" className="flex flex-wrap gap-2">
          {Object.entries(FAMILIES).map(([code, meta]) => (
            <button type="button" key={code} aria-pressed={family === code} onClick={() => { setFamily(code); setShowArchives(false); }}
              className={`rounded-xl border px-4 py-3 text-sm font-bold ${family === code ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white' : 'border-[var(--color-border)] bg-[var(--color-surface)]'}`}>
              {meta.label}
            </button>
          ))}
          <button type="button" aria-pressed={family === ''} onClick={() => setFamily('')}
            className={`rounded-xl border px-4 py-3 text-sm font-bold ${family === '' ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white' : 'border-[var(--color-border)]'}`}>
            Toutes les formules
          </button>
        </nav>
        <div className="flex flex-wrap items-center gap-3">
          <label className="relative min-w-0 flex-1 basis-56">
            <Search size={16} className="absolute left-3 top-3 text-[var(--color-text-muted)]"/>
            <span className="sr-only">Rechercher un pack</span>
            <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Rechercher une formule ou un code" className={FIELD + ' w-full pl-10'}/>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={showArchives} onChange={event => setShowArchives(event.target.checked)}/>
            {showArchives ? 'Archives uniquement' : 'Voir les archives'}
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
                  {(plan.family === 'CONSOMMATEUR' || plan.family === 'PERSONNEL') &&
                    <Row label="YEM bonus" value={describeBonus(v)}/>}

                  <Row label="Bonus cashback YEM" value={
                    plan.family === 'VENDEUR' || plan.family === 'MARCHAND'
                      ? 'Jamais applicable'
                      : !superadmin || cashbackPolicy.isPending ? 'Consulter les règles'
                      : cashbackPolicy.data?.current_value.enabled && cashbackPolicy.data.current_value.families.includes(plan.family)
                        ? `Activé : ${(cashbackPolicy.data.current_value.rate_bps / 100).toLocaleString('fr-FR')} %`
                        : 'Désactivé pour cette famille'
                  }/>
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
                  {superadmin && plan.status !== 'archived' && (
                    <GhostButton onClick={() => setRemoving(plan)}><Archive size={14}/> Supprimer / retirer</GhostButton>
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
          </>
        )}

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
      {removing && (
        <FormDialog title={'Supprimer ou retirer : ' + removing.code}
          subtitle="Un brouillon non utilisé sera supprimé définitivement. Un pack déjà publié ou acheté sera archivé pour conserver les contrats et opérations des membres."
          submitLabel="Confirmer la suppression / le retrait" danger onClose={() => setRemoving(null)}
          fields={[{ name: 'reason', label: 'Motif obligatoire', type: 'textarea', required: true }]}
          onSubmit={async values => {
            const { http } = await import('@/lib/api')
            await http.delete('/admin/packs/plans/' + removing.id, { data: { reason: values.reason } })
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
  const saleRate = useQuery({
    queryKey: ['pack-preview', 'sale-rate'],
    queryFn: () => get<{ current_value: number }>('/admin/settings/rates.sale_xof_per_yem'),
    enabled: plan.family === 'CONSOMMATEUR' || plan.family === 'PERSONNEL',
  })
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
    <FormDialog title={'Paramétrer ' + plan.name}
      subtitle={`Formule ${plan.code} · ${FAMILIES[plan.family].label}. Configurez les droits des futurs souscripteurs sans modifier les contrats passés.`}
      submitLabel="Enregistrer les nouvelles conditions" guided fields={versionFields(plan, base)} onClose={close}
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
    >
      {(values) => {
        const cycles = Number(values.cycles || 0)
        const delayPeriods = Number(values.first_credit_delay_periods ?? (plan.family === 'VENDEUR' ? 1 : 0))
        const quota = Number(values.quota_per_period || 0)
        const isReference = plan.family === 'CONSOMMATEUR'
        const reference = Number(values.price_xof || 0)
        const unitRate = saleRate.data?.current_value ?? 0
        const purchaseYem = isReference && unitRate > 0 && cycles > 0 ? reference / (unitRate * cycles) : quota
        const total = cycles > 0 && purchaseYem > 0 ? cycles * purchaseYem : null
        const mode = values.cashback_mode
        const percentage = Number(values.cashback_percent || 0)
        const maxBonus = values.cashback_max_yem?.trim() ? Number(values.cashback_max_yem) : Infinity
        const bonus = total !== null && mode === 'yes' && Number.isFinite(percentage)
          ? Math.max(0, Math.min(total * percentage / 100, Number.isFinite(maxBonus) ? maxBonus : Infinity))
          : 0
        const topup = Number(values.min_topup_xof || 0)
        const personalBase = unitRate > 0 ? topup / unitRate : null
        const personalBonus = personalBase !== null && mode === 'yes'
          ? Math.max(0, Math.min(personalBase * percentage / 100, Number.isFinite(maxBonus) ? maxBonus : Infinity))
          : 0
        const display = (amount: number) => amount.toLocaleString('fr-FR', { maximumFractionDigits: 6 })
        return (
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--dash-bg)] p-4 text-sm">
            <p className="font-bold">Comprendre cette formule</p>
            <p className="mt-1 text-[var(--color-text-muted)]">
              {plan.family === 'VENDEUR' && 'Le vendeur peut céder à la CECT la quantité de YEM prévue à chaque période. Aucun cashback.'}
              {plan.family === 'CONSOMMATEUR' && 'Le consommateur achète un pack au prix indiqué, reçoit des YEM répartis sur sa durée et peut obtenir un bonus YEM si le cashback est activé.'}
              {plan.family === 'PERSONNEL' && 'Le membre ouvre un compte rechargeable. Aucun quota ni durée fixes ; le cashback éventuel intervient sur ses rechargements.'}
              {plan.family === 'MARCHAND' && 'Le marchand (personne morale) dispose de droits pour accepter puis céder ses YEM à la coopérative. Aucun cashback.'}
            </p>
            {plan.family === 'CONSOMMATEUR' && total !== null && (
              <div className="mt-3 space-y-1 rounded-xl border border-[var(--color-border)] p-3">
                <p><strong>Prix payé :</strong> {formatXof(isReference ? reference : Number(values.price_xof || 0))}</p>
                <p><strong>YEM achetés :</strong> {display(total)} YEM au total ({display(purchaseYem)} YEM par période × {cycles})</p>
                <p><strong>YEM bonus :</strong> {mode === 'legacy' ? 'Selon l’ancienne règle du pack' : display(bonus) + ' YEM'}</p>
                <p className="font-bold"><strong>Total prévu :</strong> {mode === 'legacy' ? 'Selon la règle historique' : display(total + bonus) + ' YEM'}</p>
              </div>
            )}
            {plan.family === 'PERSONNEL' && (
              <div className="mt-3 space-y-1 rounded-xl border border-[var(--color-border)] p-3">
                <p><strong>Ouverture du pack :</strong> {formatXof(Number(values.price_xof || 0))} ; ce montant est distinct des rechargements.</p>
                <p><strong>Exemple de rechargement :</strong> {formatXof(topup || 0)} au cours {unitRate || 'non chargé'} FCFA/YEM</p>
                <p><strong>YEM achetés :</strong> {personalBase === null ? 'Cours indisponible' : display(personalBase) + ' YEM'}</p>
                <p><strong>Bonus :</strong> {mode === 'legacy' ? 'Selon l’ancienne règle du pack' : display(personalBonus) + ' YEM'}</p>
                <p className="font-bold"><strong>Total prévu :</strong> {personalBase === null || mode === 'legacy' ? 'Calcul selon les paramètres en vigueur' : display(personalBase + personalBonus) + ' YEM'}</p>
              </div>
            )}
            {(plan.family === 'VENDEUR' || plan.family === 'MARCHAND') && (
              <p className="mt-2 font-semibold">{total === null ? 'Renseignez le plafond YEM et la durée.' : `${cycles} périodes × ${display(purchaseYem)} YEM = ${display(total)} YEM de quota sur la durée.`} Aucun cashback sur cette famille.</p>
            )}
            {plan.family !== 'PERSONNEL' && <div className="mt-3 rounded-xl border border-emerald-500/25 bg-emerald-500/[.06] p-3 text-xs leading-6">
              <p className="font-extrabold text-[var(--color-text)]">Calendrier contractuel du premier crédit</p>
              <p>{delayPeriods === 0 ? 'Premier crédit immédiatement après paiement intégral confirmé.' : `Premier crédit après ${delayPeriods} période(s) d’attente depuis l’activation, et non à la date de paiement.`}</p>
              <p>{cycles} crédits YEM au total · {cycles > 0 ? (cycles + Math.max(0, delayPeriods)) : 0} période(s) entre l’activation et la fin du dernier cycle.</p>
              <p className="text-[var(--color-text-muted)]">Les dates exactes seront fixées lors de l’activation. Les contrats existants restent inchangés.</p>
            </div>}
            <p className="mt-2 text-xs text-[var(--color-text-muted)]">Aperçu indicatif. Le serveur calcule les quantités exactes à 6 décimales, conserve les règles de la version publiée et crédite les bonus uniquement après paiement confirmé.</p>
          </div>
        )
      }}
    </FormDialog>
  )
}
function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-4"><dt className="text-[var(--color-text-muted)]">{label}</dt><dd className="text-right font-semibold tabular-nums">{value}</dd></div>
}
