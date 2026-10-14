import Link from 'next/link'
import { LiveBadge } from '@/components/ui/Cards'
import { NHL_TEAM_COLORS } from '@/data/nhl/teamColors'
import type { LiveNhlGame } from '@/lib/nhl/mappers'
import { sportMeta } from '@/lib/sport/meta'

function formatPuckDrop(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })
}

export function LiveNHLGameCard({ game }: { game: LiveNhlGame }) {
  const awayColor = NHL_TEAM_COLORS[game.away.abbr] ?? '#4d9fff'
  const homeColor = NHL_TEAM_COLORS[game.home.abbr] ?? '#4d9fff'
  const awayWon = game.away.score !== null && game.home.score !== null && game.away.score > game.home.score
  const homeWon = game.away.score !== null && game.home.score !== null && game.home.score > game.away.score
  const sportColor = sportMeta('nhl').color

  return (
    <Link
      href={`/games/nhl/${game.id}`}
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
              {game.status === 'Final' ? 'FINAL' : formatPuckDrop(game.startTimeUTC)}
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between text-[10px] text-muted">
        <span>
          {game.away.abbr} {game.away.record} ({game.away.gpg.toFixed(1)} GPG) · {game.home.abbr} {game.home.record} ({game.home.gpg.toFixed(1)} GPG)
        </span>
        {game.network && <span className="shrink-0">{game.network}</span>}
      </div>
      {(game.away.goalie || game.home.goalie) && (
        <div className="mt-2 flex items-center justify-between border-t border-border pt-2 text-[10px] text-muted">
          <span>🥅 {game.away.goalie ? `${game.away.goalie.name} (${(game.away.goalie.savePct * 100).toFixed(1)}%)` : 'TBD'}</span>
          <span>{game.home.goalie ? `${game.home.goalie.name} (${(game.home.goalie.savePct * 100).toFixed(1)}%)` : 'TBD'} 🥅</span>
        </div>
      )}
    </Link>
  )
}
