import { BetTile } from '@/components/breakdown/BetTile'
import type { TeamSummary } from '@/data/breakdown/summaryTypes'

const FORM_COLOR: Record<string, string> = {
  W: 'bg-positive',
  L: 'bg-negative',
  P: 'bg-warning',
}

export function TeamBettingCard({
  team,
  teamColor,
}: {
  team: TeamSummary
  teamColor: string
}) {
  return (
    <div
      className="mb-3.5 overflow-hidden rounded-2xl bg-card"
      style={{ border: `2px solid ${teamColor}44` }}
    >
      <div className="flex items-center justify-between border-b border-border px-3.5 py-2.5">
        <div className="flex items-center gap-2">
          <div
            className="flex h-[26px] w-[26px] items-center justify-center rounded-lg text-[10px] font-extrabold"
            style={{ background: `${teamColor}22`, color: teamColor }}
          >
            {team.abbr}
          </div>
          <span className="text-[13px] font-extrabold text-text">{team.abbr} Betting Record</span>
        </div>
        <div className="flex gap-1">
          {team.form.map((r, i) => (
            <div key={i} className={`h-[7px] w-[7px] rounded-full ${FORM_COLOR[r]}`} />
          ))}
        </div>
      </div>
      <div className="p-3.5">
        {team.betSections.map((section) => (
          <div key={section.title} className="mb-3.5 last:mb-0">
            <div className="mb-2 text-[9px] font-extrabold tracking-[0.1em] text-muted">
              {section.title}
            </div>
            <div
              className="grid gap-1.5"
              style={{ gridTemplateColumns: `repeat(${section.tiles.length}, minmax(0, 1fr))` }}
            >
              {section.tiles.map((tile) => (
                <BetTile key={tile.label} {...tile} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
