import { useMemo } from 'react'
import { Helmet } from 'react-helmet-async'
import { Link, Navigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Activity, BadgePercent, BookOpen, CircleCheck, CreditCard, Download,
  FileKey2, Landmark, LockKeyhole, Package, Settings, ShieldCheck,
  Users, UserCog, Wallet, ArrowRight, AlertTriangle,
} from 'lucide-react'
import { useAuth } from '@/app/AuthContext'
import { get } from '@/lib/api'

type Setting = { key: string; current_value: unknown; is_sensitive: boolean }
type Role = { name: string; label: string; users_count: number; permissions: string[] }
type Security = { emails: string[]; key_validity_days: number }

const groups = [
  {
    title: 'Économie de la coopérative',
    description: 'Cours de référence, adhésions et règles de cashback, tous versionnés par le serveur.',
    icon: Wallet,
    items: [
      { key: 'rates.purchase_xof_per_yem', label: 'Achat vendeur', unit: 'FCFA / YEM' },
      { key: 'rates.sale_xof_per_yem', label: 'Vente consommateur', unit: 'FCFA / YEM' },
      { key: 'rates.transfer_xof_per_yem', label: 'Cession marchand', unit: 'FCFA / YEM' },
      { key: 'membership.fee.natural_person', label: 'Adhésion PF', unit: 'FCFA' },
      { key: 'membership.fee.legal_person', label: 'Adhésion PM', unit: 'FCFA' },
    ],
    to: '/admin/configuration?group=rates',
  },
  {
    title: 'Packs et fidélisation',
    description: 'Formules, quotas et cashback propre à chaque pack Consommateur et Personnel.',
    icon: Package,
    items: [
      { key: 'packs.max_structured_active', label: 'Packs structurés maximum', unit: '' },
    ],
    to: '/admin/packs',
  },
]

const modules = [
  { name: 'Tarifs et politiques', to: '/admin/configuration', description: 'Prix, taux, plafonds, seuils et paramètres critiques', icon: Settings },
  { name: 'Packs et quotas', to: '/admin/packs', description: 'Créer, versionner, publier et suspendre les formules', icon: Package },
  { name: 'Cashback Consommateur & Personnel', to: '/admin/packs?family=CONSOMMATEUR', description: 'Bonus YEM directement dans les packs éligibles', icon: BadgePercent },
  { name: 'Pays de paiement', to: '/admin/pays', description: 'Pays éligibles et paramètres des versements', icon: CreditCard },
  { name: 'Membres', to: '/admin/membres', description: 'Personnes physiques, morales, droits et statut', icon: Users },
  { name: 'Équipe & rôles', to: '/admin/equipe', description: 'Comptabilité, Administrateur et permissions RBAC', icon: UserCog },
  { name: 'Validations YEM', to: '/admin/validations', description: 'Vérifications et arbitrages opérés par Comptabilité', icon: CircleCheck },
  { name: 'Paiements', to: '/admin/paiements', description: 'Simulation et traçabilité des règlements', icon: CreditCard },
  { name: 'Finance', to: '/admin/finance', description: 'Décaissements, rapprochement et contre-valeurs FCFA', icon: Landmark },
  { name: 'Rapports & exports', to: '/admin/export', description: 'PDF, Excel, snapshots et historique', icon: Download },
  { name: 'Audit & supervision', to: '/admin/journal', description: 'Actions sensibles, événements et anomalies', icon: Activity },
  { name: 'Sécurité SuperAdmin', to: '/admin/securite', description: 'Trois e-mails, certificat et fichier de clé', icon: FileKey2 },
] as const

function formatValue(value: unknown, unit: string): string {
  if (typeof value === 'number') {
    return [new Intl.NumberFormat('fr-FR').format(value), unit].filter(Boolean).join(' ')
  }
  if (typeof value === 'object' && value !== null) {
    const rules = value as { enabled?: boolean; rate_bps?: number }
    if ('enabled' in rules) return rules.enabled ? `Actif · ${((rules.rate_bps ?? 0) / 100).toLocaleString('fr-FR')} %` : 'Désactivé'
  }
  return typeof value === 'string' ? `${value} ${unit}`.trim() : 'À configurer'
}

