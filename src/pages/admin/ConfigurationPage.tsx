import { useMemo, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { History, Lock, Pencil, Search, X } from 'lucide-react'
import { useAuth } from '@/app/AuthContext'
import { Panel } from '@/components/dashboard/Panel'
import { StatusBadge } from '@/components/dashboard/StatusBadge'
import { FormDialog, type FormField } from '@/components/ui/FormDialog'
import { newIdempotencyKey, put, get } from '@/lib/api'

interface SettingVersion {
  id: string
  value: unknown
  effective_from: string
  created_at: string
  reason: string | null
  created_by: string | null
}

interface SettingDetail extends Setting {
  versions: SettingVersion[]
}

interface Setting {
  key: string
  group: string
  type: 'integer' | 'decimal' | 'string' | 'boolean' | 'json'
  description: string
  edit_level: 'administrator' | 'superadmin' | string
  is_sensitive: boolean
  current_value: unknown
}

interface MerchantPricingPolicy {
  mode: 'fixed' | 'sale_minus_fee'
  fee_bps: number
  fixed_fee_xof: number
  fee_rounding: 'down' | 'up'
}

const GROUP_LABELS: Record<string, string> = {
  membership: 'Adhésion',
  organization: 'Organisation',
  payment: 'Paiement',
  payout: 'Versements',
  rates: 'Cours et taux',
  yem: 'YEM',
  security: 'Sécurité',
  ops: 'Exploitation',
  packs: 'Packs',
  notifications: 'Notifications',
}

function groupLabel(group: string): string {
  return GROUP_LABELS[group] ?? group.charAt(0).toUpperCase() + group.slice(1)
}

function displayValue(setting: Setting): string {
  const value = setting.current_value
  if (setting.is_sensitive) return '••••••••'
  if (value === null || value === undefined) return 'Non défini'
  if (typeof value === 'boolean') return value ? 'Oui' : 'Non'
  if (setting.key === 'merchant_redemption.pricing' && value && typeof value === 'object') {
    const p = value as MerchantPricingPolicy
    return p.mode === 'sale_minus_fee'
      ? `Cours de vente − ${(p.fee_bps / 100).toLocaleString('fr-FR')} % de frais${p.fixed_fee_xof ? ` − ${p.fixed_fee_xof} FCFA` : ''}`
      : 'Taux fixe Marchand (cours paramétrable)'
  }
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function fieldFor(setting: Setting): FormField {
  if (setting.type === 'boolean') {
    return { name: 'value', label: 'Valeur', type: 'select', initial: setting.current_value ? 'true' : 'false', options: [{ value: 'true', label: 'Oui' }, { value: 'false', label: 'Non' }] }
  }
  if (setting.type === 'json') {
    return { name: 'value', label: 'Valeur (JSON)', type: 'textarea', required: true, initial: JSON.stringify(setting.current_value ?? null, null, 2) }
  }
  return { name: 'value', label: 'Valeur', type: setting.type === 'integer' ? 'number' : 'text', required: true, initial: setting.current_value === null || setting.current_value === undefined ? '' : String(setting.current_value) }
}

function parseValue(setting: Setting, raw: string): unknown {
  switch (setting.type) {
    case 'integer':
      return Number.parseInt(raw, 10)
    case 'boolean':
      return raw === 'true'
    case 'json':
      return JSON.parse(raw)
    default:
      return raw
  }
}

export default function ConfigurationPage() {
  const { can } = useAuth()
  const queryClient = useQueryClient()
  const [group, setGroup] = useState<string>(() => new URLSearchParams(window.location.search).get('group') || 'all')
  const [search, setSearch] = useState(() => new URLSearchParams(window.location.search).get('search') || '')
  const [editing, setEditing] = useState<Setting | null>(null)
  const [history, setHistory] = useState<Setting | null>(null)
  const query = useQuery({ queryKey: ['settings'], queryFn: () => get<Setting[]>('/admin/settings'), staleTime: 0 })

  const groups = useMemo(() => [...new Set((query.data ?? []).map((setting) => setting.group))], [query.data])
  const merchantSetting = (query.data ?? []).find(item => item.key === 'merchant_redemption.pricing')
  const policy = merchantSetting?.current_value as MerchantPricingPolicy | undefined
  const saleRate = Number((query.data ?? []).find(item => item.key === 'rates.sale_xof_per_yem')?.current_value ?? 0)
  const merchantRate = Number((query.data ?? []).find(item => item.key === 'rates.transfer_xof_per_yem')?.current_value ?? 0)
  const referenceYem = 100
  const pricingGross = referenceYem * (policy?.mode === 'sale_minus_fee' ? saleRate : merchantRate)
  const percentageFee = policy?.mode === 'sale_minus_fee' ? pricingGross * (policy.fee_bps / 10000) : 0
  const pricingFee = policy?.mode === 'sale_minus_fee'
    ? Math.min(pricingGross, (policy.fee_rounding === 'up' ? Math.ceil(percentageFee) : Math.floor(percentageFee)) + policy.fixed_fee_xof)
    : 0
  const pricingNet = Math.max(0, pricingGross - pricingFee)

  const visible = (query.data ?? []).filter((setting) => {
    // Global cashback is retained only for packs published before per-pack
    // policies existed. New cashback is edited in the eligible pack wizard.
    if (setting.key === 'cashback.rules') return false
    if (group !== 'all' && setting.group !== group) return false
    const needle = search.trim().toLowerCase()
    return !needle || setting.key.toLowerCase().includes(needle) || setting.description.toLowerCase().includes(needle)
  })

  function canEdit(setting: Setting): boolean {
    if (setting.is_sensitive) return false
    return setting.edit_level === 'superadmin' ? can('settings.update_critical') : can('settings.update')
  }

  return (
    <>
      <Helmet>
        <title>Configuration — CECT Admin</title>
      </Helmet>

      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-extrabold tracking-tight text-[var(--color-text)]">Configuration</h1>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">Tarifs, frais, durées et seuils appliqués par la plateforme. Chaque modification est versionnée, motivée et peut être programmée.</p>
        </header>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-0 flex-1 basis-64">
            <Search size={16} aria-hidden className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher un paramètre" aria-label="Rechercher un paramètre" className="min-h-[44px] w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <span className="text-[var(--color-text-muted)]">Catégorie</span>
            <select value={group} onChange={(event) => setGroup(event.target.value)} className="min-h-[44px] rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]">
              <option value="all">Toutes</option>
              {groups.map((item) => (
                <option key={item} value={item}>
                  {groupLabel(item)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-4">
          <h2 className="text-sm font-bold text-[var(--color-text)]">Gestion des frais d'adhésion</h2>
          <p className="mt-1 text-xs leading-relaxed text-[var(--color-text-muted)]">
            Le Superadmin peut définir les frais des personnes physiques et des personnes morales.
            Les montants affichés lors de l'inscription proviennent immédiatement de l'API.
            Chaque changement exige un motif et reste historisé.
          </p>
          <button type="button"
            onClick={() => { setGroup('membership'); setSearch('membership.fee.') }}
            className="mt-3 rounded-xl bg-[var(--color-primary)] px-4 py-2 text-xs font-bold text-white">
            Accéder aux tarifs d'adhésion
          </button>
        </div>

        {merchantSetting && (
          <section className="rounded-[24px] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-2xl">
                <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-primary)]">Gestion financière • SuperAdmin</p>
                <h2 className="mt-1 text-lg font-extrabold">Politique de rachat des YEM Marchands</h2>
                <p className="mt-2 text-sm text-[var(--color-text-muted)]">
                  Deux méthodes possibles, entièrement modifiables : taux de cession fixe, ou cours de vente diminué de frais de gestion.
                  Les taux se règlent ci-dessous dans « Cours et taux » et les modifications restent historisées.
                </p>
              </div>
              {canEdit(merchantSetting) && (
                <button type="button" onClick={() => setEditing(merchantSetting)}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--color-primary)] px-4 py-2 text-sm font-bold text-white">
                  <Pencil size={16} /> Modifier le modèle
                </button>
              )}
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-[var(--dash-bg)] p-4">
                <p className="text-xs text-[var(--color-text-muted)]">Modèle actuel</p>
                <p className="mt-1 text-sm font-extrabold">{policy?.mode === 'sale_minus_fee' ? 'Cours de vente moins frais' : 'Taux fixe Marchand'}</p>
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">{policy?.mode === 'sale_minus_fee'
                  ? `${(policy.fee_bps / 100).toLocaleString('fr-FR')} % de frais + ${policy.fixed_fee_xof.toLocaleString('fr-FR')} FCFA fixes`
                  : `${merchantRate.toLocaleString('fr-FR')} FCFA par YEM`}</p>
              </div>
              <div className="rounded-2xl bg-[var(--dash-bg)] p-4">
                <p className="text-xs text-[var(--color-text-muted)]">Exemple pour 100 YEM reçus</p>
                <p className="mt-1 text-xl font-extrabold">{pricingGross.toLocaleString('fr-FR')} FCFA</p>
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">Frais retenus : {pricingFee.toLocaleString('fr-FR')} FCFA</p>
              </div>
              <div className="rounded-2xl bg-[var(--dash-bg)] p-4">
                <p className="text-xs text-[var(--color-text-muted)]">Net à régler au Marchand</p>
                <p className="mt-1 text-xl font-extrabold text-[var(--color-primary)]">{pricingNet.toLocaleString('fr-FR')} FCFA</p>
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">Estimation calculée avec les paramètres actuels</p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={() => { setGroup('rates'); setSearch('rates.transfer_xof_per_yem') }}
                className="rounded-xl border border-[var(--color-border)] px-3 py-2 text-xs font-semibold">Modifier le taux Marchand</button>
              <button type="button" onClick={() => { setGroup('rates'); setSearch('rates.sale_xof_per_yem') }}
                className="rounded-xl border border-[var(--color-border)] px-3 py-2 text-xs font-semibold">Modifier le cours de vente</button>
              <button type="button" onClick={() => setHistory(merchantSetting)}
                className="inline-flex items-center gap-1 rounded-xl border border-[var(--color-border)] px-3 py-2 text-xs font-semibold"><History size={14}/> Historique et décisions</button>
            </div>
            <p className="mt-3 text-xs text-[var(--color-text-muted)]">Les opérations déjà créées conservent leur modèle, leur cours et leurs frais d’origine.</p>
          </section>
        )}

        <Panel title="Paramètres" subtitle={`${visible.length} paramètre(s)`} flush>
          {query.isPending && <div className="mx-5 mb-4 h-32 animate-pulse rounded-2xl bg-[var(--chart-track)]" />}
          {query.isError && <p role="alert" className="px-6 pb-4 text-sm">Impossible de charger les paramètres.</p>}
          <ul className="divide-y divide-[var(--color-border)]">
            {visible.map((setting) => (
              <li key={setting.key} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 sm:px-6">
                <div className="min-w-0 flex-1 basis-64">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-[var(--color-text)]">
                    <code className="rounded bg-[var(--chart-track)] px-1.5 py-0.5 text-xs">{setting.key}</code>
                    {setting.edit_level === 'superadmin' && <StatusBadge label="Critique" tone="warning" icon={Lock} />}
                  </p>
                  <p className="mt-1 text-xs text-[var(--color-text-muted)]">{setting.description}</p>
                </div>
                <p className="max-w-xs break-words text-right text-sm font-semibold text-[var(--color-text)]">{displayValue(setting)}</p>
                <button type="button" onClick={() => setHistory(setting)} aria-label={`Historique de ${setting.key}`} title="Historique des versions" className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--color-border)] hover:bg-[var(--dash-bg)]">
                  <History size={16} aria-hidden />
                </button>
                {canEdit(setting) && (
                  <button type="button" onClick={() => setEditing(setting)} aria-label={`Modifier ${setting.key}`} className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--color-border)] hover:bg-[var(--dash-bg)]">
                    <Pencil size={15} aria-hidden />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      {history && <SettingHistory setting={history} onClose={() => setHistory(null)} />}
      {editing && (
        <SettingDialog
          setting={editing}
          onClose={() => setEditing(null)}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ['settings'] })}
        />
      )}
    </>
  )
}

