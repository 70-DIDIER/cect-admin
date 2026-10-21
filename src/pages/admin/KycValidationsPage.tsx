import { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, FileSearch2, ShieldCheck, XCircle } from 'lucide-react'
import { get, getRaw, post, downloadFile, toApiError } from '@/lib/api'
import { Panel } from '@/components/dashboard/Panel'
import { useAuth } from '@/app/AuthContext'

type Status = 'submitted' | 'approved' | 'rejected' | 'needs_information'
interface Summary {
  id: string
  status: Status
  submitted_at: string
  reviewed_at: string | null
  review_reason: string | null
  person: { name: string; email: string; person_type: string; member_number: string | null }
  documents: { front: boolean; back: boolean; company: boolean }
  verification_mode: string
  provider_status?: string | null
  provider_checks?: { document?: boolean; active_liveness?: boolean; face_match?: boolean; business_verified?: boolean; complete?: boolean } | null
}
interface Detail extends Summary {
  identity: { document_type: string; document_number: string; document_country: string; date_of_birth: string; address: string } | null
}
interface QueueResponse { data: Summary[]; meta: { total: number; current_page: number; last_page: number } }

const statuses: { code: Status; label: string }[] = [
  { code: 'submitted', label: 'À contrôler' },
  { code: 'needs_information', label: 'À compléter' },
  { code: 'rejected', label: 'Rejetés' },
  { code: 'approved', label: 'Approuvés' },
]

