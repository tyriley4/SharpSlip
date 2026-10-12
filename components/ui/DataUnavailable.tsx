export function DataUnavailable({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card px-6 py-14 text-center">
      <div className="mb-3 text-4xl">📡</div>
      <div className="mb-1.5 text-sm font-black text-text">Data Temporarily Unavailable</div>
      <p className="mx-auto max-w-[320px] text-xs leading-relaxed text-muted">
        We couldn&apos;t reach the {label} data source just now. This usually resolves itself —
        try refreshing in a moment.
      </p>
    </div>
  )
}
