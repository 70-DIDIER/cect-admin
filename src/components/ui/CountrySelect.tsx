import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { ChevronDown, Search } from 'lucide-react'
import 'flag-icons/css/flag-icons.min.css'
import { COUNTRIES, findCountry } from '@/lib/countries'

interface CountrySelectProps {
  value: string
  onChange: (iso: string) => void
  className?: string
}

function Flag({ iso }: { iso: string }) {
  return <span aria-hidden className={`fi fi-${iso.toLowerCase()} shrink-0 rounded-[3px]`} style={{ width: '1.4em', height: '1.05em' }} />
}

export function CountrySelect({ value, onChange, className = '' }: CountrySelectProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const root = useRef<HTMLDivElement>(null)
  const listId = useId()
  const selected = findCountry(value)

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase().replace(/^\+/, '')
    if (!needle) return COUNTRIES
    return COUNTRIES.filter((country) => country.name.toLowerCase().includes(needle) || country.dial.slice(1).startsWith(needle) || country.iso.toLowerCase() === needle)
  }, [query])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  function choose(iso: string) {
    onChange(iso)
    setOpen(false)
    setQuery('')
  }

  return (
    <div ref={root} className={`relative ${className}`} onKeyDown={(event) => event.key === 'Escape' && setOpen(false)}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={`Pays : ${selected?.name ?? 'choisir'}`}
        className="flex h-full w-full items-center gap-2 rounded-l-xl rounded-r-none border border-r-0 border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2.5 text-sm text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
      >
        {selected && <Flag iso={selected.iso} />}
        <span className="font-medium">{selected?.dial}</span>
        <ChevronDown size={14} aria-hidden className="ml-auto text-[var(--color-text-muted)]" />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xl">
          <div className="relative border-b border-[var(--color-border)] p-2">
            <Search size={14} aria-hidden className="absolute left-5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Rechercher un pays ou un indicatif"
              aria-label="Rechercher un pays"
              className="w-full rounded-xl bg-[var(--color-bg)] py-2 pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            />
          </div>
          <ul id={listId} role="listbox" aria-label="Pays" className="max-h-64 overflow-y-auto py-1">
            {filtered.length === 0 && <li className="px-4 py-3 text-sm text-[var(--color-text-muted)]">Aucun pays trouvé</li>}
            {filtered.map((country) => (
              <li key={country.iso} role="option" aria-selected={country.iso === value}>
                <button
                  type="button"
                  onClick={() => choose(country.iso)}
                  className={`flex w-full items-center gap-3 px-4 py-2 text-left text-sm hover:bg-[var(--color-primary)]/10 ${country.iso === value ? 'bg-[var(--color-primary)]/5 font-semibold' : ''}`}
                >
                  <Flag iso={country.iso} />
                  <span className="min-w-0 flex-1 truncate">{country.name}</span>
                  <span className="shrink-0 text-[var(--color-text-muted)]">{country.dial}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
