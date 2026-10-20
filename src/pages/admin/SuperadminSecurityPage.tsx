import { useState, type FormEvent } from 'react'
import { Helmet } from 'react-helmet-async'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/app/AuthContext'
import { get, post, toApiError } from '@/lib/api'

export default function SuperadminSecurityPage() {
  const { user } = useAuth()
  const client = useQueryClient()
  const query = useQuery({ queryKey: ['superadmin-security'], queryFn: () => get<{emails: string[];key_validity_days:number}>('/superadmin/security'), enabled: user?.role === 'superadmin' })
  const [emails, setEmails] = useState<string[] | null>(null)
  const [challenge, setChallenge] = useState('')
  const [codes, setCodes] = useState(['', '', ''])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  if (user?.role !== 'superadmin') return <Navigate to="/admin" replace />
  const values = emails ?? query.data?.emails ?? ['', '', '']
  async function run(event: FormEvent, callback: () => Promise<void>) {
    event.preventDefault(); setBusy(true); setError('')
    try { await callback() } catch (e) { setError(toApiError(e).message) } finally { setBusy(false) }
  }
  return <div className="max-w-2xl space-y-5">
    <Helmet><title>Sécurité SuperAdmin — CECT</title></Helmet>
    <header><h1 className="text-2xl font-extrabold">Sécurité SuperAdmin</h1>
      <p className="text-sm text-[var(--color-text-muted)]">Les trois adresses e-mail ont été configurées à la première connexion. Tout changement est confirmé sur les nouvelles boîtes.</p></header>
    {query.isError && <p role="alert">Impossible de vérifier la session de sécurité mTLS.</p>}
    {error && <p role="alert" className="text-red-600">{error}</p>}
    {query.data && <p className="text-sm">Durée de validité maximale du fichier : {query.data.key_validity_days} jours. Renouvellement uniquement en cas de perte, d’expiration ou de demande de sécurité.</p>}
    <form className="space-y-4 rounded-2xl border border-[var(--color-border)] p-5" onSubmit={(e) => void run(e, async () => {
      if (!challenge) {
        const result = await post<{challenge_id:string}>('/superadmin/emails/start', { emails: values })
        setChallenge(result.challenge_id)
      } else {
        await post('/superadmin/emails/finish', { challenge_id: challenge, codes })
        setChallenge(''); setCodes(['', '', '']); setEmails(null)
        await client.invalidateQueries({ queryKey: ['superadmin-security'] })
      }
    })}>
      {!challenge ? <>
        {values.map((value, i) => <label key={i} className="block text-sm font-semibold">Adresse de vérification {i + 1}
          <input required type="email" value={value} onChange={(e) => setEmails(values.map((mail,j) => j === i ? e.target.value : mail))}
            className="mt-1 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3" />
        </label>)}
        <button disabled={busy || !query.data} className="rounded-xl bg-[var(--color-primary)] px-5 py-3 font-semibold text-white disabled:opacity-60">Vérifier les nouvelles adresses</button>
      </> : <>
        <p className="text-sm">Trois codes <strong>différents</strong> ont été envoyés, un à chacune des nouvelles adresses.</p>
        {codes.map((value,i) => <label key={i} className="block text-sm font-semibold">Code e-mail {i + 1}
          <input required pattern="[0-9]{6}" inputMode="numeric" maxLength={6} value={value}
            onChange={(e) => setCodes(codes.map((c,j) => j === i ? e.target.value.replace(/\D/g,'').slice(0,6) : c))}
            className="mt-1 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3" />
        </label>)}
        <button disabled={busy || codes.some(c=>c.length!==6)} className="rounded-xl bg-[var(--color-primary)] px-5 py-3 font-semibold text-white disabled:opacity-60">Confirmer les trois adresses</button>
      </>}
    </form>
  </div>
}
