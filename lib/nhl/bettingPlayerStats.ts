import type { TonightEdge } from '@/lib/players/types'
import type { NHLPlayerGameLogRow } from './api'
import { getNHLPlayerGameLog, getNHLPlayerInfo } from './api'
import { buildNHLGameDots, computeNHLHitRate, type NHLGameDot, type NHLStatKey, type NHLThresholdHitRate } from './bettingStats'
import {
  NHL_GOALIE_PLAYER_PROP_CATEGORIES,
  NHL_GOALIE_PLAYER_PROP_STAT_KEY,
  NHL_GOALIE_PLAYER_PROP_THRESHOLDS,
  NHL_SKATER_BETTING_CATEGORIES,
  NHL_SKATER_BETTING_STAT_KEY,
  NHL_SKATER_BETTING_THRESHOLDS,
  type NHLGoaliePlayerPropCategory,
  type NHLSkaterBettingCategory,
} from './leaderCategories'
import { NOTABLE_NHL_GOALIES, NOTABLE_NHL_SKATERS } from './notablePlayers'
import { resolveNhlGoalieIds, resolveNhlSkaterIds } from './playerLookup'

export interface NHLPlayerCategoryStats extends NHLThresholdHitRate {
  gamesPlayed: number
  last10: NHLGameDot[]
  leagueAverage: number
}

type NHLPropCategory = NHLSkaterBettingCategory | NHLGoaliePlayerPropCategory

function statKeyFor(category: NHLPropCategory, isGoalie: boolean): NHLStatKey {
  if (isGoalie) return NHL_GOALIE_PLAYER_PROP_STAT_KEY[category as NHLGoaliePlayerPropCategory]
  return NHL_SKATER_BETTING_STAT_KEY[category as NHLSkaterBettingCategory]
}

/** A single player's hit rate at one prop category/threshold. */
export async function getNhlPlayerCategoryStats(playerId: number, category: NHLPropCategory, threshold: number, isGoalie: boolean): Promise<NHLPlayerCategoryStats | null> {
  const log = await getNHLPlayerGameLog(playerId)
  if (!log || log.length === 0) return null

  const relevant = isGoalie ? log.filter((g) => g.decision !== null) : log
  if (relevant.length === 0) return null

  const statKey = statKeyFor(category, isGoalie)
  const hitRateResult = computeNHLHitRate(relevant, statKey, threshold)
  const last10 = buildNHLGameDots(relevant, statKey, threshold, 10)
  const leagueAverage = await getLeagueAverage(category, threshold, isGoalie)

  return { ...hitRateResult, gamesPlayed: relevant.length, last10, leagueAverage }
}

const leagueAvgCache = new Map<string, Promise<number>>()

function getLeagueAverage(category: NHLPropCategory, threshold: number, isGoalie: boolean): Promise<number> {
  const key = `${isGoalie ? 'goalie' : 'skater'}|${category}|${threshold}`
  let cached = leagueAvgCache.get(key)
  if (!cached) {
    cached = computeLeagueAverage(category, threshold, isGoalie)
    leagueAvgCache.set(key, cached)
    cached.catch(() => leagueAvgCache.delete(key))
  }
  return cached
}

async function computeLeagueAverage(category: NHLPropCategory, threshold: number, isGoalie: boolean): Promise<number> {
  const statKey = statKeyFor(category, isGoalie)
  const resolved = isGoalie ? await resolveNhlGoalieIds(NOTABLE_NHL_GOALIES) : await resolveNhlSkaterIds(NOTABLE_NHL_SKATERS)

  const results = await Promise.all(
    resolved.map(async (p) => {
      const log = await getNHLPlayerGameLog(p.playerId)
      const relevant = isGoalie ? (log ?? []).filter((g) => g.decision !== null) : log ?? []
      if (relevant.length === 0) return null
      return computeNHLHitRate(relevant, statKey, threshold)
    })
  )

  const valid = results.filter((r): r is NHLThresholdHitRate => r !== null)
  if (valid.length === 0) return 0
  const avg = valid.reduce((sum, r) => sum + r.hitRate, 0) / valid.length
  return Math.round(avg * 10) / 10
}

