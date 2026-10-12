export function PillTabs({
  options,
  active,
  onChange,
}: {
  options: string[]
  active: string
  onChange: (value: string) => void
}) {
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {options.map((o) => {
        const isActive = active === o
        return (
          <button
            key={o}
            onClick={() => onChange(o)}
            className={`shrink-0 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-[11px] font-semibold transition-colors ${
              isActive
                ? 'border-accent bg-accent text-white'
                : 'border-border bg-transparent text-muted'
            }`}
          >
            {o}
          </button>
        )
      })}
    </div>
  )
}

export function SegmentTabs({
  options,
  active,
  onChange,
}: {
  options: string[]
  active: string
  onChange: (value: string) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-1.5 rounded-xl border border-border bg-card p-1">
      {options.map((o) => {
        const isActive = active === o
        return (
          <button
            key={o}
            onClick={() => onChange(o)}
            className={`rounded-lg py-2 text-xs font-semibold transition-colors ${
              isActive ? 'bg-accent text-white' : 'text-muted'
            }`}
          >
            {o}
          </button>
        )
      })}
    </div>
  )
}
