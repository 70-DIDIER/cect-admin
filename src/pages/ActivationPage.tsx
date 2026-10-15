import { useState, type FormEvent } from 'react'
import { Helmet } from 'react-helmet-async'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Eye, EyeOff, KeyRound } from 'lucide-react'
import { authErrorMessage, fieldErrors } from '@/features/auth/errors'
import { post } from '@/lib/api'

const INPUT =
  'w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]'

export default function ActivationPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [email, setEmail] = useState(params.get('email') ?? '')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fields, setFields] = useState<Record<string, string>>({})

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setFields({})
    if (password !== confirmation) {
      setFields({ password_confirmation: 'Les deux mots de passe ne correspondent pas.' })
      return
    }
    setBusy(true)
    try {
      await post('/auth/staff/activate', { email: email.trim(), code: code.trim(), password, password_confirmation: confirmation })
      navigate('/connexion', { replace: true })
    } catch (caught) {
      setFields(fieldErrors(caught))
      setError(authErrorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--dash-bg)] px-4 py-12">
      <Helmet>
        <title>Activation du compte — CECT Admin</title>
      </Helmet>
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-3">
          <img src="/logos/CECT_logo_transparent.png" alt="" className="h-10 w-10 object-contain" />
          <p className="text-lg font-extrabold">CECT Admin</p>
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight text-[var(--color-text)]">Activer mon compte</h1>
        <p className="mb-6 mt-1 text-sm text-[var(--color-text-muted)]">Saisissez le code à 6 chiffres reçu par e-mail et choisissez votre mot de passe.</p>
        <form onSubmit={(event) => void submit(event)} className="space-y-4 rounded-3xl border border-[var(--color-border)] bg-[var(--dash-card)] p-6 shadow-[var(--shadow-card)]">
          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-medium">
              Adresse e-mail
            </label>
            <input id="email" type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} className={INPUT} />
            {fields.email && <p className="mt-1 text-xs text-[var(--color-danger)]">{fields.email}</p>}
          </div>
          <div>
            <label htmlFor="code" className="mb-1.5 block text-sm font-medium">
              Code d’activation
            </label>
            <input id="code" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))} className={INPUT} placeholder="123456" />
            {fields.code && <p className="mt-1 text-xs text-[var(--color-danger)]">{fields.code}</p>}
          </div>
          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm font-medium">
              Mot de passe
            </label>
            <div className="relative">
              <input id="password" type={show ? 'text' : 'password'} autoComplete="new-password" required value={password} onChange={(event) => setPassword(event.target.value)} className={`${INPUT} pr-11`} />
              <button type="button" onClick={() => setShow((value) => !value)} aria-label={show ? 'Masquer le mot de passe' : 'Afficher le mot de passe'} className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--chart-track)]">
                {show ? <EyeOff size={17} aria-hidden /> : <Eye size={17} aria-hidden />}
              </button>
            </div>
            {fields.password && <p className="mt-1 text-xs text-[var(--color-danger)]">{fields.password}</p>}
          </div>
          <div>
            <label htmlFor="confirmation" className="mb-1.5 block text-sm font-medium">
              Confirmer le mot de passe
            </label>
            <input id="confirmation" type={show ? 'text' : 'password'} autoComplete="new-password" required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className={INPUT} />
            {fields.password_confirmation && <p className="mt-1 text-xs text-[var(--color-danger)]">{fields.password_confirmation}</p>}
          </div>
          {error && (
            <p role="alert" className="rounded-xl bg-[var(--tone-danger-bg)] px-3 py-2 text-sm text-[var(--tone-danger-fg)]">
              {error}
            </p>
          )}
          <button type="submit" disabled={busy} className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] text-sm font-bold text-white transition-colors hover:bg-[var(--color-primary-hover)] disabled:opacity-60">
            <KeyRound size={16} aria-hidden />
            {busy ? 'Activation…' : 'Activer mon compte'}
          </button>
        </form>
        <p className="mt-4 text-center text-sm">
          <Link to="/connexion" className="font-semibold text-[var(--color-primary)] hover:underline">
            Retour à la connexion
          </Link>
        </p>
      </div>
    </main>
  )
}
