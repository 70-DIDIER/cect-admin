import { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { BadgePercent, Globe2, History, Lock } from 'lucide-react'
import { useAuth } from '@/app/AuthContext'
import { Panel } from '@/components/dashboard/Panel'
import { StatusBadge } from '@/components/dashboard/StatusBadge'
import { authErrorMessage } from '@/features/auth/errors'
import { get, newIdempotencyKey, put } from '@/lib/api'
import { dateTime, ErrorLine, FIELD, LoadingBlock, PageIntro, PrimaryButton } from './shared'

interface CashbackRules {
  enabled: boolean
  rate_bps: number
  max_yem: string | null
  families: string[]
  rounding: 'down' | 'half_up'
}

interface Country {
  code: string
  name: string
  dial_code: string
  national_lengths: number[]
  enabled: boolean
}

interface SettingDetail<T> {
  key: string
  current_value: T
  versions: { id: string; value: T; effective_from: string; reason: string | null; created_at: string }[]
}

const FAMILIES = [
  { value: 'CONSOMMATEUR', label: 'Consommateur' },
  { value: 'PERSONNEL', label: 'Personnel' },
  { value: 'VENDEUR', label: 'Vendeur' },
  { value: 'MARCHAND', label: 'Marchand' },
]

function useSetting<T>(key: string) {
  return useQuery({ queryKey: ['setting', key], queryFn: () => get<SettingDetail<T>>(`/admin/settings/${key}`), staleTime: 0 })
}

function SaveBar({ busy, error, done, disabled, onSave }: { busy: boolean; error: string | null; done: boolean; disabled: boolean; onSave: () => void }) {
  return (
    <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-[var(--color-border)] pt-5">
      <PrimaryButton onClick={onSave} disabled={busy || disabled}>
        {disabled ? <Lock size={15} aria-hidden /> : null}
        {busy ? 'Enregistrement…' : 'Enregistrer une nouvelle version'}
      </PrimaryButton>
      {done && <span className="text-sm font-semibold text-[var(--tone-success-fg)]">Version enregistrée.</span>}
      {error && (
        <span role="alert" className="text-sm text-[var(--color-danger)]">
          {error}
        </span>
      )}
    </div>
  )
}

function useSaver(key: string) {
  const queryClient = useQueryClient()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  async function save(value: unknown, reason: string, effectiveFrom: string) {
    setBusy(true)
    setError(null)
    setDone(false)
    try {
      await put(`/admin/settings/${key}`, { value, reason, effective_from: effectiveFrom ? new Date(`${effectiveFrom}T00:00:00`).toISOString() : null }, newIdempotencyKey())
      await queryClient.invalidateQueries({ queryKey: ['setting', key] })
      setDone(true)
    } catch (caught) {
      setError(authErrorMessage(caught))
    } finally {
      setBusy(false)
    }
  }
  return { busy, error, done, save }
}

function Meta({ reason, setReason, from, setFrom }: { reason: string; setReason: (v: string) => void; from: string; setFrom: (v: string) => void }) {
  return (
    <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_200px]">
      <label className="block text-sm">
        <span className="mb-1.5 block font-medium">Motif (5 caractères minimum)</span>
        <input value={reason} onChange={(event) => setReason(event.target.value)} className={`${FIELD} w-full`} placeholder="Ex. Campagne de lancement" />
      </label>
      <label className="block text-sm">
        <span className="mb-1.5 block font-medium">En vigueur le (facultatif)</span>
        <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className={`${FIELD} w-full`} />
      </label>
    </div>
  )
}

