import { getGameOdds } from '@/lib/odds/api'
import { edgeToProb, noVigProb } from '@/lib/parlay/math'
import type { Sport } from '@/lib/sport/SportContext'
import type { TopEdgeResult } from './topEdges'

export interface BestBetPick {
  sport: Sport
  gameId: string
  href: string
  matchup: string
  /** Team the pick backs (its moneyline). */
  team: string
  pick: string
  /** The insight this pick comes from. */
  insight: string
  oddsAmerican: number
  book: string
  /** Estimated hit probability from the insight's confidence, 0-100. */
  hitRate: number
  /** The market's no-vig implied probability for the same side. */
  marketProb: number
  /** hitRate − marketProb, in percentage points. Positive = the book is pricing the side lower than our estimate. */
  edgePts: number
  grade: string
  conf: number
  trends: number
  startTime: string | null
}

const PER_SPORT = 2
/** Heaviest favorite still worth recommending. */
const MAX_FAVORITE_PRICE = -300

const scoreOf = (conf: number, edgePts: number) => conf + Math.max(-10, Math.min(10, edgePts)) * 0.5

function parseMatchup(m: string): { away: string; home: string } | null {
  const [away, home] = m.split(' @ ')
  return away && home ? { away: away.trim(), home: home.trim() } : null
}

/**
 * Today's best bets, each priced at a real posted moneyline. For every insight that names a team we take
 * that team's live moneyline and compare the insight-based hit probability with the market's no-vig
 * probability. Ranking is led by the insight's own confidence, nudged by that gap ("value", capped at ±10
 * points so the crude hit-rate estimate can't dominate). Prices steeper than -300 are skipped because they
 * barely pay, as are games that have started or that no book has posted — nothing is priced with a guess.
 */
export async function getBestBetPicks(edges: TopEdgeResult[]): Promise<BestBetPick[]> {
  const cache = new Map<string, ReturnType<typeof getGameOdds>>()
  const oddsFor = (sport: Sport, gameId: string, away: string, home: string) => {
    const k = `${sport}:${gameId}`
    if (!cache.has(k)) cache.set(k, getGameOdds(sport, gameId, { away, home }))
    return cache.get(k)!
  }

  const candidates = (
    await Promise.all(
      edges
        .filter((r) => r.edge.team)
        .map(async (r): Promise<(BestBetPick & { score: number }) | null> => {
          const teams = parseMatchup(r.matchup)
          if (!teams) return null
          const odds = await oddsFor(r.sport, r.gameId, teams.away, teams.home)
          if (!odds || odds.live) return null
          if (odds.commenceTime && Date.parse(odds.commenceTime) <= Date.now()) return null
          const team = r.edge.team!
          const mine = team === odds.away ? odds.moneyline.away : team === odds.home ? odds.moneyline.home : null
          const theirs = team === odds.away ? odds.moneyline.home : odds.moneyline.away
          if (!mine || !theirs) return null
          if (mine.price < MAX_FAVORITE_PRICE) return null

          const hitRate = edgeToProb(r.edge.conf)
          const marketProb = noVigProb(mine.price, theirs.price)
          const edgePts = hitRate - marketProb
          return {
            sport: r.sport,
            gameId: r.gameId,
            href: r.href,
            matchup: r.matchup,
            team,
            pick: `${team} Moneyline`,
            insight: r.edge.bet,
            oddsAmerican: mine.price,
            book: mine.book,
            hitRate,
            marketProb: Math.round(marketProb * 10) / 10,
            edgePts: Math.round(edgePts * 10) / 10,
            grade: r.edge.grade,
            conf: r.edge.conf,
            trends: r.edge.supporting,
            startTime: odds.commenceTime,
            score: scoreOf(r.edge.conf, edgePts),
          }
        })
    )
  ).filter((c): c is BestBetPick & { score: number } => c !== null)

  // One pick per team (best insight wins), then the top few per sport.
  const bestPerTeam = new Map<string, BestBetPick & { score: number }>()
  for (const c of candidates) {
    const k = `${c.sport}:${c.gameId}:${c.team}`
    const prev = bestPerTeam.get(k)
    if (!prev || c.score > prev.score) bestPerTeam.set(k, c)
  }
  const out: BestBetPick[] = []
  for (const sport of ['mlb', 'nfl', 'nba', 'nhl'] as Sport[]) {
    const mine = Array.from(bestPerTeam.values())
      .filter((c) => c.sport === sport)
      .sort((a, b) => b.score - a.score)
      .slice(0, PER_SPORT)
    for (const { score, ...pick } of mine) {
      void score
      out.push(pick)
    }
  }
  return out.sort((a, b) => scoreOf(b.conf, b.edgePts) - scoreOf(a.conf, a.edgePts))
}
