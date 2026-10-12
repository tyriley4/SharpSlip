import Link from 'next/link'
import { NFL_TEAM_COLORS } from '@/data/nfl/teamColors'
import type { LiveNflGame } from '@/lib/nfl/mappers'
import { sportMeta } from '@/lib/sport/meta'

export function LiveNFLGameCard({ game }: { game: LiveNflGame }) {
  const awayColor = NFL_TEAM_COLORS[game.away.abbr] ?? '#4d9fff'
  const homeColor = NFL_TEAM_COLORS[game.home.abbr] ?? '#4d9fff'
  const final = game.status === 'Final'
  const live = game.status === 'Live'
  const awayWon = final && Number(game.away.score) > Number(game.home.score)
  const homeWon = final && Number(game.home.score) > Number(game.away.score)
  const sportColor = sportMeta('nfl').color

  return (
    <Link
      href={`/games/${game.id}`}
      className="block rounded-[14px] border border-border bg-card p-3.5 transition-colors hover:border-border2 md:p-4"
      style={{ borderLeft: `3px solid ${sportColor}` }}
    >
      <div className="mb-2.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="text-center">
            <div className="text-lg font-black" style={{ color: awayColor }}>
              {game.away.abbr}
            </div>
            <div className={`stat-number text-sm ${awayWon || live ? 'text-text' : 'text-muted'}`}>{final || live ? game.away.score : '—'}</div>
          </div>
          <span className="text-[10px] text-muted">@</span>
          <div className="text-center">
            <div className="text-lg font-black" style={{ color: homeColor }}>
              {game.home.abbr}
            </div>
            <div className={`stat-number text-sm ${homeWon || live ? 'text-text' : 'text-muted'}`}>{final || live ? game.home.score : '—'}</div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className={`rounded-lg px-2.5 py-1 text-[10px] font-bold ${live ? 'bg-loss/15 text-loss' : 'bg-card3 text-muted'}`}>{final ? 'FINAL' : live ? `LIVE · ${game.liveDetail ?? ''}` : game.kickoff}</div>
          {game.network && <div className="rounded-md border border-border px-1.5 py-0.5 text-[9px] font-bold text-text2">📺 {game.network}</div>}
        </div>
      </div>
      <div className="text-[10px] text-muted">
        Week {game.week} · {game.gameday}
        {game.spread ? ` · ${final ? 'Closed' : 'Line'} ${game.spread}` : ''}
        {game.total ? ` · O/U ${game.total}` : ''}
      </div>
    </Link>
  )
}
