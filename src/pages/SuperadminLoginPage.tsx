import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Helmet } from 'react-helmet-async'
import { useNavigate } from 'react-router-dom'
import { FileKey2, LockKeyhole, MailCheck, ShieldCheck, RotateCcw, Download } from 'lucide-react'
import { useAuth } from '@/app/AuthContext'
import { get, post, toApiError } from '@/lib/api'
import { createKeyMaterial, createKeyFile, downloadKeyFile, parseKeyFile, publicPemFromKeyFile, signChallenge, type SuperadminKeyFile } from '@/lib/superadminKeys'

type Stage = 'loading' | 'enroll-emails' | 'enroll-codes' | 'select-key' | 'login-code' | 'rotate-codes' | 'recover-codes' | 'activate'
type Status = { initialized: boolean; has_active_key: boolean; key_validity_days: number }
type Challenge = { challenge_id: string }
type ProofResponse = { status: 'authenticated' | 'login_otp_required'; challenge_id?: string }
type KeyResponse = { key_id: string; activation_required: boolean }
const input = 'w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3 text-[var(--color-text)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]'
const defaultEmails = ['', '', '']

export default function SuperadminLoginPage() {
  const navigate = useNavigate()
  const { refresh } = useAuth()
  const [stage, setStage] = useState<Stage>('loading')
  const [emails, setEmails] = useState<string[]>(defaultEmails)
  const [codes, setCodes] = useState<string[]>(['', '', ''])
  const [code, setCode] = useState('')
  const [challengeId, setChallengeId] = useState('')
  const [keyFile, setKeyFile] = useState<SuperadminKeyFile | null>(null)
  const [pendingKey, setPendingKey] = useState<SuperadminKeyFile | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [validityDays, setValidityDays] = useState(30)
  const [passphrase, setPassphrase] = useState('')

  const checkCertificateStatus = useCallback(async () => {
    setError('')
    setStage('loading')
    try {
      const status = await get<Status>('/superadmin/status')
      setValidityDays(status.key_validity_days)
      setStage(status.initialized ? 'select-key' : 'enroll-emails')
    } catch (caught) {
      const failure = toApiError(caught)
      setError(failure.status === 403
        ? 'Accès refusé par le contrôle mTLS (403). Vérifiez votre certificat navigateur personnel (.p12), sa validité et sa révocation. La protection ne peut pas être désactivée depuis cette page.'
        : failure.message)
    }
  }, [])

  useEffect(() => { void checkCertificateStatus() }, [checkCertificateStatus])

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError('')
    try { await action() } catch (caught) { setError(toApiError(caught).message) } finally { setBusy(false) }
  }

  async function completeAccess() {
    const profile = await refresh()
    if (!profile || profile.role !== 'superadmin') throw new Error('Session SuperAdmin impossible à établir.')
    navigate('/admin/gouvernance', { replace: true })
  }

  async function prove(key: SuperadminKeyFile) {
    const proof = await post<Challenge & { nonce: string }>('/superadmin/key/challenge', { key_id: key.key_id })
    // Decrypt locally only; the API receives a signature, never key material or a passphrase.
    const signature = await signChallenge(key, proof.challenge_id, proof.nonce, passphrase)
    const result = await post<ProofResponse>('/superadmin/key/prove', { challenge_id: proof.challenge_id, signature })
    if (result.status === 'authenticated') { await completeAccess(); return }
    if (!result.challenge_id) throw new Error('Code de vérification non reçu.')
    setChallengeId(result.challenge_id)
    setStage('login-code')
  }

  async function initialEnrollment(codesToSend: string[]) {
    if (!keyFile) throw new Error('Importe la clé .cectkey reçue dans ton kit de démonstration.')
    const publicKey = await publicPemFromKeyFile(keyFile, passphrase)
    const response = await post<KeyResponse>('/superadmin/enroll/finish', {
      challenge_id: challengeId, codes: codesToSend,
      public_key_pem: publicKey, key_id: keyFile.key_id,
    })
    if (response.key_id !== keyFile.key_id) throw new Error('Identifiant de clé inattendu.')
    setPendingKey(keyFile)
    setStage('activate')
  }

  async function prepareNewKey(path: string, codesToSend: string[]) {
    if (passphrase.length < 14) throw new Error('Choisissez une phrase secrète d’au moins 14 caractères pour chiffrer la nouvelle clé.')
    const keys = await createKeyMaterial()
    const result = await post<KeyResponse>(path, { challenge_id: challengeId, codes: codesToSend, public_key_pem: keys.public_key_pem })
    const file = await createKeyFile(result.key_id, keys.private_key_pkcs8, passphrase)
    setPendingKey(file)
    downloadKeyFile(file)
    setStage('activate')
  }

  async function protectLegacyKey() {
    if (!keyFile || keyFile.version !== 1) return
    const secured = await createKeyFile(keyFile.key_id, keyFile.private_key_pkcs8, passphrase)
    downloadKeyFile(secured)
    setKeyFile(secured)
  }

  function secretInput(label: string) {
    return <label className="block space-y-2 text-sm font-semibold">{label}
      <input type="password" autoComplete="off" className={input}
        value={passphrase} onChange={(event) => setPassphrase(event.target.value)}
        placeholder="Phrase secrète personnelle (14 caractères minimum)" />
    </label>
  }

  function submit(event: FormEvent, action: () => Promise<void>) {
    event.preventDefault()
    void run(action)
  }

  function updateEmail(index: number, value: string) {
    setEmails((old) => old.map((item, i) => i === index ? value : item))
  }

  function updateCode(index: number, value: string) {
    setCodes((old) => old.map((item, i) => i === index ? value.replace(/\D/g, '').slice(0, 6) : item))
  }

  const title: Record<Stage, string> = {
    loading: 'Vérification du certificat',
    'enroll-emails': 'Première connexion',
    'enroll-codes': 'Vérification des 3 adresses',
    'select-key': 'Votre fichier cryptographique',
    'login-code': 'Code de connexion',
    'rotate-codes': 'Renouvellement de la clé',
    'recover-codes': 'Récupération sécurisée',
    activate: 'Sauvegarder la nouvelle clé',
  }

  return (
    <div className="min-h-screen bg-[var(--dash-bg)] px-4 py-12">
      <Helmet><title>Accès SuperAdmin sécurisé — CECT</title></Helmet>
      <div className="mx-auto max-w-lg space-y-6">
        <div className="text-center">
          <span className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#0b6b45] text-white"><ShieldCheck size={30} /></span>
          <h1 className="text-2xl font-extrabold">Console SuperAdmin CECT</h1>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">Accès isolé par certificat mTLS et preuve cryptographique.</p>
        </div>
        <section className="space-y-5 rounded-3xl border border-[var(--color-border)] bg-[var(--dash-card)] p-6 shadow-[var(--shadow-card)]">
          <div className="flex items-center gap-3">
            <LockKeyhole className="text-[var(--color-primary)]" size={21} aria-hidden />
            <h2 className="text-xl font-bold">{title[stage]}</h2>
          </div>
          {error && <p role="alert" className="rounded-xl bg-[var(--tone-danger-bg)] p-3 text-sm text-[var(--tone-danger-fg)]">{error}</p>}
          {stage === 'loading' && (error
            ? <button type="button" onClick={() => void checkCertificateStatus()} className="min-h-11 w-full rounded-xl border border-[var(--color-border)] px-4 py-3 text-sm font-bold hover:border-[var(--color-primary)]">Réessayer la vérification du certificat</button>
            : <p role="status">Contrôle du certificat client en cours…</p>
          )}
          {stage === 'enroll-emails' && (
            <form className="space-y-4" onSubmit={(event) => submit(event, async () => {
              if (new Set(emails.map((e) => e.trim().toLowerCase())).size !== 3) throw new Error('Choisissez trois adresses différentes.')
              const data = await post<Challenge>('/superadmin/enroll/start', { emails })
              setChallengeId(data.challenge_id); setCodes(['', '', '']); setStage('enroll-codes')
            })}>
              <p className="text-sm text-[var(--color-text-muted)]">Configurez vos trois adresses e-mail et sélectionnez la clé .cectkey fournie pour la première connexion.</p>
              <label className="block space-y-2 text-sm font-semibold">Clé initiale (.cectkey)
                <input className={input} type="file" accept=".cectkey" required
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    setKeyFile(null)
                    if (!file) return
                    if (!file.name.toLowerCase().endsWith('.cectkey')) {
                      setError('Ce fichier est un certificat. Choisissez CECT-SuperAdmin-DEMO.cectkey dans votre kit, pas le .crt.')
                      event.currentTarget.value = ''
                      return
                    }
                    void file.text().then((data) => { setKeyFile(parseKeyFile(data)); setError('') })
                      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : 'Clé invalide.'))
                  }} />
              </label>
              {keyFile && <p role="status" className="text-sm text-[var(--color-primary)]">Clé CECT valide : fichier .cectkey chargé.</p>}
              {secretInput('Phrase secrète de la clé chiffrée (si applicable)')}
              {keyFile?.version === 1 && <button type="button" disabled={busy || passphrase.length < 14} onClick={() => void run(protectLegacyKey)} className="w-full rounded-xl border border-amber-600 px-4 py-3 text-sm font-bold">Protéger mon ancienne clé : créer une copie chiffrée</button>}
              {emails.map((value, i) => <label className="block text-sm font-semibold" key={i}>E-mail {i + 1}
                <input type="email" autoComplete="off" required className={`${input} mt-1`} value={value} onChange={(e) => updateEmail(i, e.target.value)} />
              </label>)}
              <button disabled={busy || !keyFile} className="w-full rounded-xl bg-[var(--color-primary)] px-4 py-3 font-bold text-white disabled:opacity-60">Envoyer trois codes différents</button>
            </form>
          )}
          {(stage === 'enroll-codes' || stage === 'rotate-codes' || stage === 'recover-codes') && (
            <form className="space-y-4" onSubmit={(event) => submit(event, () => stage === 'enroll-codes'
              ? initialEnrollment(codes)
              : prepareNewKey(stage === 'rotate-codes' ? '/superadmin/rotate/finish' : '/superadmin/recover/finish', codes)
            )}>
              <p className="text-sm text-[var(--color-text-muted)]"><MailCheck className="mr-2 inline" size={18} />Trois codes <strong>différents</strong> ont été envoyés. Saisissez les trois pour autoriser la génération d'une nouvelle clé.</p>
              {stage !== 'enroll-codes' && secretInput('Phrase secrète de la nouvelle clé (14 caractères minimum)')}
              {codes.map((value, i) => <label className="block text-sm font-semibold" key={i}>Code de l'e-mail {i + 1}
                <input className={`${input} mt-1`} inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required value={value} onChange={(e) => updateCode(i, e.target.value)} autoComplete="one-time-code" />
              </label>)}
              <button disabled={busy || codes.some((c) => c.length !== 6) || (stage !== 'enroll-codes' && passphrase.length < 14)} className="w-full rounded-xl bg-[var(--color-primary)] px-4 py-3 font-bold text-white disabled:opacity-60">{stage === 'enroll-codes' ? 'Valider les codes et activer ma clé' : 'Valider et créer une nouvelle clé'}</button>
            </form>
          )}
          {stage === 'select-key' && (
            <div className="space-y-5">
              <label className="block space-y-2 text-sm font-semibold"><FileKey2 size={20} /> Choisir mon fichier .cectkey
                <input type="file" accept=".cectkey" className={input} onChange={(event) => {
                  const file = event.target.files?.[0]
                  setKeyFile(null)
                  if (!file) return
                  if (!file.name.toLowerCase().endsWith('.cectkey')) {
                    setError('Choisissez un fichier personnel .cectkey, pas un certificat .crt ou .p12.')
                    event.currentTarget.value = ''
                    return
                  }
                  void file.text().then((value) => { setKeyFile(parseKeyFile(value)); setError('') })
                    .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Clé non valide.'))
                }} />
              </label>
              {secretInput('Phrase secrète du fichier (requise pour les nouvelles clés)')}
              {keyFile?.version === 1 && <p className="rounded-xl border border-amber-600/50 p-3 text-sm">Ancien fichier non chiffré : créez une copie chiffrée avant votre prochaine connexion, puis supprimez l'ancienne copie.</p>}
              {keyFile?.version === 1 && <button type="button" disabled={busy || passphrase.length < 14} onClick={() => void run(protectLegacyKey)} className="w-full rounded-xl border border-amber-600 px-4 py-3 text-sm font-bold">Télécharger une copie chiffrée de ma clé existante</button>}
              <button disabled={!keyFile || busy || (keyFile.version === 2 && !passphrase)} onClick={() => keyFile && void run(() => prove(keyFile))} className="w-full rounded-xl bg-[var(--color-primary)] px-4 py-3 font-bold text-white disabled:opacity-60">Vérifier ma clé et recevoir mon code</button>
              <button type="button" className="w-full text-sm font-semibold underline" disabled={busy}
                onClick={() => void run(async () => {
                  const challenge = await post<Challenge>('/superadmin/recover/start')
                  setChallengeId(challenge.challenge_id); setCodes(['', '', '']); setStage('recover-codes')
                })}>Clé expirée ou perdue ? Renouveler avec mes trois e-mails</button>
            </div>
          )}
          {stage === 'login-code' && (
            <form className="space-y-4" onSubmit={(event) => submit(event, async () => {
              const result = await post<{ status: 'authenticated' | 'rotation_otp_required'; challenge_id?: string }>('/superadmin/login/verify', { challenge_id: challengeId, code })
              if (result.status === 'authenticated') {
                await completeAccess()
                return
              }
              if (!result.challenge_id) throw new Error('Réponse de vérification inattendue.')
              setChallengeId(result.challenge_id)
              setCodes(['', '', ''])
              setStage('rotate-codes')
            })}>
              <p className="text-sm text-[var(--color-text-muted)]">Le <strong>même code</strong> a été envoyé aux trois adresses e-mail. Saisissez-le une seule fois.</p>
              <label className="block text-sm font-semibold">Code unique
                <input className={`${input} mt-1`} inputMode="numeric" maxLength={6} pattern="[0-9]{6}" autoComplete="one-time-code" required value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} />
              </label>
              <button disabled={busy || code.length !== 6} className="w-full rounded-xl bg-[var(--color-primary)] px-4 py-3 font-bold text-white disabled:opacity-60">Confirmer la connexion</button>
            </form>
          )}
          {stage === 'activate' && pendingKey && (
            <div className="space-y-4">
              <p className="text-sm">Votre nouveau fichier <strong>.cectkey</strong> est chiffré par votre phrase secrète. Sauvegardez ce fichier et conservez la phrase secrète séparément : elle n'est pas récupérable par la CECT.</p>
              {secretInput('Phrase secrète utilisée pour chiffrer la clé')}
              <p className="rounded-xl border border-amber-600/40 bg-amber-500/10 p-3 text-sm">Attention : après activation, votre ancien fichier sera révoqué. Vérifiez que le nouveau est bien sauvegardé avant de continuer.</p>
              <button type="button" onClick={() => downloadKeyFile(pendingKey)} className="flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] px-4 py-3 font-semibold"><Download size={18} /> Télécharger de nouveau ma clé</button>
              <button disabled={busy || (pendingKey.version === 2 && !passphrase)} type="button" onClick={() => void run(() => prove(pendingKey))} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] px-4 py-3 font-bold text-white disabled:opacity-60"><RotateCcw size={18} /> J'ai sauvegardé la clé — Activer</button>
              <p className="text-xs text-[var(--color-text-muted)]">Validité maximale configurée : {validityDays} jours. La clé reste valide jusqu’à son expiration ou son renouvellement volontaire.</p>
            </div>
          )}
        </section>
        <p className="text-center text-xs text-[var(--color-text-muted)]">La clé privée n'est jamais transmise à l'API. Les nouveaux fichiers sont chiffrés localement. Ne communiquez ni votre fichier ni sa phrase secrète.</p>
      </div>
    </div>
  )
}
