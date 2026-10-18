import { useState, type FormEvent, type ReactNode } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { authErrorMessage } from '@/features/auth/errors'

export interface FormField {
  name: string
  label: string
  type?: 'text' | 'number' | 'textarea' | 'select' | 'date'
  required?: boolean
  initial?: string
  options?: ReadonlyArray<{ value: string; label: string }>
  hint?: string
  section?: 'main' | 'cashback' | 'advanced' | 'final'
  showWhen?: { name: string; value: string }
}

interface FormDialogProps {
  title: string
  subtitle?: string
  fields: FormField[]
  submitLabel: string
  danger?: boolean
  confirmText?: string
  children?: ReactNode | ((values: Record<string, string>) => ReactNode)
  onSubmit: (values: Record<string, string>) => Promise<void>
  onClose: () => void
  guided?: boolean
}

const INPUT = 'w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]'

export function FormDialog({ title, subtitle, fields, submitLabel, danger = false, confirmText, children, onSubmit, onClose, guided = false }: FormDialogProps) {
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(fields.map((field) => [field.name, field.initial ?? field.options?.[0]?.value ?? ''])))
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await onSubmit(values)
      onClose()
    } catch (caught) {
      setError(caught instanceof Error && caught.name !== 'ApiError' ? caught.message : authErrorMessage(caught))
      setBusy(false)
    }
  }

  const set = (name: string, value: string) => setValues((current) => ({ ...current, [name]: value }))

  const isVisible = (field: FormField) => !field.showWhen || values[field.showWhen.name] === field.showWhen.value

  const renderField = (field: FormField) => (
    <div key={field.name}>
      <label htmlFor={`f-${field.name}`} className="mb-1.5 block text-sm font-medium text-[var(--color-text)]">
        {field.label}{field.required ? ' *' : ''}
      </label>
      {field.hint && <p className="mb-2 text-xs text-[var(--color-text-muted)]">{field.hint}</p>}
      {field.type === 'textarea' ? (
        <textarea id={`f-${field.name}`} rows={3} required={field.required} value={values[field.name]} onChange={(event) => set(field.name, event.target.value)} className={INPUT} />
      ) : field.type === 'select' ? (
        <select id={`f-${field.name}`} required={field.required} value={values[field.name]} onChange={(event) => set(field.name, event.target.value)} className={INPUT}>
          {field.options?.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      ) : (
        <input id={`f-${field.name}`} type={field.type ?? 'text'} required={field.required} value={values[field.name]} onChange={(event) => set(field.name, event.target.value)} className={INPUT} />
      )}
    </div>
  )

  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[var(--forest-900)]/60" />
        <Dialog.Content aria-describedby={undefined} className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[calc(100vw-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-3xl bg-[var(--dash-card)] p-6 shadow-2xl outline-none">
          <div className="mb-1 flex items-start justify-between gap-3">
            <Dialog.Title className="text-lg font-extrabold tracking-tight text-[var(--color-text)]">{title}</Dialog.Title>
            <Dialog.Close aria-label="Fermer" className="flex h-9 w-9 items-center justify-center rounded-xl text-[var(--color-text-muted)] hover:bg-[var(--chart-track)]">
              <X size={18} aria-hidden />
            </Dialog.Close>
          </div>
          {subtitle && <p className="mb-4 text-sm text-[var(--color-text-muted)]">{subtitle}</p>}
          <form onSubmit={(event) => void submit(event)} className="space-y-4">
            {typeof children === 'function' ? children(values) : children}
            {guided ? (
              <>
                <div className="rounded-xl bg-[var(--dash-bg)] px-4 py-3">
                  <p className="text-sm font-bold">1. Conditions principales du pack</p>
                  <p className="mt-1 text-xs text-[var(--color-text-muted)]">Commencez par le montant à payer, la quantité de YEM et la durée. Les réglages facultatifs sont plus bas.</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {fields.filter(field => (!field.section || field.section === 'main') && isVisible(field)).map(renderField)}
                </div>
                {fields.some(field => field.section === 'cashback') && (
                  <div className="rounded-2xl border border-[var(--color-border)] p-4">
                    <div className="mb-4">
                      <p className="text-sm font-bold">2. Bonus YEM lié à ce pack</p>
                      <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                        Le bonus est ajouté en YEM ; le membre paie toujours le montant complet en FCFA.
                        Ce réglage concerne seulement Consommateur et Personnel.
                      </p>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      {fields.filter(field => field.section === 'cashback' && isVisible(field)).map(renderField)}
                    </div>
                  </div>
                )}
                {fields.some(field => field.section === 'advanced') && (
                  <details className="rounded-2xl border border-[var(--color-border)] p-4">
                    <summary className="cursor-pointer text-sm font-bold">Paramètres avancés — facultatifs et plafonds</summary>
                    <p className="mt-2 text-xs text-[var(--color-text-muted)]">Conservez les valeurs proposées si vous ne souhaitez pas changer le cumul, les limites d'opération ou les règles d'expiration.</p>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">{fields.filter(field => field.section === 'advanced' && isVisible(field)).map(renderField)}</div>
                  </details>
                )}
                {fields.some(field => field.section === 'final') && (
                  <div className="space-y-3">
                    <p className="text-sm font-bold">Validation et publication</p>
                    {fields.filter(field => field.section === 'final' && isVisible(field)).map(renderField)}
                  </div>
                )}
              </>
            ) : (
              fields.filter(isVisible).map(renderField)
            )}
            {fields.length === 0 && confirmText && <p className="text-sm text-[var(--color-text)]">{confirmText}</p>}
            {error && (
              <p role="alert" className="text-sm text-[var(--color-danger)]">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={busy}
              className={`inline-flex min-h-[44px] w-full items-center justify-center rounded-xl px-5 text-sm font-semibold text-white disabled:opacity-60 ${danger ? 'bg-[var(--color-danger)]' : 'bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)]'}`}
            >
              {submitLabel}
            </button>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
