import { useState, type FormEvent } from 'react'
import { Helmet } from 'react-helmet-async'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Lock, ShieldCheck } from 'lucide-react'
import { homeFor, useAuth, type OtpChallenge } from '@/app/AuthContext'
import { CodeForm } from '@/features/auth/CodeForm'
import { authErrorMessage } from '@/features/auth/errors'
import { ApiError } from '@/lib/api'

const INPUT =
  'w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]'

export default function LoginPage() {
  const navigate = useNavigate()
  const { user, login, verifyOtp, resendOtp } = useAuth()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [challenge, setChallenge] = useState<OtpChallenge | null>(null)

  if (user && !challenge) return <Navigate to={homeFor(user)} replace />

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const outcome = await login(identifier.trim(), password)
      if (outcome.status === 'otp_required') setChallenge(outcome)
      else navigate(outcome.redirectTo)
    } catch (caught) {
      setError(caught instanceof ApiError && caught.code === 'NOT_STAFF' ? caught.message : authErrorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <Helmet>
        <title>Connexion — CECT Admin</title>
      </Helmet>

      <aside className="relative hidden overflow-hidden bg-[#051c12] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div aria-hidden className="absolute -right-32 -top-32 h-[28rem] w-[28rem] rounded-full bg-[#b4f105]/10 blur-3xl" />
        <div aria-hidden className="absolute -bottom-40 -left-24 h-[30rem] w-[30rem] rounded-full bg-[#0b6b45]/40 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white p-1.5">
            <img src="/logos/CECT_logo_transparent.png" alt="" className="h-full w-full object-contain" />
          </span>
          <div className="leading-tight">
            <p className="text-lg font-extrabold">CECT Admin</p>
            <p className="text-sm text-white/60">Coopérative CECT Togo</p>
          </div>
        </div>
        <div className="relative max-w-md">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-[#b4f105]">
            <ShieldCheck size={14} aria-hidden /> Accès réservé à l’équipe
          </p>
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight">Pilotez la coopérative en toute sérénité.</h1>
          <p className="mt-4 text-base leading-7 text-white/65">Validations, versements, membres, packs et cashback : tout est tracé, versionné et soumis à une double confirmation.</p>
        </div>
        <p className="relative text-xs text-white/40">© CECT Togo — console d’administration</p>
      </aside>

      <main className="flex items-center justify-center bg-[var(--dash-bg)] px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <img src="/logos/CECT_logo_transparent.png" alt="" className="h-10 w-10 object-contain" />
            <p className="text-lg font-extrabold">CECT Admin</p>
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight text-[var(--color-text)]">Connexion</h2>
          <p className="mb-6 mt-1 text-sm text-[var(--color-text-muted)]">Identifiez-vous avec votre compte interne.</p>

          {challenge ? (
            <CodeForm
              sentTo={challenge.sentTo}
              onVerify={async (code) => {
                const { redirectTo } = await verifyOtp(challenge.challengeId, code)
                navigate(redirectTo)
              }}
              onResend={async () => setChallenge(await resendOtp(challenge.challengeId))}
              onBack={() => setChallenge(null)}
              backLabel="Changer de compte"
            />
          ) : (
            <form onSubmit={(event) => void submit(event)} className="space-y-4 rounded-3xl border border-[var(--color-border)] bg-[var(--dash-card)] p-6 shadow-[var(--shadow-card)]">
              <div>
                <label htmlFor="identifier" className="mb-1.5 block text-sm font-medium">
                  Adresse e-mail
                </label>
                <input id="identifier" autoComplete="username" autoFocus required value={identifier} onChange={(event) => setIdentifier(event.target.value)} className={INPUT} placeholder="prenom.nom@cect.tg" />
              </div>
              <div>
                <label htmlFor="password" className="mb-1.5 block text-sm font-medium">
                  Mot de passe
                </label>
                <div className="relative">
                  <input id="password" type={show ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} className={`${INPUT} pr-11`} />
                  <button type="button" onClick={() => setShow((value) => !value)} aria-label={show ? 'Masquer le mot de passe' : 'Afficher le mot de passe'} className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--chart-track)]">
                    {show ? <EyeOff size={17} aria-hidden /> : <Eye size={17} aria-hidden />}
                  </button>
                </div>
              </div>
              {error && (
                <p role="alert" className="rounded-xl bg-[var(--tone-danger-bg)] px-3 py-2 text-sm text-[var(--tone-danger-fg)]">
                  {error}
                </p>
              )}
              <button type="submit" disabled={busy} className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] text-sm font-bold text-white transition-colors hover:bg-[var(--color-primary-hover)] disabled:opacity-60">
                <Lock size={16} aria-hidden />
                {busy ? 'Vérification…' : 'Se connecter'}
              </button>
            </form>
          )}
          {!challenge && (
            <>
              <p className="mt-4 text-center text-sm text-[var(--color-text-muted)]">
                Compte créé par la CECT ?{' '}
                <Link to="/activation" className="font-semibold text-[var(--color-primary)] hover:underline">
                  Activer mon compte
                </Link>
              </p>
              <div className="mt-5 border-t border-[var(--color-border)] pt-4 text-center">
                <a
                  href="/acces-superadmin"
                  className="inline-flex items-center gap-2 font-semibold text-sm text-[var(--color-primary)] underline underline-offset-4"
                >
                  <ShieldCheck size={17} aria-hidden />
                  Accès Superadmin sécurisé
                </a>
                <p className="mt-2 text-xs text-[var(--color-text-muted)]">
                  Réservé au détenteur du certificat navigateur et du fichier .cectkey.
                </p>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
