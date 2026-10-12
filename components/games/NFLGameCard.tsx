import Link from 'next/link'
import { NFL_TEAM_COLORS } from '@/data/nfl/teamColors'
import type { NFLGame } from '@/data/nfl/games'

export function NFLGameCard({ game }: { game: NFLGame }) {
  const awayColor = NFL_TEAM_COLORS[game.away.abbr] ?? '#4d9fff'
  const homeColor = NFL_TEAM_COLORS[game.home.abbr] ?? '#4d9fff'
  const edgeColor =
    game.edgeCount >= 3 ? 'text-positive' : game.edgeCount >= 2 ? 'text-accent' : 'text-text2'
  const edgeBorder =
    game.edgeCount >= 3
      ? 'border-positive/40'
      : game.edgeCount >= 2
        ? 'border-accent/40'
        : 'border-white/10'
  const edgeBg =
    game.edgeCount >= 3 ? 'bg-positive/10' : game.edgeCount >= 2 ? 'bg-accent/10' : 'bg-white/[0.04]'
  const confColor =
    game.edgeConf >= 85 ? 'text-positive' : game.edgeConf >= 75 ? 'text-accent' : 'text-warning'
  const confBorder =
    game.edgeConf >= 85
      ? 'border-positive/30'
      : game.edgeConf >= 75
        ? 'border-accent/30'
        : 'border-warning/30'
  const confBg =
    game.edgeConf >= 85 ? 'bg-positive/[0.07]' : game.edgeConf >= 75 ? 'bg-accent/[0.07]' : 'bg-warning/[0.07]'

  return (
    <Link
      href={`/games/${game.id}`}
      className="block rounded-2xl border border-border bg-card p-3.5 transition-colors hover:border-border2 hover:bg-card2 md:p-4"
    >
      <div className="mb-2.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="text-center">
            <div className="text-base font-black" style={{ color: awayColor }}>
              {game.away.abbr}
            </div>
            <div className="text-[8px] text-muted">Away</div>
          </div>
          <div className="text-center">
            <div className="mb-0.5 text-[9px] text-muted">{game.time}</div>
            <div className="rounded-lg bg-card3 px-2.5 py-1">
              <div className="text-[11px] font-bold text-text">{game.spread}</div>
              <div className="text-[9px] text-muted">O/U {game.total}</div>
            </div>
            <div className="mt-0.5 text-[8px] text-muted">{game.network}</div>
          </div>
          <div className="text-center">
            <div className="text-base font-black" style={{ color: homeColor }}>
              {game.home.abbr}
            </div>
            <div className="text-[8px] text-muted">Home</div>
          </div>
        </div>
        <div
          className={`rounded-xl border px-3 py-1 text-[11px] font-bold ${edgeBorder} ${edgeBg} ${edgeColor}`}
        >
          {game.edgeCount} edge{game.edgeCount !== 1 ? 's' : ''}
        </div>
      </div>

      <div
        className={`mb-2 flex items-center gap-1.5 rounded-[10px] border px-2.5 py-1.5 ${confBorder} ${confBg}`}
      >
        <span className="text-[10px]">🎯</span>
        <span className={`flex-1 truncate text-[10px] font-bold ${confColor}`}>{game.edge}</span>
        <span className={`text-[9px] font-bold ${confColor}`}>{game.edgeConf}%</span>
      </div>

      <div className="flex gap-1.5">
        <div className="flex-1 rounded-lg bg-card3 py-1.5 text-center">
          <div className="text-[9px] text-muted">Away ML</div>
          <div className="text-[11px] font-bold text-text2">{game.awayML}</div>
        </div>
        <div className="flex-1 rounded-lg bg-card3 py-1.5 text-center">
          <div className="text-[9px] text-muted">Win Prob</div>
          <div className="text-[11px] font-bold text-accent">{game.winProb}%</div>
        </div>
        <div className="flex-1 rounded-lg bg-card3 py-1.5 text-center">
          <div className="text-[9px] text-muted">Home ML</div>
          <div className="text-[11px] font-bold text-text2">{game.homeML}</div>
        </div>
      </div>
    </Link>
  )
}
