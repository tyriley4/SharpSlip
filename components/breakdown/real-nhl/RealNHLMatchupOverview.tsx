import { PlayerLink } from '@/components/players/PlayerLink'
import { ContextStats } from '@/components/breakdown/ContextStats'
import { NHL_TEAM_COLORS } from '@/data/nhl/teamColors'
import type { ContextStat } from '@/data/breakdown/types'
import type { NHLStarterGoalie, NHLTopSkater } from '@/lib/nhl/gameBreakdown'

function GoalieCard({ abbr, goalie }: { abbr: string; goalie: NHLStarterGoalie | null }) {
  const tc = NHL_TEAM_COLORS[abbr] ?? '#4d9fff'
  return (
    <div className="flex-1 rounded-xl bg-card3 p-2.5" style={{ border: `2px solid ${tc}44` }}>
      <div className="mb-2 text-[9px] text-muted">{abbr} Starting Goalie</div>
      {!goalie ? (
        <div className="py-6 text-center text-xs text-muted">Goalie unavailable</div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between rounded-lg bg-card px-2 py-1.5">
            <PlayerLink name={goalie.name} team={abbr} className="truncate text-[11px] font-semibold text-text hover:text-accent hover:underline">
              {goalie.name}
            </PlayerLink>
            <div className="shrink-0 text-right text-[9px] text-text2">
              {(goalie.savePct * 100).toFixed(1)}% / {goalie.gaa.toFixed(2)}
            </div>
          </div>
          <div className="px-2 text-[9px] text-muted">
            {goalie.wins}-{goalie.losses}-{goalie.otLosses} · Last 3: {goalie.last3.map((g) => g.decision ?? '—').join(', ') || '—'}
          </div>
        </div>
      )}
    </div>
  )
}

function SkaterList({ abbr, skaters }: { abbr: string; skaters: NHLTopSkater[] }) {
  const tc = NHL_TEAM_COLORS[abbr] ?? '#4d9fff'
  return (
    <div className="flex-1 rounded-xl bg-card3 p-2.5" style={{ border: `2px solid ${tc}44` }}>
      <div className="mb-2 text-[9px] text-muted">{abbr} Top Skaters</div>
      {skaters.length === 0 ? (
        <div className="py-6 text-center text-xs text-muted">Skaters unavailable</div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {skaters.map((p) => (
            <div key={p.playerId} className="flex items-center justify-between rounded-lg bg-card px-2 py-1.5">
              <div className="min-w-0">
                <PlayerLink name={p.name} team={abbr} className="truncate text-[11px] font-semibold text-text hover:text-accent hover:underline">
                  {p.name}
                </PlayerLink>
                <div className="text-[9px] text-muted">{p.position}</div>
              </div>
              <div className="shrink-0 text-right text-[9px] text-text2">
                {p.goals}G / {p.assists}A / {p.points}PTS
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function RealNHLMatchupOverview({
  awayAbbr,
  homeAbbr,
  awayGoalie,
  homeGoalie,
  awayTopSkaters,
  homeTopSkaters,
  contextStats,
}: {
  awayAbbr: string
  homeAbbr: string
  awayGoalie: NHLStarterGoalie | null
  homeGoalie: NHLStarterGoalie | null
  awayTopSkaters: NHLTopSkater[]
  homeTopSkaters: NHLTopSkater[]
  contextStats: ContextStat[]
}) {
  return (
    <div className="mb-3 rounded-2xl border border-border bg-card p-3">
      <div className="mb-2.5 flex items-center gap-1.5">
        <span className="text-[10px]">🤖</span>
        <span className="text-[9px] font-extrabold tracking-[0.1em] text-muted">MATCHUP OVERVIEW</span>
      </div>
      <div className="mb-2.5 flex flex-col gap-2 md:flex-row">
        <GoalieCard abbr={awayAbbr} goalie={awayGoalie} />
        <GoalieCard abbr={homeAbbr} goalie={homeGoalie} />
      </div>
      <div className="mb-2.5 flex flex-col gap-2 md:flex-row">
        <SkaterList abbr={awayAbbr} skaters={awayTopSkaters} />
        <SkaterList abbr={homeAbbr} skaters={homeTopSkaters} />
      </div>
      {contextStats.length > 0 && <ContextStats stats={contextStats} />}
    </div>
  )
}
