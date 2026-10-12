export function BoardEmpty({ icon, onClear }: { icon: string; onClear?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-[14px] border border-border bg-card px-6 py-14 text-center">
      <div className="text-5xl opacity-80">{icon}</div>
      <div className="text-sm font-extrabold text-text">No qualifying players</div>
      <div className="text-xs text-muted">Try adjusting your filters</div>
      {onClear && (
        <button onClick={onClear} className="mt-2 rounded-full bg-accent px-4 py-2 text-[11px] font-extrabold text-white">
          Clear filters
        </button>
      )}
    </div>
  )
}