function SettingDialog({ setting, onClose, onSaved }: { setting: Setting; onClose: () => void; onSaved: () => Promise<void> }) {
  const [key] = useState(newIdempotencyKey)
  const isMerchant = setting.key === 'merchant_redemption.pricing'
  const policy = (setting.current_value ?? {}) as Partial<MerchantPricingPolicy>
  const fields: FormField[] = isMerchant ? [
    { name: 'mode', label: 'Comment rémunérer les Marchands ?', type: 'select', required: true,
      initial: policy.mode ?? 'fixed', options: [
        { value: 'fixed', label: 'Taux fixe défini par le SuperAdmin' },
        { value: 'sale_minus_fee', label: 'Cours de vente CECT moins frais de gestion' },
      ] },
    { name: 'fee_percent', label: 'Frais de gestion (%)', type: 'number', step: '0.01', required: true,
      initial: String((policy.fee_bps ?? 0) / 100), showWhen: { name: 'mode', value: 'sale_minus_fee' },
      hint: '3 signifie 3 %. Le taux de base est le cours de vente paramétré dans Cours et taux.' },
    { name: 'fixed_fee_xof', label: 'Frais de gestion fixes supplémentaires (FCFA)', type: 'number', required: true,
      initial: String(policy.fixed_fee_xof ?? 0), showWhen: { name: 'mode', value: 'sale_minus_fee' } },
    { name: 'fee_rounding', label: 'Arrondi des frais en FCFA', type: 'select',
      initial: policy.fee_rounding ?? 'down', showWhen: { name: 'mode', value: 'sale_minus_fee' }, options: [
        { value: 'down', label: 'À l’inférieur (moins de frais pour le Marchand)' },
        { value: 'up', label: 'Au supérieur' },
      ] },
    { name: 'reason', label: 'Motif du changement (obligatoire)', type: 'textarea', required: true },
    { name: 'effective_from', label: 'Date d’entrée en vigueur (facultatif)', type: 'date' },
  ] : [
    fieldFor(setting),
    { name: 'reason', label: 'Motif (5 caractères minimum)', type: 'textarea', required: true },
    { name: 'effective_from', label: 'Date d’entrée en vigueur (facultatif)', type: 'date' },
  ]
  return (
    <FormDialog
      title={isMerchant ? 'Modifier la politique de rachat Marchand' : 'Modifier le paramètre'}
      subtitle={isMerchant ? 'La nouvelle politique ne s’appliquera qu’aux nouvelles demandes.' : setting.key}
      submitLabel="Enregistrer"
      fields={fields}
      onClose={onClose}
      onSubmit={async (values) => {
        let value: unknown
        try {
          if (isMerchant) {
            const percent = values.mode === 'sale_minus_fee' ? Number(values.fee_percent) : 0
            const fixedFee = values.mode === 'sale_minus_fee' ? Number(values.fixed_fee_xof) : 0
            if (!Number.isFinite(percent) || percent < 0 || percent > 99.99
              || !Number.isInteger(Math.round(percent * 100)) || !/^\d{1,2}(\.\d{1,2})?$/.test(String(percent))
              || !Number.isSafeInteger(fixedFee) || fixedFee < 0 || fixedFee > 10000000) {
              throw new Error('Saisissez un pourcentage de 0 à 99,99 et des frais fixes compris entre 0 et 10 000 000 FCFA.')
            }
            value = {
              mode: values.mode,
              fee_bps: Math.round(percent * 100),
              fixed_fee_xof: fixedFee,
              fee_rounding: values.mode === 'sale_minus_fee' ? values.fee_rounding : 'down',
            }
          } else {
            value = parseValue(setting, values.value ?? '')
          }
        } catch {
          throw new Error('Valeur invalide.')
        }
        const from = values.effective_from ? new Date(`${values.effective_from}T00:00:00`).toISOString() : null
        await put(`/admin/settings/${setting.key}`, { value, reason: values.reason, effective_from: from }, key)
        await onSaved()
      }}
    >
      <p className="text-sm text-[var(--color-text-muted)]">{setting.description}</p>
      {isMerchant && <p className="rounded-xl bg-[var(--dash-bg)] px-4 py-3 text-xs text-[var(--color-text-muted)]">Le calcul se fait sur la quantité de YEM réellement reçue. Les frais sont prélevés en FCFA lors du rééchange. Chaque version exige une justification du SuperAdmin et ne change pas les contrats existants.</p>}
    </FormDialog>
  )
}

