'use client'

export interface FilterChip {
  key: string
  label: string
  onRemove: () => void
}

/** Time-window pills, a Filters button with an active-count badge, removable chips, and a sliding panel. */
export function FilterBar({
  windows,
  windowValue,
  onWindow,
  chips,
  onClearAll,
  open,
  onToggle,
  panel,
}: {
  windows: readonly string[]
  windowValue: string
  onWindow: (w: string) => void
  chips: FilterChip[]
  onClearAll: () => void
  open: boolean
  onToggle: () => void
  panel: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {windows.map((w) => {
            const active = windowValue === w
            return (
              <button
                key={w}
                onClick={() => onWindow(w)}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-bold transition-colors ${
                  active ? 'border-accent bg-accent text-white shadow-[0_0_10px_rgba(59,158,255,0.3)]' : 'border-border bg-card text-text2 hover:border-border2 hover:text-text'
                }`}
              >
                {w}
              </button>
            )
          })}
        </div>
        <button
          onClick={onToggle}
          aria-expanded={open}
          className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[11px] font-bold transition-colors ${
            open || chips.length > 0 ? 'border-accent/60 bg-accent/10 text-accent' : 'border-border bg-card text-text2 hover:border-border2 hover:text-text'
          }`}
        >
          ⚙ Filters
          {chips.length > 0 && (
            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[9px] font-extrabold text-white">{chips.length}</span>
          )}
        </button>
      </div>

      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {chips.map((c) => (
            <span key={c.key} className="flex items-center gap-1 rounded-full border border-accent/30 bg-accent/10 py-1 pl-2.5 pr-1.5 text-[10px] font-bold text-accent">
              {c.label}
              <button onClick={c.onRemove} aria-label={`Remove filter ${c.label}`} className="flex h-4 w-4 items-center justify-center rounded-full hover:bg-accent/25">
                ✕
              </button>
            </span>
          ))}
          <button onClick={onClearAll} className="px-1.5 text-[10px] font-extrabold text-text2 hover:text-text hover:underline">
            Clear all
          </button>
        </div>
      )}

      <div className={`grid transition-[grid-template-rows] duration-300 ease-out ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="overflow-hidden">
          <div className="pb-1">{panel}</div>
        </div>
      </div>
    </div>
  )
}

/** Builds removable chips for every filter that differs from its default. */
export function buildFilterChips<T extends object>(
  filters: T,
  defaults: T,
  labels: Partial<Record<keyof T, string>>,
  set: (next: T) => void
): FilterChip[] {
  const chips: FilterChip[] = []
  for (const key of Object.keys(defaults) as (keyof T)[]) {
    if (filters[key] !== defaults[key]) {
      chips.push({
        key: String(key),
        label: `${labels[key] ?? String(key)}: ${String(filters[key])}`,
        onRemove: () => set({ ...filters, [key]: defaults[key] }),
      })
    }
  }
  return chips
}
