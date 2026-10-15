import { reportError } from '@/lib/monitoring/sentry'
import { cached } from '@/lib/net/ttlCache'
import { getCachedPlayerProps } from '@/lib/odds/api'
import { dateOffset, getUnifiedGamesForDate, type UnifiedGame } from '@/lib/home/schedule'
import { impliedProb, noVigProb } from '@/lib/parlay/math'
import { slugify } from '@/lib/players/slug'
import type { Sport } from '@/lib/sport/SportContext'
import { loadGameContext } from './data/gameContext'
import { categoryForMarket, getPlayerHistory } from './data/playerHistory'
import { loadHitterMatchup } from './data/mlbMatchup'
import { evaluateWithContext } from './edgeEngine'
import type { BettingOutcome, EdgeCategory, Grade } from './types'

export interface PlayerConvictionInsight {
  description: string
  category: EdgeCategory
  supportingData: string
}

export interface ThresholdConviction {
  /** The calculator "N+" threshold this row answers for. */
  threshold: number
  grade: Grade | null
  convictionScore: number
  historicalHitRate: number | null
  isSharpFind: boolean
  limitedSample: boolean
  sampleSize: number
  insights: PlayerConvictionInsight[]
}

export interface PlayerConviction {
  available: boolean
  /** Why nothing is shown: no game tonight, history missing ... */
  reason?: string
  matchup?: string
  href?: string
  opponent?: string
  thresholds: ThresholdConviction[]
  /** The graded threshold with the strongest conviction, when any. */
  best: number | null
}

export interface PlayerConvictionArgs {
  sport: Sport
  name: string
  team: string
  category: string
  /** Calculator thresholds, "N+" meaning at least N. */
  thresholds: number[]
  /** MLB strikeouts: pitcher (true) or hitter (false) log. */
  pitching?: boolean
}

/** A calculator "N+" (at least N) is the engine's Over (ceil(N) - 0.5) on whole-number stats. */
export function lineForAtLeast(n: number): number {
  return Math.ceil(n) - 0.5
}

const none = (reason: string): PlayerConviction => ({ available: false, reason, thresholds: [], best: null })

async function todaysGames(): Promise<UnifiedGame[]> {
  return (await cached('edges:todays-games', 600, () => getUnifiedGamesForDate(dateOffset(0)))) ?? []
}

/**
 * Conviction for one player prop at several thresholds against the team's game today. Nothing is graded without a game
 * (the matchup is half the evidence) or without a measurable history, and no price is invented: a Sharp Find needs a
 * posted line that is already cached.
 */
export async function getPlayerConviction(args: PlayerConvictionArgs): Promise<PlayerConviction> {
  const { sport, name, team, category, thresholds } = args
  const key = `edges:playerconv:${sport}:${slugify(name)}:${team}:${category}:${thresholds.join(',')}:${args.pitching ? 'p' : 'h'}`
  // Failures (missing history, upstream errors) are returned but never cached, so a transient outage cannot stick for an hour.
  let miss: PlayerConviction | null = null
  const result = await cached(key, 3600, async (): Promise<PlayerConviction | null> => {
    try {
      const abbr = team.toUpperCase()
      const games = (await todaysGames()).filter((g) => g.sport === sport && (g.away.abbr.toUpperCase() === abbr || g.home.abbr.toUpperCase() === abbr))
      const game = games.find((g) => g.status !== 'Final') ?? games[0]
      if (!game) return none('No game today')
      const home = game.home.abbr.toUpperCase() === abbr
      const opponent = home ? game.away.abbr : game.home.abbr
      const ctx = await loadGameContext(sport, game.id, game.away.abbr, game.home.abbr)
      if (ctx.season.isPreseason) return none('Preseason game')
      const history = await getPlayerHistory(sport, name, team, category, { pitching: args.pitching })
      if (!history) {
        miss = none('No game history for this player')
        return null
      }

      const position = history.position || ''
      let hitterMatchup = null
      if (sport === 'mlb' && !args.pitching && category !== 'Strikeouts' && ctx.mlb) {
        // The probable starter is the opposing team's.
        const opposing = abbr === game.away.abbr.toUpperCase() ? ctx.mlb.probables.home : ctx.mlb.probables.away
        if (opposing) hitterMatchup = await loadHitterMatchup(history.playerId, opposing.id, opposing.name, new Date().getUTCFullYear()).catch(() => null)
      }

      const posted = await getCachedPlayerProps(sport, game.id, { away: game.away.abbr, home: game.home.abbr })
      const offers = (posted?.props ?? []).filter((o) => slugify(o.player) === slugify(name) && categoryForMarket(sport, o.marketLabel) === category)

      const rows: ThresholdConviction[] = thresholds.map((t) => {
        const line = lineForAtLeast(t)
        const offer = offers.find((o) => o.line === line && o.over)
        let odds: number | undefined
        let implied: number | undefined
        if (offer?.over) {
          odds = offer.over.price
          implied = (offer.under ? noVigProb(offer.over.price, offer.under.price) : impliedProb(offer.over.price)) / 100
        }
        const outcome: BettingOutcome = {
          type: 'player_prop',
          sport,
          gameId: game.id,
          player: { name, team, position },
          category,
          threshold: line,
          direction: 'over',
          odds,
          impliedProbability: implied,
          opponent,
          homeAway: home ? 'home' : 'away',
        }
        const r = evaluateWithContext(outcome, ctx, history, { hitterMatchup })
        return {
          threshold: t,
          grade: r.grade,
          convictionScore: r.convictionScore,
          historicalHitRate: r.historicalHitRate,
          isSharpFind: r.isSharpFind,
          limitedSample: r.limitedSample,
          sampleSize: r.sampleSize,
          insights: r.edges.map((e) => ({ description: e.description, category: e.category, supportingData: e.supportingData })),
        }
      })

      // A line cleared 95%+ of the time pays next to nothing, so it only wins when every graded line is that safe.
      const graded = rows.filter((r) => r.grade && ['A', 'B', 'C'].includes(r.grade))
      const worthwhile = graded.filter((r) => (r.historicalHitRate ?? 0) < 95)
      const pool = worthwhile.length ? worthwhile : graded
      const best = pool.length ? pool.reduce((a, b) => (b.convictionScore > a.convictionScore || (b.convictionScore === a.convictionScore && b.threshold > a.threshold) ? b : a)).threshold : null
      return { available: true, matchup: `${game.away.abbr} @ ${game.home.abbr}`, href: game.href, opponent, thresholds: rows, best }
    } catch (err) {
      reportError(err, 'player-conviction')
      miss = none('Analysis unavailable')
      return null
    }
  })
  return result ?? miss ?? none('Analysis unavailable')
}
