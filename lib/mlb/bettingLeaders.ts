import { isCareer, mlbLog } from '@/lib/career/logs'
import { mapWithConcurrency } from '@/lib/utils/concurrency'
import { buildGameDots, computeHitRate } from './bettingStats'
import { categoryStatKey, type PropCategory } from './bettingCategories'
import { isRollingWindow, takeLastGames } from '@/lib/leaders/lastGames'
import { gameMatchesFilters, type LeaderFilters } from './filters'
import { NOTABLE_HITTERS, NOTABLE_PITCHERS } from './notablePlayers'
import { resolvePlayerIds } from './playerLookup'
import { getMlbTeamsIndex } from './teams'

export interface BettingLeaderRow {
  rank: number
  name: string
  team: string
  hitRate: number
  wins: number
  losses: number
  gamesPlayed: number
  last5: boolean[]
  /** Hit rate over the whole season when a narrower window is selected, for the side-by-side divergence flag. */
  seasonHitRate?: number
}

/** A player must have at least this many games played this season to qualify for a betting leaderboard. */
const MIN_SEASON_GAMES = 20

/**
 * Computes a betting-stats leaderboard (hit rate vs. a threshold) for one category from the
 * notable-players pool's real game logs. Qualification (20+ games) is checked against the
 * player's total season log, not the filtered subset, so a narrow window like "Last 7" doesn't
 * disqualify otherwise-active players.
 */
export async function getBettingLeaders(
  sub: 'Hitters' | 'Pitchers',
  category: PropCategory,
  threshold: number,
  filters: LeaderFilters,
  limit = 100
): Promise<BettingLeaderRow[]> {
  const group: 'hitting' | 'pitching' = sub === 'Hitters' ? 'hitting' : 'pitching'
  const names = sub === 'Hitters' ? NOTABLE_HITTERS : NOTABLE_PITCHERS
  const statKey = categoryStatKey(category, group)

  const [resolved, teams] = await Promise.all([resolvePlayerIds(names), getMlbTeamsIndex()])

  const career = isCareer(filters.window)
  const results = await mapWithConcurrency(resolved, 8, async (p) => {
      const log = await mlbLog(p.id, group, career)
      if (!log || log.length < MIN_SEASON_GAMES) return null

      const filtered = takeLastGames(log.filter((g) => gameMatchesFilters(g, filters, teams)), filters.window, (g) => g.date)
      if (filtered.length === 0) return null

      const { hitRate, wins, losses, gamesPlayed } = computeHitRate(filtered, statKey, threshold)
      const seasonHitRate = isRollingWindow(filters.window)
        ? computeHitRate(log.filter((g) => gameMatchesFilters(g, { ...filters, window: 'Season' }, teams)), statKey, threshold).hitRate
        : undefined
      const last5 = buildGameDots(filtered, statKey, threshold, 5, teams).map((d) => d.hit)
      const teamId = filtered[filtered.length - 1]?.team.id
      return {
        name: p.fullName,
        team: teamId ? (teams?.get(teamId)?.abbr ?? '') : '',
        hitRate,
        wins,
        losses,
        gamesPlayed,
        last5,
        seasonHitRate,
      }
    })

  const valid = results.filter((r): r is NonNullable<typeof r> => r !== null)
  const sorted = valid.sort((a, b) => b.hitRate - a.hitRate || b.gamesPlayed - a.gamesPlayed).slice(0, limit)
  return sorted.map((r, i) => ({ rank: i + 1, ...r }))
}
