export function TabPlaceholder({ label }: { label: string }) {
  return (
    <div className="px-3.5 pt-3 md:px-8 md:pt-5">
      <div className="rounded-2xl border border-border bg-card p-8 text-center">
        <div className="mb-2 text-2xl">🚧</div>
        <div className="text-sm font-bold text-text">{label} coming soon</div>
        <p className="mt-1 text-xs text-muted">This breakdown is in development.</p>
      </div>
    </div>
  )
}
