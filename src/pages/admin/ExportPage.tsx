import { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, FileSpreadsheet, History } from 'lucide-react'
import { useAuth } from '@/app/AuthContext'
import { Panel } from '@/components/dashboard/Panel'
import { StatusBadge } from '@/components/dashboard/StatusBadge'
import { downloadFile, get, post } from '@/lib/api'
import { formatDateMedium } from '@/lib/format'
import { authErrorMessage } from '@/features/auth/errors'

const EXPORTS = [
  { type: 'members', title: 'Liste des membres', desc: 'Identité, Pernum, statut du compte et de l’adhésion, familles de packs, solde YEM.' },
  { type: 'payments', title: 'Paiements', desc: 'Paiements avec date, membre, objet, montant, frais et moyen de paiement.' },
  { type: 'subscriptions', title: 'Souscriptions', desc: 'Packs souscrits avec dates de début et de fin, quotas et soldes.' },
  { type: 'merchant_payments', title: 'Paiements marchands', desc: 'Paiements de YEM aux marchands avec leur statut de confirmation.' },
] as const

interface Snapshot {
  id: string
  version: number
  status: string
  trigger: string
  size_bytes: number | null
  generated_at: string | null
  created_at: string
}

function formatSize(bytes: number | null): string {
  if (bytes === null) return '—'
  return bytes > 1_048_576 ? `${(bytes / 1_048_576).toFixed(1).replace('.', ',')} Mo` : `${Math.max(1, Math.round(bytes / 1024))} Ko`
}

export default function ExportPage() {
  const { can } = useAuth()
  const queryClient = useQueryClient()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const snapshots = useQuery({ queryKey: ['snapshots'], queryFn: () => get<Snapshot[]>('/admin/snapshots'), enabled: can('reports.view'), staleTime: 0 })

  async function run(key: string, action: () => Promise<void>) {
    setBusy(key)
    setError(null)
    try {
      await action()
    } catch (caught) {
      setError(authErrorMessage(caught))
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <Helmet>
        <title>Exports — CECT Admin</title>
      </Helmet>

      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-extrabold tracking-tight text-[var(--color-text)]">Exports</h1>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">Fichiers CSV (séparateur « ; », UTF-8) à ouvrir directement dans Excel. Chaque export demande une confirmation par code e-mail.</p>
        </header>

        {error && (
          <p role="alert" className="rounded-xl border border-[var(--color-danger)]/20 bg-[var(--color-danger)]/5 px-4 py-3 text-sm text-[var(--color-danger)]">
            {error}
          </p>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {EXPORTS.map((item) => (
            <article key={item.type} className="flex flex-col rounded-3xl border border-[var(--color-border)] bg-[var(--dash-card)] p-5 shadow-[var(--shadow-card)]">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                <FileSpreadsheet size={20} aria-hidden />
              </span>
              <h2 className="mt-3 text-base font-bold text-[var(--color-text)]">{item.title}</h2>
              <p className="mt-1 flex-1 text-sm text-[var(--color-text-muted)]">{item.desc}</p>
              <button
                type="button"
                disabled={!can('reports.export') || busy !== null}
                onClick={() => void run(item.type, () => downloadFile(`/admin/exports/${item.type}`, `${item.type}.csv`))}
                className="mt-4 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] px-5 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
              >
                <Download size={16} aria-hidden />
                {busy === item.type ? 'Préparation…' : 'Télécharger'}
              </button>
            </article>
          ))}
        </div>

        {can('reports.view') && (
          <Panel
            title="Snapshots consolidés"
            subtitle="Sauvegardes complètes des données, contrôlables par empreinte"
            action={
              can('reports.export') ? (
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() =>
                    void run('snapshot', async () => {
                      await post('/admin/snapshots')
                      await queryClient.invalidateQueries({ queryKey: ['snapshots'] })
                    })
                  }
                  className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-[var(--color-border)] px-4 text-sm font-semibold hover:bg-[var(--dash-bg)] disabled:opacity-50"
                >
                  <History size={15} aria-hidden />
                  Générer
                </button>
              ) : undefined
            }
            flush
          >
            {snapshots.isPending && <div className="mx-5 mb-4 h-20 animate-pulse rounded-2xl bg-[var(--chart-track)]" />}
            {snapshots.data && snapshots.data.length === 0 && <p className="px-6 pb-5 text-sm text-[var(--color-text-muted)]">Aucun snapshot pour le moment.</p>}
            <ul className="divide-y divide-[var(--color-border)]">
              {snapshots.data?.map((snapshot) => (
                <li key={snapshot.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5 sm:px-6">
                  <span className="min-w-0 flex-1 basis-40">
                    <span className="block text-sm font-bold text-[var(--color-text)]">Version {snapshot.version}</span>
                    <span className="block text-xs text-[var(--color-text-muted)]">
                      {formatDateMedium(snapshot.generated_at ?? snapshot.created_at)} · {formatSize(snapshot.size_bytes)}
                    </span>
                  </span>
                  <StatusBadge label={snapshot.status === 'ready' ? 'Prêt' : snapshot.status === 'failed' ? 'Échec' : 'En cours'} tone={snapshot.status === 'ready' ? 'success' : snapshot.status === 'failed' ? 'danger' : 'info'} />
                  {snapshot.status === 'ready' && can('reports.export') && (
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => void run(snapshot.id, () => downloadFile(`/admin/snapshots/${snapshot.id}/download`, `snapshot-${snapshot.version}.zip`))}
                      className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-[var(--color-border)] px-3 text-xs font-bold hover:bg-[var(--dash-bg)] disabled:opacity-50"
                    >
                      <Download size={14} aria-hidden />
                      Télécharger
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </div>
    </>
  )
}
