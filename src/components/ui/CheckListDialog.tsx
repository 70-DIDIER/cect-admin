import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { authErrorMessage } from '@/features/auth/errors'

export interface CheckItem {
  value: string
  label: string
  hint?: string
  group?: string
  disabled?: boolean
}

interface CheckListDialogProps {
  title: string
  subtitle?: string
  items: CheckItem[]
  initial: string[]
  submitLabel: string
  withReason?: boolean
  header?: ReactNode
  onSubmit: (selected: string[], reason: string) => Promise<void>
  onClose: () => void
}

export function CheckListDialog({ title, subtitle, items, initial, submitLabel, withReason = true, header, onSubmit, onClose }: CheckListDialogProps) {
  const [selected, setSelected] = useState(() => new Set(initial))
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const groups = useMemo(() => {
    const map = new Map<string, CheckItem[]>()
    for (const item of items) map.set(item.group ?? '', [...(map.get(item.group ?? '') ?? []), item])
    return [...map.entries()]
  }, [items])

  function toggle(value: string) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(value)) next.delete(value)
      else next.add(value)
      return next
    })
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await onSubmit([...selected], reason)
      onClose()
    } catch (caught) {
      setError(authErrorMessage(caught))
      setBusy(false)
    }
  }

  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[var(--forest-900)]/60" />
        <Dialog.Content aria-describedby={undefined} className="fixed left-1/2 top-1/2 z-50 flex max-h-[90vh] w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col rounded-3xl bg-[var(--dash-card)] p-6 shadow-2xl outline-none">
          <div className="mb-1 flex items-start justify-between gap-3">
            <Dialog.Title className="text-lg font-extrabold tracking-tight">{title}</Dialog.Title>
            <Dialog.Close aria-label="Fermer" className="flex h-9 w-9 items-center justify-center rounded-xl text-[var(--color-text-muted)] hover:bg-[var(--chart-track)]">
              <X size={18} aria-hidden />
            </Dialog.Close>
          </div>
          {subtitle && <p className="mb-3 text-sm text-[var(--color-text-muted)]">{subtitle}</p>}
          <form onSubmit={(event) => void submit(event)} className="flex min-h-0 flex-1 flex-col gap-4">
            {header}
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto rounded-2xl border border-[var(--color-border)] p-3">
              {groups.map(([group, groupItems]) => (
                <fieldset key={group}>
                  {group && <legend className="mb-1 px-1 text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">{group}</legend>}
                  {groupItems.map((item) => (
                    <label key={item.value} className="flex min-h-[40px] cursor-pointer items-start gap-3 rounded-xl px-2 py-1.5 hover:bg-[var(--dash-bg)]">
                      <input type="checkbox" className="mt-1 h-4 w-4 accent-[var(--color-primary)]" disabled={item.disabled} checked={selected.has(item.value)} onChange={() => toggle(item.value)} />
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold">{item.label}</span>
                        {item.hint && <span className="block text-xs text-[var(--color-text-muted)]">{item.hint}</span>}
                      </span>
                    </label>
                  ))}
                </fieldset>
              ))}
            </div>
            {withReason && (
              <div>
                <label htmlFor="check-reason" className="mb-1.5 block text-sm font-medium">
                  Motif (5 caractères minimum)
                </label>
                <textarea id="check-reason" rows={2} required minLength={5} value={reason} onChange={(event) => setReason(event.target.value)} className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
              </div>
            )}
            {error && (
              <p role="alert" className="text-sm text-[var(--color-danger)]">
                {error}
              </p>
            )}
            <button type="submit" disabled={busy || selected.size === 0} className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl bg-[var(--color-primary)] px-5 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-60">
              {submitLabel}
            </button>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
