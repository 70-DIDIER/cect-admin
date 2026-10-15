import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { CornerDownLeft, Search, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface Command {
  id: string
  label: string
  hint?: string
  icon: LucideIcon
  run: () => void
}

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  commands: Command[]
}

function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

export function CommandPalette({ open, onOpenChange, commands }: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const list = useRef<HTMLUListElement>(null)

  const results = useMemo(() => {
    const needle = normalize(query.trim())
    if (!needle) return commands
    return commands.filter((command) => normalize(`${command.label} ${command.hint ?? ''}`).includes(needle))
  }, [commands, query])

  useEffect(() => {
    if (open) {
      setQuery('')
      setActive(0)
    }
  }, [open])

  useEffect(() => setActive(0), [query])

  useEffect(() => {
    list.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [active])

  function choose(command: Command | undefined) {
    if (!command) return
    onOpenChange(false)
    command.run()
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActive((current) => Math.min(current + 1, results.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((current) => Math.max(current - 1, 0))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      choose(results[active])
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[70] bg-[var(--forest-900)]/50" />
        <Dialog.Content
          aria-describedby={undefined}
          onKeyDown={onKeyDown}
          className="fixed left-1/2 top-[14vh] z-[70] w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-[18px] border border-[var(--color-border)] bg-[var(--dash-card)] shadow-[var(--shadow-pop)] outline-none"
        >
          <Dialog.Title className="sr-only">Recherche et actions rapides</Dialog.Title>
          <div className="flex items-center gap-3 border-b border-[var(--color-border)] px-5">
            <Search size={18} aria-hidden className="text-[var(--color-text-muted)]" />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Aller à une page ou lancer une action…"
              aria-label="Rechercher"
              className="h-14 flex-1 bg-transparent text-[15px] font-medium text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-muted)]"
            />
            <kbd className="hidden rounded-md border border-[var(--color-border)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--color-text-muted)] sm:block">Échap</kbd>
          </div>
          <ul ref={list} role="listbox" aria-label="Résultats" className="max-h-[50vh] overflow-y-auto p-2">
            {results.length === 0 && <li className="px-4 py-8 text-center text-sm text-[var(--color-text-muted)]">Aucun résultat.</li>}
            {results.map((command, index) => {
              const Icon = command.icon
              const isActive = index === active
              return (
                <li key={command.id} role="option" aria-selected={isActive} data-active={isActive}>
                  <button
                    type="button"
                    onMouseMove={() => setActive(index)}
                    onClick={() => choose(command)}
                    className={cn('flex min-h-[48px] w-full items-center gap-3 rounded-xl px-3 text-left text-sm transition-colors', isActive ? 'bg-[var(--chart-track)]' : '')}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-surface)] text-[var(--color-primary)]">
                      <Icon size={17} aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-[var(--color-text)]">{command.label}</span>
                      {command.hint && <span className="block truncate text-xs text-[var(--color-text-muted)]">{command.hint}</span>}
                    </span>
                    {isActive && <CornerDownLeft size={15} aria-hidden className="text-[var(--color-text-muted)]" />}
                  </button>
                </li>
              )
            })}
          </ul>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
