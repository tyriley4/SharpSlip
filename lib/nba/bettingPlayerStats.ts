import type { TonightEdge } from '@/lib/players/types'
import type { NBAPlayerGameLogRow } from './api'
import { getNBAPlayerGameLog } from './api'
import { buildNBAGameDots, computeNBAHitRate, type NBAGameDot, type NBAThresholdHitRate } from './bettingStats'
import { NBA_BETTING_CATEGORIES, NBA_BETTING_STAT_KEY, NBA_BETTING_THRESHOLDS, type NBABettingCategory } from './leaderCategories'
import { NOTABLE_NBA_PLAYERS } from './notablePlayers'
import { resolveNbaPlayerIds } from './playerLookup'

export interface NBAPlayerCategoryStats extends NBAThresholdHitRate {
  gamesPlayed: number
  last10: NBAGameDot[]
  leagueAverage: number
}

/** A single player's hit rate at one betting category/threshold. */
export async function getNbaPlayerCategoryStats(
  playerId: number,
  category: NBABettingCategory,
  threshold: number
): Promise<NBAPlayerCategoryStats | null> {
  const log = await getNBAPlayerGameLog(playerId)
  if (!log || log.length === 0) return null

  const statKey = NBA_BETTING_STAT_KEY[category]
  const hitRateResult = computeNBAHitRate(log, statKey, threshold)
  const last10 = buildNBAGameDots(log, statKey, threshold, 10)
  const leagueAverage = await getLeagueAverage(category, threshold)

  return { ...hitRateResult, gamesPlayed: log.length, last10, leagueAverage }
}

const leagueAvgCache = new Map<string, Promise<number>>()

function getLeagueAverage(category: NBABettingCategory, threshold: number): Promise<number> {
  const key = `${category}|${threshold}`
  let cached = leagueAvgCache.get(key)
  if (!cached) {
    cached = computeLeagueAverage(category, threshold)
    leagueAvgCache.set(key, cached)
    cached.catch(() => leagueAvgCache.delete(key))
  }
  return cached
}

async function computeLeagueAverage(category: NBABettingCategory, threshold: number): Promise<number> {
  const statKey = NBA_BETTING_STAT_KEY[category]
  const resolved = await resolveNbaPlayerIds(NOTABLE_NBA_PLAYERS)

  const results = await Promise.all(
    resolved.map(async (p) => {
      const log = await getNBAPlayerGameLog(p.playerId)
      if (!log || log.length === 0) return null
      return computeNBAHitRate(log, statKey, threshold)
    })
  )

  const valid = results.filter((r): r is NBAThresholdHitRate => r !== null)
  if (valid.length === 0) return 0
  const avg = valid.reduce((sum, r) => sum + r.hitRate, 0) / valid.length
  return Math.round(avg * 10) / 10
}

export interface BestNbaPropResult {
  category: NBABettingCategory
  threshold: number
  hitRate: number
  wins: number
  losses: number
  gamesPlayed: number
  last10: NBAGameDot[]
  bestContext?: { label: string; hitRate: number }
  last7HitRate: number
  last7GamesPlayed: number
}

const MIN_BEST_PROP_SAMPLE = 20

/**
 * Scans every betting category/threshold this player qualifies for (20+ game season sample, per
 * the NBA spec) and returns the one with the highest season hit rate, for the player page's
 * "Tonight's Edge" card. Also looks for a real home/away split that meaningfully beats the season rate.
 */
export async function getBestNbaProp(playerId: number): Promise<BestNbaPropResult | null> {
  const log = await getNBAPlayerGameLog(playerId)
  if (!log || log.length < MIN_BEST_PROP_SAMPLE) return null

  let best: { category: NBABettingCategory; threshold: number; result: NBAThresholdHitRate } | null = null
  for (const category of NBA_BETTING_CATEGORIES) {
    const statKey = NBA_BETTING_STAT_KEY[category]
    for (const threshold of NBA_BETTING_THRESHOLDS[category]) {
      const result = computeNBAHitRate(log, statKey, threshold)
      if (result.wins + result.losses < MIN_BEST_PROP_SAMPLE) continue
      if (!best || result.hitRate > best.result.hitRate) {
        best = { category, threshold, result }
      }
    }
  }
  if (!best) return null

  const statKey = NBA_BETTING_STAT_KEY[best.category]
  const last10 = buildNBAGameDots(log, statKey, best.threshold, 10)

  const splitCandidates: { label: string; games: NBAPlayerGameLogRow[] }[] = [
    { label: 'at home', games: log.filter((g) => g.isHome) },
    { label: 'on the road', games: log.filter((g) => !g.isHome) },
  ]

  let bestContext: { label: string; hitRate: number } | undefined
  for (const c of splitCandidates) {
    if (c.games.length < 8) continue
    const r = computeNBAHitRate(c.games, statKey, best.threshold)
    if (r.hitRate >= best.result.hitRate + 8 && (!bestContext || r.hitRate > bestContext.hitRate)) {
      bestContext = { label: c.label, hitRate: r.hitRate }
    }
  }

  const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000
  const last7Games = log.filter((g) => new Date(g.gameDate).getTime() >= cutoff)
  const last7Result = computeNBAHitRate(last7Games, statKey, best.threshold)

  return {
    category: best.category,
    ...best.result,
    gamesPlayed: log.length,
    last10,
    bestContext,
    last7HitRate: last7Result.hitRate,
    last7GamesPlayed: last7Result.wins + last7Result.losses,
  }
}

function leanForHitRate(hitRate: number): string {
  if (hitRate >= 70) return `Hits this mark at a ${hitRate}% clip this season — one of the strongest props on the board.`
  if (hitRate >= 60) return `Clears this line ${hitRate}% of the time this season — a solid statistical case.`
  if (hitRate >= 45) return `Right around a coin flip at ${hitRate}% this season — no clear statistical case either way.`
  return `Only hits this mark ${hitRate}% of the time this season — falls short more often than not.`
}

/** Converts a computed best-prop scan into the player page's Tonight's Edge card shape. */
export function toNbaTonightEdge(best: BestNbaPropResult): TonightEdge {
  const lean =
    leanForHitRate(best.hitRate) +
    (best.bestContext ? ` — especially strong ${best.bestContext.label} (${best.bestContext.hitRate}%)` : '')

  const risk =
    best.last7GamesPlayed > 0 && best.last7HitRate < best.hitRate
      ? `${best.last7HitRate}% over the last 2 weeks (${best.last7GamesPlayed} games) — cooler than the season mark.`
      : undefined

  return {
    propLine: `${best.category} ${best.threshold}+`,
    propRecord: `${best.wins}-${best.losses}`,
    hitRate: best.hitRate,
    lean,
    risk,
    last10: [...best.last10].reverse().map((d) => d.hit),
    prop: { category: best.category, threshold: best.threshold },
  }
}
