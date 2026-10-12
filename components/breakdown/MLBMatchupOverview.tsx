import { PlayerLink } from '@/components/players/PlayerLink'
import { ContextStats } from '@/components/breakdown/ContextStats'
import { StatBox, StatRow } from '@/components/breakdown/StatBox'
import { MLB_TEAM_COLORS } from '@/data/mlb/teamColors'
import type { MLBPitcher } from '@/data/breakdown/gameTypes'
import type { ContextStat } from '@/data/breakdown/types'

function PitcherCard({ abbr, pitcher }: { abbr: string; pitcher: MLBPitcher }) {
  const tc = MLB_TEAM_COLORS[abbr] ?? '#4d9fff'
  return (
    <div className="flex-1 rounded-xl bg-card3 p-2.5" style={{ border: `2px solid ${tc}44` }}>
      <div className="mb-1 text-[9px] text-muted">{abbr} Starting Pitcher</div>
      <div className="mb-2.5 flex items-center gap-1">
        <PlayerLink name={pitcher.name} team={abbr} className="text-xs font-extrabold text-text hover:text-accent hover:underline">{pitcher.name}</PlayerLink>
        <span className="text-xs">{pitcher.hot ? '🔥' : '❄️'}</span>
      </div>
      <div className="mb-2 grid grid-cols-2 gap-1.5">
        <StatBox label="ERA" val={pitcher.era} good={pitcher.eraGood} />
        <StatBox label="FIP" val={pitcher.fip} good={pitcher.fipGood} />
        <StatBox label="K/9" val={pitcher.k9} good={pitcher.k9Good} />
        <StatBox label="xFIP" val={pitcher.xfip} good={pitcher.xfipGood} />
      </div>
      <div className="border-t border-border pt-2">
        <StatRow label="WHIP" value={pitcher.whip} />
        <StatRow label="CSW%" value={pitcher.csw} />
        <StatRow label="BB/9" value={pitcher.bb9} />
      </div>
    </div>
  )
}

export function MLBMatchupOverview({
  awayAbbr,
  homeAbbr,
  away,
  home,
  contextStats,
}: {
  awayAbbr: string
  homeAbbr: string
  away: MLBPitcher
  home: MLBPitcher
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
        <PitcherCard abbr={awayAbbr} pitcher={away} />
        <PitcherCard abbr={homeAbbr} pitcher={home} />
      </div>
      <ContextStats stats={contextStats} />
    </div>
  )
}
