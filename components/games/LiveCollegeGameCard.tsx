import Link from 'next/link'
import type { SlateGame, SlateTeam } from '@/lib/college/slate'
import { sportMeta } from '@/lib/sport/meta'

export interface EdgeBadge {
  count: number
  topGrade: string | null
  topConf: number | null
}

function TeamRow({ t, winner, showScore }: { t: SlateTeam; winner: boolean; showScore: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-2">
        {t.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={t.logo} alt="" width={26} height={26} className="h-[26px] w-[26px] shrink-0 object-contain" />
        ) : (
          <span className="h-[26px] w-[26px] shrink-0 rounded-full bg-card3" />
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            {t.rank !== null && <span className="rounded-md bg-accent/15 px-1.5 py-px text-[10px] font-extrabold text-accent">#{t.rank}</span>}
            <span className={`truncate text-[13px] ${winner ? 'font-black text-text' : 'font-bold text-text2'}`}>{t.shortName}</span>
          </div>
          <div className="flex items-center gap-1.5 text-[9px] text-muted">
            {t.conferenceAbbr && <span className="font-bold" style={{ color: t.color }}>{t.conferenceAbbr}</span>}
            {t.record && <span>{t.record}</span>}
          </div>
        </div>
      </div>
      {showScore && <span className={`stat-number text-lg ${winner ? 'text-text' : 'text-muted'}`}>{t.score ?? '—'}</span>}
    </div>
  )
}

function timeLabel(g: SlateGame): string {
  if (g.state === 'in') return `LIVE · ${g.shortStatus}`
  if (g.state === 'post') return 'FINAL'
  return new Date(g.date).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' }) + ' ET'
}

/** College football / basketball game card: rankings, conference badges, time, TV, venue, and (lazily) a qualifying-edge badge. */
export function LiveCollegeGameCard({ game, edge }: { game: SlateGame; edge?: EdgeBadge }) {
  const meta = sportMeta(game.sport)
  const final = game.state === 'post'
  const live = game.state === 'in'
  const showScore = final || live
  const awayWon = final && (game.away.score ?? 0) > (game.home.score ?? 0)
  const homeWon = final && (game.home.score ?? 0) > (game.away.score ?? 0)

  return (
    <Link
      href={`/games/${game.sport}/${game.id}`}
      className="block rounded-[14px] border border-border bg-card p-3.5 transition-colors hover:border-border2 md:p-4"
      style={{ borderLeft: `3px solid ${meta.color}` }}
    >
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <span className={`rounded-lg px-2 py-1 text-[10px] font-bold ${live ? 'bg-loss/15 text-loss' : 'bg-card3 text-muted'}`}>{timeLabel(game)}</span>
        <div className="flex items-center gap-1.5">
          {game.network && <span className="rounded-md border border-border px-1.5 py-0.5 text-[9px] font-bold text-text2">📺 {game.network}</span>}
          {edge && edge.count > 0 && (
            <span className="rounded-md border border-win/40 bg-win/10 px-1.5 py-0.5 text-[9px] font-extrabold text-win" title={edge.topConf ? `Top edge ${edge.topConf}% confidence` : undefined}>
              ⚡ {edge.count} edge{edge.count === 1 ? '' : 's'}
              {edge.topGrade ? ` · ${edge.topGrade}` : ''}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <TeamRow t={game.away} winner={awayWon} showScore={showScore} />
        <TeamRow t={game.home} winner={homeWon} showScore={showScore} />
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-muted">
        {game.headline && <span className="font-semibold text-text2">{game.headline}</span>}
        {game.conferenceGame && <span className="rounded-full border border-border px-1.5 py-px font-bold">Conference</span>}
        {game.neutral && <span className="rounded-full border border-border px-1.5 py-px font-bold">Neutral site</span>}
        {game.venue && (
          <span className="truncate">
            {game.venue}
            {game.venueCity ? ` · ${game.venueCity}` : ''}
          </span>
        )}
        {game.homeSpread !== null && (
          <span>
            {game.home.abbr} {game.homeSpread > 0 ? '+' : ''}
            {game.homeSpread}
            {game.total !== null ? ` · O/U ${game.total}` : ''}
          </span>
        )}
      </div>
    </Link>
  )
}