export default function KycValidationsPage() {
  const { can } = useAuth()
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<Status>('submitted')
  const [selected, setSelected] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const queue = useQuery({
    queryKey: ['kyc-queue', status],
    queryFn: () => getRaw<QueueResponse>('/kyc/cases', { status }),
    enabled: can('kyc.review'),
    staleTime: 0,
  })
  const detail = useQuery({
    queryKey: ['kyc-case', selected],
    queryFn: () => get<Detail>('/kyc/cases/' + selected),
    enabled: Boolean(selected) && can('kyc.review'),
  })

  async function decide(decision: 'approved' | 'rejected' | 'needs_information') {
    if (!selected) return
    if (decision !== 'approved' && reason.trim().length < 10) {
      setError('Saisissez un motif d’au moins 10 caractères.')
      return
    }
    if (!window.confirm(decision === 'approved' ?
      'Confirmez-vous avoir contrôlé l’authenticité et la concordance des pièces ?' :
      'Enregistrer cette décision ?')) return
    setLoading(true)
    setError(null)
    try {
      await post('/kyc/cases/' + selected + '/decision', { decision, reason: reason.trim() || null })
      setSelected(null)
      setReason('')
      await queryClient.invalidateQueries({ queryKey: ['kyc-queue'] })
    } catch (err) {
      setError(toApiError(err).message)
    } finally {
      setLoading(false)
    }
  }

  async function document(type: 'front' | 'back' | 'company') {
    if (!selected) return
    try {
      await downloadFile('/kyc/cases/' + selected + '/documents/' + type, 'cect-kyc-' + type)
    } catch (err) { setError(toApiError(err).message) }
  }

  return (
    <>
      <Helmet><title>Vérifications KYC — CECT Admin</title></Helmet>
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-extrabold tracking-tight">Contrôle d’identité KYC</h1>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">
            Contrôlez les dossiers PF et PM avant le paiement des droits d'adhésion.
          </p>
        </header>
        {!can('kyc.review') ? <p role="alert">Accès réservé au Validateur KYC.</p> : (
          <>
            <div className="flex flex-wrap gap-2">
              {statuses.map(item => <button type="button" key={item.code}
                onClick={() => { setStatus(item.code); setSelected(null); setError(null) }}
                className={item.code === status
                  ? 'rounded-xl bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white'
                  : 'rounded-xl border border-[var(--color-border)] px-4 py-2 text-sm font-semibold'}
              >{item.label}</button>)}
            </div>
            <Panel title={'Dossiers KYC — ' + (statuses.find(s => s.code === status)?.label ?? status)}>
              {queue.isPending && <p>Chargement…</p>}
              {queue.isError && <p role="alert">Erreur de chargement des dossiers.</p>}
              {queue.data?.data.length === 0 && <p>Aucun dossier.</p>}
              <ul className="divide-y divide-[var(--color-border)]">
                {queue.data?.data.map(item => <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <strong className="text-sm">{item.person.name}</strong>
                    <p className="text-xs text-[var(--color-text-muted)]">{item.person.email} · {item.person.member_number}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">{item.person.person_type === 'legal' ? 'PM' : 'PF'} · {new Date(item.submitted_at).toLocaleString('fr-FR')}</p>
                  </div>
                  <button type="button" onClick={() => { setSelected(item.id); setError(null) }}
                    className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-border)] px-4 py-2 text-sm font-semibold">
                    <FileSearch2 size={16} /> Examiner
                  </button>
                </li>)}
              </ul>
            </Panel>
            {selected && <Panel title="Examen du dossier">
              {detail.isPending && <p>Chargement du dossier…</p>}
              {detail.isError && <p role="alert">Erreur lors de l’ouverture.</p>}
              {detail.data && <div className="space-y-4">
                <div className="grid gap-3 text-sm sm:grid-cols-2">
                  <p><strong>Identité :</strong> {detail.data.person.name}</p>
                  {detail.data.verification_mode === 'didit' && <p><strong>Prestataire :</strong> Didit · {detail.data.provider_status ?? 'En cours'}</p>}
                  {detail.data.identity && <>
                  <p><strong>Document :</strong> {detail.data.identity.document_type}</p>
                  <p><strong>Numéro :</strong> {detail.data.identity.document_number}</p>
                  <p><strong>Pays :</strong> {detail.data.identity.document_country}</p>
                  <p><strong>Naissance :</strong> {detail.data.identity.date_of_birth}</p>
                  <p><strong>Adresse :</strong> {detail.data.identity.address}</p>
                  </>}
                </div>
                {detail.data.verification_mode === 'didit' && <div className="rounded-xl border border-[var(--color-border)] p-4 text-sm">
                  <p className="mb-2 font-bold">Résultats de vérification Didit</p>
                  <p>Pièce officielle : {detail.data.provider_checks?.document ? 'Validée' : 'Non confirmée'}</p>
                  <p>Selfie / preuve de vie active : {detail.data.provider_checks?.active_liveness ? 'Validée' : 'Non confirmée'}</p>
                  <p>Comparaison faciale : {detail.data.provider_checks?.face_match ? 'Validée' : 'Non confirmée'}</p>
                  {detail.data.person.person_type === 'legal' && <p>Vérification entreprise (KYB) : {detail.data.provider_checks?.business_verified ? 'Validée' : 'Non confirmée'}</p>}
                  {!detail.data.provider_checks?.complete && <p role="alert" className="mt-2 font-semibold">
                    Les contrôles biométriques ne sont pas tous confirmés : approbation bloquée.
                  </p>}
                </div>}
                <div className="flex flex-wrap gap-2">
                  {(['front', 'back', 'company'] as const).filter(t => detail.data?.documents[t]).map(t =>
                    <button type="button" key={t} onClick={() => void document(t)}
                      className="rounded-xl border border-[var(--color-border)] px-4 py-2 text-sm font-semibold">
                      Télécharger {t === 'front' ? 'recto' : t === 'back' ? 'verso' : 'document société'}
                    </button>)}
                </div>
                {detail.data.status === 'submitted' && <>
                  <p className="rounded-xl border border-[var(--color-border)] p-3 text-sm">
                    <ShieldCheck size={17} className="mr-2 inline" />
                    Comparez les informations aux justificatifs officiels. La simple réception d’un fichier n’est pas une vérification d'identité.
                  </p>
                  <div>
                    <label htmlFor="kyc-reason" className="mb-1 block text-sm font-semibold">Motif de refus ou demande de complément</label>
                    <textarea id="kyc-reason" rows={3} maxLength={1000}
                      className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3 text-sm"
                      value={reason} onChange={e => setReason(e.target.value)} />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" disabled={loading || (detail.data.verification_mode === 'didit'
                      && (!detail.data.provider_checks?.complete
                        || (detail.data.person.person_type === 'legal' && !detail.data.provider_checks?.business_verified)))}
                      onClick={() => void decide('approved')}
                      className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--color-primary)] px-4 text-sm font-bold text-white disabled:opacity-50">
                      <CheckCircle2 size={18} /> Approuver
                    </button>
                    <button type="button" disabled={loading} onClick={() => void decide('needs_information')}
                      className="rounded-xl border border-[var(--color-border)] px-4 text-sm font-semibold">Complément</button>
                    <button type="button" disabled={loading} onClick={() => void decide('rejected')}
                      className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-danger)]/50 px-4 text-sm font-semibold text-[var(--color-danger)]">
                      <XCircle size={18} /> Rejeter
                    </button>
                  </div>
                </>}
                {error && <p role="alert" className="text-sm text-[var(--color-danger)]">{error}</p>}
                <button type="button" onClick={() => setSelected(null)} className="text-sm underline">Fermer</button>
              </div>}
            </Panel>}
          </>
        )}
      </div>
    </>
  )
}
