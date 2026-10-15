const BASE = 'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60'

export const btnPrimary = `${BASE} bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)]`
export const btnLime = `${BASE} bg-[var(--lime)] text-[var(--forest-900)] hover:bg-[var(--lime-hover)]`
export const btnOutline = `${BASE} border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-surface)]`
export const btnOnDark = `${BASE} border border-white/20 text-white hover:bg-[var(--forest-500)]`
