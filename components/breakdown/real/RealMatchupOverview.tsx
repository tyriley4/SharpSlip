import { PlayerLink } from '@/components/players/PlayerLink'
import { ContextStats } from '@/components/breakdown/ContextStats'
import { StatBox, StatRow } from '@/components/breakdown/StatBox'
import { MLB_TEAM_COLORS } from '@/data/mlb/teamColors'
import type { ContextStat } from '@/data/breakdown/types'
import type { ProbablePitcherStats } from '@/lib/mlb/gameBreakdown'

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function RealPitcherCard({ abbr, pitcher }: { abbr: string; pitcher: ProbablePitcherStats }) {
  const tc = MLB_TEAM_COLORS[abbr] ?? '#4d9fff'
  const last3 = pitcher.last5.slice(0, 3)

  return (
    <div className="flex-1 rounded-xl bg-card3 p-2.5" style={{ border: `2px solid ${tc}44` }}>
      <div className="mb-1 text-[9px] text-muted">{abbr} Starting Pitcher</div>
      <div className="mb-2.5 flex items-center gap-1.5">
        <PlayerLink name={pitcher.name} team={abbr} className="text-xs font-extrabold text-text hover:text-accent hover:underline">{pitcher.name}</PlayerLink>
        {pitcher.handedness !== '—' && <span className="text-[9px] text-muted">{pitcher.handedness}HP</span>}
        {pitcher.hot && <span className="text-xs" title="Trending hot — last 3 starts ERA below season ERA">🔥</span>}
        {pitcher.cold && <span className="text-xs" title="Trending cold — last 3 starts ERA above season ERA">❄️</span>}
      </div>

      <div className="mb-2 grid grid-cols-2 gap-1.5">
        <StatBox label="ERA" val={pitcher.era.toFixed(2)} good={pitcher.era < 4.0} />
        <StatBox label="WHIP" val={pitcher.whip.toFixed(2)} good={pitcher.whip < 1.25} />
        <StatBox label="K/9" val={pitcher.k9.toFixed(1)} good={pitcher.k9 >= 8.5} />
        <StatBox label="BB/9" val={pitcher.bb9.toFixed(1)} good={pitcher.bb9 <= 3.0} />
      </div>

      <div className="mb-2 border-t border-border pt-2">
        <StatRow label="AVG Against" value={pitcher.avgAgainst} />
        <StatRow label="K%" value={`${pitcher.kPct}%`} />
        {pitcher.recentEra !== null && <StatRow label="Last 3 ERA" value={pitcher.recentEra.toFixed(2)} />}
      </div>

      {last3.length > 0 && (
        <div>
          <div className="mb-1 text-[8px] font-bold uppercase tracking-wide text-muted">Last 3 Starts</div>
          <div className="overflow-hidden rounded-lg border border-border">
            <div className="grid grid-cols-6 gap-0.5 bg-card px-1.5 py-1 text-[7px] font-bold text-muted">
              <span>DATE</span>
              <span>OPP</span>
              <span>IP</span>
              <span>ER</span>
              <span>K</span>
              <span>W/L</span>
            </div>
            {last3.map((g) => (
              <div
                key={g.date}
                className="grid grid-cols-6 gap-0.5 border-t border-border px-1.5 py-1 text-[8px] text-text2"
              >
                <span>{shortDate(g.date)}</span>
                <span>{g.opp}</span>
                <span>{g.ip}</span>
                <span>{g.er}</span>
                <span>{g.k}</span>
                <span
                  className={g.result === 'W' ? 'font-bold text-positive' : g.result === 'L' ? 'font-bold text-negative' : ''}
                >
                  {g.result}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function PitcherTBD({ abbr }: { abbr: string }) {
  return (
    <div className="flex-1 rounded-xl bg-card3 p-2.5 text-center">
      <div className="mb-1 text-[9px] text-muted">{abbr} Starting Pitcher</div>
      <div className="py-6 text-xs text-muted">Probable pitcher TBD</div>
    </div>
  )
}

export function RealMatchupOverview({
  awayAbbr,
  homeAbbr,
  awayPitcher,
  homePitcher,
  contextStats,
}: {
  awayAbbr: string
  homeAbbr: string
  awayPitcher: ProbablePitcherStats | null
  homePitcher: ProbablePitcherStats | null
  contextStats: ContextStat[]
}) {
  return (
    <div className="mb-3 rounded-2xl border border-border bg-card p-3">
      <div className="mb-2.5 flex items-center gap-1.5">
        <span className="text-[10px]">🤖</span>
        <span className="text-[9px] font-extrabold tracking-[0.1em] text-muted">MATCHUP OVERVIEW</span>
      </div>
      <div className="mb-2.5 flex flex-col gap-2 md:flex-row">
        {awayPitcher ? <RealPitcherCard abbr={awayAbbr} pitcher={awayPitcher} /> : <PitcherTBD abbr={awayAbbr} />}
        {homePitcher ? <RealPitcherCard abbr={homeAbbr} pitcher={homePitcher} /> : <PitcherTBD abbr={homeAbbr} />}
      </div>
      {contextStats.length > 0 && <ContextStats stats={contextStats} />}
    </div>
  )
}
