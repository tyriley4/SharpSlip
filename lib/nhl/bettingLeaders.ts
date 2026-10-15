import { isCareer, nhlLog } from '@/lib/career/logs'
import { mapWithConcurrency } from '@/lib/utils/concurrency'
import { getAllNHLGoalieStats, getAllNHLSkaterStats } from './api'
import { buildNHLGameDots, computeNHLHitRate } from './bettingStats'
import { isRollingWindow, takeLastGames } from '@/lib/leaders/lastGames'
import { gameMatchesFilters, type NHLLeaderFilters } from './filters'
import { NHL_SKATER_BETTING_STAT_KEY, type NHLGoalieBettingCategory, type NHLSkaterBettingCategory } from './leaderCategories'
import { NOTABLE_NHL_GOALIES, NOTABLE_NHL_SKATERS } from './notablePlayers'

export interface NHLBettingLeaderRow {
  rank: number
  playerId: number
  name: string
  teamAbbr: string
  hitRate: number
  wins: number
  losses: number
  gamesPlayed: number
  last5: boolean[]
  seasonHitRate?: number
}

const MIN_SEASON_GAMES = 5

export async function getNhlSkaterBettingLeaders(
  category: NHLSkaterBettingCategory,
  threshold: number,
  filters: NHLLeaderFilters,
  limit = 100
): Promise<NHLBettingLeaderRow[]> {
  const allStats = await getAllNHLSkaterStats()
  if (!allStats) return []

  const pool = allStats.filter((p) => NOTABLE_NHL_SKATERS.includes(p.name))
  const statKey = NHL_SKATER_BETTING_STAT_KEY[category]

  const career = isCareer(filters.window)
  const results = await mapWithConcurrency(pool, 6, async (p) => {
      const log = await nhlLog(p.playerId, career)
      if (!log || log.length < MIN_SEASON_GAMES) return null
      const filtered = takeLastGames(log.filter((g) => gameMatchesFilters(g, filters)), filters.window, (g) => g.gameDate)
      if (filtered.length === 0) return null

      const { hitRate, wins, losses } = computeNHLHitRate(filtered, statKey, threshold)
      const last5 = buildNHLGameDots(filtered, statKey, threshold, 5).map((d) => d.hit)
      const seasonHitRate = isRollingWindow(filters.window)
        ? computeNHLHitRate(log.filter((g) => gameMatchesFilters(g, { ...filters, window: 'Season' })), statKey, threshold).hitRate
        : undefined

      return { playerId: p.playerId, name: p.name, teamAbbr: p.teamAbbr, hitRate, wins, losses, gamesPlayed: filtered.length, last5, seasonHitRate }
    })

  const valid = results.filter((r): r is NonNullable<typeof r> => r !== null)
  const sorted = valid.sort((a, b) => b.hitRate - a.hitRate || b.gamesPlayed - a.gamesPlayed).slice(0, limit)
  return sorted.map((r, i) => ({ rank: i + 1, ...r }))
}

export async function getNhlGoalieBettingLeaders(
  _category: NHLGoalieBettingCategory,
  threshold: number,
  filters: NHLLeaderFilters,
  limit = 100
): Promise<NHLBettingLeaderRow[]> {
  const allStats = await getAllNHLGoalieStats()
  if (!allStats) return []

  const pool = allStats.filter((p) => NOTABLE_NHL_GOALIES.includes(p.name))

  const career = isCareer(filters.window)
  const results = await mapWithConcurrency(pool, 6, async (p) => {
      const log = await nhlLog(p.playerId, career)
      if (!log || log.length < MIN_SEASON_GAMES) return null
      const filtered = takeLastGames(log.filter((g) => gameMatchesFilters(g, filters) && g.decision !== null), filters.window, (g) => g.gameDate)
      if (filtered.length === 0) return null

      const { hitRate, wins, losses } = computeNHLHitRate(filtered, 'saves', threshold)
      const last5 = buildNHLGameDots(filtered, 'saves', threshold, 5).map((d) => d.hit)
      const seasonHitRate = isRollingWindow(filters.window)
        ? computeNHLHitRate(log.filter((g) => gameMatchesFilters(g, { ...filters, window: 'Season' }) && g.decision !== null), 'saves', threshold).hitRate
        : undefined

      return { playerId: p.playerId, name: p.name, teamAbbr: p.teamAbbr, hitRate, wins, losses, gamesPlayed: filtered.length, last5, seasonHitRate }
    })

  const valid = results.filter((r): r is NonNullable<typeof r> => r !== null)
  const sorted = valid.sort((a, b) => b.hitRate - a.hitRate || b.gamesPlayed - a.gamesPlayed).slice(0, limit)
  return sorted.map((r, i) => ({ rank: i + 1, ...r }))
}