export default function SuperadminGovernancePage() {
  const { user, can } = useAuth()
  const settings = useQuery({
    queryKey: ['superadmin', 'governance', 'settings'],
    queryFn: () => get<Setting[]>('/admin/settings'),
    staleTime: 30_000,
    enabled: user?.role === 'superadmin',
  })
  const roles = useQuery({
    queryKey: ['superadmin', 'governance', 'roles'],
    queryFn: () => get<Role[]>('/admin/roles'),
    staleTime: 30_000,
    enabled: user?.role === 'superadmin',
  })
  const security = useQuery({
    queryKey: ['superadmin', 'governance', 'security'],
    queryFn: () => get<Security>('/superadmin/security'),
    enabled: user?.role === 'superadmin',
  })

  const byKey = useMemo(() => new Map((settings.data ?? []).map(item => [item.key, item])), [settings.data])
  if (!user || user.role !== 'superadmin' || !can('settings.update_critical')) return <Navigate to="/admin" replace />

  const accounting = roles.data?.find(r => r.name === 'comptabilite')
  const validatorPresent = roles.data?.some(r => r.name === 'validateur')
  const mailReady = security.data?.emails?.length === 3

  return (
    <>
      <Helmet><title>Gouvernance SuperAdmin — CECT</title></Helmet>
      <div className="space-y-6">
        <header className="rounded-3xl bg-[var(--color-surface)] p-6 ring-1 ring-[var(--color-border)]">
          <div className="flex flex-wrap items-start gap-4">
            <div className="rounded-2xl bg-[var(--color-primary)] p-3 text-white"><ShieldCheck size={28} /></div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--color-primary)]">Pilotage stratégique</p>
              <h1 className="mt-1 text-2xl font-extrabold tracking-tight">Centre de gouvernance SuperAdmin</h1>
              <p className="mt-2 max-w-3xl text-sm text-[var(--color-text-muted)]">
                Toutes les responsabilités du cahier des charges CECT v5 regroupées dans un seul espace.
                Les règles sensibles sont calculées, autorisées et historisées côté API ; les boutons ouvrent les modules existants.
              </p>
            </div>
            <Link to="/admin/pilotage" className="rounded-xl border border-[var(--color-border)] px-4 py-2.5 text-sm font-semibold hover:border-[var(--color-primary)]">Indicateurs & activité</Link>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-[var(--dash-bg)] p-4">
              <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]"><LockKeyhole size={15}/> Double protection</div>
              <p className="mt-1 font-bold">{security.isPending ? 'Vérification…' : mailReady ? '3 adresses configurées' : 'Configuration à vérifier'}</p>
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">mTLS + clé RSA + OTP, validité de clé : {security.data?.key_validity_days ?? '—'} jours</p>
            </div>
            <div className="rounded-xl bg-[var(--dash-bg)] p-4">
              <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]"><UserCog size={15}/> Rôles internes</div>
              <p className="mt-1 font-bold">{roles.isPending ? 'Chargement…' : accounting ? `Comptabilité : ${accounting.users_count} compte(s)` : 'Comptabilité à vérifier'}</p>
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">{validatorPresent ? 'Ancien rôle Validateur détecté' : 'Fonctions de validation réunies en Comptabilité'}</p>
            </div>
            <div className="rounded-xl bg-[var(--dash-bg)] p-4">
              <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]"><BookOpen size={15}/> Catalogue actif</div>
              <p className="mt-1 font-bold">{settings.isPending ? 'Chargement…' : `${settings.data?.length ?? 0} paramètres disponibles`}</p>
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">Changements avec motif, date d'effet et historique</p>
            </div>
          </div>
        </header>

        {(settings.isError || roles.isError || security.isError) && (
          <div role="alert" className="flex items-start gap-2 rounded-xl border border-amber-500/30 p-4 text-sm text-[var(--color-text)]">
            <AlertTriangle size={18}/> Certaines données de pilotage n'ont pas pu être chargées. Vérifiez la session et les droits API.
          </div>
        )}

        <section className="grid gap-4 xl:grid-cols-2">
          {groups.map(group => {
            const Icon = group.icon
            return (
              <div key={group.title} className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
                <h2 className="flex items-center gap-2 text-lg font-extrabold"><Icon size={20} className="text-[var(--color-primary)]" /> {group.title}</h2>
                <p className="mt-1 text-sm text-[var(--color-text-muted)]">{group.description}</p>
                <div className="mt-4 divide-y divide-[var(--color-border)]">
                  {group.items.map(item => (
                    <div key={item.key} className="flex items-center justify-between gap-4 py-2.5 text-sm">
                      <span className="text-[var(--color-text-muted)]">{item.label}</span>
                      <span className="text-right font-bold">{settings.isPending ? '…' : byKey.get(item.key) && !byKey.get(item.key)?.is_sensitive ? formatValue(byKey.get(item.key)?.current_value, item.unit) : 'À vérifier'}</span>
                    </div>
                  ))}
                </div>
                <Link to={group.to} className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-[var(--color-primary)]">
                  Ouvrir la gestion <ArrowRight size={16}/>
                </Link>
              </div>
            )
          })}
        </section>

        <section>
          <h2 className="mb-3 text-lg font-extrabold">Modules de supervision</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {modules.map(module => {
              const Icon = module.icon
              return (
                <Link key={module.to} to={module.to} className="group flex items-start gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 transition-colors hover:border-[var(--color-primary)]">
                  <span className="rounded-xl bg-[var(--dash-bg)] p-2.5 text-[var(--color-primary)]"><Icon size={19}/></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold">{module.name}</span>
                    <span className="mt-1 block text-xs text-[var(--color-text-muted)]">{module.description}</span>
                  </span>
                  <ArrowRight className="mt-1 shrink-0 text-[var(--color-text-muted)]" size={16}/>
                </Link>
              )
            })}
          </div>
        </section>

        <div className="flex items-start gap-3 rounded-xl border border-[var(--color-border)] p-4 text-sm">
          <CreditCard className="mt-0.5 shrink-0 text-[var(--color-primary)]" size={18}/>
          <p><strong>Environnement de recette :</strong> les opérations de paiement sont simulées. Une validation par le simulateur ne constitue pas un encaissement réel. Les taux et conditions de cession marchands restent soumis aux décisions formelles de la coopérative.</p>
        </div>
      </div>
    </>
  )
}
