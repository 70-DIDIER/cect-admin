import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { ShieldCheck, X } from 'lucide-react'
import { ApiError, post, setStepUpHandler } from '@/lib/api'
import { CodeForm } from './CodeForm'
import { authErrorMessage } from './errors'

interface Challenge {
  challenge_id: string
  sent_to: string
}

export function StepUpProvider({ children }: { children: ReactNode }) {
  const [challenge, setChallenge] = useState<Challenge | null>(null)
  const [startError, setStartError] = useState<string | null>(null)
  const settle = useRef<{ resolve: () => void; reject: (error: unknown) => void } | null>(null)

  const close = useCallback((error?: unknown) => {
    setChallenge(null)
    setStartError(null)
    if (error) settle.current?.reject(error)
    settle.current = null
  }, [])

  useEffect(() => {
    setStepUpHandler(
      () =>
        new Promise<void>((resolve, reject) => {
          settle.current = { resolve, reject }
          post<Challenge>('/auth/step-up').then(setChallenge, (error: unknown) => {
            setStartError(authErrorMessage(error))
            reject(error)
          })
        })
    )
    return () => setStepUpHandler(null)
  }, [])

  const open = challenge !== null || startError !== null

  return (
    <>
      {children}
      <Dialog.Root open={open} onOpenChange={(next) => !next && close(new ApiError(0, 'STEP_UP_CANCELED', 'Confirmation annulée.'))}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[60] bg-[var(--forest-900)]/60" />
          <Dialog.Content aria-describedby={undefined} className="fixed left-1/2 top-1/2 z-[60] w-[calc(100vw-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-3xl bg-[var(--dash-card)] p-6 shadow-2xl outline-none">
            <div className="mb-4 flex items-start justify-between gap-3">
              <Dialog.Title className="flex items-center gap-2 text-lg font-extrabold tracking-tight text-[var(--color-text)]">
                <ShieldCheck size={20} className="text-[var(--color-primary)]" aria-hidden />
                Confirmez votre identité
              </Dialog.Title>
              <Dialog.Close aria-label="Annuler" className="flex h-9 w-9 items-center justify-center rounded-xl text-[var(--color-text-muted)] hover:bg-[var(--chart-track)]">
                <X size={18} aria-hidden />
              </Dialog.Close>
            </div>
            {startError && <p role="alert" className="text-sm text-[var(--color-danger)]">{startError}</p>}
            {challenge && (
              <CodeForm
                sentTo={challenge.sent_to}
                onVerify={async (code) => {
                  await post('/auth/step-up/verify', { challenge_id: challenge.challenge_id, code })
                  const pending = settle.current
                  setChallenge(null)
                  settle.current = null
                  pending?.resolve()
                }}
                onResend={async () => setChallenge(await post<Challenge>('/auth/otp/resend', { challenge_id: challenge.challenge_id }))}
              />
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  )
}
