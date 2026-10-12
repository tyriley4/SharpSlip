'use client'

/** Segmented conference / league switch — same visual language as the Leaders view toggle. */
export function ConferenceToggle({ options, value, onChange }: { options: { id: string; label: string }[]; value: string; onChange: (id: string) => void }) {
  return (
    <div
      className="grid gap-1 rounded-2xl border border-border bg-card p-1"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
      role="tablist"
      aria-label="Conference"
    >
      {options.map((o) => {
        const active = o.id === value
        return (
          <button
            key={o.id}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.id)}
            className={`rounded-xl py-3 text-[13px] font-extrabold transition-all duration-200 ${
              active ? 'bg-accent text-white shadow-[0_0_16px_rgba(59,158,255,0.45)]' : 'text-text2 hover:text-text'
            }`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
