import Link from 'next/link'
import { LiveBadge } from '@/components/ui/Cards'
import { MLB_TEAM_COLORS } from '@/data/mlb/teamColors'
import type { LiveMlbGame } from '@/lib/mlb/mappers'
import { sportMeta } from '@/lib/sport/meta'

export function LiveMLBGameCard({ game }: { game: LiveMlbGame }) {
  const isLive = game.status === 'Live'
  const isFinal = game.status === 'Final'
  const awayColor = MLB_TEAM_COLORS[game.away.abbr] ?? '#4d9fff'
  const homeColor = MLB_TEAM_COLORS[game.home.abbr] ?? '#4d9fff'
  const sportColor = sportMeta('mlb').color

  return (
    <Link
      href={`/games/${game.id}`}
      className="block rounded-[14px] border border-border bg-card p-3.5 transition-colors hover:border-border2 hover:bg-card2 md:p-4"
      style={{ borderLeft: `3px solid ${sportColor}` }}
    >
      <div className="mb-2 flex items-center justify-between md:mb-2.5">
        <div className="flex items-center gap-3">
          <div className="text-center">
            <span className="text-lg font-black" style={{ color: awayColor }}>
              {game.away.abbr}
            </span>
            <div className="stat-number text-[9px] text-muted">
              {game.away.wins}-{game.away.losses}
            </div>
          </div>
          <div className="text-center">
            {isLive ? (
              <div className="flex items-center gap-1 text-[10px] font-bold text-loss">
                <span className="live-pulse h-1.5 w-1.5 rounded-full bg-loss" />
                {game.timeDisplay}
              </div>
            ) : (
              <div className="text-[11px] text-muted">{game.timeDisplay}</div>
            )}
            {(isLive || isFinal) && (
              <div className="stat-number text-[13px] text-text">
                {game.away.score} – {game.home.score}
              </div>
            )}
          </div>
          <div className="text-center">
            <span className="text-lg font-black" style={{ color: homeColor }}>
              {game.home.abbr}
            </span>
            <div className="stat-number text-[9px] text-muted">
              {game.home.wins}-{game.home.losses}
            </div>
          </div>
        </div>
        {isLive && <LiveBadge />}
        {isFinal && <div className="rounded-lg bg-card3 px-2.5 py-1 text-[10px] font-bold text-muted">FINAL</div>}
      </div>

      <div className="text-[10px] text-muted">
        {game.away.pitcher} vs {game.home.pitcher}
        {game.venue ? ` · ${game.venue}` : ''}
      </div>
    </Link>
  )
}
