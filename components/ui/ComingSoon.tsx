export function ComingSoon({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="px-6 py-14 text-center">
      <div className="mb-4 text-5xl">{icon}</div>
      <div className="mb-2 text-lg font-black text-text">{label} Coming Soon</div>
      <div className="mx-auto mb-6 max-w-[280px] text-xs leading-relaxed text-muted">
        {label} coverage is in development. Check back soon for full standings, leaders, and
        analysis.
      </div>
      <div className="inline-block rounded-full border border-accent/40 bg-accent/15 px-5 py-2 text-[11px] font-bold text-accent">
        In Development
      </div>
    </div>
  )
}
