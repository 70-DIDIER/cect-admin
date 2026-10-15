const NNBSP = ' '
const NBSP = ' '

const xofFormatter = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 })

export function formatXof(amount: number): string {
  return `${xofFormatter.format(Math.round(amount)).replace(/\s/g, NNBSP)}${NBSP}FCFA`
}

export function formatCompact(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1).replace('.', ',')}${NBSP}M`
  if (abs >= 1_000) return `${Math.round(value / 1_000)}${NBSP}k`
  return String(Math.round(value))
}

export function formatYem(quantity: string | number): string {
  const text = typeof quantity === 'number' ? quantity.toString() : quantity
  const [whole = '0', decimals = ''] = text.split('.')
  const trimmed = decimals.replace(/0+$/, '').slice(0, 2)
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, NNBSP)
  return `${grouped}${trimmed ? `,${trimmed}` : ''}${NBSP}YEM`
}

export function formatBps(bps: number): string {
  return `${(bps / 100).toFixed(bps % 100 === 0 ? 0 : 1).replace('.', ',')}${NBSP}%`
}

export function formatDateLong(date: Date): string {
  return date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

export function formatDateShort(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}

export function formatDateMedium(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function formatRelativeDay(value: string | Date, now: Date = new Date()): string {
  const date = typeof value === 'string' ? new Date(value) : value
  const days = Math.floor((now.getTime() - date.getTime()) / 86_400_000)
  if (days <= 0) return "Aujourd'hui"
  if (days === 1) return 'Hier'
  if (days < 7) return `Il y a ${days} jours`
  return formatDateShort(date)
}

export function daysUntil(value: string | Date, now: Date = new Date()): number {
  const date = typeof value === 'string' ? new Date(value) : value
  return Math.max(0, Math.ceil((date.getTime() - now.getTime()) / 86_400_000))
}

export function initialsOf(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map((word) => word[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}
