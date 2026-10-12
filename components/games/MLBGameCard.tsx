import Link from 'next/link'
import { MLB_TEAM_COLORS } from '@/data/mlb/teamColors'
import type { SlateGame } from '@/data/mlb/home'

export function MLBGameCard({ game }: { game: SlateGame }) {
  const isLive = game.status === 'Live'
  const awayColor = MLB_TEAM_COLORS[game.away.abbr] ?? '#4d9fff'
  const homeColor = MLB_TEAM_COLORS[game.home.abbr] ?? '#4d9fff'
  const edgeColor =
    game.edges >= 3 ? 'text-positive' : game.edges >= 2 ? 'text-accent' : 'text-text2'
  const edgeBorder =
    game.edges >= 3 ? 'border-positive/40' : game.edges >= 2 ? 'border-accent/40' : 'border-white/10'
  const edgeBg = game.edges >= 3 ? 'bg-positive/10' : game.edges >= 2 ? 'bg-accent/10' : 'bg-white/[0.04]'

  return (
    <Link
      href={`/games/${game.id}`}
      className="block rounded-2xl border border-border bg-card p-3.5 transition-colors hover:border-border2 hover:bg-card2 md:p-4"
    >
      <div className="mb-2 flex items-center justify-between md:mb-2.5">
        <div className="flex items-center gap-3">
          <span className="text-base font-black" style={{ color: awayColor }}>
            {game.away.abbr}
          </span>
          <div className="text-center">
            {isLive ? (
              <div className="flex items-center gap-1 text-[10px] font-bold text-negative">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-negative" />
                LIVE
              </div>
            ) : (
              <div className="text-[11px] text-muted">{game.time}</div>
            )}
            <div className="text-[11px] font-semibold text-text2">O/U {game.total}</div>
          </div>
          <span className="text-base font-black" style={{ color: homeColor }}>
            {game.home.abbr}
          </span>
        </div>
        <div
          className={`rounded-xl border px-3 py-1 text-[11px] font-bold ${edgeBorder} ${edgeBg} ${edgeColor}`}
        >
          {game.edges} edge{game.edges !== 1 ? 's' : ''}
        </div>
      </div>

      <div className="mb-2 text-[10px] text-muted">
        {game.awayPitcher} vs {game.homePitcher}
      </div>

      <div className="h-[3px] overflow-hidden rounded-full bg-border2">
        <div
          className="h-full rounded-full"
          style={{
            width: `${game.winProb}%`,
            background: `linear-gradient(90deg, ${awayColor}, ${homeColor})`,
          }}
        />
      </div>
    </Link>
  )
}
