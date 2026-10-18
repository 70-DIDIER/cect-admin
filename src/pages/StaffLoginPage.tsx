import { useState, type FormEvent } from 'react'
import { Helmet } from 'react-helmet-async'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { KeyRound, LockKeyhole, Mail, ShieldCheck } from 'lucide-react'
import { useAuth } from '@/app/AuthContext'
import { post } from '@/lib/api'
import { authErrorMessage } from '@/features/auth/errors'

const INPUT = 'w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary)]'

/** Dedicated no-password login for CECT Administrator and Accounting staff. */
export default function StaffLoginPage() {
  const navigate = useNavigate()
  const { user, refresh } = useAuth()
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [challenge, setChallenge] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  if (user && !challenge) return <Navigate to="/admin" replace />

  async function start(event: FormEvent) {
    event.preventDefault()
    setBusy(true); setError('')
    try {
      const result = await post<{ challenge_id: string }>('/auth/staff/login/start', { email })
      setChallenge(result.challenge_id); setCode('')
    } catch (caught) { setError(authErrorMessage(caught)) }
    finally { setBusy(false) }
  }
  async function confirm(event: FormEvent) {
    event.preventDefault()
    setBusy(true); setError('')
    try {
      await post('/auth/staff/login/verify', { challenge_id: challenge, code })
      const active = await refresh()
      if (!active) throw new Error('Session refusée ou en dehors des horaires de connexion.')
      navigate('/admin', { replace: true })
    } catch (caught) { setError(authErrorMessage(caught)) }
    finally { setBusy(false) }
  }
  return (
    <main className="relative grid min-h-screen overflow-hidden bg-[var(--dash-bg)] lg:grid-cols-2">
      <Helmet><title>Connexion du personnel — CECT</title></Helmet>
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-[#071e15] p-12 text-white lg:flex">
        <div className="absolute -right-44 -top-40 h-[35rem] w-[35rem] rounded-full bg-emerald-500/10 blur-3xl"/>
        <div className="relative flex items-center gap-4">
          <img src="/logos/CECT_logo_transparent.png" className="h-14 w-14 rounded-2xl bg-white p-2" alt="CECT"/>
          <div><p className="text-xl font-extrabold">CECT · Équipe</p><p className="text-sm text-white/55">Console privée</p></div>
        </div>
        <div className="relative max-w-lg">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300"><ShieldCheck size={16}/> Contrôle d'accès renforcé</div>
          <h1 className="text-5xl font-extrabold tracking-tight">Chaque accès est autorisé et traçable.</h1>
          <p className="mt-6 max-w-md text-base leading-7 text-white/60">Administrateur et Comptabilité : connexion sans mot de passe, validation à trois adresses de sécurité et horaires configurés par le SuperAdmin.</p>
        </div>
        <p className="text-xs text-white/35">CECT Togo · Accès nominatif · Journalisation de sécurité</p>
      </aside>
      <section className="flex items-center justify-center px-5 py-16">
        <div className="w-full max-w-md">
          <div className="mb-8 flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-700 text-white shadow-lg"><LockKeyhole size={27}/></div>
          <p className="mb-2 text-sm font-semibold tracking-wide text-[var(--color-primary)]">ACCÈS PERSONNEL</p>
          <h2 className="text-3xl font-extrabold">Connexion sécurisée</h2>
          <p className="mt-3 text-sm leading-6 text-[var(--color-text-muted)]">
            {challenge ? 'Le même code a été envoyé aux trois e-mails de sécurité du SuperAdmin. Saisissez-le dans les cinq minutes.' : 'Entrez votre adresse professionnelle. Une demande identifiée par votre nom et votre fonction sera envoyée aux trois e-mails de sécurité.'}
          </p>
          <form onSubmit={challenge ? confirm : start} className="mt-7 space-y-5 rounded-3xl border border-[var(--color-border)] bg-[var(--dash-card)] p-6 shadow-xl">
            {!challenge ? (
              <label className="block text-sm font-bold"><span className="mb-2 flex items-center gap-2"><Mail size={16}/> E-mail professionnel</span>
                <input type="email" autoFocus required className={INPUT} value={email} onChange={e=>setEmail(e.target.value)} autoComplete="username" placeholder="prenom.nom@organisation.tg"/>
              </label>
            ) : (
              <label className="block text-sm font-bold"><span className="mb-2 flex items-center gap-2"><KeyRound size={16}/> Code à six chiffres</span>
                <input autoFocus required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} className={INPUT} value={code} onChange={e=>setCode(e.target.value.replace(/\D/g, '').slice(0,6))} autoComplete="one-time-code" placeholder="••••••"/>
              </label>
            )}
            {error && <p role="alert" className="rounded-xl bg-red-900/10 p-3 text-sm text-[var(--color-danger)]">{error}</p>}
            <button type="submit" disabled={busy} className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 font-bold text-white hover:bg-emerald-600 disabled:opacity-50">
              {busy ? 'Vérification…' : challenge ? 'Valider et accéder à mon espace' : 'Recevoir un code sécurisé'}
            </button>
            {challenge && <button className="w-full text-sm text-[var(--color-text-muted)] underline" type="button" onClick={()=>{setChallenge('');setError('')}}>Changer de compte ou demander un nouveau code</button>}
          </form>
          <p className="mt-5 text-center text-xs text-[var(--color-text-muted)]">Les connexions hors des horaires autorisés sont refusées.</p>
          <div className="mt-5 text-center"><Link to="/superadmin/connexion" className="text-sm text-[var(--color-primary)] underline">Accès SuperAdmin par certificat</Link></div>
        </div>
      </section>
    </main>
  )
}
