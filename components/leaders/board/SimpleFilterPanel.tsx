'use client'

function Group({ label, options, active, onChange }: { label: string; options: readonly string[]; active: string; onChange: (v: string) => void }) {
  return (
    <div>
      <div className="mb-1.5 text-[9px] font-bold uppercase tracking-wide text-muted">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button
            key={o}
            onClick={() => onChange(o)}
            className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors ${
              active === o ? 'border-accent bg-accent text-white' : 'border-border text-muted hover:border-border2 hover:text-text2'
            }`}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  )
}

/**
 * Filter panel shared by the NFL, NBA and NHL boards: the Team → Player selector, plus Home/Away and Month
 * for Betting Stats (game-stat boards only get the team selector).
 */
export function SimpleFilterPanel({
  teamSection,
  homeAway,
  month,
  homeAwayOptions,
  monthOptions,
  onHomeAway,
  onMonth,
}: {
  teamSection: React.ReactNode
  homeAway?: string
  month?: string
  homeAwayOptions?: readonly string[]
  monthOptions?: readonly string[]
  onHomeAway?: (v: string) => void
  onMonth?: (v: string) => void
}) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-3.5 md:p-4">
      {teamSection}
      {homeAway !== undefined && homeAwayOptions && onHomeAway && <Group label="Home / Away" options={homeAwayOptions} active={homeAway} onChange={onHomeAway} />}
      {month !== undefined && monthOptions && onMonth && <Group label="Month" options={monthOptions} active={month} onChange={onMonth} />}
    </div>
  )
}
