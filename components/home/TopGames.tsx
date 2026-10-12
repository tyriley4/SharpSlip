import { MatchupLinks } from '@/components/teams/MatchupLinks'
import { CardOverlayLink } from '@/components/ui/CardOverlayLink'
import type { ConvictionTier, TopGame } from '@/lib/home/topGames'
import { sportMeta } from '@/lib/sport/meta'
import type { Sport } from '@/lib/sport/SportContext'

function formatTime(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

const TIER_BADGE: Record<Exclude<ConvictionTier, null>, { label: string; className: string }> = {
  strong: { label: 'Strong Edge', className: 'border-grade-a/40 bg-grade-a/15 text-grade-a' },
  edge: { label: 'Edge', className: 'border-grade-b/40 bg-grade-b/15 text-grade-b' },
}

function TopGameCard({ topGame }: { topGame: TopGame }) {
  const { game, tier } = topGame
  const meta = sportMeta(topGame.sport)
  const isLive = game.status === 'Live'
  const matchup = `${game.away.abbr} @ ${game.home.abbr}`

  return (
    <div
      className="relative flex w-[220px] shrink-0 flex-col gap-1.5 rounded-[14px] border border-border bg-card p-3 transition-colors hover:border-border2 md:w-auto"
      style={{ borderLeft: `3px solid ${meta.color}` }}
    >
      <CardOverlayLink href={game.href} label={`${matchup} game breakdown`} />
      <div className="pointer-events-none flex items-center justify-between gap-2">
        <span className="rounded-full px-1.5 py-0.5 text-[8px] font-bold" style={{ background: `${meta.color}22`, color: meta.color }}>
          {meta.icon} {meta.label}
        </span>
        {tier && <span className={`rounded-full border px-1.5 py-0.5 text-[8px] font-bold ${TIER_BADGE[tier].className}`}>{TIER_BADGE[tier].label}</span>}
      </div>
      <div className="pointer-events-none text-[13px] font-bold text-text">
        <MatchupLinks sport={topGame.sport} matchup={matchup} />
      </div>
      <div className="pointer-events-none flex items-center justify-between text-[9px] text-muted">
        <span>
          {isLive ? (
            <span className="live-pulse font-bold text-loss">● LIVE</span>
          ) : game.status === 'Final' ? (
            'Final'
          ) : (
            formatTime(game.startTime) || game.statusText
          )}
        </span>
        {game.network && <span className="truncate">{game.network}</span>}
      </div>
    </div>
  )
}

export function TopGames({ topGames, sportFilter }: { topGames: TopGame[]; sportFilter: Sport | 'all' }) {
  const relevant = sportFilter === 'all' ? topGames : topGames.filter((g) => g.sport === sportFilter)

  return (
    <div className="flex flex-col gap-3">
      <h2 className="section-header text-sm text-text md:text-base">Top Games</h2>

      {relevant.length === 0 ? (
        <div className="rounded-xl border border-border bg-card px-4 py-6 text-center text-[11px] text-muted">No games scheduled.</div>
      ) : (
        <div className="flex gap-2.5 overflow-x-auto pb-1 [scrollbar-width:none] md:grid md:grid-cols-2 md:gap-3 md:overflow-visible [&::-webkit-scrollbar]:hidden">
          {relevant.map((g) => (
            <TopGameCard key={`${g.sport}-${g.game.id}`} topGame={g} />
          ))}
        </div>
      )}
    </div>
  )
}
