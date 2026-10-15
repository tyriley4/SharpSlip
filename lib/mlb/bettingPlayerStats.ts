import type { TonightEdge } from '@/lib/players/types'
import type { RawGameLogEntry } from './api'
import { getPlayerGameLog } from './api'
import { buildGameDots, computeHitRate, leanForHitRate, type GameDot, type HitRateResult } from './bettingStats'
import {
  categoryStatKey,
  formatThreshold,
  HITTER_PROP_CATEGORIES,
  PITCHER_PROP_CATEGORIES,
  thresholdsFor,
  type PropCategory,
} from './bettingCategories'
import { takeLastGames } from '@/lib/leaders/lastGames'
import { DEFAULT_FILTERS, gameMatchesFilters, type LeaderFilters } from './filters'
import { NOTABLE_HITTERS, NOTABLE_PITCHERS } from './notablePlayers'
import { resolvePlayerIds } from './playerLookup'
import { getMlbTeamsIndex } from './teams'

export interface PlayerCategoryStats extends HitRateResult {
  last10: GameDot[]
  leagueAverage: number
}

/** A single player's hit rate at one category/threshold, optionally scoped by the shared leader filters. */
export async function getPlayerCategoryStats(
  playerId: number,
  group: 'hitting' | 'pitching',
  category: PropCategory,
  threshold: number,
  filters: LeaderFilters = DEFAULT_FILTERS
): Promise<PlayerCategoryStats | null> {
  const [log, teams] = await Promise.all([getPlayerGameLog(playerId, group), getMlbTeamsIndex()])
  if (!log || log.length === 0) return null

  const statKey = categoryStatKey(category, group)
  const filtered = takeLastGames(log.filter((g) => gameMatchesFilters(g, filters, teams)), filters.window, (g) => g.date)
  const hitRateResult = computeHitRate(filtered, statKey, threshold)
  const last10 = buildGameDots(log, statKey, threshold, 10, teams)
  const leagueAverage = await getLeagueAverage(group, category, threshold)

  return { ...hitRateResult, last10, leagueAverage }
}

const leagueAvgCache = new Map<string, Promise<number>>()

function getLeagueAverage(group: 'hitting' | 'pitching', category: PropCategory, threshold: number): Promise<number> {
  const key = `${group}|${category}|${threshold}`
  let cached = leagueAvgCache.get(key)
  if (!cached) {
    cached = computeLeagueAverage(group, category, threshold)
    leagueAvgCache.set(key, cached)
    cached.catch(() => leagueAvgCache.delete(key))
  }
  return cached
}

async function computeLeagueAverage(group: 'hitting' | 'pitching', category: PropCategory, threshold: number): Promise<number> {
  const names = group === 'hitting' ? NOTABLE_HITTERS : NOTABLE_PITCHERS
  const statKey = categoryStatKey(category, group)
  const resolved = await resolvePlayerIds(names)

  const results = await Promise.all(
    resolved.map(async (p) => {
      const log = await getPlayerGameLog(p.id, group)
      if (!log || log.length === 0) return null
      return computeHitRate(log, statKey, threshold)
    })
  )

  const valid = results.filter((r): r is HitRateResult => r !== null && r.gamesPlayed > 0)
  if (valid.length === 0) return 0
  const avg = valid.reduce((sum, r) => sum + r.hitRate, 0) / valid.length
  return Math.round(avg * 10) / 10
}

export interface BestPropResult {
  category: PropCategory
  threshold: number
  hitRate: number
  wins: number
  losses: number
  gamesPlayed: number
  last10: GameDot[]
  bestContext?: { label: string; hitRate: number }
  last7HitRate: number
  last7GamesPlayed: number
}

const MIN_BEST_PROP_SAMPLE = 30

/**
 * Scans every category/threshold this player qualifies for (30+ game season sample) and returns
 * the one with the highest season hit rate, for the player page's "Tonight's Edge" card. Also
 * looks for a real, composable split (home/away, day/night) that meaningfully beats the season rate.
 */
export async function getBestProp(playerId: number, group: 'hitting' | 'pitching'): Promise<BestPropResult | null> {
  const [log, teams] = await Promise.all([getPlayerGameLog(playerId, group), getMlbTeamsIndex()])
  if (!log || log.length < MIN_BEST_PROP_SAMPLE) return null

  const categories = group === 'hitting' ? HITTER_PROP_CATEGORIES : PITCHER_PROP_CATEGORIES

  let best: { category: PropCategory; threshold: number; result: HitRateResult } | null = null
  for (const category of categories) {
    const statKey = categoryStatKey(category, group)
    for (const threshold of thresholdsFor(category, group)) {
      const result = computeHitRate(log, statKey, threshold)
      if (result.gamesPlayed < MIN_BEST_PROP_SAMPLE) continue
      if (!best || result.hitRate > best.result.hitRate) {
        best = { category, threshold, result }
      }
    }
  }
  if (!best) return null

  const statKey = categoryStatKey(best.category, group)
  const last10 = buildGameDots(log, statKey, best.threshold, 10, teams)

  const splitCandidates: { label: string; games: RawGameLogEntry[] }[] = [
    { label: 'at home', games: log.filter((g) => g.isHome) },
    { label: 'on the road', games: log.filter((g) => !g.isHome) },
    { label: 'in day games', games: log.filter((g) => g.game?.dayNight === 'day') },
    { label: 'in night games', games: log.filter((g) => g.game?.dayNight === 'night') },
  ]

  let bestContext: { label: string; hitRate: number } | undefined
  for (const c of splitCandidates) {
    if (c.games.length < 10) continue
    const r = computeHitRate(c.games, statKey, best.threshold)
    if (r.hitRate >= best.result.hitRate + 8 && (!bestContext || r.hitRate > bestContext.hitRate)) {
      bestContext = { label: c.label, hitRate: r.hitRate }
    }
  }

  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000
  const last7Games = log.filter((g) => new Date(g.date).getTime() >= cutoff)
  const last7Result = computeHitRate(last7Games, statKey, best.threshold)

  return {
    category: best.category,
    threshold: best.threshold,
    ...best.result,
    last10,
    bestContext,
    last7HitRate: last7Result.hitRate,
    last7GamesPlayed: last7Result.gamesPlayed,
  }
}

/** Converts a computed best-prop scan into the player page's Tonight's Edge card shape. */
export function toTonightEdge(best: BestPropResult): TonightEdge {
  const lean =
    leanForHitRate(best.hitRate) +
    (best.bestContext ? ` — especially strong ${best.bestContext.label} (${best.bestContext.hitRate}%)` : '')

  const risk =
    best.last7GamesPlayed > 0 && best.last7HitRate < best.hitRate
      ? `${best.last7HitRate}% over the last 7 days (${best.last7GamesPlayed} games) — cooler than the season mark.`
      : undefined

  return {
    propLine: `${best.category} ${formatThreshold(best.threshold)}`,
    propRecord: `${best.wins}-${best.losses}`,
    hitRate: best.hitRate,
    lean,
    risk,
    last10: [...best.last10].reverse().map((d) => d.hit),
    prop: { category: best.category, threshold: best.threshold },
  }
}
