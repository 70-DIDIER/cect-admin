export function FullPageLoader() {
  return (
    <div role="status" className="flex min-h-screen items-center justify-center bg-[var(--dash-bg)]">
      <div className="h-9 w-9 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
      <span className="sr-only">Chargement…</span>
    </div>
  )
}
