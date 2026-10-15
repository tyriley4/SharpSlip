import { isCareer, nbaLog } from '@/lib/career/logs'
import { mapWithConcurrency } from '@/lib/utils/concurrency'
import { getAllNBAPlayerSeasonStats } from './api'
import { buildNBAGameDots, computeNBAHitRate } from './bettingStats'
import { isRollingWindow, takeLastGames } from '@/lib/leaders/lastGames'
import { gameMatchesFilters, type NBALeaderFilters } from './filters'
import { NBA_BETTING_STAT_KEY, type NBABettingCategory } from './leaderCategories'
import { NOTABLE_NBA_PLAYERS } from './notablePlayers'

export interface NBABettingLeaderRow {
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

const MIN_SEASON_GAMES = 15

export async function getNbaBettingLeaders(
  category: NBABettingCategory,
  threshold: number,
  filters: NBALeaderFilters,
  season: string,
  limit = 100
): Promise<NBABettingLeaderRow[]> {
  const allStats = await getAllNBAPlayerSeasonStats(season)
  if (!allStats) return []

  const pool = allStats.filter((p) => NOTABLE_NBA_PLAYERS.includes(p.name))
  const statKey = NBA_BETTING_STAT_KEY[category]

  const career = isCareer(filters.window)
  const results = await mapWithConcurrency(pool, 6, async (p) => {
      const log = await nbaLog(p.playerId, season, career)
      if (!log || log.length < MIN_SEASON_GAMES) return null
      const filtered = takeLastGames(log.filter((g) => gameMatchesFilters(g, filters)), filters.window, (g) => g.gameDate)
      if (filtered.length === 0) return null

      const { hitRate, wins, losses } = computeNBAHitRate(filtered, statKey, threshold)
      const last5 = buildNBAGameDots(filtered, statKey, threshold, 5).map((d) => d.hit)

      const seasonHitRate = isRollingWindow(filters.window)
        ? computeNBAHitRate(log.filter((g) => gameMatchesFilters(g, { ...filters, window: 'Season' })), statKey, threshold).hitRate
        : undefined

      return { playerId: p.playerId, name: p.name, teamAbbr: p.teamAbbr, hitRate, wins, losses, gamesPlayed: filtered.length, last5, seasonHitRate }
    })

  const valid = results.filter((r): r is NonNullable<typeof r> => r !== null)
  const sorted = valid.sort((a, b) => b.hitRate - a.hitRate || b.gamesPlayed - a.gamesPlayed).slice(0, limit)
  return sorted.map((r, i) => ({ rank: i + 1, ...r }))
}
