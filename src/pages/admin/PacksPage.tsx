import { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { FilePlus2, Pause, Play } from 'lucide-react'
import { useAuth } from '@/app/AuthContext'
import { Panel } from '@/components/dashboard/Panel'
import { StatusBadge } from '@/components/dashboard/StatusBadge'
import type { Tone } from '@/components/dashboard/tones'
import { EmptyState } from '@/components/ui/EmptyState'
import { FormDialog, type FormField } from '@/components/ui/FormDialog'
import { getRaw, post } from '@/lib/api'
import { formatXof } from '@/lib/format'
import { ErrorLine, FIELD, GhostButton, LoadingBlock, PageIntro } from './shared'

interface Version {
  id: string
  version: number
  price_xof: number
  period: { unit: string; every: number; cycles: number } | null
  quota_per_period: string | null
  total_quota: string | null
  cumulative: boolean | null
  end_of_term: string | null
  rules: Record<string, unknown>
}

interface Plan {
  id: string
  family: string
  code: string
  name: string
  level: number | null
  description: string | null
  status: 'draft' | 'published' | 'suspended' | 'retired' | 'archived'
  current_version: Version | null
}

const FAMILIES: Record<string, { label: string; tone: Tone }> = {
  CONSOMMATEUR: { label: 'Consommateur', tone: 'primary' },
  VENDEUR: { label: 'Vendeur', tone: 'gold' },
  PERSONNEL: { label: 'Personnel', tone: 'info' },
  MARCHAND: { label: 'Marchand', tone: 'violet' },
}

const STATUS: Record<Plan['status'], { label: string; tone: Tone }> = {
  draft: { label: 'Brouillon', tone: 'neutral' },
  published: { label: 'Publié', tone: 'success' },
  suspended: { label: 'Suspendu', tone: 'warning' },
  retired: { label: 'Retiré', tone: 'neutral' },
  archived: { label: 'Archivé', tone: 'neutral' },
}

const UNIT: Record<string, string> = { month: 'mois', week: 'semaine(s)', day: 'jour(s)', year: 'an(s)' }

function versionFields(plan: Plan): FormField[] {
  const current = plan.current_version
  const fields: FormField[] = [{ name: 'price_xof', label: 'Prix (FCFA)', type: 'number', required: true, initial: current ? String(current.price_xof) : '' }]
  if (plan.family !== 'PERSONNEL') {
    fields.push(
      {
        name: 'unit',
        label: 'Unité de période',
        type: 'select',
        options: [
          { value: 'month', label: 'Mois' },
          { value: 'week', label: 'Semaine(s)' },
          { value: 'day', label: 'Jour(s)' },
        ],
        initial: current?.period?.unit ?? 'month',
      },
      { name: 'every', label: 'Une période tous les (nombre d’unités)', type: 'number', required: true, initial: String(current?.period?.every ?? 1) },
      { name: 'cycles', label: 'Nombre de périodes', type: 'number', required: true, initial: current?.period ? String(current.period.cycles) : '' },
      { name: 'quota_per_period', label: 'Quota par période (YEM)', type: 'text', required: true, initial: current?.quota_per_period ?? '' },
      {
        name: 'cumulative',
        label: 'Quota cumulable d’une période à l’autre',
        type: 'select',
        options: [
          { value: 'true', label: 'Oui' },
          { value: 'false', label: 'Non' },
        ],
        initial: String(current?.cumulative ?? true),
      },
      {
        name: 'end_of_term',
        label: 'Quota restant en fin de pack',
        type: 'select',
        options: [
          { value: 'expire', label: 'Expire' },
          { value: 'keep', label: 'Est conservé' },
        ],
        initial: current?.end_of_term ?? 'expire',
      }
    )
  }
  fields.push(
    { name: 'reason', label: 'Motif (5 caractères minimum)', type: 'textarea', required: true },
    {
      name: 'publish',
      label: 'Publication',
      type: 'select',
      options: [
        { value: 'yes', label: 'Publier tout de suite (proposée aux nouveaux souscripteurs)' },
        { value: 'no', label: 'Garder en brouillon' },
      ],
    }
  )
  return fields
}

function versionPayload(plan: Plan, values: Record<string, string>): Record<string, unknown> {
  const payload: Record<string, unknown> = { price_xof: Number(values.price_xof), reason: values.reason }
  if (plan.family !== 'PERSONNEL') {
    payload.period = { unit: values.unit, every: Number(values.every), cycles: Number(values.cycles) }
    payload.quota_per_period = values.quota_per_period.trim().replace(',', '.')
    payload.cumulative = values.cumulative === 'true'
    payload.end_of_term = values.end_of_term
  }
  if (plan.current_version && Object.keys(plan.current_version.rules).length > 0) payload.rules = plan.current_version.rules
  return payload
}

function yem(value: string | null): string {
  if (value === null) return '—'
  return `${Number.parseFloat(value).toLocaleString('fr-FR', { maximumFractionDigits: 6 })} YEM`
}

export default function PacksPage() {
  const { can } = useAuth()
  const queryClient = useQueryClient()
  const [family, setFamily] = useState('')
  const [target, setTarget] = useState<{ plan: Plan; to: 'published' | 'suspended' } | null>(null)
  const [versionTarget, setVersionTarget] = useState<Plan | null>(null)
  const query = useQuery({ queryKey: ['admin-plans', family], queryFn: () => getRaw<{ data: Plan[] }>('/admin/packs/plans', { per_page: 100, ...(family ? { family } : {}) }), staleTime: 0 })
  const plans = query.data?.data ?? []

  return (
    <>
      <Helmet>
        <title>Packs — CECT Admin</title>
      </Helmet>
      <div className="space-y-6">
        <PageIntro
          title="Packs"
          description="Catalogue des packs et conditions en vigueur. Chaque modification crée une nouvelle version, sans toucher aux packs déjà souscrits."
          actions={
            <select aria-label="Famille" value={family} onChange={(event) => setFamily(event.target.value)} className={FIELD}>
              <option value="">Toutes les familles</option>
              {Object.entries(FAMILIES).map(([value, item]) => (
                <option key={value} value={value}>
                  {item.label}
                </option>
              ))}
            </select>
          }
        />

        {query.isPending && <LoadingBlock />}
        {query.isError && <ErrorLine message="Impossible de charger les packs." />}
        {query.isSuccess && plans.length === 0 && <EmptyState title="Aucun pack" description="Aucun pack ne correspond à ce filtre." />}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {plans.map((plan) => {
            const meta = FAMILIES[plan.family] ?? { label: plan.family, tone: 'neutral' as Tone }
            const status = STATUS[plan.status]
            const version = plan.current_version
            return (
              <Panel key={plan.id} title={plan.name} subtitle={`${meta.label} · ${plan.code}`} action={<StatusBadge label={status.label} tone={status.tone} />}>
                <dl className="space-y-2 text-sm">
                  <Row label="Prix" value={version ? formatXof(version.price_xof) : '—'} />
                  <Row label="Version en vigueur" value={version ? `v${version.version}` : '—'} />
                  {version?.period && <Row label="Durée" value={`${version.period.cycles} × ${version.period.every} ${UNIT[version.period.unit] ?? version.period.unit}`} />}
                  <Row label="Quota par période" value={yem(version?.quota_per_period ?? null)} />
                  <Row label="Quota total" value={yem(version?.total_quota ?? null)} />
                </dl>
                {plan.description && <p className="mt-3 line-clamp-2 text-xs text-[var(--color-text-muted)]">{plan.description}</p>}
                {can('packs.manage') && plan.status !== 'retired' && plan.status !== 'archived' && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <GhostButton onClick={() => setVersionTarget(plan)}>
                      <FilePlus2 size={15} aria-hidden /> Nouvelle version
                    </GhostButton>
                    {plan.status === 'published' ? (
                      <GhostButton onClick={() => setTarget({ plan, to: 'suspended' })}>
                        <Pause size={15} aria-hidden /> Suspendre
                      </GhostButton>
                    ) : plan.status === 'suspended' ? (
                      <GhostButton onClick={() => setTarget({ plan, to: 'published' })}>
                        <Play size={15} aria-hidden /> Réactiver
                      </GhostButton>
                    ) : null}
                  </div>
                )}
              </Panel>
            )
          })}
        </div>
      </div>

      {versionTarget && (
        <FormDialog
          title="Nouvelle version"
          subtitle={`${versionTarget.name} (${versionTarget.code}) — les packs déjà souscrits ne sont pas modifiés`}
          submitLabel="Créer la version"
          fields={versionFields(versionTarget)}
          onClose={() => setVersionTarget(null)}
          onSubmit={async (values) => {
            const created = await post<Version>(`/admin/packs/plans/${versionTarget.id}/versions`, versionPayload(versionTarget, values))
            if (values.publish === 'yes') await post(`/admin/packs/plans/${versionTarget.id}/versions/${created.id}/publish`)
            await queryClient.invalidateQueries({ queryKey: ['admin-plans'] })
          }}
        />
      )}

      {target && (
        <FormDialog
          title={target.to === 'suspended' ? 'Suspendre le pack' : 'Réactiver le pack'}
          subtitle={`${target.plan.name} (${target.plan.code})`}
          submitLabel={target.to === 'suspended' ? 'Suspendre' : 'Réactiver'}
          danger={target.to === 'suspended'}
          fields={[{ name: 'reason', label: 'Motif (5 caractères minimum)', type: 'textarea', required: true }]}
          onClose={() => setTarget(null)}
          onSubmit={async (values) => {
            await post(`/admin/packs/plans/${target.plan.id}/transition`, { to: target.to, reason: values.reason })
            await queryClient.invalidateQueries({ queryKey: ['admin-plans'] })
          }}
        />
      )}
    </>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-[var(--color-text-muted)]">{label}</dt>
      <dd className="font-semibold text-[var(--color-text)] [font-variant-numeric:tabular-nums]">{value}</dd>
    </div>
  )
}
