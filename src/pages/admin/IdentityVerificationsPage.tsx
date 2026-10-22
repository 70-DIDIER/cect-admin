import { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/app/AuthContext'
import { PageHeader } from '@/components/ui/PageHeader'
import { downloadFile, get, getRaw, post } from '@/lib/api'
import { authErrorMessage } from '@/features/auth/errors'

type VerificationStatus = 'pending' | 'approved' | 'rejected'
type Attachment = 'front' | 'back' | 'selfie'

interface Member {
  id: string
  first_name: string
  last_name: string
  legal_name: string | null
  email: string
  member_number: string | null
}
interface IdentityVerification {
  id: string
  status: VerificationStatus
  document_label: string
  document_number: string | null
  rejection_reason: string | null
  submitted_at: string
  reviewed_at: string | null
  files: Attachment[]
  member: Member
}
interface PaginatedIdentities {
  data: IdentityVerification[]
  meta: { current_page: number; last_page: number; total: number }
}

const FILE_LABELS: Record<Attachment, string> = { front: 'Recto / page principale', back: 'Verso', selfie: 'Selfie' }
const STATUS_LABELS: Record<VerificationStatus, string> = { pending: 'En attente', approved: 'Approuvée', rejected: 'Rejetée' }

export default function IdentityVerificationsPage() {
  const { can } = useAuth()
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<VerificationStatus>('pending')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [working, setWorking] = useState(false)
  const [fileBusy, setFileBusy] = useState<Attachment | null>(null)

  const list = useQuery({
    queryKey: ['identity-verifications', status, page],
    queryFn: () => getRaw<PaginatedIdentities>('/admin/identity-verifications', { status, page, per_page: 20 }),
    staleTime: 0,
  })
  const detail = useQuery({
    queryKey: ['identity-verification-admin', selected],
    queryFn: () => get<IdentityVerification>(`/admin/identity-verifications/${selected}`),
    enabled: selected !== null,
    staleTime: 0,
  })

  async function review(decision: 'approve' | 'reject') {
    if (!selected || !can('identity_verifications.review')) return
    if (decision === 'reject' && reason.trim().length < 5) {
      setError('Indiquez un motif de rejet contenant au moins 5 caractères.')
      return
    }
    setWorking(true)
    setError(null)
    try {
      await post(`/admin/identity-verifications/${selected}/${decision}`, decision === 'reject' ? { reason: reason.trim() } : undefined)
      await queryClient.invalidateQueries({ queryKey: ['identity-verifications'] })
      await queryClient.invalidateQueries({ queryKey: ['identity-verification-admin', selected] })
      setSelected(null)
      setReason('')
    } catch (caught) {
      setError(authErrorMessage(caught))
    } finally {
      setWorking(false)
    }
  }

  async function download(file: Attachment) {
    if (!selected) return
    setFileBusy(file)
    setError(null)
    try {
      await downloadFile(`/admin/identity-verifications/${selected}/files/${file}`, `cect-identite-${selected}-${file}`)
    } catch (caught) {
      setError(authErrorMessage(caught))
    } finally {
      setFileBusy(null)
    }
  }

  if (!can('identity_verifications.view')) {
    return <p role="alert">Vous n’avez pas l’autorisation de consulter les dossiers d’identité.</p>
  }

  return (
    <>
      <Helmet><title>Vérifications d’identité — CECT Admin</title></Helmet>
      <div className="space-y-6">
        <PageHeader title="Vérifications d’identité" description="Examinez les pièces et selfies déposés par les membres avant d’autoriser les souscriptions." />
        <div className="flex flex-wrap gap-2" aria-label="Filtrer les vérifications">
          {(['pending', 'approved', 'rejected'] as const).map((item) => (
            <button key={item} type="button" aria-pressed={status === item} onClick={() => { setStatus(item); setPage(1); setSelected(null) }}
              className={`rounded-xl px-4 py-2 text-sm font-semibold ${status === item ? 'bg-[var(--color-primary)] text-white' : 'border border-[var(--color-border)]'}`}>
              {STATUS_LABELS[item]}
            </button>
          ))}
        </div>
        {list.isPending && <p role="status">Chargement de la file de vérification…</p>}
        {list.isError && <p role="alert">Impossible de charger les dossiers. <button type="button" className="underline" onClick={() => void list.refetch()}>Réessayer</button></p>}
        {list.data && (
          <section className="overflow-hidden rounded-xl border border-[var(--color-border)]" aria-label="Dossiers d’identité">
            <p className="border-b border-[var(--color-border)] p-4 text-sm text-[var(--color-text-muted)]">{list.data.meta.total} dossier(s) · {STATUS_LABELS[status].toLowerCase()}</p>
            {list.data.data.length === 0 && <p className="p-5 text-sm">Aucun dossier pour ce statut.</p>}
            <ul className="divide-y divide-[var(--color-border)]">
              {list.data.data.map((record) => (
                <li key={record.id}>
                  <button type="button" onClick={() => { setSelected(record.id); setError(null); setReason('') }} className="flex min-h-16 w-full flex-wrap items-center justify-between gap-2 p-4 text-left hover:bg-[var(--dash-bg)]">
                    <span><strong>{record.member.legal_name || `${record.member.first_name} ${record.member.last_name}`}</strong><span className="ml-2 text-sm text-[var(--color-text-muted)]">{record.member.email}</span></span>
                    <span className="text-xs text-[var(--color-text-muted)]">{record.document_label} · {new Date(record.submitted_at).toLocaleDateString('fr-FR')}</span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between gap-3 border-t border-[var(--color-border)] p-4 text-sm">
              <button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="underline disabled:opacity-50">Précédent</button>
              <span>Page {list.data.meta.current_page} / {list.data.meta.last_page}</span>
              <button type="button" disabled={page >= list.data.meta.last_page} onClick={() => setPage((value) => value + 1)} className="underline disabled:opacity-50">Suivant</button>
            </div>
          </section>
        )}
        {selected && (
          <section className="space-y-4 rounded-xl border border-[var(--color-border)] bg-[var(--dash-card)] p-5" aria-label="Examen du dossier">
            <div className="flex justify-between gap-2">
              <h2 className="font-bold">Examen du dossier</h2>
              <button type="button" className="underline" onClick={() => { setSelected(null); setError(null) }}>Fermer</button>
            </div>
            {detail.isPending && <p role="status">Chargement des justificatifs…</p>}
            {detail.isError && <p role="alert">Le dossier n’a pas pu être chargé.</p>}
            {detail.data && (
              <>
                <dl className="grid gap-2 text-sm sm:grid-cols-2">
                  <div><dt className="text-[var(--color-text-muted)]">Membre</dt><dd>{detail.data.member.legal_name || `${detail.data.member.first_name} ${detail.data.member.last_name}`}</dd></div>
                  <div><dt className="text-[var(--color-text-muted)]">E-mail</dt><dd>{detail.data.member.email}</dd></div>
                  <div><dt className="text-[var(--color-text-muted)]">Document</dt><dd>{detail.data.document_label}</dd></div>
                  <div><dt className="text-[var(--color-text-muted)]">Numéro de document</dt><dd>{detail.data.document_number || 'Non renseigné'}</dd></div>
                  <div><dt className="text-[var(--color-text-muted)]">État</dt><dd>{STATUS_LABELS[detail.data.status]}</dd></div>
                </dl>
                <div className="flex flex-wrap gap-2">
                  {detail.data.files.map((file) => (
                    <button type="button" key={file} disabled={fileBusy !== null} onClick={() => void download(file)}
                      className="rounded-xl border border-[var(--color-border)] px-3 py-2 text-sm disabled:opacity-50">
                      {fileBusy === file ? 'Téléchargement…' : `Télécharger : ${FILE_LABELS[file]}`}
                    </button>
                  ))}
                </div>
                {detail.data.rejection_reason && <p className="text-sm">Motif précédent : {detail.data.rejection_reason}</p>}
                {detail.data.status === 'pending' && can('identity_verifications.review') && (
                  <div className="space-y-3 border-t border-[var(--color-border)] pt-4">
                    <label htmlFor="kyc-rejection-reason" className="block text-sm font-semibold">Motif en cas de rejet (minimum 5 caractères)</label>
                    <textarea id="kyc-rejection-reason" value={reason} maxLength={1000} rows={3} onChange={(event) => setReason(event.target.value)} className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3" />
                    <div className="flex flex-wrap gap-3">
                      <button type="button" disabled={working} onClick={() => void review('approve')} className="rounded-xl bg-[var(--color-primary)] px-4 py-2 font-semibold text-white disabled:opacity-50">Approuver l’identité</button>
                      <button type="button" disabled={working || reason.trim().length < 5} onClick={() => void review('reject')} className="rounded-xl border border-[var(--color-danger)] px-4 py-2 font-semibold text-[var(--color-danger)] disabled:opacity-50">Rejeter le dossier</button>
                    </div>
                    <p className="text-xs text-[var(--color-text-muted)]">Ces actions sont auditées et nécessitent une vérification de sécurité renforcée.</p>
                  </div>
                )}
              </>
            )}
            {error && <p role="alert" className="text-sm text-[var(--color-danger)]">{error}</p>}
          </section>
        )}
      </div>
    </>
  )
}
