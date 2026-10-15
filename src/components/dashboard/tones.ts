export type Tone = 'primary' | 'gold' | 'info' | 'violet' | 'rose' | 'success' | 'warning' | 'danger' | 'neutral'

interface ToneStyle {
  fg: string
  bg: string
  solid: string
}

export const TONES: Record<Tone, ToneStyle> = {
  primary: { fg: 'var(--tone-success-fg)', bg: 'var(--tone-success-bg)', solid: 'var(--chart-1)' },
  success: { fg: 'var(--tone-success-fg)', bg: 'var(--tone-success-bg)', solid: 'var(--chart-1)' },
  gold: { fg: 'var(--tone-warning-fg)', bg: 'var(--tone-warning-bg)', solid: 'var(--chart-2)' },
  warning: { fg: 'var(--tone-warning-fg)', bg: 'var(--tone-warning-bg)', solid: 'var(--chart-2)' },
  info: { fg: 'var(--tone-info-fg)', bg: 'var(--tone-info-bg)', solid: 'var(--chart-3)' },
  violet: { fg: 'var(--tone-violet-fg)', bg: 'var(--tone-violet-bg)', solid: 'var(--chart-4)' },
  rose: { fg: 'var(--tone-rose-fg)', bg: 'var(--tone-rose-bg)', solid: 'var(--chart-5)' },
  danger: { fg: 'var(--tone-danger-fg)', bg: 'var(--tone-danger-bg)', solid: 'var(--color-danger)' },
  neutral: { fg: 'var(--color-text-muted)', bg: 'var(--chart-track)', solid: 'var(--color-text-muted)' },
}
