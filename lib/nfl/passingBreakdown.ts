import { getNFLAdvancedStats, getNFLSchedule, getNFLWeeklyPlayerStats } from './api'
import { hitRatesForThresholds, type NFLThresholdHitRate } from './bettingStats'
import { normalizeNflAbbr } from './divisions'
import { getNFLGameMatchup, getNFLQBStatsByName, type NFLQBStats } from './gameBreakdown'

function n(v: string | undefined): number {
  const parsed = Number(v)
  return Number.isFinite(parsed) ? parsed : 0
}

export const QB_PASS_YDS_THRESHOLDS = [199.5, 224.5, 249.5, 274.5, 299.5, 324.5]
export const QB_TD_THRESHOLDS = [0.5, 1.5, 2.5]
export const QB_INT_THRESHOLDS = [0.5, 1.5]
export const QB_COMP_THRESHOLDS = [19.5, 24.5, 29.5]

export interface NFLQBAdvanced {
  airYardsPerAttempt: number | null
  cpoe: number | null
  aggressiveness: number | null
  timeToThrow: number | null
  yacPerCompletion: number | null
}

export interface NFLQBBetting {
  passYds: NFLThresholdHitRate[]
  tds: NFLThresholdHitRate[]
  ints: NFLThresholdHitRate[]
  completions: NFLThresholdHitRate[]
  gamesPlayed: number
}

export interface NFLQBHomeAwaySplit {
  home: { yds: number | null; rating: number | null } | null
  away: { yds: number | null; rating: number | null } | null
}

export interface NFLPassingTabQB {
  stats: NFLQBStats | null
  advanced: NFLQBAdvanced | null
  betting: NFLQBBetting | null
  homeAway: NFLQBHomeAwaySplit
}

async function getHomeAwaySplit(playerId: string, teamAbbr: string, season: number): Promise<NFLQBHomeAwaySplit> {
  const [weekly, schedule] = await Promise.all([getNFLWeeklyPlayerStats(season), getNFLSchedule(season)])
  if (!weekly || !schedule) return { home: null, away: null }

  const games = weekly.filter((r) => r.player_id === playerId && n(r.attempts) > 0)
  const homeWeeks = new Set(
    schedule.filter((r) => r.game_type === 'REG' && normalizeNflAbbr(r.home_team) === teamAbbr).map((r) => r.week)
  )

  const homeGames = games.filter((g) => homeWeeks.has(g.week))
  const awayGames = games.filter((g) => !homeWeeks.has(g.week))

  function summarize(rows: Record<string, string>[]): { yds: number | null; rating: number | null } | null {
    if (rows.length === 0) return null
    const yds = rows.reduce((s, r) => s + n(r.passing_yards), 0) / rows.length
    return { yds: Math.round(yds * 10) / 10, rating: null }
  }

  return { home: summarize(homeGames), away: summarize(awayGames) }
}

export async function getNFLPassingTabData(gameId: string, team: 'away' | 'home'): Promise<NFLPassingTabQB | null> {
  const matchup = await getNFLGameMatchup(gameId)
  if (!matchup) return null

  const side = team === 'away' ? matchup.away : matchup.home
  if (!side.qbName || !side.qbId) return { stats: null, advanced: null, betting: null, homeAway: { home: null, away: null } }

  const [stats, ngsRows, weekly] = await Promise.all([
    getNFLQBStatsByName(side.qbName, side.abbr, matchup.season),
    getNFLAdvancedStats('passing', matchup.season),
    getNFLWeeklyPlayerStats(matchup.season),
  ])

  const ngsRow = ngsRows?.find((r) => r.player_display_name === side.qbName)
  const advanced: NFLQBAdvanced | null = ngsRow
    ? {
        airYardsPerAttempt: Number(ngsRow.avg_intended_air_yards),
        cpoe: Number(ngsRow.completion_percentage_above_expectation),
        aggressiveness: Number(ngsRow.aggressiveness),
        timeToThrow: Number(ngsRow.avg_time_to_throw),
        yacPerCompletion: null,
      }
    : null

  let betting: NFLQBBetting | null = null
  if (stats && weekly) {
    const games = weekly.filter((r) => r.player_id === stats.playerId && n(r.attempts) > 0)
    betting = {
      passYds: hitRatesForThresholds(games, 'passing_yards', QB_PASS_YDS_THRESHOLDS),
      tds: hitRatesForThresholds(games, 'passing_tds', QB_TD_THRESHOLDS),
      ints: hitRatesForThresholds(games, 'interceptions', QB_INT_THRESHOLDS),
      completions: hitRatesForThresholds(games, 'completions', QB_COMP_THRESHOLDS),
      gamesPlayed: games.length,
    }
  }

  const homeAway = stats ? await getHomeAwaySplit(stats.playerId, side.abbr, matchup.season) : { home: null, away: null }

  return { stats, advanced, betting, homeAway }
}
