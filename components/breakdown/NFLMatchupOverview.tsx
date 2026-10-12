import { PlayerLink } from '@/components/players/PlayerLink'
import { ContextStats } from '@/components/breakdown/ContextStats'
import { StatBox, StatRow } from '@/components/breakdown/StatBox'
import { NFL_TEAM_COLORS } from '@/data/nfl/teamColors'
import type { NFLQuarterback } from '@/data/breakdown/gameTypes'
import type { ContextStat } from '@/data/breakdown/types'

function QBCard({ abbr, qb }: { abbr: string; qb: NFLQuarterback }) {
  const tc = NFL_TEAM_COLORS[abbr] ?? '#4d9fff'
  return (
    <div className="flex-1 rounded-xl bg-card3 p-2.5" style={{ border: `2px solid ${tc}44` }}>
      <div className="mb-1 text-[9px] text-muted">{abbr} Quarterback</div>
      <div className="mb-2.5 flex items-center gap-1">
        <PlayerLink name={qb.name} team={abbr} className="text-xs font-extrabold text-text hover:text-accent hover:underline">{qb.name}</PlayerLink>
        <span className="text-xs">{qb.hot ? '🔥' : '❄️'}</span>
      </div>
      <div className="mb-2 grid grid-cols-2 gap-1.5">
        <StatBox label="Rating" val={qb.rating} good={qb.ratingGood} />
        <StatBox label="Pass Yds" val={qb.passYds} good={qb.passYdsGood} />
        <StatBox label="Comp%" val={qb.compPct} good={qb.compPctGood} />
        <StatBox label="TD" val={qb.td} good={qb.tdGood} />
      </div>
      <div className="border-t border-border pt-2">
        <StatRow label="INT" value={qb.int} />
        <StatRow label="Sacks Taken" value={qb.sacksTaken} />
        <StatRow label="Rush Yds" value={qb.rushYds} />
      </div>
    </div>
  )
}

export function NFLMatchupOverview({
  awayAbbr,
  homeAbbr,
  away,
  home,
  contextStats,
}: {
  awayAbbr: string
  homeAbbr: string
  away: NFLQuarterback
  home: NFLQuarterback
  contextStats: ContextStat[]
}) {
  return (
    <div className="mb-3 rounded-2xl border border-border bg-card p-3">
      <div className="mb-2.5 flex items-center gap-1.5">
        <span className="text-[10px]">🤖</span>
        <span className="text-[9px] font-extrabold tracking-[0.1em] text-muted">
          MATCHUP OVERVIEW
        </span>
      </div>
      <div className="mb-2.5 flex gap-2">
        <QBCard abbr={awayAbbr} qb={away} />
        <QBCard abbr={homeAbbr} qb={home} />
      </div>
      <ContextStats stats={contextStats} />
    </div>
  )
}