function SettingHistory({ setting, onClose }: { setting: Setting; onClose: () => void }) {
  const query = useQuery({
    queryKey: ['setting-history', setting.key],
    queryFn: () => get<SettingDetail>(`/admin/settings/${setting.key}`),
    staleTime: 0,
  })
  return (
    <div role="dialog" aria-modal="true" aria-label={`Historique de ${setting.key}`} className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4" onClick={onClose}>
      <section className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-xl" onClick={event => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-extrabold">Historique des paramètres</h2>
            <p className="mt-1 break-all text-xs text-[var(--color-text-muted)]">{setting.key}</p>
          </div>
          <button type="button" aria-label="Fermer" onClick={onClose} className="rounded-xl border border-[var(--color-border)] p-2"><X size={18}/></button>
        </div>
        {query.isPending && <p className="mt-5 text-sm">Chargement des versions…</p>}
        {query.isError && <p role="alert" className="mt-5 text-sm">Impossible de lire cet historique.</p>}
        {query.data && (
          <ol className="mt-5 divide-y divide-[var(--color-border)]">
            {query.data.versions.length === 0 && <li className="py-4 text-sm text-[var(--color-text-muted)]">Aucune modification enregistrée.</li>}
            {query.data.versions.map((version) => (
              <li key={version.id} className="space-y-2 py-4 text-sm">
                <div className="flex flex-wrap justify-between gap-2">
                  <strong>{new Date(version.effective_from).toLocaleString('fr-FR')}</strong>
                  <span className="text-xs text-[var(--color-text-muted)]">Version du {new Date(version.created_at).toLocaleString('fr-FR')}</span>
                </div>
                <p className="break-words"><strong>Valeur : </strong>{setting.is_sensitive ? 'Valeur confidentielle masquée' : typeof version.value === 'object' ? JSON.stringify(version.value) : String(version.value ?? 'Non défini')}</p>
                <p className="break-words text-[var(--color-text-muted)]"><strong>Motif : </strong>{version.reason || 'Création initiale'}</p>
                {version.created_by && <p className="text-xs text-[var(--color-text-muted)]">Auteur (référence interne) : {version.created_by}</p>}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  )
}
