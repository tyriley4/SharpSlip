import Link from 'next/link'
import { LiveBadge } from '@/components/ui/Cards'
import { NBA_TEAM_COLORS } from '@/data/nba/teamColors'
import type { LiveNbaGame } from '@/lib/nba/mappers'
import { sportMeta } from '@/lib/sport/meta'

export function LiveNBAGameCard({ game }: { game: LiveNbaGame }) {
  const awayColor = NBA_TEAM_COLORS[game.away.abbr] ?? '#4d9fff'
  const homeColor = NBA_TEAM_COLORS[game.home.abbr] ?? '#4d9fff'
  const awayWon = game.away.score !== null && game.home.score !== null && game.away.score > game.home.score
  const homeWon = game.away.score !== null && game.home.score !== null && game.home.score > game.away.score
  const sportColor = sportMeta('nba').color

  return (
    <Link
      href={`/games/nba/${game.id}`}
      className="block rounded-[14px] border border-border bg-card p-3.5 transition-colors hover:border-border2 md:p-4"
      style={{ borderLeft: `3px solid ${sportColor}` }}
    >
      <div className="mb-2.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="text-center">
            <div className="text-lg font-black" style={{ color: awayColor }}>
              {game.away.abbr}
            </div>
            <div className={`stat-number text-sm ${awayWon ? 'text-text' : 'text-muted'}`}>{game.away.score ?? game.away.record}</div>
          </div>
          <span className="text-[10px] text-muted">@</span>
          <div className="text-center">
            <div className="text-lg font-black" style={{ color: homeColor }}>
              {game.home.abbr}
            </div>
            <div className={`stat-number text-sm ${homeWon ? 'text-text' : 'text-muted'}`}>{game.home.score ?? game.home.record}</div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          {game.status === 'Live' ? (
            <LiveBadge />
          ) : (
            <div className="rounded-lg bg-card3 px-2.5 py-1 text-[10px] font-bold text-muted">
              {game.status === 'Final' ? 'FINAL' : game.statusText}
            </div>
          )}
          {game.hasEdge && (
            <span className="rounded-full border border-accent/40 bg-accent/15 px-1.5 py-0.5 text-[9px] font-bold text-accent">⚡ Edge</span>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between text-[10px] text-muted">
        <span>
          {game.away.abbr} {game.away.record} ({game.away.ppg.toFixed(1)} PPG) · {game.home.abbr} {game.home.record} ({game.home.ppg.toFixed(1)} PPG)
        </span>
        {game.network && <span className="shrink-0">{game.network}</span>}
      </div>
    </Link>
  )
}
