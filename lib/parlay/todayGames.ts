import { getTodaysGameBreakdowns } from '@/lib/home/gameBreakdowns'
import { getGameOdds } from '@/lib/odds/api'
import { favoriteFromEdges } from './lines'
import type { ParlayGame } from './suggest'
import type { Sport } from '@/lib/sport/SportContext'

const ALL_SPORTS: Sport[] = ['mlb', 'nfl', 'nba', 'nhl']

/** Today's games (all sports) with the insight + prop context the Parlay page needs. */
export async function getParlayGames(): Promise<ParlayGame[]> {
  const breakdowns = await getTodaysGameBreakdowns()
  const out: ParlayGame[] = []
  for (const sport of ALL_SPORTS) {
    const oddsList = await Promise.all(breakdowns[sport].map(({ game }) => getGameOdds(sport, game.id, { away: game.away.abbr, home: game.home.abbr })))
    breakdowns[sport].forEach(({ game, edges }, i) => {
      out.push({
        sport,
        gameId: game.id,
        href: game.href,
        awayAbbr: game.away.abbr,
        homeAbbr: game.home.abbr,
        startTime: game.startTime,
        network: game.network,
        status: game.status,
        favorite: favoriteFromEdges(edges, game.away.abbr, game.home.abbr),
        odds: oddsList[i],
        insights: edges.map((e) => ({
          key: `${e.team ?? ''}:${e.bet}`,
          label: e.bet,
          typeLabel: e.typeLabel,
          grade: e.grade,
          conf: e.conf,
          team: e.team ?? null,
          detail: `${e.line} ${e.altPlay}`,
        })),
      })
    })
  }
  return out
}
