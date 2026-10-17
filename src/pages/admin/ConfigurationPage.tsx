import { useMemo, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Lock, Pencil, Search } from 'lucide-react'
import { useAuth } from '@/app/AuthContext'
import { Panel } from '@/components/dashboard/Panel'
import { StatusBadge } from '@/components/dashboard/StatusBadge'
import { FormDialog, type FormField } from '@/components/ui/FormDialog'
import { newIdempotencyKey, put, get } from '@/lib/api'

interface Setting {
  key: string
  group: string
  type: 'integer' | 'decimal' | 'string' | 'boolean' | 'json'
  description: string
  edit_level: 'administrator' | 'superadmin' | string
  is_sensitive: boolean
  current_value: unknown
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
  const [group, setGroup] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Setting | null>(null)
  const query = useQuery({ queryKey: ['settings'], queryFn: () => get<Setting[]>('/admin/settings'), staleTime: 0 })

  const groups = useMemo(() => [...new Set((query.data ?? []).map((setting) => setting.group))], [query.data])
  const visible = (query.data ?? []).filter((setting) => {
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
  return (
    <FormDialog
      title="Modifier le paramètre"
      subtitle={setting.key}
      submitLabel="Enregistrer"
      fields={[
        fieldFor(setting),
        { name: 'reason', label: 'Motif (5 caractères minimum)', type: 'textarea', required: true },
        { name: 'effective_from', label: 'Date d’entrée en vigueur (facultatif)', type: 'date' },
      ]}
      onClose={onClose}
      onSubmit={async (values) => {
        let value: unknown
        try {
          value = parseValue(setting, values.value ?? '')
        } catch {
          throw new Error('Valeur invalide.')
        }
        const from = values.effective_from ? new Date(`${values.effective_from}T00:00:00`).toISOString() : null
        await put(`/admin/settings/${setting.key}`, { value, reason: values.reason, effective_from: from }, key)
        await onSaved()
      }}
    >
      <p className="text-sm text-[var(--color-text-muted)]">{setting.description}</p>
    </FormDialog>
  )
}