function CashbackCard() {
  const { can } = useAuth()
  const query = useSetting<CashbackRules>('cashback.rules')
  const saver = useSaver('cashback.rules')
  const [rules, setRules] = useState<CashbackRules | null>(null)
  const [percent, setPercent] = useState('0')
  const [reason, setReason] = useState('')
  const [from, setFrom] = useState('')

  useEffect(() => {
    if (query.data) {
      setRules(query.data.current_value)
      setPercent(String(query.data.current_value.rate_bps / 100))
    }
  }, [query.data])

  if (query.isPending || !rules) return <Panel title="Cashback en YEM"><LoadingBlock /></Panel>
  if (query.isError) return <Panel title="Cashback en YEM"><ErrorLine message="Impossible de charger la règle." /></Panel>

  const rate = Math.max(0, Math.min(99.99, Number.parseFloat(percent) || 0))
  const example = (300000 / 650) * (rate / 100)
  const canEdit = can('settings.update_critical')
  const update = (patch: Partial<CashbackRules>) => setRules({ ...rules, ...patch })

  return (
    <Panel
      title="Cashback en YEM"
      subtitle="Le membre paie le prix plein et reçoit un bonus en YEM, calculé et figé à l’achat."
      action={<StatusBadge label={rules.enabled ? 'Activé' : 'Désactivé'} tone={rules.enabled ? 'success' : 'neutral'} icon={BadgePercent} />}
    >
      <div className="grid gap-5 md:grid-cols-2">
        <label className="flex min-h-[44px] items-center gap-3 rounded-xl border border-[var(--color-border)] px-4 text-sm font-semibold md:col-span-2">
          <input type="checkbox" className="h-4 w-4 accent-[var(--color-primary)]" checked={rules.enabled} disabled={!canEdit} onChange={(event) => update({ enabled: event.target.checked })} />
          Activer le cashback sur les nouveaux achats
        </label>

        <label className="block text-sm">
          <span className="mb-1.5 block font-medium">Taux de cashback (%)</span>
          <input type="number" min={0} max={99.99} step={0.01} value={percent} disabled={!canEdit} onChange={(event) => setPercent(event.target.value)} className={`${FIELD} w-full`} />
        </label>
        <label className="block text-sm">
          <span className="mb-1.5 block font-medium">Plafond par opération (YEM, facultatif)</span>
          <input value={rules.max_yem ?? ''} disabled={!canEdit} onChange={(event) => update({ max_yem: event.target.value.trim() === '' ? null : event.target.value.trim() })} className={`${FIELD} w-full`} placeholder="Aucun plafond" inputMode="decimal" />
        </label>

        <fieldset className="text-sm">
          <legend className="mb-1.5 font-medium">Familles éligibles</legend>
          <div className="flex flex-wrap gap-2">
            {FAMILIES.map((family) => {
              const checked = rules.families.includes(family.value)
              return (
                <label key={family.value} className={`flex min-h-[40px] cursor-pointer items-center gap-2 rounded-xl border px-3 ${checked ? 'border-[var(--color-primary)] bg-[var(--tone-success-bg)]' : 'border-[var(--color-border)]'}`}>
                  <input type="checkbox" className="accent-[var(--color-primary)]" checked={checked} disabled={!canEdit} onChange={() => update({ families: checked ? rules.families.filter((value) => value !== family.value) : [...rules.families, family.value] })} />
                  {family.label}
                </label>
              )
            })}
          </div>
        </fieldset>
        <label className="block text-sm">
          <span className="mb-1.5 block font-medium">Arrondi</span>
          <select value={rules.rounding} disabled={!canEdit} onChange={(event) => update({ rounding: event.target.value as CashbackRules['rounding'] })} className={`${FIELD} w-full`}>
            <option value="down">Par défaut (à l’inférieur)</option>
            <option value="half_up">Au plus proche</option>
          </select>
        </label>
      </div>

      <div className="mt-5 rounded-2xl bg-[var(--tone-success-bg)] p-4 text-sm text-[var(--tone-success-fg)]">
        <p className="font-bold">Simulation</p>
        <p className="mt-1">
          Un achat de 300 000 FCFA à 650 FCFA/YEM donne ≈ {(300000 / 650).toFixed(2)} YEM, plus <strong>{example.toFixed(2)} YEM</strong> de cashback à {rate} %.
        </p>
      </div>

      {canEdit ? (
        <>
          <Meta reason={reason} setReason={setReason} from={from} setFrom={setFrom} />
          <SaveBar busy={saver.busy} error={saver.error} done={saver.done} disabled={reason.trim().length < 5} onSave={() => void saver.save({ ...rules, rate_bps: Math.round(rate * 100) }, reason, from)} />
        </>
      ) : (
        <p className="mt-5 text-sm text-[var(--color-text-muted)]">Seul le Super-administrateur peut modifier cette règle.</p>
      )}

      {query.data && query.data.versions.length > 0 && (
        <details className="mt-6 rounded-2xl border border-[var(--color-border)] p-4">
          <summary className="flex cursor-pointer items-center gap-2 text-sm font-bold">
            <History size={15} aria-hidden /> Historique des versions
          </summary>
          <ul className="mt-3 divide-y divide-[var(--color-border)] text-sm">
            {query.data.versions.map((version) => (
              <li key={version.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  <strong>{version.value.enabled ? `${version.value.rate_bps / 100} %` : 'Désactivé'}</strong> <span className="text-[var(--color-text-muted)]">— {version.reason ?? 'Valeur initiale'}</span>
                </span>
                <span className="text-xs text-[var(--color-text-muted)]">Depuis le {dateTime(version.effective_from)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </Panel>
  )
}

function CountriesCard() {
  const { can } = useAuth()
  const query = useSetting<Country[]>('payout.countries')
  const saver = useSaver('payout.countries')
  const [countries, setCountries] = useState<Country[] | null>(null)
  const [reason, setReason] = useState('')
  const [from, setFrom] = useState('')

  useEffect(() => {
    if (query.data) setCountries(query.data.current_value)
  }, [query.data])

  if (query.isPending || !countries) return <Panel title="Pays de réception"><LoadingBlock /></Panel>
  const canEdit = can('settings.update_critical')

  return (
    <Panel title="Pays de réception des fonds" subtitle="Pays ouverts aux membres pour recevoir leur contre-valeur, avec indicatif et longueur du numéro." action={<Globe2 size={18} aria-hidden className="text-[var(--color-text-muted)]" />}>
      <ul className="divide-y divide-[var(--color-border)]">
        {countries.map((country, index) => (
          <li key={country.code} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3">
            <label className="flex min-w-0 flex-1 basis-48 cursor-pointer items-center gap-3 text-sm font-semibold">
              <input
                type="checkbox"
                className="h-4 w-4 accent-[var(--color-primary)]"
                checked={country.enabled}
                disabled={!canEdit}
                onChange={(event) => setCountries(countries.map((item, position) => (position === index ? { ...item, enabled: event.target.checked } : item)))}
              />
              {country.name}
              <span className="text-xs font-medium text-[var(--color-text-muted)]">({country.code})</span>
            </label>
            <code className="rounded bg-[var(--chart-track)] px-2 py-1 text-xs font-bold">+{country.dial_code}</code>
            <span className="w-32 text-right text-xs text-[var(--color-text-muted)]">{country.national_lengths.join(' ou ')} chiffres</span>
          </li>
        ))}
      </ul>
      {canEdit && (
        <>
          <Meta reason={reason} setReason={setReason} from={from} setFrom={setFrom} />
          <SaveBar busy={saver.busy} error={saver.error} done={saver.done} disabled={reason.trim().length < 5} onSave={() => void saver.save(countries, reason, from)} />
        </>
      )}
    </Panel>
  )
}

export default function CashbackPage() {
  return (
    <>
      <Helmet>
        <title>Cashback & pays — CECT Admin</title>
      </Helmet>
      <div className="space-y-6">
        <PageIntro title="Cashback & pays de réception" description="Règles commerciales pilotées par le Super-administrateur. Chaque enregistrement crée une version datée ; les achats déjà passés ne sont jamais recalculés." />
        <CashbackCard />
        <CountriesCard />
      </div>
    </>
  )
}
