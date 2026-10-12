import { PlayerLink } from '@/components/players/PlayerLink'
import { ContextStats } from '@/components/breakdown/ContextStats'
import { NBA_TEAM_COLORS } from '@/data/nba/teamColors'
import type { ContextStat } from '@/data/breakdown/types'
import type { NBAStarter } from '@/lib/nba/gameBreakdown'

function LineupCard({ abbr, lineup }: { abbr: string; lineup: NBAStarter[] }) {
  const tc = NBA_TEAM_COLORS[abbr] ?? '#4d9fff'
  return (
    <div className="flex-1 rounded-xl bg-card3 p-2.5" style={{ border: `2px solid ${tc}44` }}>
      <div className="mb-2 text-[9px] text-muted">{abbr} Starting Lineup</div>
      {lineup.length === 0 ? (
        <div className="py-6 text-center text-xs text-muted">Lineup unavailable</div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {lineup.map((p) => (
            <div key={p.playerId} className="flex items-center justify-between rounded-lg bg-card px-2 py-1.5">
              <div className="min-w-0">
                <PlayerLink name={p.name} team={abbr} className="truncate text-[11px] font-semibold text-text hover:text-accent hover:underline">
                  {p.name}
                </PlayerLink>
                <div className="text-[9px] text-muted">{p.position}</div>
              </div>
              <div className="shrink-0 text-right text-[9px] text-text2">
                {p.ppg.toFixed(1)} / {p.rpg.toFixed(1)} / {p.apg.toFixed(1)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function RealNBAMatchupOverview({
  awayAbbr,
  homeAbbr,
  awayLineup,
  homeLineup,
  contextStats,
}: {
  awayAbbr: string
  homeAbbr: string
  awayLineup: NBAStarter[]
  homeLineup: NBAStarter[]
  contextStats: ContextStat[]
}) {
  return (
    <div className="mb-3 rounded-2xl border border-border bg-card p-3">
      <div className="mb-2.5 flex items-center gap-1.5">
        <span className="text-[10px]">🤖</span>
        <span className="text-[9px] font-extrabold tracking-[0.1em] text-muted">MATCHUP OVERVIEW</span>
      </div>
      <div className="mb-1 flex justify-between px-1 text-[8px] text-muted">
        <span>PPG / RPG / APG</span>
      </div>
      <div className="mb-2.5 flex flex-col gap-2 md:flex-row">
        <LineupCard abbr={awayAbbr} lineup={awayLineup} />
        <LineupCard abbr={homeAbbr} lineup={homeLineup} />
      </div>
      {contextStats.length > 0 && <ContextStats stats={contextStats} />}
    </div>
  )
}