export interface BestNhlPropResult {
  category: NHLPropCategory
  threshold: number
  hitRate: number
  wins: number
  losses: number
  gamesPlayed: number
  last10: NHLGameDot[]
  bestContext?: { label: string; hitRate: number }
  last7HitRate: number
  last7GamesPlayed: number
}

const MIN_BEST_PROP_SAMPLE = 15

/**
 * Scans every prop category/threshold this player qualifies for (15+ game season sample, per the
 * NHL spec) and returns the one with the highest season hit rate, for Tonight's Edge. Also looks
 * for a real home/away split that meaningfully beats the season rate.
 */
export async function getBestNhlProp(playerId: number): Promise<BestNhlPropResult | null> {
  const info = await getNHLPlayerInfo(playerId)
  if (!info) return null

  const log = await getNHLPlayerGameLog(playerId)
  const relevant = info.isGoalie ? (log ?? []).filter((g) => g.decision !== null) : log ?? []
  if (relevant.length < MIN_BEST_PROP_SAMPLE) return null

  const categories: readonly NHLPropCategory[] = info.isGoalie ? NHL_GOALIE_PLAYER_PROP_CATEGORIES : NHL_SKATER_BETTING_CATEGORIES
  const thresholdsFor = (c: NHLPropCategory): number[] => (info.isGoalie ? NHL_GOALIE_PLAYER_PROP_THRESHOLDS[c as NHLGoaliePlayerPropCategory] : NHL_SKATER_BETTING_THRESHOLDS[c as NHLSkaterBettingCategory])

  let best: { category: NHLPropCategory; threshold: number; result: NHLThresholdHitRate } | null = null
  for (const category of categories) {
    const statKey = statKeyFor(category, info.isGoalie)
    for (const threshold of thresholdsFor(category)) {
      const result = computeNHLHitRate(relevant, statKey, threshold)
      if (result.wins + result.losses < MIN_BEST_PROP_SAMPLE) continue
      if (!best || result.hitRate > best.result.hitRate) {
        best = { category, threshold, result }
      }
    }
  }
  if (!best) return null

  const statKey = statKeyFor(best.category, info.isGoalie)
  const last10 = buildNHLGameDots(relevant, statKey, best.threshold, 10)

  const splitCandidates: { label: string; games: NHLPlayerGameLogRow[] }[] = [
    { label: 'at home', games: relevant.filter((g) => g.isHome) },
    { label: 'on the road', games: relevant.filter((g) => !g.isHome) },
  ]

  let bestContext: { label: string; hitRate: number } | undefined
  for (const c of splitCandidates) {
    if (c.games.length < 8) continue
    const r = computeNHLHitRate(c.games, statKey, best.threshold)
    if (r.hitRate >= best.result.hitRate + 8 && (!bestContext || r.hitRate > bestContext.hitRate)) {
      bestContext = { label: c.label, hitRate: r.hitRate }
    }
  }

  const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000
  const last7Games = relevant.filter((g) => new Date(g.gameDate).getTime() >= cutoff)
  const last7Result = computeNHLHitRate(last7Games, statKey, best.threshold)

  return {
    category: best.category,
    ...best.result,
    gamesPlayed: relevant.length,
    last10,
    bestContext,
    last7HitRate: last7Result.hitRate,
    last7GamesPlayed: last7Result.wins + last7Result.losses,
  }
}

function leanForHitRate(hitRate: number): string {
  if (hitRate >= 70) return `Hits this mark at a ${hitRate}% clip this season — one of the strongest props on the board.`
  if (hitRate >= 60) return `Clears this line ${hitRate}% of the time this season — a solid lean.`
  if (hitRate >= 45) return `Right around a coin flip at ${hitRate}% this season — proceed with caution.`
  return `Only hits this mark ${hitRate}% of the time this season — fades more often than not.`
}

/** Converts a computed best-prop scan into the player page's Tonight's Edge card shape. */
export function toNhlTonightEdge(best: BestNhlPropResult): TonightEdge {
  const lean = leanForHitRate(best.hitRate) + (best.bestContext ? ` — especially strong ${best.bestContext.label} (${best.bestContext.hitRate}%)` : '')

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
