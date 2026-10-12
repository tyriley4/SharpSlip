import { PlayerLink } from '@/components/players/PlayerLink'
import { ContextStats } from '@/components/breakdown/ContextStats'
import { StatBox, StatRow } from '@/components/breakdown/StatBox'
import { NFL_TEAM_COLORS } from '@/data/nfl/teamColors'
import type { ContextStat } from '@/data/breakdown/types'
import type { NFLQBStats } from '@/lib/nfl/gameBreakdown'

function QBCard({ abbr, qb, teamColors, college }: { abbr: string; qb: NFLQBStats; teamColors: Record<string, string>; college: boolean }) {
  const tc = teamColors[abbr] ?? '#4d9fff'
  return (
    <div className="flex-1 rounded-xl bg-card3 p-2.5" style={{ border: `2px solid ${tc}44` }}>
      <div className="mb-1 text-[9px] text-muted">{abbr} Quarterback</div>
      <div className="mb-2.5 flex items-center gap-1.5">
        <PlayerLink name={qb.name} team={abbr} sport={college ? 'cfb' : undefined} className="text-xs font-extrabold text-text hover:text-accent hover:underline">{qb.name}</PlayerLink>
        {qb.hot && <span className="text-xs" title="Trending hot — last 3 games rating above season average">🔥</span>}
        {qb.cold && <span className="text-xs" title="Trending cold — last 3 games rating below season average">❄️</span>}
      </div>
      <div className="mb-2 grid grid-cols-2 gap-1.5">
        <StatBox label={college ? 'Efficiency' : 'Rating'} val={qb.season.rating.toFixed(1)} good={qb.season.rating >= (college ? 140 : 95)} />
        <StatBox label="Comp%" val={`${qb.season.compPct}%`} good={qb.season.compPct >= 65} />
        <StatBox label="Pass Yds" val={String(qb.season.yds)} good={qb.season.yds >= (college ? 1200 : 3500)} />
        <StatBox label="TD/INT" val={`${qb.season.td}/${qb.season.int}`} good={qb.season.td >= qb.season.int * 2} />
      </div>
      <div className="border-t border-border pt-2">
        <StatRow label="Rush Yds" value={String(qb.season.rushYds)} />
        {qb.last3RatingAvg !== null && <StatRow label="Last 3 Rating" value={qb.last3RatingAvg.toFixed(1)} />}
      </div>
    </div>
  )
}

function QBTBD({ abbr }: { abbr: string }) {
  return (
    <div className="flex-1 rounded-xl bg-card3 p-2.5 text-center">
      <div className="mb-1 text-[9px] text-muted">{abbr} Quarterback</div>
      <div className="py-6 text-xs text-muted">QB data unavailable</div>
    </div>
  )
}

export function RealNFLMatchupOverview({
  awayAbbr,
  homeAbbr,
  awayQB,
  homeQB,
  contextStats,
  teamColors = NFL_TEAM_COLORS,
  college = false,
}: {
  awayAbbr: string
  homeAbbr: string
  awayQB: NFLQBStats | null
  homeQB: NFLQBStats | null
  contextStats: ContextStat[]
  teamColors?: Record<string, string>
  college?: boolean
}) {
  return (
    <div className="mb-3 rounded-2xl border border-border bg-card p-3">
      <div className="mb-2.5 flex items-center gap-1.5">
        <span className="text-[10px]">🤖</span>
        <span className="text-[9px] font-extrabold tracking-[0.1em] text-muted">MATCHUP OVERVIEW</span>
      </div>
      <div className="mb-2.5 flex flex-col gap-2 md:flex-row">
        {awayQB ? <QBCard abbr={awayAbbr} qb={awayQB} teamColors={teamColors} college={college} /> : <QBTBD abbr={awayAbbr} />}
        {homeQB ? <QBCard abbr={homeAbbr} qb={homeQB} teamColors={teamColors} college={college} /> : <QBTBD abbr={homeAbbr} />}
      </div>
      {contextStats.length > 0 && <ContextStats stats={contextStats} />}
    </div>
  )
}
