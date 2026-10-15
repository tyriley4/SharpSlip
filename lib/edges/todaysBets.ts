import { dateOffset, getUnifiedGamesForDate, type UnifiedGame } from '@/lib/home/schedule'
import { cached } from '@/lib/net/ttlCache'
import { mapWithConcurrency, withTimeout } from '@/lib/utils/concurrency'
import { getRecommendedBets, type BetCardData } from './recommended'

export interface TodayBet {
  bet: BetCardData
  href: string
  startTime: string | null
}

const MAX_GAMES_PER_SPORT = 8
const SCAN_TIMEOUT_MS = 40000

/**
 * Every graded bet across today games that have not started, all six sports. Uses only props that are already cached,
 * so a home-page load never spends an odds credit. Sorted by conviction, strongest first.
 */
async function scan(): Promise<TodayBet[]> {
  const games = (await getUnifiedGamesForDate(dateOffset(0))).filter((g) => g.status === 'Pregame')
  const picked: UnifiedGame[] = []
  const rankKey = (g: UnifiedGame) => Math.min(g.awayRank ?? 99, g.homeRank ?? 99)
  for (const sport of ['mlb', 'nfl', 'cfb', 'nba', 'cbb', 'nhl'] as const) {
    picked.push(
      ...games
        .filter((g) => g.sport === sport)
        .sort((a, b) => rankKey(a) - rankKey(b))
        .slice(0, MAX_GAMES_PER_SPORT)
    )
  }
  const out: TodayBet[] = []
  await mapWithConcurrency(picked, 4, async (g) => {
    const rec = await getRecommendedBets(g.sport, g.id, g.away.abbr, g.home.abbr, 'cached')
    for (const b of [...rec.gameLines, ...rec.props.flatMap((p) => p.players.flatMap((x) => x.bets))]) {
      if (b.grade && ['A', 'B', 'C'].includes(b.grade)) out.push({ bet: b, href: g.href, startTime: g.startTime })
    }
  })
  return out.sort((a, b) => b.bet.convictionScore - a.bet.convictionScore)
}

export async function getTodaysBets(): Promise<TodayBet[]> {
  const r = await cached('edges:today', 900, async () => withTimeout(scan(), SCAN_TIMEOUT_MS, null as TodayBet[] | null))
  return r ?? []
}
