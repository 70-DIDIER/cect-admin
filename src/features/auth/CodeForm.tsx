import { useState, type FormEvent } from 'react'
import { Lock } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { authErrorMessage } from './errors'

interface CodeFormProps {
  sentTo: string
  onVerify: (code: string) => Promise<void>
  onResend: () => Promise<void>
  onBack?: () => void
  backLabel?: string
}

export function CodeForm({ sentTo, onVerify, onResend, onBack, backLabel = 'Retour' }: CodeFormProps) {
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setInfo(null)
    setBusy(true)
    try {
      await onVerify(code.trim())
    } catch (caught) {
      setError(authErrorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  async function resend() {
    setError(null)
    setInfo(null)
    try {
      await onResend()
      setCode('')
      setInfo('Un nouveau code vient d’être envoyé.')
    } catch (caught) {
      setError(authErrorMessage(caught))
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-sm">
      <p className="text-sm text-[var(--color-text-muted)]">
        Un code à 6 chiffres a été envoyé à <strong className="text-[var(--color-text)]">{sentTo}</strong>. Il expire dans quelques minutes.
      </p>
      <div>
        <label htmlFor="otp-code" className="mb-1.5 block text-sm font-medium text-[var(--color-text)]">
          Code de vérification
        </label>
        <input
          id="otp-code"
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          maxLength={6}
          placeholder="000000"
          className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3 text-center text-2xl font-bold tracking-[0.5em] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
        />
      </div>

      {error && (
        <p role="alert" className="rounded-xl border border-[var(--color-danger)]/20 bg-[var(--color-danger)]/5 px-3 py-2 text-center text-sm text-[var(--color-danger)]">
          {error}
        </p>
      )}
      {info && (
        <p role="status" className="text-center text-sm text-[var(--color-primary)]">
          {info}
        </p>
      )}

      <Button type="submit" className="w-full" size="lg" disabled={busy || code.length !== 6}>
        <Lock size={16} aria-hidden />
        Valider le code
      </Button>
      <div className="flex items-center justify-between text-sm">
        {onBack ? (
          <button type="button" onClick={onBack} className="text-[var(--color-text-muted)] hover:underline">
            {backLabel}
          </button>
        ) : (
          <span />
        )}
        <button type="button" onClick={() => void resend()} className="font-medium text-[var(--color-primary)] hover:underline">
          Renvoyer le code
        </button>
      </div>
    </form>
  )
}
